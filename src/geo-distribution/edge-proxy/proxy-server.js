/**
 * CFX-048: Edge Proxy Server
 * ==========================
 * Lightweight proxy that relays WebSocket, SSE, and HTTP polling
 * connections from nearby clients to the origin OpenClaw server.
 *
 * Each edge region runs one of these. It does NOT run OpenClaw itself —
 * it's a dumb pipe with health checks and connection management.
 *
 * Env vars:
 *   ORIGIN_URL          - Origin OpenClaw URL (wss://... or https://...)
 *   EDGE_REGION         - This edge's region ID (eu-west, us-east, etc.)
 *   PORT                - Listen port (default 3000)
 *   HEALTH_CHECK_INTERVAL - How often to ping origin (ms, default 30000)
 *   MAX_CONNECTIONS     - Max concurrent proxy connections (default 1000)
 *   ORIGIN_API_KEY      - Optional auth key for origin
 */

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const WebSocket = require('ws');
const httpProxy = require('http-proxy');

// ── Config ──────────────────────────────────────────────────────────────────

const ORIGIN_URL = process.env.ORIGIN_URL || 'ws://localhost:3847';
const EDGE_REGION = process.env.EDGE_REGION || 'unknown';
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000;
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS, 10) || 1000;
const ORIGIN_API_KEY = process.env.ORIGIN_API_KEY || '';

// Parse origin for HTTP proxy
const originParsed = new URL(ORIGIN_URL.replace(/^ws/, 'http'));
const originHttpUrl = originParsed.toString().replace(/\/$/, '');

// ── State ───────────────────────────────────────────────────────────────────

let activeConnections = 0;
let totalConnections = 0;
let originHealthy = true;
let lastHealthCheck = null;
let startTime = Date.now();

// ── HTTP Proxy (for SSE + polling) ──────────────────────────────────────────

const proxy = httpProxy.createProxyServer({
  target: originHttpUrl,
  changeOrigin: true,
  ws: false, // We handle WS separately
  timeout: 30000,
  proxyTimeout: 60000,
  headers: {
    'X-Edge-Region': EDGE_REGION,
    ...(ORIGIN_API_KEY ? { 'X-Origin-API-Key': ORIGIN_API_KEY } : {})
  }
});

proxy.on('error', (err, req, res) => {
  console.error(`[proxy] HTTP proxy error: ${err.message}`);
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'edge_proxy_upstream_error',
      region: EDGE_REGION,
      message: 'Origin server unreachable'
    }));
  }
});

// ── HTTP Server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Id');
  res.setHeader('X-Edge-Region', EDGE_REGION);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Health endpoint — not proxied
  if (req.url === '/health') {
    return handleHealth(req, res);
  }

  // Edge info endpoint
  if (req.url === '/edge/info') {
    return handleEdgeInfo(req, res);
  }

  // Everything else → proxy to origin
  if (activeConnections >= MAX_CONNECTIONS) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      error: 'edge_at_capacity',
      region: EDGE_REGION,
      maxConnections: MAX_CONNECTIONS
    }));
  }

  proxy.web(req, res);
});

// ── WebSocket Proxy ─────────────────────────────────────────────────────────

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (activeConnections >= MAX_CONNECTIONS) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (clientWs) => {
    handleWebSocketProxy(clientWs, req);
  });
});

