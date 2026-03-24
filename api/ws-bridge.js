/**
 * WebSocket Bridge — Real-time OpenClaw connection
 * Streams OpenClaw responses token-by-token over WebSocket.
 * Attaches to existing HTTP server via upgrade event.
 *
 * CFX-005: Connection Health Monitoring
 * - Per-client health tracking (state, latency, missed pongs)
 * - Server-initiated ping with pong timeout detection
 * - Auto-cleanup of dead/stale connections
 * - Health metrics logging & /ws/health endpoint
 *
 * CFX-007: Error Handling Improvement
 * - Structured error codes for all failure types
 * - Categorized error logging with severity levels
 * - Graceful degradation on spawn/timeout/resource failures
 * - User-friendly error payloads with recovery hints
 * - Resource exhaustion detection and backpressure
 */

const { WebSocketServer } = require('ws');
const { spawn, execSync } = require('child_process');
const { randomUUID } = require('crypto');
const os = require('os');

// ─── CFX-006: Timeout Configuration ───
// All timeouts are configurable via environment variables.
// Prefix: WS_ for WebSocket, OPENCLAW_ for spawn/processing.
// Profiles: Set WS_TIMEOUT_PROFILE=development|production|aggressive
//
// Recommended values by tunnel type:
//   ngrok (no idle timeout):      production profile (default)
//   Cloudflare tunnel (100s):     aggressive profile (shorter keepalive)
//   Direct / localhost:           development profile (relaxed)
//
const TIMEOUT_PROFILES = {
  development: {
    SPAWN_TIMEOUT_MS: 180_000,         // 3 min — generous for local dev
    PROCESSING_KEEPALIVE_MS: 30_000,   // 30s — relaxed, no proxy to appease
    HEALTH_PING_INTERVAL_MS: 30_000,   // 30s — less noisy in dev
    PONG_TIMEOUT_MS: 15_000,           // 15s — tolerant of slow local networks
    MAX_MISSED_PONGS: 3,               // 3 misses before terminate
    STALE_CONNECTION_MS: 10 * 60_000,  // 10 min — dev sessions stay open longer
    HEALTH_LOG_INTERVAL_MS: 120_000,   // 2 min — less log noise
    CLEANUP_INTERVAL_MS: 60_000,       // 1 min
    CONNECTION_TIMEOUT_MS: 30_000,     // 30s to complete WS handshake
    SESSION_TIMEOUT_MS: 60 * 60_000,   // 1 hour sessions in dev
  },
  production: {
    SPAWN_TIMEOUT_MS: 180_000,         // 3 min — OpenClaw can take 2+ min for complex queries
    PROCESSING_KEEPALIVE_MS: 15_000,   // 15s — keeps connection alive through proxies
    HEALTH_PING_INTERVAL_MS: 20_000,   // 20s — balanced health checking
    PONG_TIMEOUT_MS: 10_000,           // 10s — reasonable for internet RTT
    MAX_MISSED_PONGS: 2,               // 2 misses = likely dead
    STALE_CONNECTION_MS: 5 * 60_000,   // 5 min idle = stale
    HEALTH_LOG_INTERVAL_MS: 60_000,    // 1 min
    CLEANUP_INTERVAL_MS: 30_000,       // 30s
    CONNECTION_TIMEOUT_MS: 15_000,     // 15s handshake timeout
    SESSION_TIMEOUT_MS: 30 * 60_000,   // 30 min
  },
  aggressive: {
    // For Cloudflare tunnels with 100s idle timeout
    SPAWN_TIMEOUT_MS: 180_000,         // 3 min — still need time for OpenClaw
    PROCESSING_KEEPALIVE_MS: 8_000,    // 8s — well under CF's 100s threshold
    HEALTH_PING_INTERVAL_MS: 15_000,   // 15s — frequent pings to keep CF alive
    PONG_TIMEOUT_MS: 8_000,            // 8s — tight pong window
    MAX_MISSED_PONGS: 2,               // 2 misses
    STALE_CONNECTION_MS: 3 * 60_000,   // 3 min — aggressive cleanup
    HEALTH_LOG_INTERVAL_MS: 60_000,    // 1 min
    CLEANUP_INTERVAL_MS: 20_000,       // 20s
    CONNECTION_TIMEOUT_MS: 10_000,     // 10s handshake
    SESSION_TIMEOUT_MS: 20 * 60_000,   // 20 min
  },
};

