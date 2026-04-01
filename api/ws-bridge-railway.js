/**
 * WebSocket Bridge — Railway Production Edition
 * 
 * Uses Anthropic SDK directly instead of spawning OpenClaw CLI.
 * This eliminates the OpenClaw gateway dependency for Railway deployment.
 * 
 * Key differences from ws-bridge.js:
 * - Direct Anthropic API calls (no child process spawning)
 * - True streaming via Anthropic streaming API
 * - No openclaw binary dependency
 * - Production timeout profile (no Cloudflare tunnel workarounds needed)
 * - Railway has native WebSocket support (no 100s idle timeout!)
 * 
 * All CFX improvements preserved:
 * - CFX-005: Connection health monitoring
 * - CFX-006: Timeout configuration (production profile default)
 * - CFX-007: Structured error codes
 * - CFX-009: Mobile network optimization
 */

const { WebSocketServer } = require('ws');
const Anthropic = require('@anthropic-ai/sdk');
const { randomUUID } = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ─── Cortex Freelancer System Prompt ───
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

// ─── Timeout Configuration ───
const TIMEOUT_PROFILES = {
  production: {
    API_TIMEOUT_MS: 120_000,           // 2 min — Anthropic API timeout
    PROCESSING_KEEPALIVE_MS: 15_000,   // 15s keepalive during streaming
    HEALTH_PING_INTERVAL_MS: 25_000,   // 25s — Railway has no idle timeout!
    PONG_TIMEOUT_MS: 10_000,
    MAX_MISSED_PONGS: 3,               // More lenient — no tunnel to worry about
    STALE_CONNECTION_MS: 10 * 60_000,  // 10 min — Railway is stable
    HEALTH_LOG_INTERVAL_MS: 120_000,
    CLEANUP_INTERVAL_MS: 60_000,
    CONNECTION_TIMEOUT_MS: 15_000,
    SESSION_TIMEOUT_MS: 60 * 60_000,   // 1 hour sessions
  },
  mobile: {
    API_TIMEOUT_MS: 120_000,
    PROCESSING_KEEPALIVE_MS: 12_000,
    HEALTH_PING_INTERVAL_MS: 30_000,
    PONG_TIMEOUT_MS: 15_000,
    MAX_MISSED_PONGS: 4,
    STALE_CONNECTION_MS: 15 * 60_000,
    HEALTH_LOG_INTERVAL_MS: 120_000,
    CLEANUP_INTERVAL_MS: 60_000,
    CONNECTION_TIMEOUT_MS: 20_000,
    SESSION_TIMEOUT_MS: 60 * 60_000,
  },
};

function loadTimeoutConfig() {
  const profileName = process.env.WS_TIMEOUT_PROFILE || 'production';
  const profile = TIMEOUT_PROFILES[profileName] || TIMEOUT_PROFILES.production;
  return {
    API_TIMEOUT_MS:            parseInt(process.env.ANTHROPIC_TIMEOUT_MS, 10)         || profile.API_TIMEOUT_MS,
    PROCESSING_KEEPALIVE_MS:   parseInt(process.env.WS_PROCESSING_KEEPALIVE_MS, 10)   || profile.PROCESSING_KEEPALIVE_MS,
    HEALTH_PING_INTERVAL_MS:   parseInt(process.env.WS_HEALTH_PING_INTERVAL_MS, 10)   || profile.HEALTH_PING_INTERVAL_MS,
    PONG_TIMEOUT_MS:           parseInt(process.env.WS_PONG_TIMEOUT_MS, 10)           || profile.PONG_TIMEOUT_MS,
    MAX_MISSED_PONGS:          parseInt(process.env.WS_MAX_MISSED_PONGS, 10)          || profile.MAX_MISSED_PONGS,
    STALE_CONNECTION_MS:       parseInt(process.env.WS_STALE_CONNECTION_MS, 10)        || profile.STALE_CONNECTION_MS,
    HEALTH_LOG_INTERVAL_MS:    parseInt(process.env.WS_HEALTH_LOG_INTERVAL_MS, 10)    || profile.HEALTH_LOG_INTERVAL_MS,
    CLEANUP_INTERVAL_MS:       parseInt(process.env.WS_CLEANUP_INTERVAL_MS, 10)       || profile.CLEANUP_INTERVAL_MS,
    CONNECTION_TIMEOUT_MS:     parseInt(process.env.WS_CONNECTION_TIMEOUT_MS, 10)      || profile.CONNECTION_TIMEOUT_MS,
    SESSION_TIMEOUT_MS:        parseInt(process.env.WS_SESSION_TIMEOUT_MS, 10)         || profile.SESSION_TIMEOUT_MS,
  };
}

