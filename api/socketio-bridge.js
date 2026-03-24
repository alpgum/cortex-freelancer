/**
 * CFX-024: Socket.io Bridge — Battle-tested WebSocket alternative
 * 
 * Socket.io provides:
 * - Automatic transport fallback (WebSocket → HTTP long-polling)
 * - Built-in reconnection with exponential backoff
 * - Heartbeat/ping-pong out of the box
 * - Room/namespace support for scaling
 * - Binary data support
 * - Multiplexing over single connection
 * 
 * This module mirrors ws-bridge-railway.js functionality using Socket.io.
 * Both can coexist — Socket.io mounts on /socket.io path (default),
 * while raw WS stays on /ws/chat.
 * 
 * Dependencies: socket.io (server), @anthropic-ai/sdk
 */

'use strict';

const { Server: SocketIOServer } = require('socket.io');
const Anthropic = require('@anthropic-ai/sdk');
const { randomUUID } = require('crypto');
const os = require('os');

// ─── System Prompt (shared with other bridges) ───
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

// ─── Configuration ───
const CONFIG = {
  // Socket.io server options
  pingInterval: 25000,        // How often to send ping (ms)
  pingTimeout: 10000,         // How long to wait for pong before disconnect (ms)
  maxHttpBufferSize: 1e6,     // 1MB max message size
  connectTimeout: 15000,      // Connection timeout (ms)
  
  // Application limits
  maxConcurrentStreams: 5,
  rateLimitWindow: 5 * 60 * 1000,  // 5 min
  rateLimitMax: 20,                 // 20 messages per window
  sessionTimeout: 30 * 60 * 1000,  // 30 min
  maxHistory: 20,                   // Max conversation history per session
  
  // Allowed origins (customize for production)
  corsOrigins: process.env.SOCKETIO_CORS_ORIGINS
    ? process.env.SOCKETIO_CORS_ORIGINS.split(',')
    : ['http://localhost:3847', 'https://cortexfreelancer.com', 'https://www.cortexfreelancer.com'],
};

// ─── State ───
const sessionHistory = new Map();
const rateLimitMap = new Map();
let activeStreamCount = 0;

// ─── Metrics (CFX-020 integration) ───
const metrics = {
  totalConnections: 0,
  activeConnections: 0,
  totalMessages: 0,
  totalErrors: 0,
  totalTokens: 0,
  transportBreakdown: { websocket: 0, polling: 0 },
  avgLatencyMs: 0,
  _latencies: [],
  upSince: Date.now(),
};

// ─── Anthropic Client ───
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[socketio-bridge] ANTHROPIC_API_KEY not set');
      return null;
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ─── Rate Limiting ───
function checkRateLimit(clientId) {
  const now = Date.now();
  let entry = rateLimitMap.get(clientId);
  if (!entry || now - entry.windowStart > CONFIG.rateLimitWindow) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(clientId, entry);
  }
  entry.count++;
  return entry.count <= CONFIG.rateLimitMax;
}

// ─── Session History Management ───
function getHistory(sessionId) {
  const entry = sessionHistory.get(sessionId);
  if (!entry) return [];
  if (Date.now() - entry.lastAccess > CONFIG.sessionTimeout) {
    sessionHistory.delete(sessionId);
    return [];
  }
  entry.lastAccess = Date.now();
  return entry.messages;
}

function addToHistory(sessionId, role, content) {
  let entry = sessionHistory.get(sessionId);
  if (!entry) {
    entry = { messages: [], lastAccess: Date.now() };
    sessionHistory.set(sessionId, entry);
  }
  entry.lastAccess = Date.now();
  entry.messages.push({ role, content });
  // Trim to max history
  if (entry.messages.length > CONFIG.maxHistory) {
    entry.messages = entry.messages.slice(-CONFIG.maxHistory);
  }
}

