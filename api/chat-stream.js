/**
 * /api/chat-stream — SSE streaming endpoint for chat responses
 * Fallback when WebSocket is unavailable (proxy issues, timeouts).
 * Streams token-by-token via Server-Sent Events.
 *
 * CFX-021: Server-Sent Events implementation
 * CFX-005: Connection health monitoring integration
 * CFX-007: Structured error codes
 * CFX-009: Mobile network optimization
 *
 * Modes:
 *   - Local: spawns openclaw CLI (requires local gateway)
 *   - Railway: uses Anthropic SDK directly (via chat-stream-railway.js)
 */

const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const os = require('os');

// CFX-042: chat message rate limiting (token buckets)
const { checkAndConsume, applyRateLimitHeaders } = require('../src/rate-limit/server-middleware');

// ─── Session History (CFX-041) ───
const { createServerSessionStore } = require('../src/session/server-session-store');
const sessionStore = global.__cfx041SessionStore || (global.__cfx041SessionStore = createServerSessionStore({
  timeoutMs: process.env.CORTEX_SESSION_TIMEOUT_MS ? Number(process.env.CORTEX_SESSION_TIMEOUT_MS) : undefined,
  maxHistory: 20,
}));

// ─── Connection Tracking (CFX-005) ───
const activeConnections = new Map();
const sseMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  totalMessages: 0,
  errors: { byCode: {}, total: 0 },
  avgResponseMs: 0,
  _responseTimes: [],
  startedAt: Date.now(),
};

// ─── Concurrency Control ───
let busy = false;
const SPAWN_TIMEOUT_MS = 120_000;
const KEEPALIVE_INTERVAL_MS = 15_000; // Send keepalive every 15s during processing

// ─── Error Codes (CFX-007) ───
const SSE_ERRORS = {
  RATE_LIMITED:       { code: 'S300', message: 'Too many requests. Try again in a few minutes.', retryAfter: 60 },
  BUSY:              { code: 'S301', message: 'Cortex is processing another request. Please wait.', retryAfter: 5 },
  INVALID_MESSAGE:   { code: 'S400', message: 'Message is required.' },
  INVALID_METHOD:    { code: 'S401', message: 'POST only.' },
  MESSAGE_TOO_LONG:  { code: 'S402', message: 'Message too long. Keep under 4000 characters.' },
  SPAWN_ERROR:       { code: 'S500', message: 'Cortex is temporarily unavailable.' },
  TIMEOUT:           { code: 'S501', message: 'Request timed out. Try a shorter message.' },
  RESOURCE_EXHAUSTED:{ code: 'S502', message: 'Server resources limited. Try again shortly.', retryAfter: 30 },
};

// ─── Structured Logging ───
function sseLog(level, msg, meta = {}) {
  const entry = { ts: new Date().toISOString(), ctx: 'sse', level, msg, ...meta };
  if (level === 'error' || level === 'critical') console.error('[chat-stream]', JSON.stringify(entry));
  else if (level === 'warn') console.warn('[chat-stream]', JSON.stringify(entry));
  else console.log('[chat-stream]', JSON.stringify(entry));
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

// ─── Resource Health Check (CFX-005) ───
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
    isDegraded: memUsageRatio > 0.85 || loadRatio > 2.0,
  };
}