const CFG = loadTimeoutConfig();

// ─── Error Codes (CFX-007) ───
const ERROR_CODES = {
  WS_STALE_CLOSED: { code: 'E102', category: 'connection', severity: 'info',
    message: 'Connection closed due to inactivity.', hint: 'Send a message to reconnect.' },
  API_FAILED: { code: 'E200', category: 'api', severity: 'error',
    message: 'AI service temporarily unavailable.', hint: 'Try again in 30 seconds.' },
  API_TIMEOUT: { code: 'E201', category: 'api', severity: 'warn',
    message: 'AI response timed out.', hint: 'Try a shorter or simpler message.' },
  API_OVERLOADED: { code: 'E202', category: 'api', severity: 'warn',
    message: 'AI service is busy.', hint: 'Please wait a moment and try again.' },
  RATE_LIMITED: { code: 'E300', category: 'rate', severity: 'info',
    message: 'Too many requests.', hint: 'Wait a few minutes.' },
  RESOURCE_EXHAUSTED: { code: 'E302', category: 'resource', severity: 'critical',
    message: 'Server resources limited.', hint: 'Try again in a few minutes.' },
  INVALID_JSON: { code: 'E400', category: 'client', severity: 'warn',
    message: 'Invalid message format.', hint: 'Send valid JSON.' },
  INVALID_MESSAGE: { code: 'E401', category: 'client', severity: 'info',
    message: 'Message is required.', hint: 'Type a message and press send.' },
  UNKNOWN_TYPE: { code: 'E402', category: 'client', severity: 'info',
    message: 'Unknown message type.', hint: 'Use type: "chat"' },
  MESSAGE_TOO_LONG: { code: 'E403', category: 'client', severity: 'info',
    message: 'Message too long.', hint: 'Keep under 4000 characters.' },
  INTERNAL_ERROR: { code: 'E500', category: 'server', severity: 'error',
    message: 'Internal server error.', hint: 'Try again.' },
};

const SEVERITY = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };
const LOG_MIN_SEVERITY = SEVERITY[process.env.WS_LOG_LEVEL || 'info'];

const errorCounters = { byCode: {}, byCategory: {}, total: 0, lastReset: Date.now() };

function structuredLog(severity, context, message, meta = {}) {
  if (SEVERITY[severity] < LOG_MIN_SEVERITY) return;
  const prefix = `[ws-bridge][${severity.toUpperCase()}]`;
  const entry = { ts: new Date().toISOString(), level: severity, ctx: context, msg: message, ...meta };
  if (severity === 'error' || severity === 'critical') console.error(prefix, JSON.stringify(entry));
  else if (severity === 'warn') console.warn(prefix, JSON.stringify(entry));
  else console.log(prefix, JSON.stringify(entry));
}

function recordError(errorDef, extra = {}) {
  errorCounters.total++;
  errorCounters.byCode[errorDef.code] = (errorCounters.byCode[errorDef.code] || 0) + 1;
  errorCounters.byCategory[errorDef.category] = (errorCounters.byCategory[errorDef.category] || 0) + 1;
  structuredLog(errorDef.severity, errorDef.category, errorDef.message, { code: errorDef.code, ...extra });
}

function buildErrorPayload(errorDef, requestId, extra = {}) {
  recordError(errorDef, extra);
  return {
    type: 'error', code: errorDef.code, error: errorDef.message, hint: errorDef.hint,
    retryable: errorDef.category !== 'client',
    retryAfterMs: errorDef.category === 'rate' ? 30000 : errorDef.category === 'resource' ? 60000 : 3000,
    requestId: requestId || undefined, ...extra,
  };
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
    isDegraded: memUsageRatio > 0.85 || loadRatio > 2.0,
    freeMem: Math.round(freeMem / 1024 / 1024),
    loadAvg: Math.round(loadAvg * 100) / 100,
  };
}

