/**
 * /api/chat-rest — REST API with Polling (CFX-026)
 *
 * Simplest possible chat transport: pure request/response with polling.
 * Final fallback when WebSocket, SSE, Chunked Transfer, and Long Polling all fail.
 *
 * Routes (all via POST to work with serverless auto-mount):
 *   POST /api/chat-rest
 *   Body: { action: "send"|"poll"|"result"|"cancel", ... }
 *
 * Flow:
 *   1. Client sends { action: "send", message, sessionId? }
 *      → { requestId, status: "queued", pollInterval: 1000 }
 *
 *   2. Client polls  { action: "poll", requestId }
 *      → { status: "processing"|"complete"|"error", progress?, pollInterval }
 *
 *   3. Client gets   { action: "result", requestId }
 *      → { status: "complete", result, meta }
 *
 *   4. Client cancels { action: "cancel", requestId }
 *      → { status: "cancelled" }
 *
 * Transport Chain: WebSocket → SSE → Chunked → Long Polling → REST Polling
 */

const { randomUUID } = require('crypto');
const { spawn } = require('child_process');

// ── Configuration ──
const REQUEST_TTL_MS = 10 * 60_000;   // Requests expire after 10 min
const COMPLETED_TTL_MS = 5 * 60_000;  // Completed results cached 5 min
const RATE_WINDOW_MS = 5 * 60_000;    // Rate limit window
const RATE_MAX = 20;                   // Max requests per window
const MAX_REQUESTS = 100;             // Max concurrent requests
const MAX_MESSAGE_LENGTH = 4000;       // Max message chars
const SPAWN_TIMEOUT_MS = 120_000;      // Process timeout
const CLEANUP_INTERVAL_MS = 60_000;    // Cleanup interval

// ── State ──
const requests = new Map();     // requestId → { status, message, result, ... }
const rateLimits = new Map();   // clientKey → [timestamps]
let processing = false;
const queue = [];               // requestIds waiting to be processed

// ── Cleanup timer ──
let cleanupTimer = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, req] of requests.entries()) {
      if (now > req.expiresAt) {
        if (req._process && typeof req._process.kill === 'function') {
          try { req._process.kill('SIGTERM'); } catch (_) {}
        }
        requests.delete(id);
      }
    }
    // Clean rate limit entries
    for (const [key, timestamps] of rateLimits.entries()) {
      const filtered = timestamps.filter(t => t > now - RATE_WINDOW_MS);
      if (filtered.length === 0) rateLimits.delete(key);
      else rateLimits.set(key, filtered);
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}
ensureCleanup();

// ── Rate Limiting ──
function checkRateLimit(clientKey) {
  const now = Date.now();
  let timestamps = rateLimits.get(clientKey) || [];
  timestamps = timestamps.filter(t => t > now - RATE_WINDOW_MS);

  if (timestamps.length >= RATE_MAX) {
    const resetTime = timestamps[0] + RATE_WINDOW_MS;
    return {
      allowed: false,
      retryAfter: Math.ceil((resetTime - now) / 1000),
      remaining: 0
    };
  }

  timestamps.push(now);
  rateLimits.set(clientKey, timestamps);
  return { allowed: true, remaining: RATE_MAX - timestamps.length };
}

function getClientKey(req) {
  return (req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    'unknown').toString().split(',')[0].trim();
}

// ── System Prompt ──
const SYSTEM_PROMPT = `You are Cortex, an AI business manager for freelancers. You help freelancers with:
- Rate optimization and pricing strategy
- Proposal writing and job analysis
- Client communication and red flag detection
- Revenue forecasting and income tracking
- Contract review and negotiation
- Portfolio review and professional branding
- Tax planning and business operations

You are knowledgeable about platforms like Upwork, Fiverr, and direct client work.
Be practical, actionable, and supportive. Give specific advice, not generic platitudes.
Keep responses concise but thorough. Use bullet points and structure when helpful.`;

// ── Build Prompt ──
function buildPrompt(request) {
  let prompt = '';

  if (request.profile) {
    const lines = ['<user_profile>'];
    if (request.profile.name) lines.push(`Name: ${request.profile.name}`);
    if (request.profile.title) lines.push(`Title: ${request.profile.title}`);
    if (request.profile.hourlyRate) lines.push(`Rate: $${request.profile.hourlyRate}/hr`);
    if (request.profile.skills?.length) lines.push(`Skills: ${request.profile.skills.slice(0, 15).join(', ')}`);
    if (request.profile.jobSuccessScore) lines.push(`JSS: ${request.profile.jobSuccessScore}%`);
    if (request.profile.totalEarnings) lines.push(`Earned: $${request.profile.totalEarnings}`);
    if (request.profile.country) lines.push(`Country: ${request.profile.country}`);
    lines.push('</user_profile>');
    prompt += lines.join('\n') + '\n\n';
  }

  if (request.goals) {
    const lines = ['<user_goals>'];
    if (request.goals.incomeGoal) lines.push(`Income goal: $${request.goals.incomeGoal}/mo`);
    if (request.goals.taxCountry) lines.push(`Tax country: ${request.goals.taxCountry}`);
    if (request.goals.workType) lines.push(`Work preference: ${request.goals.workType}`);
    lines.push('</user_goals>');
    prompt += lines.join('\n') + '\n\n';
  }

  const prefix = 'I need help with my freelance business: ';
  prompt += prefix + request.message.substring(0, MAX_MESSAGE_LENGTH - prefix.length);
  return prompt;
}