// ─── Client identity (for logs) ───
function getRateLimitKey(req) {
  return (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}

// ─── Session Management ───
function getOrCreateSession(sid) {
  return sessionStore.getOrCreate(sid);
}

function appendToSession(sid, role, content) {
  sessionStore.append(sid, role, content);
}

// ─── Profile Context Builder ───
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

function buildPrompt(message, session, profile, goals) {
  let prompt = '';
  const profileCtx = buildProfileContext(profile, goals);
  if (profileCtx) prompt += profileCtx + '\n\n';

  const historyMessages = session.messages.slice(0, -1);
  if (historyMessages.length > 0) {
    const contextBlock = historyMessages
      .map(m => '[' + m.role + ']: ' + m.content)
      .join('\n');
    prompt += '<conversation_history>\n' + contextBlock + '\n</conversation_history>\n\n';
  }

  const freelancerContext = 'I need help with my freelance business: ';
  prompt += freelancerContext + message.trim().substring(0, 4000 - freelancerContext.length);
  return prompt;
}

/**
 * Write an SSE event to the response.
 * SSE format: event: <name>\ndata: <json>\n\n
 */
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

/**
 * Send SSE comment (keepalive) — invisible to EventSource parser
 * but keeps the connection alive through proxies.
 */
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
module.exports = function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/chat-stream → SSE health/info endpoint
  if (req.method === 'GET') {
    return res.json({
      service: 'cortex-sse',
      status: busy ? 'busy' : 'ready',
      mode: 'local',
      connections: {
        active: sseMetrics.activeConnections,
        total: sseMetrics.totalConnections,
      },
      performance: {
        avgResponseMs: sseMetrics.avgResponseMs,
        totalMessages: sseMetrics.totalMessages,
      },
      errors: sseMetrics.errors,
      uptime: Math.round((Date.now() - sseMetrics.startedAt) / 1000),
      activeSessions: sessionStore.stats().activeSessions,
    });
  }

  if (req.method !== 'POST') {
    recordError(SSE_ERRORS.INVALID_METHOD);
    return res.status(405).json({ error: SSE_ERRORS.INVALID_METHOD.message, code: SSE_ERRORS.INVALID_METHOD.code });
  }

  // Resource health check (CFX-005)
  const health = checkResourceHealth();
  if (health.isExhausted) {
    recordError(SSE_ERRORS.RESOURCE_EXHAUSTED);
    sseLog('warn', 'Resource exhaustion detected', { mem: health.memUsageRatio, load: health.loadRatio });
    return res.status(503).json({
      error: SSE_ERRORS.RESOURCE_EXHAUSTED.message,
      code: SSE_ERRORS.RESOURCE_EXHAUSTED.code,
      retryAfter: SSE_ERRORS.RESOURCE_EXHAUSTED.retryAfter,
    });
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
      retryAfter: rlInfo.retryAfterSec || SSE_ERRORS.RATE_LIMITED.retryAfter,
      resetAt: rlInfo.resetAtSec,
      remaining: rlInfo.remaining,
    });
  }

  if (busy) {
    recordError(SSE_ERRORS.BUSY);
    return res.status(429).json({
      error: SSE_ERRORS.BUSY.message,
      code: SSE_ERRORS.BUSY.code,
      retryAfter: SSE_ERRORS.BUSY.retryAfter,
    });
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

  const prompt = buildPrompt(message, session, profile, goals);
  const connId = 'sse-' + randomUUID().slice(0, 8);
  const startTime = Date.now();

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',       // Disable nginx buffering
    'X-SSE-Connection-Id': connId,
  });

  // Track connection (CFX-005)
  sseMetrics.totalConnections++;
  sseMetrics.activeConnections++;
  activeConnections.set(connId, {
    id: connId,
    sessionId: sid,
    ip: rlKey,
    connectedAt: startTime,
    lastActivity: startTime,
    state: 'streaming',
  });

  // Send stream_start
  sseWrite(res, 'stream_start', { sessionId: sid, connectionId: connId });

  busy = true;
  let finished = false;
  let stdout = '';
  let chunkIndex = 0;

  // Keepalive timer — keeps proxies from closing the connection (CFX-009)
  const keepaliveTimer = setInterval(() => {
    if (!finished) {
      sseKeepalive(res);
      const conn = activeConnections.get(connId);
      if (conn) conn.lastActivity = Date.now();
    }
  }, KEEPALIVE_INTERVAL_MS);

  const args = [
    'agent',
    '--message', prompt,
    '--session-id', sid,
    '--json',
    '--local'
  ];

  const proc = spawn('openclaw', args, { env: { ...process.env } });

  // Manual timeout
  const killTimer = setTimeout(() => {
    if (!finished) {
      sseLog('warn', 'openclaw timed out, killing', { connId, sid });
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 5000);
      finish('error', { error: SSE_ERRORS.TIMEOUT.message, code: SSE_ERRORS.TIMEOUT.code });
    }
  }, SPAWN_TIMEOUT_MS);

  function finish(event, data) {
    if (finished) return;
    finished = true;
    clearTimeout(killTimer);
    clearInterval(keepaliveTimer);
    busy = false;

    // Record metrics
    const duration = Date.now() - startTime;
    if (event === 'stream_end') {
      sseMetrics.totalMessages++;
      recordResponseTime(duration);
      sseLog('info', 'Stream completed', { connId, sid, durationMs: duration });
    } else if (event === 'error') {
      recordError(data.code ? { code: data.code } : SSE_ERRORS.SPAWN_ERROR);
      sseLog('warn', 'Stream error', { connId, sid, error: data.error, durationMs: duration });
    }

    // Cleanup connection tracking
    sseMetrics.activeConnections = Math.max(0, sseMetrics.activeConnections - 1);
    activeConnections.delete(connId);

    sseWrite(res, event, data);
    sseWrite(res, 'done', { durationMs: duration });
    res.end();
  }

  proc.stdout.on('data', (data) => {
    const chunk = data.toString();
    stdout += chunk;
    if (!finished) {
      sseWrite(res, 'stream_chunk', { chunk, index: chunkIndex++ });
    }
  });

  proc.stderr.on('data', (data) => {
    sseLog('debug', 'stderr', { connId, output: data.toString().trim() });
  });

  proc.on('close', (code) => {
    if (finished) return;

    if (code !== 0 && !stdout.trim()) {
      finish('error', { error: SSE_ERRORS.SPAWN_ERROR.message, code: SSE_ERRORS.SPAWN_ERROR.code });
      return;
    }

    // Parse final response
    let text = 'No response from Cortex.';
    let meta = {};
    try {
      const jsonStart = stdout.indexOf('{');
      if (jsonStart !== -1) {
        const parsed = JSON.parse(stdout.slice(jsonStart));
        const responseText = (parsed.payloads || [])
          .map(p => p.text)
          .filter(Boolean)
          .join('\n\n');
        text = responseText || text;
        meta = {
          model: parsed.meta?.agentMeta?.model,
          durationMs: parsed.meta?.durationMs,
        };
      } else {
        text = stdout.trim() || text;
      }
    } catch (e) {
      text = stdout.trim() || text;
    }

    appendToSession(sid, 'assistant', text);
    finish('stream_end', { reply: text, sessionId: sid, meta });
  });

  proc.on('error', (err) => {
    sseLog('error', 'Spawn error', { connId, error: err.message });
    finish('error', { error: SSE_ERRORS.SPAWN_ERROR.message, code: SSE_ERRORS.SPAWN_ERROR.code });
  });

  // Client disconnect — kill the process
  req.on('close', () => {
    if (!finished) {
      sseLog('info', 'Client disconnected', { connId, sid });
      finished = true;
      clearTimeout(killTimer);
      clearInterval(keepaliveTimer);
      busy = false;
      sseMetrics.activeConnections = Math.max(0, sseMetrics.activeConnections - 1);
      activeConnections.delete(connId);
      try { proc.kill('SIGTERM'); } catch (_) {}
    }
  });
};

// Export metrics for health endpoint
module.exports.getSSEMetrics = function () {
  return {
    ...sseMetrics,
    _responseTimes: undefined, // Don't expose raw array
    activeConnectionDetails: Array.from(activeConnections.values()).map(c => ({
      id: c.id,
      sessionId: c.sessionId,
      state: c.state,
      connectedSec: Math.round((Date.now() - c.connectedAt) / 1000),
    })),
  };
};

// Cleanup expired sessions every 5 min
setInterval(() => {
  const now = Date.now();
  try { sessionStore.cleanup(); } catch (_e) {}
}, 5 * 60 * 1000).unref();
