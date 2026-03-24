# CFX-024: Socket.io Integration

## Status: ✅ Complete

## Overview

Socket.io integrated as a battle-tested WebSocket alternative for Cortex Freelancer's real-time chat. Coexists with the existing raw WebSocket (`ws`) implementation — both can run simultaneously on the same server.

## Architecture

```
Client Browser
├── CortexSocketIO (socketio-client.js)     ← Socket.io client
├── CortexWsReconnect (ws-reconnect.js)     ← Raw WebSocket client
├── chat-dispatcher-socketio.js             ← Patches dispatcher to try Socket.io first
└── chat-dispatcher.js                      ← Existing dispatcher (WS → SSE → HTTP)

Express Server (server.js)
├── /socket.io (namespace: /chat)           ← Socket.io server (socketio-bridge.js)
├── /ws/chat                                ← Raw WebSocket (ws-bridge-railway.js)
├── /api/chat-stream                        ← SSE fallback
└── /api/chat                               ← HTTP POST fallback
```

## Transport Priority (with Socket.io)

1. **Socket.io** (auto-negotiates WebSocket or polling)
2. **Raw WebSocket** (existing ws-reconnect.js)
3. **SSE** (EventSource)
4. **HTTP Long-Polling** (custom)
5. **HTTP Chunked** (Transfer-Encoding: chunked)
6. **HTTP POST** (last resort)

## Files Created

| File | Purpose |
|------|---------|
| `api/socketio-bridge.js` | Server-side Socket.io integration |
| `app/js/socketio-client.js` | Client-side Socket.io wrapper |
| `app/js/chat-dispatcher-socketio.js` | Dispatcher patch for Socket.io priority |
| `tests/socketio-integration.test.js` | 18 integration tests (all passing) |
| `docs/CFX-024-SOCKETIO.md` | This document |

## Server Integration

Add to `server.js` after the existing WebSocket bridge:

```js
// ── Socket.io Bridge (CFX-024: battle-tested alternative) ──
const { attachSocketIO } = require('./api/socketio-bridge');
const socketioResult = attachSocketIO(server);

// Expose Socket.io metrics alongside WS/SSE metrics
app.get('/api/socketio/health', (req, res) => {
  res.json(socketioResult.getMetrics());
});
```

## Client Integration

Add to chat.html:

```html
<!-- Socket.io client (CDN) -->
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>

<!-- Cortex Socket.io client -->
<script src="/app/js/socketio-client.js"></script>

<!-- Dispatcher integration (load AFTER chat-dispatcher.js and socketio-client.js) -->
<script src="/app/js/chat-dispatcher-socketio.js"></script>
```

## Socket.io vs Raw WebSocket Comparison

| Feature | Socket.io | Raw `ws` (current) |
|---------|-----------|-------------------|
| **Transport fallback** | ✅ Automatic (WS → polling) | ❌ Manual SSE/HTTP fallback |
| **Reconnection** | ✅ Built-in, configurable | ✅ Custom (ws-reconnect.js) |
| **Heartbeat** | ✅ Built-in ping/pong | ✅ Custom implementation |
| **Browser compat** | ✅ IE9+ (via polling) | ⚠️ IE10+ (WebSocket only) |
| **Message acknowledgment** | ✅ Native callback acks | ❌ Must implement manually |
| **Rooms/namespaces** | ✅ Built-in | ❌ Not supported |
| **Binary data** | ✅ Native | ✅ Native |
| **Bundle size (client)** | ~45KB min+gz | ~0KB (native WebSocket) |
| **Multiplexing** | ✅ Multiple namespaces, 1 connection | ❌ 1 connection = 1 purpose |
| **Middleware** | ✅ Per-namespace middleware | ❌ Manual |
| **Compression** | ✅ perMessageDeflate | ⚠️ Manual setup |

## Performance Notes

- **Latency**: Socket.io adds ~1-2ms overhead vs raw WS (negligible for chat)
- **Bundle size**: +45KB gzipped client library (CDN-cached, loads once)
- **Memory**: Socket.io server uses ~2-5MB more than raw `ws` at idle
- **Connection establishment**: Socket.io may start with polling then upgrade to WS (~200ms delay on first connect)
- **Throughput**: Comparable for chat workloads (<100 msg/s per client)

## Key Socket.io Benefits for Production

1. **Automatic fallback**: Corporate firewalls blocking WS? Socket.io falls back to HTTP long-polling transparently
2. **Reconnection**: Built-in exponential backoff with jitter — replaces our 100-line ws-reconnect.js
3. **Mobile reliability**: Better handling of network transitions (WiFi → cellular)
4. **Acknowledgments**: Native callback-based message acks — no custom request/response matching
5. **Rooms**: Future multi-user chat support with zero additional code

## Migration Path

### Phase 1: Coexistence (Current)
Both transports active. Socket.io tried first, falls back to raw WS/SSE/HTTP.

### Phase 2: Socket.io Primary
Remove raw WS client code, keep Socket.io only. Raw WS bridge remains for API clients.

### Phase 3: Full Migration (Optional)
Remove ws-bridge entirely. Socket.io handles all real-time communication.

## Events API

### Client → Server
| Event | Payload | Ack |
|-------|---------|-----|
| `chat:message` | `{ message, sessionId, requestId, profile?, goals? }` | `{ ok, requestId }` or `{ error, message }` |
| `chat:newSession` | `{}` | `{ sessionId }` |
| `chat:clearHistory` | `{ sessionId }` | `{ ok }` |
| `chat:typing` | `{ roomId }` | — |
| `room:join` | `{ roomId }` | `{ ok, room }` |
| `room:leave` | `{ roomId }` | `{ ok }` |

### Server → Client
| Event | Payload |
|-------|---------|
| `chat:stream:start` | `{ requestId, sessionId }` |
| `chat:stream:token` | `{ requestId, text }` |
| `chat:stream:end` | `{ requestId, sessionId, tokenCount, latencyMs }` |
| `chat:stream:error` | `{ requestId, error, message }` |
| `chat:userTyping` | `{ userId }` |

## Test Results

```
18 passed, 0 failed
├── Module Loading (3)
├── Server Setup (2)
├── Client Connection — WebSocket & Polling (2)
├── Message Handling — validation & errors (3)
├── Session Management (2)
├── Room Support (2)
├── Metrics (1)
├── Rate Limiting (1)
└── Disconnect & Reconnection (2)
```

## Dependencies Added

```json
{
  "socket.io": "^4.x",
  "socket.io-client": "^4.x"  // Also used for testing; CDN for production client
}
```
