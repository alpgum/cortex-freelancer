# CFX-021: Server-Sent Events (SSE) Implementation

## Overview

SSE provides a reliable fallback transport when WebSocket connections are unavailable or blocked. The implementation streams AI responses token-by-token via HTTP, using the standard `text/event-stream` format.

## Architecture

```
┌──────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Browser  │────▶│  /api/chat-stream │────▶│  Anthropic API  │
│           │◀────│  (SSE endpoint)   │◀────│  (streaming)    │
│ EventSource│    └──────────────────┘     └─────────────────┘
│ or fetch() │
└──────────┘
```

### Transport Fallback Chain (3-Tier)

```
Tier 1: WebSocket (ws-bridge)      ← primary, full-duplex
Tier 2: SSE (chat-stream)          ← fallback, server-push streaming
Tier 3: HTTP POST (chat.js)        ← last resort, no streaming
```

The `chat-dispatcher.js` client automatically selects the best available transport.

## Server Endpoints

### `POST /api/chat-stream` — Streaming Chat

Sends a chat message and receives AI response via SSE stream.

**Request:**
```json
{
  "message": "How should I price my web dev services?",
  "sessionId": "ctx-abc12345",
  "profile": { "name": "Alex", "hourlyRate": 75, "skills": ["React", "Node.js"] },
  "goals": { "incomeGoal": 8000, "workType": "remote" }
}
```

**Response:** SSE stream with the following events:

| Event | Description | Data |
|-------|-------------|------|
| `stream_start` | Connection established | `{ sessionId, connectionId }` |
| `stream_chunk` | Token from AI response | `{ chunk, index }` |
| `stream_end` | Response complete | `{ reply, sessionId, meta }` |
| `error` | Error occurred | `{ error, code, retryAfter? }` |
| `done` | Stream finished | `{ durationMs }` |

**SSE Comments (keepalive):**
```
: keepalive 1711324800000
```
Sent every 15s during processing to keep proxy connections alive.

### `GET /api/chat-stream` — SSE Health Info

Returns SSE service status and metrics.

```json
{
  "service": "cortex-sse",
  "status": "ready",
  "mode": "railway",
  "connections": { "active": 2, "total": 150, "streaming": 1 },
  "performance": { "avgResponseMs": 3200, "totalMessages": 148 },
  "errors": { "total": 3, "byCode": { "S501": 2, "S300": 1 } },
  "uptime": 86400
}
```

### `GET /api/sse/health` — Detailed SSE Metrics

Returns full metrics including active connection details (for monitoring dashboard integration with CFX-005).

## Server Variants

| File | Mode | When Used |
|------|------|-----------|
| `api/chat-stream.js` | Local | Spawns `openclaw` CLI (dev, local deployments) |
| `api/chat-stream-railway.js` | Railway | Direct Anthropic SDK calls (production) |

The correct variant is selected automatically in `server.js` based on `config.isRailway`.

## Error Codes (CFX-007)

All SSE errors use S-prefixed codes to distinguish from WebSocket E-codes:

| Code | Category | Description | Retryable |
|------|----------|-------------|-----------|
| S300 | rate | Rate limit exceeded | ✅ (60s) |
| S301 | rate | Server busy / concurrent limit | ✅ (5s) |
| S400 | client | Message is required | ❌ |
| S401 | client | Invalid HTTP method | ❌ |
| S402 | client | Message too long (>4000 chars) | ❌ |
| S500 | server | AI service unavailable | ✅ (5s) |
| S501 | server | Response timeout | ✅ (3s) |
| S502 | server | AI service overloaded | ✅ (30s) |
| S503 | resource | Server resources exhausted | ✅ (30s) |
| S504 | config | API key not configured | ❌ |

## Client Integration

### chat-dispatcher.js (Primary)

The dispatcher handles transport selection:

```javascript
// Transport priority:
// 1. WebSocket (CortexWsReconnect.isConnected())
// 2. SSE (EventSource available && !sseFailed)
// 3. HTTP POST (last resort)

var result = await CortexChatDispatcher.send("My question", {
  onStreamStart: function() { /* show typing indicator */ },
  onChunk: function(chunk, index) { /* append token */ },
  onDone: function(reply, meta) { /* render final */ },
  onError: function(error) { /* show error */ },
});
```

### chat-streaming.js (Standalone)

Lower-level SSE client using fetch + ReadableStream:

```javascript
CortexFreelancer.ChatStreaming.streamMessage('/api/chat-stream', body, {
  onToken: function(token, fullText) { /* per-token */ },
  onDone: function(fullText) { /* complete */ },
  onError: function(err) { /* error */ },
});
```

### Connection Mode Detection

```javascript
CortexChatDispatcher.getConnectionMode();
// Returns: 'websocket' | 'reconnecting' | 'sse' | 'http'
```

## Performance Characteristics

| Metric | WebSocket | SSE | HTTP |
|--------|-----------|-----|------|
| Streaming | ✅ Token-by-token | ✅ Token-by-token | ❌ Full response |
| Connection | Persistent | Per-request | Per-request |
| Overhead | Low (binary frames) | Medium (HTTP headers per chunk) | High (full HTTP per message) |
| Proxy friendly | ⚠️ Some block | ✅ Standard HTTP | ✅ Standard HTTP |
| Mobile networks | ⚠️ Drops on switch | ✅ Reconnects naturally | ✅ Reconnects naturally |
| Bidirectional | ✅ Full duplex | ❌ Server→Client only | ❌ Request→Response |

### When SSE Wins

- Corporate firewalls that block WebSocket upgrades
- HTTP/2 environments (multiplexed SSE streams)
- Mobile networks with frequent reconnects
- Proxy/CDN configurations that buffer WebSocket but stream HTTP

## Mobile Optimization (CFX-009)

- SSE uses standard HTTP — works reliably on cellular networks
- Keepalive comments prevent proxy timeout on mobile carriers
- `AbortController` enables clean cancellation on page unload/navigation
- Natural reconnection: each message is a new HTTP request (no persistent state to recover)

## Browser Compatibility

| Browser | SSE Support | ReadableStream | Notes |
|---------|-------------|----------------|-------|
| Chrome 52+ | ✅ | ✅ | Full streaming |
| Firefox 65+ | ✅ | ✅ | Full streaming |
| Safari 15+ | ✅ | ✅ | Full streaming |
| Safari 10-14 | ✅ | ⚠️ Buffered | Works, but buffers response |
| Edge 79+ | ✅ | ✅ | Full streaming |
| IE 11 | ❌ | ❌ | Falls back to HTTP |

The `browser-compat-test.js` validates SSE capabilities at runtime.

## Monitoring Integration (CFX-005)

SSE metrics are exposed via:
- `GET /api/chat-stream` — Quick status check
- `GET /api/sse/health` — Full metrics (for status.html dashboard)
- Connection tracking: active connections, response times, error rates
- Resource health checks: memory usage, CPU load

## Files

| File | Purpose |
|------|---------|
| `api/chat-stream.js` | SSE server endpoint (local/OpenClaw CLI mode) |
| `api/chat-stream-railway.js` | SSE server endpoint (Railway/Anthropic SDK mode) |
| `app/js/chat-dispatcher.js` | Client transport selector (WS → SSE → HTTP) |
| `app/js/chat-streaming.js` | Standalone SSE streaming client |
| `app/js/chat-error-handler.js` | Error classification (S-prefixed SSE codes) |
| `app/js/browser-compat-test.js` | Runtime SSE capability detection |
| `server.js` | Route mounting and variant selection |
| `docs/SSE_IMPLEMENTATION.md` | This document |
