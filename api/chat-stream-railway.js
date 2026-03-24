/**
 * /api/chat-stream — SSE streaming endpoint (Railway Production Edition)
 * Uses Anthropic SDK directly instead of spawning OpenClaw CLI.
 * True token-by-token streaming via Anthropic streaming API.
 *
 * CFX-021: Server-Sent Events implementation
 * CFX-005: Connection health monitoring
 * CFX-007: Structured error codes
 * CFX-009: Mobile network optimization
 */

const Anthropic = require('@anthropic-ai/sdk');
const { randomUUID } = require('crypto');
const os = require('os');

// ─── Anthropic Client ───
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[chat-stream-railway] ANTHROPIC_API_KEY not set');
      return null;
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ─── System Prompt ───
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
Keep responses concise but thorough. Use bullet points and structure when helpful.
If the user has shared their profile info, reference it to give personalized advice.`;

// CFX-042: chat message rate limiting (token buckets)
const { checkAndConsume, applyRateLimitHeaders } = require('../src/rate-limit/server-middleware');

// ─── Session History ───
const sessionHistory = new Map();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_HISTORY = 20;

// ─── Connection Tracking (CFX-005) ───
const activeConnections = new Map();
let activeStreamCount = 0;
const MAX_CONCURRENT_STREAMS = 5;

const sseMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  totalMessages: 0,
  totalTokens: { input: 0, output: 0 },
  errors: { byCode: {}, total: 0 },
  avgResponseMs: 0,
  _responseTimes: [],
  startedAt: Date.now(),
};

// ─── Configuration ───
const API_TIMEOUT_MS = parseInt(process.env.ANTHROPIC_TIMEOUT_MS, 10) || 120_000;
const KEEPALIVE_INTERVAL_MS = parseInt(process.env.SSE_KEEPALIVE_MS, 10) || 15_000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const MAX_TOKENS = parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10) || 2048;

// ─── Error Codes (CFX-007) ───
const SSE_ERRORS = {
  RATE_LIMITED:       { code: 'S300', message: 'Too many requests. Try again in a few minutes.', retryAfter: 60 },
  CONCURRENT_LIMIT:  { code: 'S301', message: 'Server is busy. Please wait a moment.', retryAfter: 5 },
  INVALID_MESSAGE:   { code: 'S400', message: 'Message is required.' },
  INVALID_METHOD:    { code: 'S401', message: 'POST only.' },
  MESSAGE_TOO_LONG:  { code: 'S402', message: 'Message too long. Keep under 4000 characters.' },
  API_UNAVAILABLE:   { code: 'S500', message: 'AI service temporarily unavailable.' },
  API_TIMEOUT:       { code: 'S501', message: 'AI response timed out. Try a shorter message.' },
  API_OVERLOADED:    { code: 'S502', message: 'AI service is busy. Please wait and try again.', retryAfter: 30 },
  RESOURCE_EXHAUSTED:{ code: 'S503', message: 'Server resources limited. Try again shortly.', retryAfter: 30 },
  NO_API_KEY:        { code: 'S504', message: 'AI service not configured.' },
};

// ─── Helpers ───
function sseLog(level, msg, meta = {}) {
  const entry = { ts: new Date().toISOString(), ctx: 'sse-railway', level, msg, ...meta };
  if (level === 'error' || level === 'critical') console.error('[chat-stream-railway]', JSON.stringify(entry));
  else if (level === 'warn') console.warn('[chat-stream-railway]', JSON.stringify(entry));
  else console.log('[chat-stream-railway]', JSON.stringify(entry));
}

function recordError(errorDef) {
  sseMetrics.errors.total++;
  sseMetrics.errors.byCode[errorDef.code] = (sseMetrics.errors.byCode[errorDef.code] || 0) + 1;
}

function recordResponseTime(ms) {
  sseMetrics._responseTimes.push(ms);
  if (sseMetrics._responseTimes.length > 100) sseMetrics._responseTimes.shift();
  const sum = sseMetrics._responseTimes.reduce((a, b) => a + b, 0);
  sseMetrics.avgResponseMs = Math.round(sum / sseMetrics._responseTimes.length);
}

function checkResourceHealth() {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const memUsageRatio = 1 - (freeMem / totalMem);
  const loadAvg = os.loadavg()[0];
  const cpuCount = os.cpus().length;
  const loadRatio = loadAvg / cpuCount;
  return {
    memUsageRatio, loadRatio,
    isExhausted: memUsageRatio > 0.95 || loadRatio > 3.0,
  };
}

function getRateLimitKey(req) {
  return (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}


function getOrCreateSession(sid) {
  if (sessionHistory.has(sid)) {
    const s = sessionHistory.get(sid);
    if (Date.now() - s.lastActivity < SESSION_TIMEOUT_MS) {
      s.lastActivity = Date.now();
      return s;
    }
    sessionHistory.delete(sid);
  }
  const s = { messages: [], lastActivity: Date.now() };
  sessionHistory.set(sid, s);
  return s;
}

function appendToSession(sid, role, content) {
  const s = sessionHistory.get(sid);
  if (!s) return;
  s.messages.push({ role, content });
  if (s.messages.length > MAX_HISTORY) {
    s.messages = s.messages.slice(-MAX_HISTORY);
  }
  s.lastActivity = Date.now();
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
  return lines.length > 0 ? lines.join('\n') : '';
}

function buildMessages(message, session, profile, goals) {
  const messages = [];
  const profileCtx = buildProfileContext(profile, goals);

  // Add conversation history
  const history = session.messages.slice(0, -1); // Exclude current message (already appended)
  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Build current user message with profile context
  let userContent = '';
  if (profileCtx) userContent += profileCtx + '\n\n';
  userContent += message.trim();
  messages.push({ role: 'user', content: userContent });

  return messages;
}

function sseWrite(res, event, data) {
  if (res.writableEnded) return false;
  try {
    res.write('event: ' + event + '\n');
    res.write('data: ' + JSON.stringify(data) + '\n\n');
    return true;
  } catch (e) {
    return false;
  }
}

function sseKeepalive(res) {
  if (res.writableEnded) return false;
  try {
    res.write(': keepalive ' + Date.now() + '\n\n');
    return true;
  } catch (e) {
    return false;
  }
}

// ─── Main Handler ───
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET → SSE health/info
  if (req.method === 'GET') {
    return res.json({
      service: 'cortex-sse',
      status: activeStreamCount >= MAX_CONCURRENT_STREAMS ? 'busy' : 'ready',
      mode: 'railway',
      model: MODEL,
      connections: {
        active: sseMetrics.activeConnections,
        total: sseMetrics.totalConnections,
        streaming: activeStreamCount,
        maxConcurrent: MAX_CONCURRENT_STREAMS,
      },
      performance: {
        avgResponseMs: sseMetrics.avgResponseMs,
        totalMessages: sseMetrics.totalMessages,
        totalTokens: sseMetrics.totalTokens,
      },
      errors: sseMetrics.errors,
      uptime: Math.round((Date.now() - sseMetrics.startedAt) / 1000),
      activeSessions: sessionHistory.size,
    });
  }

  if (req.method !== 'POST') {
    recordError(SSE_ERRORS.INVALID_METHOD);
    return res.status(405).json({ error: SSE_ERRORS.INVALID_METHOD.message, code: SSE_ERRORS.INVALID_METHOD.code });
  }

  // Resource check
  const health = checkResourceHealth();
  if (health.isExhausted) {
    recordError(SSE_ERRORS.RESOURCE_EXHAUSTED);
    return res.status(503).json({ error: SSE_ERRORS.RESOURCE_EXHAUSTED.message, code: SSE_ERRORS.RESOURCE_EXHAUSTED.code, retryAfter: 30 });
  }

  // CFX-042: message rate limit (per sessionId, fallback IP)
  const rlKey = getRateLimitKey(req);
  const rlInfo = checkAndConsume(req);
  applyRateLimitHeaders(res, rlInfo);
  if (!rlInfo.allowed) {
    recordError(SSE_ERRORS.RATE_LIMITED);
    return res.status(429).json({
      error: SSE_ERRORS.RATE_LIMITED.message,
      code: SSE_ERRORS.RATE_LIMITED.code,
      retryAfter: rlInfo.retryAfterSec || 60,
      resetAt: rlInfo.resetAtSec,
      remaining: rlInfo.remaining,
    });
  }

  // Concurrent stream limit
  if (activeStreamCount >= MAX_CONCURRENT_STREAMS) {
    recordError(SSE_ERRORS.CONCURRENT_LIMIT);
    return res.status(429).json({ error: SSE_ERRORS.CONCURRENT_LIMIT.message, code: SSE_ERRORS.CONCURRENT_LIMIT.code, retryAfter: 5 });
  }

  // Validate Anthropic client
  const client = getAnthropicClient();
  if (!client) {
    recordError(SSE_ERRORS.NO_API_KEY);
    return res.status(503).json({ error: SSE_ERRORS.NO_API_KEY.message, code: SSE_ERRORS.NO_API_KEY.code });
  }

  const { message, sessionId, profile, goals } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    recordError(SSE_ERRORS.INVALID_MESSAGE);
    return res.status(400).json({ error: SSE_ERRORS.INVALID_MESSAGE.message, code: SSE_ERRORS.INVALID_MESSAGE.code });
  }
  if (message.length > 4000) {
    recordError(SSE_ERRORS.MESSAGE_TOO_LONG);
    return res.status(400).json({ error: SSE_ERRORS.MESSAGE_TOO_LONG.message, code: SSE_ERRORS.MESSAGE_TOO_LONG.code });
  }

  const sid = sessionId || 'ctx-' + randomUUID().slice(0, 8);
  const session = getOrCreateSession(sid);
  appendToSession(sid, 'user', message.trim());

  const apiMessages = buildMessages(message, session, profile, goals);
  const connId = 'sse-' + randomUUID().slice(0, 8);
  const startTime = Date.now();

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-SSE-Connection-Id': connId,
  });

  // Track connection
  activeStreamCount++;
  sseMetrics.totalConnections++;
  sseMetrics.activeConnections++;
  activeConnections.set(connId, {
    id: connId,
    sessionId: sid,
    ip: rlKey,
    connectedAt: startTime,
    state: 'streaming',
  });

  sseWrite(res, 'stream_start', { sessionId: sid, connectionId: connId });

  let finished = false;
  let fullText = '';
  let chunkIndex = 0;

  // Keepalive timer
  const keepaliveTimer = setInterval(() => {
    if (!finished) sseKeepalive(res);
  }, KEEPALIVE_INTERVAL_MS);

  // API timeout
  const timeoutTimer = setTimeout(() => {
    if (!finished) {
      finish('error', { error: SSE_ERRORS.API_TIMEOUT.message, code: SSE_ERRORS.API_TIMEOUT.code });
    }
  }, API_TIMEOUT_MS);

  function finish(event, data) {
    if (finished) return;
    finished = true;
    clearTimeout(timeoutTimer);
    clearInterval(keepaliveTimer);
    activeStreamCount = Math.max(0, activeStreamCount - 1);
    sseMetrics.activeConnections = Math.max(0, sseMetrics.activeConnections - 1);
    activeConnections.delete(connId);

    const duration = Date.now() - startTime;
    if (event === 'stream_end') {
      sseMetrics.totalMessages++;
      recordResponseTime(duration);
      sseLog('info', 'Stream completed', { connId, sid, durationMs: duration, tokens: data.meta?.tokens });
    } else {
      recordError(data.code ? { code: data.code } : SSE_ERRORS.API_UNAVAILABLE);
    }

    sseWrite(res, event, data);
    sseWrite(res, 'done', { durationMs: duration });
    res.end();
  }

  // Client disconnect
  req.on('close', () => {
    if (!finished) {
      sseLog('info', 'Client disconnected', { connId, sid });
      finished = true;
      clearTimeout(timeoutTimer);
      clearInterval(keepaliveTimer);
      activeStreamCount = Math.max(0, activeStreamCount - 1);
      sseMetrics.activeConnections = Math.max(0, sseMetrics.activeConnections - 1);
      activeConnections.delete(connId);
    }
  });

  // Stream from Anthropic
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    stream.on('text', (text) => {
      if (finished) return;
      fullText += text;
      sseWrite(res, 'stream_chunk', { chunk: text, index: chunkIndex++ });
    });

    stream.on('error', (err) => {
      if (finished) return;
      sseLog('error', 'Anthropic stream error', { connId, error: err.message });

      if (err.status === 529 || err.message?.includes('overloaded')) {
        finish('error', { error: SSE_ERRORS.API_OVERLOADED.message, code: SSE_ERRORS.API_OVERLOADED.code, retryAfter: 30 });
      } else if (err.status === 429) {
        finish('error', { error: SSE_ERRORS.RATE_LIMITED.message, code: SSE_ERRORS.RATE_LIMITED.code, retryAfter: 60 });
      } else {
        finish('error', { error: SSE_ERRORS.API_UNAVAILABLE.message, code: SSE_ERRORS.API_UNAVAILABLE.code });
      }
    });

    const finalMessage = await stream.finalMessage();

    if (!finished) {
      const usage = finalMessage.usage || {};
      sseMetrics.totalTokens.input += usage.input_tokens || 0;
      sseMetrics.totalTokens.output += usage.output_tokens || 0;

      appendToSession(sid, 'assistant', fullText);
      finish('stream_end', {
        reply: fullText,
        sessionId: sid,
        meta: {
          model: finalMessage.model,
          tokens: { input: usage.input_tokens, output: usage.output_tokens },
          stopReason: finalMessage.stop_reason,
        },
      });
    }
  } catch (err) {
    if (!finished) {
      sseLog('error', 'Anthropic API error', { connId, error: err.message, status: err.status });

      if (err.status === 529 || err.message?.includes('overloaded')) {
        finish('error', { error: SSE_ERRORS.API_OVERLOADED.message, code: SSE_ERRORS.API_OVERLOADED.code, retryAfter: 30 });
      } else {
        finish('error', { error: SSE_ERRORS.API_UNAVAILABLE.message, code: SSE_ERRORS.API_UNAVAILABLE.code });
      }
    }
  }
};

// Export metrics
module.exports.getSSEMetrics = function () {
  return {
    ...sseMetrics,
    _responseTimes: undefined,
    activeConnectionDetails: Array.from(activeConnections.values()).map(c => ({
      id: c.id,
      sessionId: c.sessionId,
      state: c.state,
      connectedSec: Math.round((Date.now() - c.connectedAt) / 1000),
    })),
  };
};

// Cleanup
setInterval(() => {
  const now = Date.now();
  for (const [sid, s] of sessionHistory) {
    if (now - s.lastActivity >= SESSION_TIMEOUT_MS) sessionHistory.delete(sid);
  }
}, 5 * 60 * 1000).unref();