function loadTimeoutConfig() {
  const profileName = process.env.WS_TIMEOUT_PROFILE || 'production';
  const profile = TIMEOUT_PROFILES[profileName] || TIMEOUT_PROFILES.production;

  if (!TIMEOUT_PROFILES[profileName]) {
    console.warn(`[ws-bridge] Unknown timeout profile "${profileName}", falling back to production`);
  }

  // Allow individual env overrides on top of the profile
  return {
    SPAWN_TIMEOUT_MS:          parseInt(process.env.OPENCLAW_SPAWN_TIMEOUT_MS, 10)     || profile.SPAWN_TIMEOUT_MS,
    PROCESSING_KEEPALIVE_MS:   parseInt(process.env.WS_PROCESSING_KEEPALIVE_MS, 10)    || profile.PROCESSING_KEEPALIVE_MS,
    HEALTH_PING_INTERVAL_MS:   parseInt(process.env.WS_HEALTH_PING_INTERVAL_MS, 10)    || profile.HEALTH_PING_INTERVAL_MS,
    PONG_TIMEOUT_MS:           parseInt(process.env.WS_PONG_TIMEOUT_MS, 10)            || profile.PONG_TIMEOUT_MS,
    MAX_MISSED_PONGS:          parseInt(process.env.WS_MAX_MISSED_PONGS, 10)           || profile.MAX_MISSED_PONGS,
    STALE_CONNECTION_MS:       parseInt(process.env.WS_STALE_CONNECTION_MS, 10)         || profile.STALE_CONNECTION_MS,
    HEALTH_LOG_INTERVAL_MS:    parseInt(process.env.WS_HEALTH_LOG_INTERVAL_MS, 10)     || profile.HEALTH_LOG_INTERVAL_MS,
    CLEANUP_INTERVAL_MS:       parseInt(process.env.WS_CLEANUP_INTERVAL_MS, 10)        || profile.CLEANUP_INTERVAL_MS,
    CONNECTION_TIMEOUT_MS:     parseInt(process.env.WS_CONNECTION_TIMEOUT_MS, 10)       || profile.CONNECTION_TIMEOUT_MS,
    SESSION_TIMEOUT_MS:        parseInt(process.env.WS_SESSION_TIMEOUT_MS, 10)         || profile.SESSION_TIMEOUT_MS,
  };
}

const CFG = loadTimeoutConfig();

// ─── CFX-007: Structured Error Codes & Categories ───
// Every error sent to clients includes a `code` for programmatic handling
// and a `category` for grouping in logs/monitoring.

const ERROR_CODES = {
  // Connection errors (1xx)
  WS_HANDSHAKE_TIMEOUT: { code: 'E100', category: 'connection', severity: 'warn',
    message: 'Connection handshake timed out. Please try again.',
    hint: 'Check your internet connection and retry.' },
  WS_CONNECTION_ERROR: { code: 'E101', category: 'connection', severity: 'error',
    message: 'WebSocket connection error.',
    hint: 'Connection interrupted. Retrying automatically.' },
  WS_STALE_CLOSED: { code: 'E102', category: 'connection', severity: 'info',
    message: 'Connection closed due to inactivity.',
    hint: 'Send a message to reconnect.' },
  WS_INVALID_PATH: { code: 'E103', category: 'connection', severity: 'warn',
    message: 'Invalid WebSocket endpoint.',
    hint: 'Connect to /ws/chat' },

  // Spawn/process errors (2xx)
  SPAWN_FAILED: { code: 'E200', category: 'spawn', severity: 'error',
    message: 'Failed to start AI service.',
    hint: 'The AI service may be temporarily down. Try again in 30 seconds.' },
  SPAWN_TIMEOUT: { code: 'E201', category: 'spawn', severity: 'warn',
    message: 'AI response timed out.',
    hint: 'Your request may have been too complex. Try a shorter or simpler message.' },
  SPAWN_CRASH: { code: 'E202', category: 'spawn', severity: 'error',
    message: 'AI service encountered an unexpected error.',
    hint: 'This has been logged. Please try again.' },
  SPAWN_NOT_FOUND: { code: 'E203', category: 'spawn', severity: 'critical',
    message: 'AI service is not available on this server.',
    hint: 'The server needs to be configured. Please contact support.' },

  // Rate/resource errors (3xx)
  RATE_LIMITED: { code: 'E300', category: 'rate', severity: 'info',
    message: 'Too many requests. Please wait a moment.',
    hint: 'You can send another message in a few minutes.' },
  QUEUE_FULL: { code: 'E301', category: 'rate', severity: 'warn',
    message: 'Server is busy. Your request has been queued.',
    hint: 'Your message will be processed shortly.' },
  RESOURCE_EXHAUSTED: { code: 'E302', category: 'resource', severity: 'critical',
    message: 'Server resources are limited right now.',
    hint: 'Try again in a few minutes. The server is under heavy load.' },
  SESSION_EXPIRED: { code: 'E303', category: 'session', severity: 'info',
    message: 'Your session has expired.',
    hint: 'A new session will be created automatically.' },

  // Client errors (4xx)
  INVALID_JSON: { code: 'E400', category: 'client', severity: 'warn',
    message: 'Invalid message format.',
    hint: 'Please send valid JSON.' },
  INVALID_MESSAGE: { code: 'E401', category: 'client', severity: 'info',
    message: 'Message is required.',
    hint: 'Type a message and press send.' },
  UNKNOWN_TYPE: { code: 'E402', category: 'client', severity: 'info',
    message: 'Unknown message type.',
    hint: 'Use type: "chat" to send messages.' },
  MESSAGE_TOO_LONG: { code: 'E403', category: 'client', severity: 'info',
    message: 'Message is too long.',
    hint: 'Please keep messages under 4000 characters.' },

  // Server errors (5xx)
  INTERNAL_ERROR: { code: 'E500', category: 'server', severity: 'error',
    message: 'Internal server error.',
    hint: 'Something went wrong. Please try again.' },
};