function handleWebSocketProxy(clientWs, req) {
  activeConnections++;
  totalConnections++;

  const connId = totalConnections;
  console.log(`[ws] #${connId} Client connected from ${req.headers['x-forwarded-for'] || req.socket.remoteAddress} (active: ${activeConnections})`);

  // Build origin WS URL preserving the path
  const wsOrigin = ORIGIN_URL.replace(/^http/, 'ws');
  const upstreamUrl = `${wsOrigin}${req.url || ''}`;

  const upstreamHeaders = {
    'X-Edge-Region': EDGE_REGION,
    'X-Forwarded-For': req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    'X-Original-Host': req.headers.host || ''
  };
  if (ORIGIN_API_KEY) {
    upstreamHeaders['X-Origin-API-Key'] = ORIGIN_API_KEY;
  }

  // Connect to origin
  const originWs = new WebSocket(upstreamUrl, {
    headers: upstreamHeaders,
    handshakeTimeout: 10000
  });

  let clientAlive = true;
  let originAlive = false;
  const messageBuffer = [];

  originWs.on('open', () => {
    originAlive = true;
    // Flush buffered messages
    while (messageBuffer.length > 0) {
      const msg = messageBuffer.shift();
      originWs.send(msg);
    }
  });

  // Client → Origin
  clientWs.on('message', (data) => {
    if (originAlive) {
      originWs.send(data);
    } else {
      // Buffer messages while origin connection is establishing
      if (messageBuffer.length < 100) {
        messageBuffer.push(data);
      }
    }
  });

  // Origin → Client
  originWs.on('message', (data) => {
    if (clientAlive && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
    }
  });

  // Cleanup on close
  const cleanup = (source) => {
    console.log(`[ws] #${connId} Closed (source: ${source}, active: ${activeConnections - 1})`);
    activeConnections--;
    clientAlive = false;
    originAlive = false;

    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    if (originWs.readyState === WebSocket.OPEN) originWs.close();
  };

  clientWs.on('close', () => cleanup('client'));
  clientWs.on('error', (err) => {
    console.error(`[ws] #${connId} Client error: ${err.message}`);
    cleanup('client-error');
  });

  originWs.on('close', () => {
    if (clientAlive) {
      // Origin closed — notify client with close code
      clientWs.close(1001, 'Origin disconnected');
    }
    cleanup('origin');
  });

  originWs.on('error', (err) => {
    console.error(`[ws] #${connId} Origin error: ${err.message}`);
    if (clientAlive) {
      clientWs.close(1011, 'Origin error');
    }
    cleanup('origin-error');
  });

  // Ping/pong keepalive
  const pingInterval = setInterval(() => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.ping();
    }
    if (originWs.readyState === WebSocket.OPEN) {
      originWs.ping();
    }
  }, 30000);

  clientWs.on('close', () => clearInterval(pingInterval));
}

// ── Health Check ────────────────────────────────────────────────────────────

function handleHealth(req, res) {
  const health = {
    status: originHealthy ? 'healthy' : 'degraded',
    region: EDGE_REGION,
    origin: {
      url: originParsed.host,
      healthy: originHealthy,
      lastCheck: lastHealthCheck
    },
    connections: {
      active: activeConnections,
      total: totalConnections,
      max: MAX_CONNECTIONS
    },
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  };

  const statusCode = originHealthy ? 200 : 503;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(health));
}

function handleEdgeInfo(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    region: EDGE_REGION,
    healthy: originHealthy,
    activeConnections,
    uptime: Math.floor((Date.now() - startTime) / 1000)
  }));
}

// ── Origin Health Monitor ───────────────────────────────────────────────────

function checkOriginHealth() {
  const healthUrl = `${originHttpUrl}/api/health`;
  const client = healthUrl.startsWith('https') ? https : http;

  const req = client.get(healthUrl, { timeout: 10000 }, (res) => {
    originHealthy = res.statusCode >= 200 && res.statusCode < 400;
    lastHealthCheck = new Date().toISOString();
    res.resume(); // drain
    if (!originHealthy) {
      console.warn(`[health] Origin unhealthy: HTTP ${res.statusCode}`);
    }
  });

  req.on('error', (err) => {
    originHealthy = false;
    lastHealthCheck = new Date().toISOString();
    console.warn(`[health] Origin check failed: ${err.message}`);
  });

  req.on('timeout', () => {
    req.destroy();
    originHealthy = false;
    lastHealthCheck = new Date().toISOString();
    console.warn('[health] Origin check timed out');
  });
}

// Run health check on startup and then periodically
checkOriginHealth();
setInterval(checkOriginHealth, HEALTH_CHECK_INTERVAL);

// ── Start ───────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[edge-proxy] Region: ${EDGE_REGION}`);
  console.log(`[edge-proxy] Listening on port ${PORT}`);
  console.log(`[edge-proxy] Origin: ${originParsed.host}`);
  console.log(`[edge-proxy] Max connections: ${MAX_CONNECTIONS}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[edge-proxy] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000);
});