// ── Process Queue ──
async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    while (queue.length > 0) {
      const requestId = queue.shift();
      const request = requests.get(requestId);

      if (!request || request.status !== 'queued') continue;

      request.status = 'processing';
      request.startedAt = Date.now();

      try {
        const result = await processRequest(request);
        request.status = 'complete';
        request.result = result.result;
        request.meta = result.meta;
        request.completedAt = Date.now();
        request.expiresAt = Date.now() + COMPLETED_TTL_MS;
      } catch (error) {
        request.status = 'error';
        request.error = error.error || 'Processing failed';
        request.errorCode = error.code || 'E500';
        request.retryAfter = error.retryAfter;
        request.expiresAt = Date.now() + COMPLETED_TTL_MS;
      }
    }
  } finally {
    processing = false;
  }
}

// ── Process Single Request ──
function processRequest(request) {
  const isRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.ANTHROPIC_API_KEY);

  if (isRailway) {
    return processWithAnthropic(request);
  }
  return processWithCLI(request);
}

async function processWithAnthropic(request) {
  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch (e) {
    throw { error: 'AI service unavailable', code: 'E503', retryAfter: 30 };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(request);

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    return {
      result: response.content[0].text,
      meta: {
        model: response.model,
        usage: response.usage,
        processingTimeMs: Date.now() - request.startedAt
      }
    };
  } catch (error) {
    if (error.status === 429) throw { error: 'Rate limit reached', code: 'E429', retryAfter: 60 };
    if (error.status === 529) throw { error: 'AI busy, try again shortly', code: 'E529', retryAfter: 10 };
    if (error.status >= 500) throw { error: 'AI service temporarily unavailable', code: 'E500', retryAfter: 30 };
    throw { error: 'Processing error', code: 'E400' };
  }
}

function processWithCLI(request) {
  return new Promise((resolve, reject) => {
    const prompt = buildPrompt(request);
    const args = ['agent', '--message', prompt, '--session-id', request.sessionId, '--json', '--local'];

    const proc = spawn('openclaw', args, {
      env: { ...process.env },
      timeout: SPAWN_TIMEOUT_MS
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code !== 0 && !stdout.trim()) {
        return reject({ error: 'Cortex temporarily unavailable', code: 'E503', retryAfter: 30 });
      }

      try {
        let result = 'No response from Cortex.';
        let meta = {};
        const jsonStart = stdout.indexOf('{');
        if (jsonStart !== -1) {
          const parsed = JSON.parse(stdout.slice(jsonStart));
          const responseText = (parsed.payloads || []).map(p => p.text).filter(Boolean).join('\n\n');
          result = responseText || result;
          meta = {
            model: parsed.meta?.agentMeta?.model,
            processingTimeMs: Date.now() - request.startedAt,
            durationMs: parsed.meta?.durationMs
          };
        } else {
          result = stdout.trim() || result;
        }
        resolve({ result, meta });
      } catch (e) {
        resolve({
          result: stdout.trim() || 'No response from Cortex.',
          meta: { processingTimeMs: Date.now() - request.startedAt }
        });
      }
    });

    proc.on('error', () => {
      reject({ error: 'Cortex temporarily unavailable', code: 'E503', retryAfter: 30 });
    });

    request._process = proc;
  });
}

// ── Serverless Handler ──
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-ID');
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-Poll-Interval');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.', code: 'E405' });
  }

  const { action } = req.body || {};

  try {
    switch (action) {
      case 'send':
        return handleSend(req, res);
      case 'poll':
        return handlePoll(req, res);
      case 'result':
        return handleResult(req, res);
      case 'cancel':
        return handleCancel(req, res);
      case 'health':
        return handleHealth(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid action',
          code: 'E400',
          hint: 'Use action: "send", "poll", "result", or "cancel"',
          validActions: ['send', 'poll', 'result', 'cancel', 'health']
        });
    }
  } catch (error) {
    console.error('[REST] Handler error:', error);
    return res.status(500).json({ error: 'Internal server error', code: 'E500' });
  }
};

// ── Action Handlers ──