// ─── Anthropic Client (supports OpenRouter fallback) ───
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      structuredLog('critical', 'api', 'ANTHROPIC_API_KEY or OPENROUTER_API_KEY not set');
      return null;
    }
    const opts = { apiKey };
    if (!process.env.ANTHROPIC_API_KEY && process.env.OPENROUTER_API_KEY) {
      opts.baseURL = 'https://openrouter.ai/api';
    }
    anthropicClient = new Anthropic(opts);
  }
  return anthropicClient;
}

// Rate limiting
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 20;

// Session history
const sessionHistory = new Map();
const MAX_HISTORY = 20;

// Processing queue
let busy = false;
const messageQueue = [];
let activeAbortController = null;
let activeWs = null;
let activeRequestId = null;

// Connection states
const STATE = { CONNECTED: 'connected', HEALTHY: 'healthy', DEGRADED: 'degraded', STALE: 'stale', DEAD: 'dead' };
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
  if (s.messages.length > MAX_HISTORY) s.messages = s.messages.slice(-MAX_HISTORY);
  s.lastActivity = Date.now();
}

function buildProfileContext(profile, goals) {
  const lines = [];
  if (profile && !profile._skipped) {
    lines.push('<user_profile>');
    if (profile.name) lines.push('Name: ' + profile.name);
    if (profile.title) lines.push('Title: ' + profile.title);
    if (profile.hourlyRate) lines.push('Rate: $' + profile.hourlyRate + '/hr');
    if (profile.skills?.length) lines.push('Skills: ' + profile.skills.slice(0, 15).join(', '));
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

function buildMessages(userMessage, session, profile, goals) {
  const messages = [];
  
  // Add conversation history
  for (const m of session.messages.slice(0, -1)) {
    messages.push({ role: m.role, content: m.content });
  }
  
  // Build current message with context
  let content = '';
  const profileCtx = buildProfileContext(profile, goals);
  if (profileCtx) content += profileCtx + '\n\n';
  content += userMessage.trim().substring(0, 4000);
  
  messages.push({ role: 'user', content });
  return messages;
}

/**
 * Stream response from Anthropic API directly.
 * Returns AbortController for cancellation on disconnect.
 */
async function streamAnthropicResponse(messages, sessionId, requestId, ws) {
  const client = getAnthropicClient();
  if (!client) {
    safeSend(ws, buildErrorPayload(ERROR_CODES.API_FAILED, requestId, { detail: 'API key not configured' }));
    return null;
  }

  const abortController = new AbortController();
  // Track active controller for cancellation/disconnect
  activeAbortController = abortController;
  activeRequestId = requestId;
  const startTime = Date.now();

  // API timeout
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, CFG.API_TIMEOUT_MS);

  // Keepalive during processing
  let receivedFirstChunk = false;
  const keepAliveTimer = setInterval(() => {
    if (ws.readyState === 1) {
      ws.ping();
      if (!receivedFirstChunk) {
        safeSend(ws, { type: 'keepalive', status: 'processing', elapsed: Date.now() - startTime, requestId });
      }
    }
  }, CFG.PROCESSING_KEEPALIVE_MS);

  try {
    safeSend(ws, { type: 'stream_start', sessionId, requestId });

    const stream = await client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || (!process.env.ANTHROPIC_API_KEY && process.env.OPENROUTER_API_KEY ? 'anthropic/claude-sonnet-4-20250514' : 'claude-sonnet-4-20250514'),
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    }, { signal: abortController.signal });

    let fullResponse = '';
    let chunkIndex = 0;

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        receivedFirstChunk = true;
        const text = event.delta.text;
        fullResponse += text;
        safeSend(ws, { type: 'stream_chunk', chunk: text, index: chunkIndex++, requestId });
      }
    }

    clearTimeout(timeoutId);
    clearInterval(keepAliveTimer);

    const elapsed = Date.now() - startTime;
    const finalMessage = await stream.finalMessage();
    
    safeSend(ws, {
      type: 'stream_end',
      reply: fullResponse || 'No response from Cortex.',
      sessionId,
      meta: {
        model: finalMessage.model,
        durationMs: elapsed,
        inputTokens: finalMessage.usage?.input_tokens,
        outputTokens: finalMessage.usage?.output_tokens,
      },
      requestId,
    });

    structuredLog('info', 'api', 'Stream complete', {
      elapsed, model: finalMessage.model,
      tokens: `${finalMessage.usage?.input_tokens}/${finalMessage.usage?.output_tokens}`,
    });

    return fullResponse;

  } catch (err) {
    clearTimeout(timeoutId);
    clearInterval(keepAliveTimer);

    if (err.name === 'AbortError' || abortController.signal.aborted) {
      safeSend(ws, buildErrorPayload(ERROR_CODES.API_TIMEOUT, requestId));
    } else if (err.status === 429) {
      safeSend(ws, buildErrorPayload(ERROR_CODES.API_OVERLOADED, requestId));
    } else if (err.status === 529) {
      safeSend(ws, buildErrorPayload(ERROR_CODES.API_OVERLOADED, requestId));
    } else {
      structuredLog('error', 'api', `Anthropic error: ${err.message}`, { status: err.status });
      safeSend(ws, buildErrorPayload(ERROR_CODES.API_FAILED, requestId, {
        detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
      }));
    }
    return null;
  }
}

