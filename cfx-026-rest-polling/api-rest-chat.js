/**
 * /api/rest-chat — REST API with Polling for Cortex Freelancer
 * 
 * Final fallback in transport chain: WebSocket → SSE → Long Polling → REST Polling
 * 
 * This is the production endpoint to be placed in projects/cortex-freelancer/api/
 * Integrates with existing shared infrastructure (Anthropic SDK, session management)
 */

const { randomUUID } = require('crypto');

// ── Configuration ──
const REQUEST_TTL_MS = 10 * 60 * 1000;   // 10 minutes
const COMPLETED_TTL_MS = 5 * 60 * 1000;  // 5 minutes  
const MAX_QUEUE_SIZE = 50;
const RATE_WINDOW_MS = 5 * 60 * 1000;    // 5 minutes
const RATE_MAX = 15;                      // 15 requests per window
const SPAWN_TIMEOUT_MS = 120_000;

// ── State ──
const requests = new Map();              // requestId → request object
const queue = [];                        // Array of request IDs in FIFO order
const rateLimitMap = new Map();         // clientKey → { start, count }
let processing = false;

// ── Helpers ──

function getRateLimitKey(req) {
  return (req.headers['x-forwarded-for'] || 
          req.headers['x-real-ip'] || 
          req.connection.remoteAddress || 
          'unknown').split(',')[0].trim();
}

function checkRateLimit(key) {
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    entry = { start: now, count: 0 };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  return entry.count <= RATE_MAX;
}

function buildProfileContext(profile, goals) {
  const lines = [];
  if (profile && !profile._skipped) {
    lines.push('<user_profile>');
    if (profile.name) lines.push('Name: ' + profile.name);
    if (profile.title) lines.push('Title: ' + profile.title);
    if (profile.hourlyRate) lines.push('Rate: $' + profile.hourlyRate + '/hr');
    if (profile.skills && profile.skills.length) lines.push('Skills: ' + profile.skills.slice(0, 15).join(', '));
    if (profile.jobSuccessScore) lines.push('JSS: ' + profile.jobSuccessScore + '%');
    if (profile.totalEarnings) lines.push('Earned: $' + profile.totalEarnings);
    if (profile.country) lines.push('Country: ' + profile.country);
    lines.push('</user_profile>');
  }
  if (goals) {
    lines.push('<user_goals>');
    if (goals.incomeGoal) lines.push('Income goal: $' + goals.incomeGoal + '/mo');
    if (goals.taxCountry) lines.push('Tax country: ' + goals.taxCountry);
    if (goals.workType) lines.push('Work preference: ' + goals.workType);
    lines.push('</user_goals>');
  }
  return lines.length > 0 ? lines.join('\\n') : '';
}

function buildPrompt(message, profile, goals) {
  let prompt = '';
  const profileCtx = buildProfileContext(profile, goals);
  if (profileCtx) prompt += profileCtx + '\\n\\n';
  
  const freelancerContext = 'I need help with my freelance business: ';
  prompt += freelancerContext + message.trim().substring(0, 4000 - freelancerContext.length);
  return prompt;
}

// ── Processing ──

async function processMessage(requestId, prompt, sessionId) {
  const request = requests.get(requestId);
  if (!request) return;

  request.status = 'processing';
  request.startedAt = Date.now();

  // Determine processing mode (Railway vs Local)
  const isRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.ANTHROPIC_API_KEY);

  try {
    if (isRailway) {
      await processWithAnthropic(request, prompt, sessionId);
    } else {
      await processWithCLI(request, prompt, sessionId);
    }
  } catch (error) {
    console.error('[rest-chat] Processing error:', error);
    request.status = 'error';
    request.error = error.message || 'Processing failed';
    request.errorCode = error.code || 'E500';
    request.retryAfter = error.retryAfter;
  }

  processing = false;
  processQueue(); // Process next in queue
}