// Severity levels for structured logging
const SEVERITY = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };
const LOG_MIN_SEVERITY = SEVERITY[process.env.WS_LOG_LEVEL || 'info'];

// Error counters for monitoring
const errorCounters = {
  byCode: {},
  byCategory: {},
  total: 0,
  lastReset: Date.now(),
};

function structuredLog(severity, context, message, meta = {}) {
  if (SEVERITY[severity] < LOG_MIN_SEVERITY) return;
  const entry = {
    ts: new Date().toISOString(),
    level: severity,
    ctx: context,
    msg: message,
    ...meta,
  };
  const prefix = `[ws-bridge][${severity.toUpperCase()}]`;
  if (severity === 'error' || severity === 'critical') {
    console.error(prefix, JSON.stringify(entry));
  } else if (severity === 'warn') {
    console.warn(prefix, JSON.stringify(entry));
  } else {
    console.log(prefix, JSON.stringify(entry));
  }
}

function recordError(errorDef, extra = {}) {
  errorCounters.total++;
  errorCounters.byCode[errorDef.code] = (errorCounters.byCode[errorDef.code] || 0) + 1;
  errorCounters.byCategory[errorDef.category] = (errorCounters.byCategory[errorDef.category] || 0) + 1;
  structuredLog(errorDef.severity, errorDef.category, errorDef.message, {
    code: errorDef.code, ...extra
  });
}

/** Build a client-facing error payload with code, message, hint, and retryable flag */
function buildErrorPayload(errorDef, requestId, extra = {}) {
  recordError(errorDef, extra);
  return {
    type: 'error',
    code: errorDef.code,
    error: errorDef.message,
    hint: errorDef.hint,
    retryable: errorDef.category !== 'client',
    retryAfterMs: getRetryDelay(errorDef),
    requestId: requestId || undefined,
    ...extra,
  };
}

function getRetryDelay(errorDef) {
  switch (errorDef.category) {
    case 'spawn': return 5000;
    case 'rate': return 30000;
    case 'resource': return 60000;
    case 'connection': return 2000;
    default: return 3000;
  }
}

/** Check system resources — detect exhaustion before it causes hard failures */
function checkResourceHealth() {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const memUsageRatio = 1 - (freeMem / totalMem);
  const loadAvg = os.loadavg()[0];
  const cpuCount = os.cpus().length;
  const loadRatio = loadAvg / cpuCount;

  return {
    memUsageRatio,
    loadRatio,
    isExhausted: memUsageRatio > 0.95 || loadRatio > 3.0,
    isDegraded: memUsageRatio > 0.85 || loadRatio > 2.0,
    freeMem: Math.round(freeMem / 1024 / 1024),
    loadAvg: Math.round(loadAvg * 100) / 100,
  };
}