function processQueue() {
  if (busy || messageQueue.length === 0) return;

  const { ws, data } = messageQueue.shift();
  if (ws.readyState !== 1) { processQueue(); return; }

  busy = true;
  activeWs = ws;
  const { message, sessionId, profile, goals, requestId } = data;
  const sid = sessionId || 'ctx-' + randomUUID().slice(0, 8);
  const rid = requestId || randomUUID().slice(0, 8);

  const session = getOrCreateSession(sid);
  appendToSession(sid, 'user', message.trim());

  const messages = buildMessages(message, session, profile, goals);

  streamAnthropicResponse(messages, sid, rid, ws).then((responseText) => {
    if (responseText) {
      appendToSession(sid, 'assistant', responseText);
    }
    activeAbortController = null;
    activeRequestId = null;
    activeWs = null;
    busy = false;
    processQueue();
  }).catch((err) => {
    structuredLog('error', 'api', `Unexpected error: ${err.message}`);
    safeSend(ws, buildErrorPayload(ERROR_CODES.INTERNAL_ERROR, rid));
    activeAbortController = null;
    activeRequestId = null;
    activeWs = null;
    busy = false;
    processQueue();
  });
}

// ─── Health Monitoring (CFX-005) ───

function createHealthInfo(ip, req) {
  const ua = (req?.headers?.['user-agent']) || '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return {
    ip, state: STATE.CONNECTED, connectedAt: Date.now(), lastActivity: Date.now(),
    lastPingSent: null, lastPongReceived: null, missedPongs: 0,
    totalPings: 0, totalPongs: 0, latencyMs: [],
    messagesReceived: 0, messagesSent: 0,
    isMobile, isIOS: /iPad|iPhone|iPod/.test(ua), isAndroid: /Android/i.test(ua),
    userAgent: ua.slice(0, 200), networkSwitchCount: 0, lastNetworkType: null,
  };
}

function avgLatency(h) {
  if (h.latencyMs.length === 0) return 0;
  return h.latencyMs.reduce((a, b) => a + b, 0) / h.latencyMs.length;
}

function updateHealthState(ws) {
  const h = clientHealth.get(ws);
  if (!h) return;
  const idleMs = Date.now() - h.lastActivity;
  if (h.missedPongs >= CFG.MAX_MISSED_PONGS) h.state = STATE.DEAD;
  else if (idleMs > CFG.STALE_CONNECTION_MS) h.state = STATE.STALE;
  else if (h.missedPongs > 0 || avgLatency(h) > 5000) h.state = STATE.DEGRADED;
  else h.state = STATE.HEALTHY;
}

function recordPong(ws) {
  const h = clientHealth.get(ws);
  if (!h) return;
  const now = Date.now();
  h.lastPongReceived = now; h.totalPongs++; h.missedPongs = 0; h.lastActivity = now;
  if (h.lastPingSent) {
    h.latencyMs.push(now - h.lastPingSent);
    if (h.latencyMs.length > 10) h.latencyMs.shift();
  }
  updateHealthState(ws);
}