async function processWithAnthropic(request, prompt, sessionId) {
  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch (e) {
    throw { message: 'AI service unavailable', code: 'E503', retryAfter: 30 };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemPrompt = `You are Cortex, an AI business manager for freelancers. You help freelancers with:
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

  const abortController = new AbortController();
  request._abort = abortController;

  const timeout = setTimeout(() => {
    abortController.abort();
    if (request.status === 'processing') {
      request.status = 'error';
      request.error = 'Request timed out';
      request.errorCode = 'E408';
    }
  }, SPAWN_TIMEOUT_MS);

  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    clearTimeout(timeout);
    
    if (request.status === 'processing') {
      request.status = 'complete';
      request.result = response.content[0].text;
      request.completedAt = Date.now();
      request.meta = {
        model: response.model,
        usage: response.usage,
        processingTimeMs: Date.now() - request.startedAt
      };
      request.expiresAt = Date.now() + COMPLETED_TTL_MS;
    }
  } catch (error) {
    clearTimeout(timeout);
    throw {
      message: error.status === 529 ? 'AI service is busy. Try again shortly.'
        : error.status === 429 ? 'Rate limit reached. Please wait.'
        : error.status >= 500 ? 'AI service temporarily unavailable.'
        : 'An error occurred while processing your request.',
      code: error.status === 429 ? 'E429' : error.status >= 500 ? 'E503' : 'E400',
      retryAfter: error.status === 429 ? 60 : error.status === 529 ? 10 : null
    };
  }
}

async function processWithCLI(request, prompt, sessionId) {
  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    const args = ['agent', '--message', prompt, '--session-id', sessionId, '--json', '--local'];
    const proc = spawn('openclaw', args, { env: { ...process.env } });

    let stdout = '';
    let finished = false;

    const killTimer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { proc.kill('SIGTERM'); } catch (_) {}
        reject({ message: 'Request timed out', code: 'E408' });
      }
    }, SPAWN_TIMEOUT_MS);

    request._kill = () => {
      if (!finished) {
        finished = true;
        clearTimeout(killTimer);
        try { proc.kill('SIGTERM'); } catch (_) {}
      }
    };

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      console.error('[rest-chat stderr]', data.toString());
    });

    proc.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);

      try {
        let result = 'No response from Cortex.';
        let meta = { processingTimeMs: Date.now() - request.startedAt };

        if (code === 0 && stdout.trim()) {
          const jsonStart = stdout.indexOf('{');
          if (jsonStart !== -1) {
            const parsed = JSON.parse(stdout.slice(jsonStart));
            const responseText = (parsed.payloads || [])
              .map(p => p.text)
              .filter(Boolean)
              .join('\\n\\n');
            result = responseText || result;
            meta = {
              model: parsed.meta?.agentMeta?.model,
              processingTimeMs: Date.now() - request.startedAt,
              durationMs: parsed.meta?.durationMs
            };
          } else {
            result = stdout.trim();
          }
        }

        request.status = 'complete';
        request.result = result;
        request.completedAt = Date.now();
        request.meta = meta;
        request.expiresAt = Date.now() + COMPLETED_TTL_MS;
        
        resolve();
      } catch (e) {
        reject({ message: 'Failed to parse response', code: 'E500' });
      }
    });

    proc.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(killTimer);
      reject({ message: 'Cortex is temporarily unavailable', code: 'E503', retryAfter: 30 });
    });
  });
}

function processQueue() {
  if (processing || queue.length === 0) return;
  
  const requestId = queue.shift();
  const request = requests.get(requestId);
  
  if (!request || request.status !== 'queued') {
    processQueue(); // Try next
    return;
  }
  
  processing = true;
  const prompt = buildPrompt(request.message, request.profile, request.goals);
  processMessage(requestId, prompt, request.sessionId);
}

// ── Route Handlers ──

async function handleSubmit(req, res) {
  const clientKey = getRateLimitKey(req);
  if (!checkRateLimit(clientKey)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'E429',
      retryAfter: 60
    });
  }

  const { message, sessionId, profile, goals } = req.body || {};
  
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      error: 'Message is required',
      code: 'E400'
    });
  }

  if (message.length > 4000) {
    return res.status(400).json({
      error: 'Message too long. Keep under 4000 characters.',
      code: 'E400'
    });
  }

  if (requests.size >= MAX_QUEUE_SIZE) {
    return res.status(503).json({
      error: 'Server is busy. Please try again shortly.',
      code: 'E503',
      retryAfter: 30
    });
  }

  const requestId = `req_${Date.now()}_${randomUUID().slice(0, 12)}`;
  const finalSessionId = sessionId || `session_${Date.now()}_${randomUUID().slice(0, 8)}`;
  
  const request = {
    id: requestId,
    sessionId: finalSessionId,
    message: message.trim(),
    profile,
    goals,
    clientKey,
    status: 'queued',
    createdAt: Date.now(),
    expiresAt: Date.now() + REQUEST_TTL_MS
  };

  requests.set(requestId, request);
  queue.push(requestId);

  // Start processing if not busy
  processQueue();

  const position = queue.length;
  res.setHeader('X-Poll-Interval', position === 0 ? '1000' : '2000');
  
  res.status(201).json({
    requestId,
    sessionId: finalSessionId,
    status: 'queued',
    position,
    estimatedWaitMs: Math.max(0, (position - 1) * 2000),
    pollInterval: position === 0 ? 1000 : 2000
  });
}

async function handlePollStatus(req, res) {
  const requestId = req.params.id;
  const request = requests.get(requestId);

  if (!request || Date.now() > request.expiresAt) {
    if (request) requests.delete(requestId);
    return res.status(404).json({
      error: 'Request not found or expired',
      code: 'E404'
    });
  }

  const response = {
    requestId,
    status: request.status
  };

  let pollInterval = 1000;

  switch (request.status) {
    case 'queued':
      const position = queue.indexOf(requestId) + 1;
      response.position = position;
      response.estimatedWaitMs = Math.max(0, (position - 1) * 2000);
      pollInterval = 2000;
      break;

    case 'processing':
      if (request.startedAt) {
        const elapsed = Date.now() - request.startedAt;
        response.progress = Math.min(elapsed / 30000, 0.95);
        response.estimatedTimeRemaining = Math.max(0, 30000 - elapsed);
      }
      pollInterval = 1000;
      break;

    case 'complete':
      response.hasResult = true;
      response.resultLength = request.result?.length || 0;
      if (request.meta) response.meta = request.meta;
      pollInterval = 60000; // No need to poll completed requests
      break;

    case 'error':
      response.error = request.error;
      response.code = request.errorCode;
      if (request.retryAfter) response.retryAfter = request.retryAfter;
      pollInterval = 60000;
      break;
  }

  response.pollInterval = pollInterval;
  res.setHeader('X-Poll-Interval', pollInterval.toString());
  res.json(response);
}

async function handleGetResult(req, res) {
  const requestId = req.params.id;
  const request = requests.get(requestId);

  if (!request || Date.now() > request.expiresAt) {
    if (request) requests.delete(requestId);
    return res.status(404).json({
      error: 'Request not found or expired',
      code: 'E404'
    });
  }

  if (request.status !== 'complete') {
    return res.status(409).json({
      error: `Request is ${request.status}, not complete`,
      code: 'E409'
    });
  }

  res.json({
    requestId,
    status: 'complete',
    result: request.result,
    sessionId: request.sessionId,
    meta: request.meta || {},
    completedAt: new Date(request.completedAt).toISOString()
  });
}

async function handleCancel(req, res) {
  const requestId = req.params.id;
  const request = requests.get(requestId);

  if (!request) {
    return res.status(404).json({
      error: 'Request not found or expired',
      code: 'E404'
    });
  }

  // Remove from queue
  const queueIndex = queue.indexOf(requestId);
  if (queueIndex !== -1) {
    queue.splice(queueIndex, 1);
  }

  // Cancel any running process
  if (request._kill) request._kill();
  if (request._abort) request._abort.abort();

  request.status = 'cancelled';
  
  res.json({
    requestId,
    status: 'cancelled',
    message: 'Request cancelled successfully'
  });
}

// ── Main Handler ──

module.exports = function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-ID');
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-Poll-Interval');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = req.url.replace(/\\?.*/, ''); // Remove query params
  
  try {
    if (req.method === 'POST' && path === '/api/rest-chat') {
      return handleSubmit(req, res);
    } else if (req.method === 'GET' && path.startsWith('/api/rest-chat/')) {
      const segments = path.split('/');
      const requestId = segments[3];
      
      if (!requestId) {
        return res.status(400).json({ error: 'Request ID required', code: 'E400' });
      }
      
      if (segments[4] === 'result') {
        return handleGetResult(req, res);
      } else {
        return handlePollStatus(req, res);
      }
    } else if (req.method === 'DELETE' && path.startsWith('/api/rest-chat/')) {
      const requestId = path.split('/')[3];
      if (!requestId) {
        return res.status(400).json({ error: 'Request ID required', code: 'E400' });
      }
      return handleCancel(req, res);
    }
    
    return res.status(404).json({ error: 'Not found', code: 'E404' });
  } catch (error) {
    console.error('[rest-chat] Handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'E500'
    });
  }
};

// ── Cleanup ──
setInterval(() => {
  const now = Date.now();
  
  // Clean expired requests
  for (const [requestId, request] of requests) {
    if (now > request.expiresAt) {
      // Remove from queue
      const queueIndex = queue.indexOf(requestId);
      if (queueIndex !== -1) queue.splice(queueIndex, 1);
      
      // Cancel any running process
      if (request._kill) request._kill();
      if (request._abort) request._abort.abort();
      
      requests.delete(requestId);
    }
  }
  
  // Clean old rate limit entries
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > RATE_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000).unref();