/** Check if openclaw binary is available */
let openclawAvailable = null; // cache
function checkOpenClawAvailable() {
  if (openclawAvailable !== null) return openclawAvailable;
  try {
    execSync('which openclaw', { stdio: 'ignore', timeout: 5000 });
    openclawAvailable = true;
  } catch {
    openclawAvailable = false;
    structuredLog('critical', 'spawn', 'openclaw binary not found in PATH');
  }
  // Re-check every 5 minutes (binary might be installed later)
  setTimeout(() => { openclawAvailable = null; }, 5 * 60 * 1000);
  return openclawAvailable;
}

// Rate limiting (shared with REST endpoint concept)
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 20;

// Session history
const sessionHistory = new Map();
const MAX_HISTORY = 20;

// Single-threaded lock
let busy = false;
// Queue for sequential processing
const messageQueue = [];

// Track active spawned process so we can kill it on disconnect
let activeProc = null;
let activeWs = null;

// Connection states
const STATE = {
  CONNECTED: 'connected',
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',    // 1 missed pong or high latency
  STALE: 'stale',          // No activity for STALE_CONNECTION_MS
  DEAD: 'dead',            // MAX_MISSED_PONGS exceeded
};

// Per-client health tracker: ws → healthInfo
const clientHealth = new Map();

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