function recordActivity(ws) {
  const h = clientHealth.get(ws);
  if (!h) return;
  h.lastActivity = Date.now(); h.messagesReceived++;
  updateHealthState(ws);
}

function safeSend(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
    const h = clientHealth.get(ws);
    if (h) h.messagesSent++;
  }
}

function getHealthSnapshot() {
  const snapshot = { totalConnections: clientHealth.size, byState: {}, connections: [] };
  for (const [ws, h] of clientHealth) {
    updateHealthState(ws);
    snapshot.byState[h.state] = (snapshot.byState[h.state] || 0) + 1;
    snapshot.connections.push({
      ip: h.ip, state: h.state, uptimeMs: Date.now() - h.connectedAt,
      avgLatencyMs: Math.round(avgLatency(h)), missedPongs: h.missedPongs,
      messagesReceived: h.messagesReceived, messagesSent: h.messagesSent,
      isMobile: h.isMobile, platform: h.isIOS ? 'iOS' : h.isAndroid ? 'Android' : 'desktop',
    });
  }
  return snapshot;
}

function killActiveIfOwner(ws) {
  if (activeWs === ws && activeAbortController) {
    console.log('[ws-bridge] Client disconnected mid-request, aborting API call');
    try { activeAbortController.abort(); } catch (_) {}
  }
}

/**
 * Attach WebSocket server to existing HTTP server.
 */
function attachWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');

    if (url.pathname === '/ws/health') {
      const snapshot = getHealthSnapshot();
      snapshot.timeoutConfig = {
        profile: process.env.WS_TIMEOUT_PROFILE || 'production',
        apiTimeoutMs: CFG.API_TIMEOUT_MS,
        processingKeepaliveMs: CFG.PROCESSING_KEEPALIVE_MS,
        healthPingIntervalMs: CFG.HEALTH_PING_INTERVAL_MS,
      };
      snapshot.errors = {
        total: errorCounters.total, byCode: { ...errorCounters.byCode },
        byCategory: { ...errorCounters.byCategory },
        sinceReset: new Date(errorCounters.lastReset).toISOString(),
      };
      snapshot.resources = checkResourceHealth();
      snapshot.mode = 'railway-direct';  // Identifies this as Railway edition
      const body = JSON.stringify(snapshot, null, 2);
      socket.write('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ' +
        Buffer.byteLength(body) + '\r\nConnection: close\r\n\r\n' + body);
      socket.end();
      return;
    }

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

    const health = createHealthInfo(ip, req);
    clientHealth.set(ws, health);

    safeSend(ws, { type: 'connected', timestamp: Date.now(), mode: 'railway-direct' });

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; recordPong(ws); });

    ws.on('message', (raw) => {
      recordActivity(ws);
      let data;
      try { data = JSON.parse(raw.toString()); } catch (e) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.INVALID_JSON));
        return;
      }

      if (data.type === 'ping') { safeSend(ws, { type: 'pong', timestamp: Date.now() }); return; }
      if (data.type === 'health') {
        const h = clientHealth.get(ws);
        if (h) { updateHealthState(ws); safeSend(ws, { type: 'health_status', state: h.state, uptimeMs: Date.now() - h.connectedAt, avgLatencyMs: Math.round(avgLatency(h)) }); }
        return;
      }
      if (data.type === 'network_info') {
        const h = clientHealth.get(ws);
        if (h && data.networkType && data.networkType !== h.lastNetworkType) {
          if (h.lastNetworkType !== null) h.networkSwitchCount++;
          h.lastNetworkType = data.networkType;
          safeSend(ws, { type: 'network_info_ack', profile: h.isMobile ? 'mobile' : 'default' });
        }
        return;
      }

      if (data.type === 'cancel') {
        const rid = data.requestId;

        // Remove any queued items for this ws+requestId
        if (rid) {
          for (let i = messageQueue.length - 1; i >= 0; i--) {
            const it = messageQueue[i];
            if (it && it.ws === ws && it.data && it.data.requestId === rid) {
              messageQueue.splice(i, 1);
            }
          }
        }

        // Abort active Anthropic request (single-threaded)
        if (rid && activeWs === ws && activeAbortController && activeRequestId === rid) {
          try { activeAbortController.abort(); } catch (_) {}
        }

        safeSend(ws, { type: 'cancelled', requestId: rid, timestamp: Date.now() });
        return;
      }

      if (data.type !== 'chat') { safeSend(ws, buildErrorPayload(ERROR_CODES.UNKNOWN_TYPE)); return; }
      if (!data.message || typeof data.message !== 'string' || !data.message.trim()) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.INVALID_MESSAGE, data.requestId)); return;
      }
      if (data.message.length > 4000) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.MESSAGE_TOO_LONG, data.requestId)); return;
      }
      if (!checkRateLimit(ip)) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.RATE_LIMITED, data.requestId)); return;
      }

      const resources = checkResourceHealth();
      if (resources.isExhausted) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.RESOURCE_EXHAUSTED, data.requestId)); return;
      }

      messageQueue.push({ ws, data });
      if (messageQueue.length > 1) {
        safeSend(ws, { type: 'queued', position: messageQueue.length, requestId: data.requestId });
      }
      processQueue();
    });

    ws.on('close', () => {
      const h = clientHealth.get(ws);
      const info = h ? ` state=${h.state} uptime=${Math.round((Date.now() - h.connectedAt) / 1000)}s` : '';
      console.log(`[ws-bridge] Client disconnected (${ip})${info}`);
      clientHealth.delete(ws);
      killActiveIfOwner(ws);
      for (let i = messageQueue.length - 1; i >= 0; i--) {
        if (messageQueue[i].ws === ws) messageQueue.splice(i, 1);
      }
    });

    ws.on('error', (err) => console.error(`[ws-bridge] Error (${ip}):`, err.message));
  });

  // Health ping
  const healthPingTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      const h = clientHealth.get(ws);
      if (!h) return;
      if (h.lastPingSent && !ws.isAlive) {
        h.missedPongs++;
        updateHealthState(ws);
        if (h.missedPongs >= CFG.MAX_MISSED_PONGS) {
          console.log(`[ws-bridge] Terminating dead connection: ip=${h.ip}`);
          ws.terminate();
          return;
        }
      }
      ws.isAlive = false;
      h.lastPingSent = Date.now();
      h.totalPings++;
      ws.ping();
    });
  }, CFG.HEALTH_PING_INTERVAL_MS);

  // Stale cleanup
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((ws) => {
      const h = clientHealth.get(ws);
      if (!h) return;
      updateHealthState(ws);
      if (h.state === STATE.STALE && (now - h.lastActivity) > CFG.STALE_CONNECTION_MS * 2) {
        safeSend(ws, buildErrorPayload(ERROR_CODES.WS_STALE_CLOSED));
        ws.close(1000, 'Stale connection');
      }
    });
  }, CFG.CLEANUP_INTERVAL_MS);

  // Health logging
  const healthLogTimer = setInterval(() => {
    if (clientHealth.size === 0) return;
    const snapshot = getHealthSnapshot();
    const states = Object.entries(snapshot.byState).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`[ws-health] connections=${snapshot.totalConnections} ${states}`);
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
      if (now - s.lastActivity >= CFG.SESSION_TIMEOUT_MS) sessionHistory.delete(sid);
    }
  }, 5 * 60 * 1000).unref();

  // Error counter reset
  setInterval(() => {
    if (Date.now() - errorCounters.lastReset > 60 * 60 * 1000) {
      errorCounters.byCode = {}; errorCounters.byCategory = {};
      errorCounters.total = 0; errorCounters.lastReset = Date.now();
    }
  }, 15 * 60 * 1000).unref();

  console.log(`  ✓ WebSocket bridge (Railway direct mode) at /ws/chat`);
  console.log(`    API timeout: ${CFG.API_TIMEOUT_MS / 1000}s | Keepalive: ${CFG.PROCESSING_KEEPALIVE_MS / 1000}s | Ping: ${CFG.HEALTH_PING_INTERVAL_MS / 1000}s`);
  return wss;
}

module.exports = { attachWebSocket, getHealthSnapshot, ERROR_CODES, errorCounters };