function handleSend(req, res) {
  const clientKey = getClientKey(req);
  const rateCheck = checkRateLimit(clientKey);

  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'E429',
      retryAfter: rateCheck.retryAfter,
      remaining: 0
    });
  }

  const { message, sessionId, profile, goals } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      error: 'Message is required',
      code: 'E400',
      hint: 'Provide a non-empty message string'
    });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)`,
      code: 'E400'
    });
  }

  if (requests.size >= MAX_REQUESTS) {
    return res.status(503).json({
      error: 'Server is busy',
      code: 'E503',
      retryAfter: 30,
      hint: 'Too many concurrent requests'
    });
  }

  const requestId = `rest_${Date.now()}_${randomUUID().slice(0, 12)}`;
  const finalSessionId = sessionId || `session_${Date.now()}_${randomUUID().slice(0, 8)}`;

  const request = {
    id: requestId,
    sessionId: finalSessionId,
    message: message.trim(),
    profile: profile || null,
    goals: goals || null,
    clientKey,
    status: 'queued',
    createdAt: Date.now(),
    expiresAt: Date.now() + REQUEST_TTL_MS
  };

  requests.set(requestId, request);
  queue.push(requestId);

  // Start processing
  processQueue();

  const position = queue.length;

  res.setHeader('X-Poll-Interval', '1000');
  return res.status(201).json({
    requestId,
    sessionId: finalSessionId,
    status: 'queued',
    position,
    estimatedWaitMs: Math.max(0, (position - 1) * 3000),
    pollInterval: position <= 1 ? 1000 : 2000,
    rateLimit: { remaining: rateCheck.remaining }
  });
}

function handlePoll(req, res) {
  const { requestId } = req.body;

  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required', code: 'E400' });
  }

  const request = requests.get(requestId);

  if (!request) {
    return res.status(404).json({
      error: 'Request not found or expired',
      code: 'E404',
      hint: 'The request may have expired (TTL: 10 min) or been cancelled'
    });
  }

  // Check expiration
  if (Date.now() > request.expiresAt && request.status === 'queued') {
    request.status = 'expired';
    return res.status(410).json({
      requestId,
      status: 'expired',
      message: 'Request expired due to timeout'
    });
  }

  const response = { requestId, status: request.status };

  switch (request.status) {
    case 'queued': {
      const pos = queue.indexOf(requestId);
      response.position = pos === -1 ? 0 : pos + 1;
      response.estimatedWaitMs = response.position * 3000;
      response.pollInterval = 2000;
      break;
    }
    case 'processing': {
      const elapsed = Date.now() - (request.startedAt || request.createdAt);
      response.progress = Math.min(elapsed / 30000, 0.95);
      response.estimatedTimeRemaining = Math.max(0, 30000 - elapsed);
      response.pollInterval = elapsed < 5000 ? 500 : elapsed < 15000 ? 1000 : 2000;
      break;
    }
    case 'complete':
      response.hasResult = true;
      response.resultLength = request.result?.length || 0;
      response.pollInterval = 60000;
      break;
    case 'error':
      response.error = request.error;
      response.errorCode = request.errorCode;
      if (request.retryAfter) response.retryAfter = request.retryAfter;
      response.pollInterval = 60000;
      break;
    case 'cancelled':
      response.message = 'Request was cancelled';
      response.pollInterval = 60000;
      break;
    case 'expired':
      response.message = 'Request expired';
      response.pollInterval = 60000;
      break;
  }

  res.setHeader('X-Poll-Interval', String(response.pollInterval || 1000));
  return res.json(response);
}

function handleResult(req, res) {
  const { requestId } = req.body;

  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required', code: 'E400' });
  }

  const request = requests.get(requestId);

  if (!request) {
    return res.status(404).json({ error: 'Request not found or expired', code: 'E404' });
  }

  if (request.status !== 'complete') {
    return res.status(409).json({
      error: `Request is "${request.status}", not complete`,
      code: 'E409',
      hint: 'Poll until status is "complete" before fetching result'
    });
  }

  return res.json({
    requestId,
    status: 'complete',
    result: request.result,
    sessionId: request.sessionId,
    meta: request.meta || {},
    completedAt: new Date(request.completedAt).toISOString()
  });
}

function handleCancel(req, res) {
  const { requestId } = req.body;

  if (!requestId) {
    return res.status(400).json({ error: 'requestId is required', code: 'E400' });
  }

  const request = requests.get(requestId);

  if (!request) {
    return res.status(404).json({ error: 'Request not found or expired', code: 'E404' });
  }

  // Remove from queue
  const idx = queue.indexOf(requestId);
  if (idx !== -1) queue.splice(idx, 1);

  // Kill process if running
  if (request._process && typeof request._process.kill === 'function') {
    try { request._process.kill('SIGTERM'); } catch (_) {}
  }

  request.status = 'cancelled';
  request.expiresAt = Date.now() + COMPLETED_TTL_MS;

  return res.json({ requestId, status: 'cancelled', message: 'Request cancelled successfully' });
}

function handleHealth(req, res) {
  let queued = 0, proc = 0, complete = 0, errored = 0;
  for (const r of requests.values()) {
    if (r.status === 'queued') queued++;
    else if (r.status === 'processing') proc++;
    else if (r.status === 'complete') complete++;
    else if (r.status === 'error') errored++;
  }

  return res.json({
    status: 'healthy',
    transport: 'rest-polling',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    queue: {
      total: requests.size,
      maxSize: MAX_REQUESTS,
      queued,
      processing: proc,
      complete,
      errored,
      queueLength: queue.length
    },
    rateLimit: {
      windowMs: RATE_WINDOW_MS,
      maxRequests: RATE_MAX,
      activeClients: rateLimits.size
    }
  });
}