function getOrCreateSession(sid) {
  if (sessionHistory.has(sid)) {
    const s = sessionHistory.get(sid);
    if (Date.now() - s.lastActivity < CFG.SESSION_TIMEOUT_MS) {
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

  // FORCE CORTEX FREELANCER SKILL TRIGGER
  const freelancerContext = "I need help with my freelance business: ";
  prompt += freelancerContext + message.trim().substring(0, 4000 - freelancerContext.length);
  return prompt;
}

/**
 * Stream OpenClaw response via spawn.
 * Implements manual timeout since spawn() ignores the timeout option.
 * Returns the child process (caller can kill it on client disconnect).
 *
 * CFX-007: Enhanced with pre-flight checks, categorized errors,
 * resource monitoring, and structured error objects.
 */
function streamOpenClaw(prompt, sessionId, onChunk, onDone, onError) {
  // CFX-007: Pre-flight checks
  if (!checkOpenClawAvailable()) {
    const err = new Error(ERROR_CODES.SPAWN_NOT_FOUND.message);
    err.errorCode = ERROR_CODES.SPAWN_NOT_FOUND;
    process.nextTick(() => onError(err));
    return null;
  }

  const resources = checkResourceHealth();
  if (resources.isExhausted) {
    structuredLog('critical', 'resource', 'Resource exhaustion detected, rejecting spawn', resources);
    const err = new Error(ERROR_CODES.RESOURCE_EXHAUSTED.message);
    err.errorCode = ERROR_CODES.RESOURCE_EXHAUSTED;
    process.nextTick(() => onError(err));
    return null;
  }
  if (resources.isDegraded) {
    structuredLog('warn', 'resource', 'System resources degraded', resources);
  }

  const args = [
    'agent',
    '--message', prompt,
    '--session-id', sessionId,
    '--json',
    '--local'
  ];

  let finished = false;
  function finish(fn, ...fnArgs) {
    if (finished) return;
    finished = true;
    clearTimeout(killTimer);
    fn(...fnArgs);
  }

  let proc;
  try {
    proc = spawn('openclaw', args, {
      env: { ...process.env }
    });
  } catch (spawnErr) {
    structuredLog('error', 'spawn', 'Failed to spawn openclaw process', {
      error: spawnErr.message, code: spawnErr.code,
    });
    const err = new Error(ERROR_CODES.SPAWN_FAILED.message);
    err.errorCode = ERROR_CODES.SPAWN_FAILED;
    err.cause = spawnErr;
    process.nextTick(() => onError(err));
    return null;
  }

  const spawnStartTime = Date.now();

  // Manual timeout — kill the process if it runs too long
  const killTimer = setTimeout(() => {
    if (!finished) {
      structuredLog('warn', 'spawn', `openclaw timed out after ${CFG.SPAWN_TIMEOUT_MS / 1000}s`, {
        pid: proc.pid, elapsed: Date.now() - spawnStartTime,
      });
      proc.kill('SIGTERM');
      setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch (_) {}
      }, 5000);
      const err = new Error(ERROR_CODES.SPAWN_TIMEOUT.message);
      err.errorCode = ERROR_CODES.SPAWN_TIMEOUT;
      finish(onError, err);
    }
  }, CFG.SPAWN_TIMEOUT_MS);

  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (data) => {
    const chunk = data.toString();
    stdout += chunk;
    if (!finished) onChunk(chunk);
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  proc.on('close', (code) => {
    if (finished) return;
    const elapsed = Date.now() - spawnStartTime;

    if (code !== 0 && !stdout.trim()) {
      const isNotFound = stderr.includes('not found') || stderr.includes('ENOENT') || code === 127;
      const isSignal = code === null || code > 128;

      if (isNotFound) {
        openclawAvailable = false;
        const err = new Error(ERROR_CODES.SPAWN_NOT_FOUND.message);
        err.errorCode = ERROR_CODES.SPAWN_NOT_FOUND;
        finish(onError, err);
      } else {
        structuredLog('error', 'spawn', `openclaw exited with code ${code}`, {
          pid: proc.pid, code, elapsed, stderr: stderr.slice(0, 500),
        });
        const errDef = isSignal ? ERROR_CODES.SPAWN_CRASH : ERROR_CODES.SPAWN_FAILED;
        const err = new Error(`${errDef.message} (exit ${code})`);
        err.errorCode = errDef;
        finish(onError, err);
      }
      return;
    }

    // Parse final JSON to extract clean response
    try {
      const jsonStart = stdout.indexOf('{');
      if (jsonStart === -1) {
        finish(onDone, stdout.trim() || 'No response from Cortex.', { durationMs: elapsed });
        return;
      }
      const parsed = JSON.parse(stdout.slice(jsonStart));
      const responseText = (parsed.payloads || [])
        .map(p => p.text)
        .filter(Boolean)
        .join('\n\n');

      structuredLog('debug', 'spawn', 'openclaw completed', {
        pid: proc.pid, elapsed, model: parsed.meta?.agentMeta?.model,
      });

      finish(onDone, responseText || 'No response from Cortex.', {
        model: parsed.meta?.agentMeta?.model,
        durationMs: parsed.meta?.durationMs || elapsed
      });
    } catch (e) {
      structuredLog('warn', 'spawn', 'Failed to parse openclaw JSON output', {
        error: e.message, stdoutLen: stdout.length,
      });
      finish(onDone, stdout.trim() || 'No response from Cortex.', { durationMs: elapsed });
    }
  });

  proc.on('error', (err) => {
    structuredLog('error', 'spawn', 'openclaw process error', {
      error: err.message, code: err.code,
    });
    const wrappedErr = new Error(ERROR_CODES.SPAWN_FAILED.message);
    wrappedErr.errorCode = err.code === 'ENOENT' ? ERROR_CODES.SPAWN_NOT_FOUND : ERROR_CODES.SPAWN_FAILED;
    wrappedErr.cause = err;
    if (err.code === 'ENOENT') openclawAvailable = false;
    finish(onError, wrappedErr);
  });

  return proc;
}

// ─── CFX-005: Health Monitoring Helpers ───

function createHealthInfo(ip) {
  return {
    ip,
    state: STATE.CONNECTED,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    lastPingSent: null,
    lastPongReceived: null,
    missedPongs: 0,
    totalPings: 0,
    totalPongs: 0,
    latencyMs: [],           // rolling window of last 10 RTTs
    messagesReceived: 0,
    messagesSent: 0,
  };
}

function updateHealthState(ws) {
  const h = clientHealth.get(ws);
  if (!h) return;

  const now = Date.now();
  const idleMs = now - h.lastActivity;

  if (h.missedPongs >= CFG.MAX_MISSED_PONGS) {
    h.state = STATE.DEAD;
  } else if (idleMs > CFG.STALE_CONNECTION_MS) {
    h.state = STATE.STALE;
  } else if (h.missedPongs > 0 || avgLatency(h) > 5000) {
    h.state = STATE.DEGRADED;
  } else {
    h.state = STATE.HEALTHY;
  }
}

function avgLatency(h) {
  if (h.latencyMs.length === 0) return 0;
  return h.latencyMs.reduce((a, b) => a + b, 0) / h.latencyMs.length;
}

function recordPong(ws) {
  const h = clientHealth.get(ws);
  if (!h) return;
  const now = Date.now();
  h.lastPongReceived = now;
  h.totalPongs++;
  h.missedPongs = 0;
  h.lastActivity = now;
  if (h.lastPingSent) {
    const rtt = now - h.lastPingSent;
    h.latencyMs.push(rtt);
    if (h.latencyMs.length > 10) h.latencyMs.shift();
  }
  updateHealthState(ws);
}

function recordActivity(ws) {
  const h = clientHealth.get(ws);
  if (!h) return;
  h.lastActivity = Date.now();
  h.messagesReceived++;
  updateHealthState(ws);
}

function recordSend(ws) {
  const h = clientHealth.get(ws);
  if (h) h.messagesSent++;
}

/** Get aggregate health snapshot for all connections */
function getHealthSnapshot() {
  const snapshot = {
    totalConnections: clientHealth.size,
    byState: {},
    connections: [],
  };
  for (const [ws, h] of clientHealth) {
    updateHealthState(ws);
    snapshot.byState[h.state] = (snapshot.byState[h.state] || 0) + 1;
    snapshot.connections.push({
      ip: h.ip,
      state: h.state,
      uptimeMs: Date.now() - h.connectedAt,
      avgLatencyMs: Math.round(avgLatency(h)),
      missedPongs: h.missedPongs,
      messagesReceived: h.messagesReceived,
      messagesSent: h.messagesSent,
    });
  }
  return snapshot;
}

function processQueue() {
  if (busy || messageQueue.length === 0) return;

  const { ws, data } = messageQueue.shift();
  if (ws.readyState !== 1) { // WebSocket.OPEN
    processQueue();
    return;
  }

  busy = true;
  activeWs = ws;
  const { message, sessionId, profile, goals, requestId } = data;
  const sid = sessionId || 'ctx-' + randomUUID().slice(0, 8);
  const rid = requestId || randomUUID().slice(0, 8);

  const session = getOrCreateSession(sid);
  appendToSession(sid, 'user', message.trim());

  const prompt = buildPrompt(message, session, profile, goals);

  // Notify client: stream starting
  safeSend(ws, { type: 'stream_start', sessionId: sid, requestId: rid });

  let chunkIndex = 0;
  let receivedFirstChunk = false;

  // Send periodic keep-alive pings during processing to prevent proxy idle timeouts
  // This is critical for Cloudflare tunnels which drop idle WS connections ~60-100s
  // We send BOTH protocol-level pings (for proxy layers) AND app-level messages (for client UI)
  const keepAliveTimer = setInterval(() => {
    if (ws.readyState === 1) {
      // Protocol-level ping — recognized by ALL proxy layers (CF, nginx, ngrok, etc.)
      ws.ping();
      // App-level keepalive — lets client UI show "still processing" state
      if (!receivedFirstChunk) {
        safeSend(ws, {
          type: 'keepalive',
          status: 'processing',
          elapsed: Date.now(),
          requestId: rid
        });
      }
    }
  }, CFG.PROCESSING_KEEPALIVE_MS);

  activeProc = streamOpenClaw(
    prompt,
    sid,
    // onChunk — stream raw stdout chunks to client
    (chunk) => {
      receivedFirstChunk = true;
      safeSend(ws, {
        type: 'stream_chunk',
        chunk: chunk,
        index: chunkIndex++,
        requestId: rid
      });
    },
    // onDone — send final parsed response
    (text, meta) => {
      clearInterval(keepAliveTimer);
      appendToSession(sid, 'assistant', text);
      safeSend(ws, {
        type: 'stream_end',
        reply: text,
        sessionId: sid,
        meta: meta,
        requestId: rid
      });
      activeProc = null;
      activeWs = null;
      busy = false;
      processQueue();
    },
    // onError — CFX-007: structured error with code, hint, retry info
    (err) => {
      clearInterval(keepAliveTimer);
      const errorDef = err.errorCode || ERROR_CODES.INTERNAL_ERROR;
      const payload = buildErrorPayload(errorDef, rid, {
        detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
      });
      safeSend(ws, payload);
      activeProc = null;
      activeWs = null;
      busy = false;
      processQueue();
    }
  );
}

function safeSend(ws, data) {
  if (ws.readyState === 1) { // WebSocket.OPEN
    ws.send(JSON.stringify(data));
    recordSend(ws);
  }
}

/**
 * Kill the active openclaw process (e.g. when the requesting client disconnects).
 */
function killActiveIfOwner(ws) {
  if (activeWs === ws && activeProc) {
    console.log('[ws-bridge] Client disconnected mid-request, killing openclaw process');
    try { activeProc.kill('SIGTERM'); } catch (_) {}
  }
}

/**
 * Attach WebSocket server to an existing HTTP server.
 * Call this from server.js after creating the HTTP server.
 */
function attachWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');

    // Health endpoint — respond with JSON over HTTP (not upgraded)
    if (url.pathname === '/ws/health') {
      const snapshot = getHealthSnapshot();
      snapshot.timeoutConfig = {
        profile: process.env.WS_TIMEOUT_PROFILE || 'production',
        spawnTimeoutMs: CFG.SPAWN_TIMEOUT_MS,
        processingKeepaliveMs: CFG.PROCESSING_KEEPALIVE_MS,
        healthPingIntervalMs: CFG.HEALTH_PING_INTERVAL_MS,
        pongTimeoutMs: CFG.PONG_TIMEOUT_MS,
        staleConnectionMs: CFG.STALE_CONNECTION_MS,
      };
      // CFX-007: Include error metrics and resource status
      snapshot.errors = {
        total: errorCounters.total,
        byCode: { ...errorCounters.byCode },
        byCategory: { ...errorCounters.byCategory },
        sinceReset: new Date(errorCounters.lastReset).toISOString(),
      };
      snapshot.resources = checkResourceHealth();
      snapshot.openclawAvailable = checkOpenClawAvailable();
      const body = JSON.stringify(snapshot, null, 2);
      socket.write(
        'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ' +
        Buffer.byteLength(body) + '\r\nConnection: close\r\n\r\n' + body
      );
      socket.end();
      return;
    }

    // Only handle /ws/chat path
    if (url.pathname !== '/ws/chat') {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws, req) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    console.log(`[ws-bridge] Client connected from ${ip}`);

    // CFX-005: Initialize health tracking for this client
    const health = createHealthInfo(ip);
    clientHealth.set(ws, health);

    // Send welcome
    safeSend(ws, { type: 'connected', timestamp: Date.now() });

    // Heartbeat — track pong responses for health monitoring
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
      recordPong(ws);
    });

    ws.on('message', (raw) => {
      recordActivity(ws);

      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch (e) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.INVALID_JSON));
        return;
      }

      if (data.type === 'ping') {
        safeSend(ws, { type: 'pong', timestamp: Date.now() });
        return;
      }

      // CFX-005: Allow clients to request their own health status
      if (data.type === 'health') {
        const h = clientHealth.get(ws);
        if (h) {
          updateHealthState(ws);
          safeSend(ws, {
            type: 'health_status',
            state: h.state,
            uptimeMs: Date.now() - h.connectedAt,
            avgLatencyMs: Math.round(avgLatency(h)),
            missedPongs: h.missedPongs,
            messagesReceived: h.messagesReceived,
            messagesSent: h.messagesSent,
          });
        }
        return;
      }

      if (data.type !== 'chat') {
        safeSend(ws, buildErrorPayload(ERROR_CODES.UNKNOWN_TYPE));
        return;
      }

      // Validate message
      if (!data.message || typeof data.message !== 'string' || !data.message.trim()) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.INVALID_MESSAGE, data.requestId));
        return;
      }

      // CFX-007: Message length validation
      if (data.message.length > 4000) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.MESSAGE_TOO_LONG, data.requestId));
        return;
      }

      // Rate limit
      if (!checkRateLimit(ip)) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.RATE_LIMITED, data.requestId));
        return;
      }

      // CFX-007: Resource pre-check before queuing
      const resources = checkResourceHealth();
      if (resources.isExhausted) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.RESOURCE_EXHAUSTED, data.requestId));
        return;
      }

      // Queue the message
      messageQueue.push({ ws, data });
      const position = messageQueue.length;
      if (position > 1) {
        safeSend(ws, { type: 'queued', position, requestId: data.requestId });
      }

      processQueue();
    });

    ws.on('close', () => {
      const h = clientHealth.get(ws);
      const stateInfo = h ? ` state=${h.state} uptime=${Math.round((Date.now() - h.connectedAt) / 1000)}s` : '';
      console.log(`[ws-bridge] Client disconnected (${ip})${stateInfo}`);
      // Clean up health tracking
      clientHealth.delete(ws);
      // Kill openclaw if this client owned the active request
      killActiveIfOwner(ws);
      // Remove queued messages from this ws
      for (let i = messageQueue.length - 1; i >= 0; i--) {
        if (messageQueue[i].ws === ws) messageQueue.splice(i, 1);
      }
    });

    ws.on('error', (err) => {
      console.error(`[ws-bridge] WebSocket error (${ip}):`, err.message);
    });
  });

  // ─── CFX-005: Server-initiated ping with pong timeout detection ───
  // Replaces the old simple heartbeat. Sends WS ping, tracks missed pongs,
  // terminates dead connections after MAX_MISSED_PONGS consecutive misses.
  const healthPingTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      const h = clientHealth.get(ws);
      if (!h) return;

      // Check if previous ping was answered
      if (h.lastPingSent && !ws.isAlive) {
        h.missedPongs++;
        updateHealthState(ws);

        if (h.missedPongs >= CFG.MAX_MISSED_PONGS) {
          console.log(`[ws-bridge] Terminating dead connection: ip=${h.ip} missed=${h.missedPongs} state=${h.state}`);
          ws.terminate();
          return;
        } else {
          console.log(`[ws-bridge] Degraded connection: ip=${h.ip} missed=${h.missedPongs}`);
        }
      }

      // Send new ping
      ws.isAlive = false;
      h.lastPingSent = Date.now();
      h.totalPings++;
      ws.ping();
    });
  }, CFG.HEALTH_PING_INTERVAL_MS);

  // ─── CFX-005: Stale connection cleanup sweep ───
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((ws) => {
      const h = clientHealth.get(ws);
      if (!h) return;

      updateHealthState(ws);

      // Terminate stale connections that have been idle too long
      if (h.state === STATE.STALE && (now - h.lastActivity) > CFG.STALE_CONNECTION_MS * 2) {
        console.log(`[ws-bridge] Cleaning up stale connection: ip=${h.ip} idle=${Math.round((now - h.lastActivity) / 1000)}s`);
        safeSend(ws, buildErrorPayload(ERROR_CODES.WS_STALE_CLOSED));
        ws.close(1000, 'Stale connection');
      }
    });
  }, CFG.CLEANUP_INTERVAL_MS);

  // ─── CFX-005: Periodic health metrics logging ───
  const healthLogTimer = setInterval(() => {
    if (clientHealth.size === 0) return;
    const snapshot = getHealthSnapshot();
    const states = Object.entries(snapshot.byState).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`[ws-health] connections=${snapshot.totalConnections} ${states}`);
    // Log degraded/dead details
    for (const c of snapshot.connections) {
      if (c.state !== STATE.HEALTHY && c.state !== STATE.CONNECTED) {
        console.log(`[ws-health]   ${c.ip}: ${c.state} latency=${c.avgLatencyMs}ms missed=${c.missedPongs} msgs=${c.messagesReceived}/${c.messagesSent}`);
      }
    }
  }, CFG.HEALTH_LOG_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(healthPingTimer);
    clearInterval(cleanupTimer);
    clearInterval(healthLogTimer);
  });

  // Session cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [sid, s] of sessionHistory) {
      if (now - s.lastActivity >= CFG.SESSION_TIMEOUT_MS) {
        sessionHistory.delete(sid);
      }
    }
  }, 5 * 60 * 1000).unref();

  // CFX-007: Periodic error counter reset (every hour)
  setInterval(() => {
    const now = Date.now();
    const elapsed = now - errorCounters.lastReset;
    if (elapsed > 60 * 60 * 1000) {
      structuredLog('info', 'monitor', 'Resetting hourly error counters', {
        total: errorCounters.total,
        byCode: { ...errorCounters.byCode },
        periodMs: elapsed,
      });
      errorCounters.byCode = {};
      errorCounters.byCategory = {};
      errorCounters.total = 0;
      errorCounters.lastReset = now;
    }
  }, 15 * 60 * 1000).unref();

  // CFX-006: Log active timeout configuration on startup
  console.log(`  ✓ WebSocket bridge attached at /ws/chat (CFX-005 health + CFX-006 timeouts + CFX-007 errors)`);
  console.log(`    Profile: ${process.env.WS_TIMEOUT_PROFILE || 'production'}`);
  console.log(`    Spawn: ${CFG.SPAWN_TIMEOUT_MS / 1000}s | Keepalive: ${CFG.PROCESSING_KEEPALIVE_MS / 1000}s | Ping: ${CFG.HEALTH_PING_INTERVAL_MS / 1000}s`);
  return wss;
}

module.exports = {
  attachWebSocket,
  getHealthSnapshot,
  getTimeoutConfig: () => ({ ...CFG, profile: process.env.WS_TIMEOUT_PROFILE || 'production' }),
  ERROR_CODES,
  errorCounters,
};