// ─── Cleanup stale sessions ───
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessionHistory) {
    if (now - entry.lastAccess > CONFIG.sessionTimeout) {
      sessionHistory.delete(id);
    }
  }
  for (const [id, entry] of rateLimitMap) {
    if (now - entry.windowStart > CONFIG.rateLimitWindow) {
      rateLimitMap.delete(id);
    }
  }
}, 60_000).unref();


/**
 * Attach Socket.io to an existing HTTP server.
 * 
 * @param {import('http').Server} httpServer - The Express HTTP server
 * @returns {{ io: SocketIOServer, getMetrics: Function }}
 */
function attachSocketIO(httpServer) {
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    pingInterval: CONFIG.pingInterval,
    pingTimeout: CONFIG.pingTimeout,
    maxHttpBufferSize: CONFIG.maxHttpBufferSize,
    connectTimeout: CONFIG.connectTimeout,
    cors: {
      origin: CONFIG.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Allow both transports; Socket.io auto-upgrades polling → WS
    transports: ['polling', 'websocket'],
    // Compress for mobile networks
    perMessageDeflate: {
      threshold: 1024,
    },
  });

  // ─── Chat Namespace ───
  // Using /chat namespace keeps chat traffic isolated from other potential namespaces
  const chatNs = io.of('/chat');

  chatNs.on('connection', (socket) => {
    const clientId = socket.handshake.auth?.userId || socket.id;
    const transport = socket.conn.transport.name; // 'polling' or 'websocket'
    
    metrics.totalConnections++;
    metrics.activeConnections++;
    metrics.transportBreakdown[transport] = (metrics.transportBreakdown[transport] || 0) + 1;

    console.log(`[socketio] Client connected: ${clientId} via ${transport} (active: ${metrics.activeConnections})`);

    // Track transport upgrades (polling → websocket)
    socket.conn.on('upgrade', (newTransport) => {
      console.log(`[socketio] Client ${clientId} upgraded: ${transport} → ${newTransport.name}`);
      metrics.transportBreakdown.websocket = (metrics.transportBreakdown.websocket || 0) + 1;
    });

    // ─── Chat Message Handler ───
    socket.on('chat:message', async (data, ack) => {
      const startTime = Date.now();
      const requestId = data.requestId || randomUUID();
      const sessionId = data.sessionId || randomUUID();
      const message = (data.message || '').trim();

      // Validate
      if (!message) {
        return ack?.({ error: 'EMPTY_MESSAGE', message: 'Message cannot be empty' });
      }
      if (message.length > 10000) {
        return ack?.({ error: 'MESSAGE_TOO_LONG', message: 'Max 10,000 characters' });
      }

      // Rate limit
      if (!checkRateLimit(clientId)) {
        metrics.totalErrors++;
        return ack?.({ error: 'RATE_LIMITED', message: 'Too many messages. Try again shortly.' });
      }

      // Concurrency limit
      if (activeStreamCount >= CONFIG.maxConcurrentStreams) {
        metrics.totalErrors++;
        return ack?.({ error: 'SERVER_BUSY', message: 'Server is busy. Please retry in a moment.' });
      }

      // Get Anthropic client
      const client = getAnthropicClient();
      if (!client) {
        metrics.totalErrors++;
        return ack?.({ error: 'SERVICE_UNAVAILABLE', message: 'AI service not configured' });
      }

      // Acknowledge receipt
      ack?.({ ok: true, requestId });
      metrics.totalMessages++;
      activeStreamCount++;

      // Build conversation
      addToHistory(sessionId, 'user', message);
      const history = getHistory(sessionId);

      // Build context-enriched system prompt
      let systemPrompt = SYSTEM_PROMPT;
      if (data.profile) {
        systemPrompt += `\n\nUser Profile:\n${JSON.stringify(data.profile, null, 2)}`;
      }
      if (data.goals) {
        systemPrompt += `\n\nUser Goals:\n${JSON.stringify(data.goals, null, 2)}`;
      }

      try {
        // Stream response via Anthropic
        const stream = await client.messages.stream({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemPrompt,
          messages: history,
        });

        let fullResponse = '';
        let tokenCount = 0;

        // Emit start
        socket.emit('chat:stream:start', { requestId, sessionId });

        // Stream tokens
        stream.on('text', (text) => {
          fullResponse += text;
          tokenCount++;
          socket.emit('chat:stream:token', { requestId, text });
        });

        // Handle completion
        stream.on('end', () => {
          // Save assistant response to history
          addToHistory(sessionId, 'assistant', fullResponse);
          
          const latencyMs = Date.now() - startTime;
          metrics.totalTokens += tokenCount;
          metrics._latencies.push(latencyMs);
          if (metrics._latencies.length > 100) metrics._latencies.shift();
          metrics.avgLatencyMs = Math.round(
            metrics._latencies.reduce((a, b) => a + b, 0) / metrics._latencies.length
          );

          socket.emit('chat:stream:end', {
            requestId,
            sessionId,
            tokenCount,
            latencyMs,
          });

          activeStreamCount--;
        });

        stream.on('error', (err) => {
          console.error(`[socketio] Stream error for ${clientId}:`, err.message);
          metrics.totalErrors++;
          activeStreamCount--;

          socket.emit('chat:stream:error', {
            requestId,
            error: 'STREAM_ERROR',
            message: 'Response generation failed. Please retry.',
          });
        });

      } catch (err) {
        console.error(`[socketio] API error for ${clientId}:`, err.message);
        metrics.totalErrors++;
        activeStreamCount--;

        const errorCode = err.status === 429 ? 'RATE_LIMITED' :
                          err.status === 529 ? 'API_OVERLOADED' :
                          'API_ERROR';

        socket.emit('chat:stream:error', {
          requestId,
          error: errorCode,
          message: errorCode === 'RATE_LIMITED'
            ? 'AI service is rate limited. Please wait a moment.'
            : 'Failed to get AI response. Please retry.',
        });
      }
    });

    // ─── Session Management ───
    socket.on('chat:newSession', (data, ack) => {
      const newSessionId = randomUUID();
      ack?.({ sessionId: newSessionId });
    });

    socket.on('chat:clearHistory', (data, ack) => {
      if (data?.sessionId) {
        sessionHistory.delete(data.sessionId);
      }
      ack?.({ ok: true });
    });

    // ─── Typing Indicators (for future multi-user) ───
    socket.on('chat:typing', (data) => {
      // Broadcast to room if multi-user chat
      if (data?.roomId) {
        socket.to(data.roomId).emit('chat:userTyping', { userId: clientId });
      }
    });

    // ─── Room Support (for scaling / multi-user) ───
    socket.on('room:join', (data, ack) => {
      const room = data?.roomId;
      if (room) {
        socket.join(room);
        ack?.({ ok: true, room });
        console.log(`[socketio] ${clientId} joined room ${room}`);
      }
    });

    socket.on('room:leave', (data, ack) => {
      const room = data?.roomId;
      if (room) {
        socket.leave(room);
        ack?.({ ok: true });
      }
    });

    // ─── Disconnect ───
    socket.on('disconnect', (reason) => {
      metrics.activeConnections--;
      console.log(`[socketio] Client disconnected: ${clientId} (reason: ${reason}, active: ${metrics.activeConnections})`);
    });

    // ─── Error handling ───
    socket.on('error', (err) => {
      console.error(`[socketio] Socket error for ${clientId}:`, err.message);
      metrics.totalErrors++;
    });
  });

  // ─── Metrics Getter ───
  function getMetrics() {
    return {
      ...metrics,
      _latencies: undefined,  // Don't expose raw latencies
      activeStreams: activeStreamCount,
      sessions: sessionHistory.size,
      uptime: Math.round((Date.now() - metrics.upSince) / 1000),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      transport: 'socket.io',
    };
  }

  console.log('  ✓ Socket.io bridge attached (namespace: /chat)');
  return { io, chatNs, getMetrics };
}

module.exports = { attachSocketIO };
