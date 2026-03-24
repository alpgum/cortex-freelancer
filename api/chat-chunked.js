/**
 * /api/chat-chunked — HTTP Chunked Transfer Encoding streaming endpoint
 * CFX-023: Streams chat responses using Transfer-Encoding: chunked
 *
 * Unlike SSE (which requires EventSource), chunked transfer works with
 * any HTTP client that supports streaming response bodies (Fetch API
 * ReadableStream, XHR with progress events, curl, etc.).
 *
 * Wire format: Newline-delimited JSON (NDJSON)
 * Each line is a complete JSON object followed by \n
 *
 * Message types:
 *   {"type":"start","sessionId":"...","connectionId":"..."}
 *   {"type":"chunk","data":"...","index":0}
 *   {"type":"end","reply":"...","sessionId":"...","meta":{}}
 *   {"type":"error","error":"...","code":"..."}
 *   {"type":"keepalive","ts":1234567890}
 *
 * Integrates with:
 *   - CFX-005: Connection health monitoring
 *   - CFX-007: Structured error codes
 *   - CFX-009: Mobile network optimization
 */

const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const os = require('os');

// ─── Rate Limiting ───
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 20;

// ─── Session History ───
const sessionHistory = new Map();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_HISTORY = 20;

// ─── Connection Tracking (CFX-005) ───
const activeConnections = new Map();
const chunkedMetrics = {
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
const KEEPALIVE_INTERVAL_MS = 15_000;
const FLUSH_DELAY_MS = 0; // Flush immediately for lowest latency

// ─── Error Codes (CFX-007) ───
const CHUNKED_ERRORS = {
  RATE_LIMITED:       { code: 'C300', message: 'Too many requests. Try again in a few minutes.', retryAfter: 60 },
  BUSY:              { code: 'C301', message: 'Cortex is processing another request. Please wait.', retryAfter: 5 },
  INVALID_MESSAGE:   { code: 'C400', message: 'Message is required.' },
  INVALID_METHOD:    { code: 'C401', message: 'POST only.' },
  MESSAGE_TOO_LONG:  { code: 'C402', message: 'Message too long. Keep under 4000 characters.' },
  SPAWN_ERROR:       { code: 'C500', message: 'Cortex is temporarily unavailable.' },
  TIMEOUT:           { code: 'C501', message: 'Request timed out. Try a shorter message.' },
  RESOURCE_EXHAUSTED:{ code: 'C502', message: 'Server resources limited. Try again shortly.', retryAfter: 30 },
};

// ─── Structured Logging ───
function chunkedLog(level, msg, meta = {}) {
  const entry = { ts: new Date().toISOString(), ctx: 'chunked', level, msg, ...meta };
  if (level === 'error' || level === 'critical') console.error('[chat-chunked]', JSON.stringify(entry));
  else if (level === 'warn') console.warn('[chat-chunked]', JSON.stringify(entry));
  else console.log('[chat-chunked]', JSON.stringify(entry));
}

function recordError(errorDef) {
  chunkedMetrics.errors.total++;
  const code = typeof errorDef === 'string' ? errorDef : errorDef.code;
  chunkedMetrics.errors.byCode[code] = (chunkedMetrics.errors.byCode[code] || 0) + 1;
}

function recordResponseTime(ms) {
  chunkedMetrics._responseTimes.push(ms);
  if (chunkedMetrics._responseTimes.length > 100) chunkedMetrics._responseTimes.shift();
  const sum = chunkedMetrics._responseTimes.reduce((a, b) => a + b, 0);
  chunkedMetrics.avgResponseMs = Math.round(sum / chunkedMetrics._responseTimes.length);
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

// ─── Rate Limiting ───
function getRateLimitKey(req) {
  return (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
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

// ─── Session Management ───
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
 * Write a NDJSON line to the response and flush.
 * Each message is a complete JSON object followed by newline.
 */
function writeChunk(res, obj) {
  if (res.writableEnded) return false;
  try {
    res.write(JSON.stringify(obj) + '\n');
    // Force flush if available (Node.js res.flush for compressed streams)
    if (typeof res.flush === 'function') res.flush();
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

  // GET /api/chat-chunked → health/info endpoint
  if (req.method === 'GET') {
    return res.json({
      service: 'cortex-chunked',
      status: busy ? 'busy' : 'ready',
      mode: 'chunked-transfer',
      connections: {
        active: chunkedMetrics.activeConnections,
        total: chunkedMetrics.totalConnections,
      },
      performance: {
        avgResponseMs: chunkedMetrics.avgResponseMs,
        totalMessages: chunkedMetrics.totalMessages,
      },
      errors: chunkedMetrics.errors,
      uptime: Math.round((Date.now() - chunkedMetrics.startedAt) / 1000),
      activeSessions: sessionHistory.size,
    });
  }

  if (req.method !== 'POST') {
    recordError(CHUNKED_ERRORS.INVALID_METHOD);
    return res.status(405).json({ error: CHUNKED_ERRORS.INVALID_METHOD.message, code: CHUNKED_ERRORS.INVALID_METHOD.code });
  }

  // Resource health check (CFX-005)
  const health = checkResourceHealth();
  if (health.isExhausted) {
    recordError(CHUNKED_ERRORS.RESOURCE_EXHAUSTED);
    chunkedLog('warn', 'Resource exhaustion detected', { mem: health.memUsageRatio, load: health.loadRatio });
    return res.status(503).json({
      error: CHUNKED_ERRORS.RESOURCE_EXHAUSTED.message,
      code: CHUNKED_ERRORS.RESOURCE_EXHAUSTED.code,
      retryAfter: CHUNKED_ERRORS.RESOURCE_EXHAUSTED.retryAfter,
    });
  }

  // Rate limit
  const rlKey = getRateLimitKey(req);
  if (!checkRateLimit(rlKey)) {
    recordError(CHUNKED_ERRORS.RATE_LIMITED);
    return res.status(429).json({
      error: CHUNKED_ERRORS.RATE_LIMITED.message,
      code: CHUNKED_ERRORS.RATE_LIMITED.code,
      retryAfter: CHUNKED_ERRORS.RATE_LIMITED.retryAfter,
    });
  }

  if (busy) {
    recordError(CHUNKED_ERRORS.BUSY);
    return res.status(429).json({
      error: CHUNKED_ERRORS.BUSY.message,
      code: CHUNKED_ERRORS.BUSY.code,
      retryAfter: CHUNKED_ERRORS.BUSY.retryAfter,
    });
  }

  const { message, sessionId, profile, goals } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    recordError(CHUNKED_ERRORS.INVALID_MESSAGE);
    return res.status(400).json({ error: CHUNKED_ERRORS.INVALID_MESSAGE.message, code: CHUNKED_ERRORS.INVALID_MESSAGE.code });
  }
  if (message.length > 4000) {
    recordError(CHUNKED_ERRORS.MESSAGE_TOO_LONG);
    return res.status(400).json({ error: CHUNKED_ERRORS.MESSAGE_TOO_LONG.message, code: CHUNKED_ERRORS.MESSAGE_TOO_LONG.code });
  }

  const sid = sessionId || 'ctx-' + randomUUID().slice(0, 8);
  const session = getOrCreateSession(sid);
  appendToSession(sid, 'user', message.trim());

  const prompt = buildPrompt(message, session, profile, goals);
  const connId = 'chk-' + randomUUID().slice(0, 8);
  const startTime = Date.now();

  // Set chunked transfer headers
  // Node.js uses Transfer-Encoding: chunked by default when not setting Content-Length
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',         // Disable nginx buffering
    'X-Content-Type-Options': 'nosniff',
    'X-Chunked-Connection-Id': connId,
    // Transfer-Encoding: chunked is implicit in HTTP/1.1 when no Content-Length
  });

  // Track connection (CFX-005)
  chunkedMetrics.totalConnections++;
  chunkedMetrics.activeConnections++;
  activeConnections.set(connId, {
    id: connId,
    sessionId: sid,
    ip: rlKey,
    connectedAt: startTime,
    lastActivity: startTime,
    state: 'streaming',
  });

  // Send start message
  writeChunk(res, { type: 'start', sessionId: sid, connectionId: connId });

  busy = true;
  let finished = false;
  let stdout = '';
  let chunkIndex = 0;

  // Keepalive timer — prevents proxies/load balancers from closing idle connections
  const keepaliveTimer = setInterval(() => {
    if (!finished) {
      writeChunk(res, { type: 'keepalive', ts: Date.now() });
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

  // Timeout safety
  const killTimer = setTimeout(() => {
    if (!finished) {
      chunkedLog('warn', 'openclaw timed out, killing', { connId, sid });
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 5000);
      finish('error', { type: 'error', error: CHUNKED_ERRORS.TIMEOUT.message, code: CHUNKED_ERRORS.TIMEOUT.code });
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
    if (event === 'end') {
      chunkedMetrics.totalMessages++;
      recordResponseTime(duration);
      chunkedLog('info', 'Stream completed', { connId, sid, durationMs: duration });
    } else if (event === 'error') {
      recordError(data.code ? { code: data.code } : CHUNKED_ERRORS.SPAWN_ERROR);
      chunkedLog('warn', 'Stream error', { connId, sid, error: data.error, durationMs: duration });
    }

    // Cleanup connection tracking
    chunkedMetrics.activeConnections = Math.max(0, chunkedMetrics.activeConnections - 1);
    activeConnections.delete(connId);

    // Write final message with duration
    writeChunk(res, { ...data, durationMs: duration });
    res.end();
  }

  proc.stdout.on('data', (data) => {
    const chunk = data.toString();
    stdout += chunk;
    if (!finished) {
      writeChunk(res, { type: 'chunk', data: chunk, index: chunkIndex++ });
    }
  });

  proc.stderr.on('data', (data) => {
    chunkedLog('debug', 'stderr', { connId, output: data.toString().trim() });
  });

  proc.on('close', (code) => {
    if (finished) return;

    if (code !== 0 && !stdout.trim()) {
      finish('error', { type: 'error', error: CHUNKED_ERRORS.SPAWN_ERROR.message, code: CHUNKED_ERRORS.SPAWN_ERROR.code });
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
    finish('end', { type: 'end', reply: text, sessionId: sid, meta });
  });

  proc.on('error', (err) => {
    chunkedLog('error', 'Spawn error', { connId, error: err.message });
    finish('error', { type: 'error', error: CHUNKED_ERRORS.SPAWN_ERROR.message, code: CHUNKED_ERRORS.SPAWN_ERROR.code });
  });

  // Client disconnect — kill the process
  req.on('close', () => {
    if (!finished) {
      chunkedLog('info', 'Client disconnected', { connId, sid });
      finished = true;
      clearTimeout(killTimer);
      clearInterval(keepaliveTimer);
      busy = false;
      chunkedMetrics.activeConnections = Math.max(0, chunkedMetrics.activeConnections - 1);
      activeConnections.delete(connId);
      try { proc.kill('SIGTERM'); } catch (_) {}
    }
  });
};

// Export metrics for health endpoint
module.exports.getChunkedMetrics = function () {
  return {
    ...chunkedMetrics,
    _responseTimes: undefined,
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
  for (const [sid, s] of sessionHistory) {
    if (now - s.lastActivity >= SESSION_TIMEOUT_MS) {
      sessionHistory.delete(sid);
    }
  }
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > RATE_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();
