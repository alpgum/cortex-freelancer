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
 */

const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');

// Rate limiting (shared with REST endpoint concept)
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 20;

// Session history
const sessionHistory = new Map();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_HISTORY = 20;

// Single-threaded lock
let busy = false;
// Queue for sequential processing
const messageQueue = [];

// Track active spawned process so we can kill it on disconnect
let activeProc = null;
let activeWs = null;

// Spawn timeout — spawn() does NOT support timeout option, must implement manually
const SPAWN_TIMEOUT_MS = 120_000;

// Keep-alive interval during processing — prevents proxy idle timeouts
// Cloudflare tunnels, nginx, and most reverse proxies drop idle WS connections after 60-100s
// OpenClaw can take 23-120s before first token, so we send periodic heartbeat pings
const PROCESSING_KEEPALIVE_MS = 15_000;

// ─── CFX-005: Health Monitoring Constants ───
const HEALTH_PING_INTERVAL_MS = 20_000;   // Server-initiated ping every 20s
const PONG_TIMEOUT_MS = 10_000;            // Client must pong within 10s
const MAX_MISSED_PONGS = 2;                // Terminate after 2 consecutive missed pongs
const STALE_CONNECTION_MS = 5 * 60_000;    // Connection with no activity for 5 min = stale
const HEALTH_LOG_INTERVAL_MS = 60_000;     // Log aggregate health metrics every 60s
const CLEANUP_INTERVAL_MS = 30_000;        // Run cleanup sweep every 30s

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
 */
function streamOpenClaw(prompt, sessionId, onChunk, onDone, onError) {
  const args = [
    'agent',
    '--message', prompt,
    '--session-id', sessionId,
    '--json',
    '--local'
  ];

  let finished = false;
  function finish(fn, ...args) {
    if (finished) return;
    finished = true;
    clearTimeout(killTimer);
    fn(...args);
  }

  const proc = spawn('openclaw', args, {
    env: { ...process.env }
  });

  // Manual timeout — kill the process if it runs too long
  const killTimer = setTimeout(() => {
    if (!finished) {
      console.warn(`[ws-bridge] openclaw process timed out after ${SPAWN_TIMEOUT_MS / 1000}s, killing pid=${proc.pid}`);
      proc.kill('SIGTERM');
      // Force kill after 5s if SIGTERM doesn't work
      setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch (_) {}
      }, 5000);
      finish(onError, new Error('openclaw timed out after ' + (SPAWN_TIMEOUT_MS / 1000) + 's'));
    }
  }, SPAWN_TIMEOUT_MS);

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

    if (code !== 0 && !stdout.trim()) {
      finish(onError, new Error(`openclaw exited with code ${code}: ${stderr}`));
      return;
    }

    // Parse final JSON to extract clean response
    try {
      const jsonStart = stdout.indexOf('{');
      if (jsonStart === -1) {
        finish(onDone, stdout.trim() || 'No response from Cortex.', {});
        return;
      }
      const parsed = JSON.parse(stdout.slice(jsonStart));
      const responseText = (parsed.payloads || [])
        .map(p => p.text)
        .filter(Boolean)
        .join('\n\n');

      finish(onDone, responseText || 'No response from Cortex.', {
        model: parsed.meta?.agentMeta?.model,
        durationMs: parsed.meta?.durationMs
      });
    } catch (e) {
      finish(onDone, stdout.trim() || 'No response from Cortex.', {});
    }
  });

  proc.on('error', (err) => {
    finish(onError, err);
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

  if (h.missedPongs >= MAX_MISSED_PONGS) {
    h.state = STATE.DEAD;
  } else if (idleMs > STALE_CONNECTION_MS) {
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
  }, PROCESSING_KEEPALIVE_MS);

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
    // onError
    (err) => {
      clearInterval(keepAliveTimer);
      console.error('[ws-bridge] OpenClaw error:', err.message);
      safeSend(ws, {
        type: 'error',
        error: 'Cortex is temporarily unavailable. Please try again.',
        requestId: rid
      });
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
        safeSend(ws, { type: 'error', error: 'Invalid JSON' });
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
        safeSend(ws, { type: 'error', error: 'Unknown message type. Use type: "chat"' });
        return;
      }

      // Validate message
      if (!data.message || typeof data.message !== 'string' || !data.message.trim()) {
        safeSend(ws, { type: 'error', error: 'Message is required' });
        return;
      }

      // Rate limit
      if (!checkRateLimit(ip)) {
        safeSend(ws, { type: 'error', error: 'Rate limit exceeded. Try again in a few minutes.', requestId: data.requestId });
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

        if (h.missedPongs >= MAX_MISSED_PONGS) {
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
  }, HEALTH_PING_INTERVAL_MS);

  // ─── CFX-005: Stale connection cleanup sweep ───
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((ws) => {
      const h = clientHealth.get(ws);
      if (!h) return;

      updateHealthState(ws);

      // Terminate stale connections that have been idle too long
      if (h.state === STATE.STALE && (now - h.lastActivity) > STALE_CONNECTION_MS * 2) {
        console.log(`[ws-bridge] Cleaning up stale connection: ip=${h.ip} idle=${Math.round((now - h.lastActivity) / 1000)}s`);
        safeSend(ws, { type: 'error', error: 'Connection closed due to inactivity.' });
        ws.close(1000, 'Stale connection');
      }
    });
  }, CLEANUP_INTERVAL_MS);

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
  }, HEALTH_LOG_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(healthPingTimer);
    clearInterval(cleanupTimer);
    clearInterval(healthLogTimer);
  });

  // Session cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [sid, s] of sessionHistory) {
      if (now - s.lastActivity >= SESSION_TIMEOUT_MS) {
        sessionHistory.delete(sid);
      }
    }
  }, 5 * 60 * 1000).unref();

  console.log('  ✓ WebSocket bridge attached at /ws/chat (CFX-005 health monitoring active)');
  return wss;
}

module.exports = { attachWebSocket };
