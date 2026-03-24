# CFX-023: HTTP Chunked Transfer Encoding

## Overview

HTTP chunked transfer provides streaming chat responses over standard HTTP without requiring WebSocket or Server-Sent Events (SSE). It works on any network that supports basic HTTP/1.1, making it the most universally compatible streaming method.

## Architecture

### Fallback Cascade (4 tiers)

```
WebSocket → SSE → Chunked Transfer → Long Polling → Plain HTTP
   Tier 1    Tier 2      Tier 3          Tier 4        Tier 5
```

Chunked transfer sits between SSE and plain HTTP. It provides streaming capability without SSE's `EventSource` requirement, working with the standard Fetch API `ReadableStream`.

### Wire Format: NDJSON

Newline-Delimited JSON (NDJSON) — each line is a complete JSON object:

```
{"type":"start","sessionId":"ctx-a1b2c3","connectionId":"chk-d4e5f6"}
{"type":"chunk","data":"Here is ","index":0}
{"type":"chunk","data":"the response","index":1}
{"type":"keepalive","ts":1711321234567}
{"type":"end","reply":"Here is the response","sessionId":"ctx-a1b2c3","meta":{"model":"claude"},"durationMs":3200}
```

### Why NDJSON over SSE format?

| Feature | SSE | NDJSON Chunked |
|---------|-----|----------------|
| Requires EventSource | Yes | No |
| Works with fetch ReadableStream | Requires custom parser | Native |
| Proxy-friendly | Sometimes buffered | Generally better |
| Bidirectional | No | No |
| Browser support | Modern browsers | All browsers with Fetch |
| Reconnection | Built-in | Manual |
| Content-Type | text/event-stream | application/x-ndjson |

## Files

| File | Purpose |
|------|---------|
| `api/chat-chunked.js` | Server endpoint — NDJSON streaming handler |
| `app/js/chat-chunked-stream.js` | Client module — stream consumer |
| `app/js/chat-dispatcher.js` | Updated fallback cascade (Tier 3) |
| `test-chunked-stream.js` | Test suite |

## Server Endpoint

### `GET /api/chat-chunked`

Health/status check. Returns JSON:

```json
{
  "service": "cortex-chunked",
  "status": "ready",
  "mode": "chunked-transfer",
  "connections": { "active": 0, "total": 42 },
  "performance": { "avgResponseMs": 2800, "totalMessages": 42 },
  "errors": { "byCode": {}, "total": 0 }
}
```

### `POST /api/chat-chunked`

Stream a chat response. Request body:

```json
{
  "message": "How should I price my services?",
  "sessionId": "ctx-optional",
  "profile": { "name": "...", "skills": [...] },
  "goals": { "incomeGoal": 5000 }
}
```

Response: `200 OK` with `Content-Type: application/x-ndjson`, `Transfer-Encoding: chunked`

### Error Codes (C-series)

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| C300 | Rate limited | 429 |
| C301 | Server busy | 429 |
| C400 | Invalid message | 400 |
| C401 | Invalid method | 405 |
| C402 | Message too long | 400 |
| C500 | Spawn error | 200 (in-stream) |
| C501 | Timeout | 200 (in-stream) |
| C502 | Resource exhausted | 503 |

## Client API

```javascript
var ChunkedStream = window.CortexFreelancer.ChunkedStream;

// Feature detection
ChunkedStream.isSupported();  // true if browser supports streaming fetch
ChunkedStream.hasFailed();    // true after 3 consecutive failures

// Stream a message
ChunkedStream.streamMessage('How do I find clients?', {
  sessionId: 'ctx-abc123',
  profile: { name: 'Alex' },
  onStart: function(info) { console.log('Stream started', info.connectionId); },
  onChunk: function(text, index) { appendToUI(text); },
  onDone: function(reply, meta) { showComplete(reply); },
  onError: function(err) { showError(err.error); },
  onKeepalive: function(ts) { /* connection alive */ },
});

// Abort
ChunkedStream.abort();

// State
ChunkedStream.isStreaming();  // boolean
ChunkedStream.getState();     // 'idle' | 'connecting' | 'streaming' | 'error'

// Health check
ChunkedStream.healthCheck().then(function(h) {
  console.log(h.available, h.status);
});
```

## Integration with Chat Dispatcher

The dispatcher (`chat-dispatcher.js`) automatically uses chunked transfer:

1. **WebSocket connected** → Use WebSocket (Tier 1)
2. **WebSocket reconnecting** → Queue via WebSocket
3. **SSE supported & not failed** → Use SSE (Tier 2)
   - If SSE fails → try Chunked (Tier 3) → then HTTP (Tier 4)
4. **Chunked supported & not failed** → Use Chunked (Tier 3)
   - If Chunked fails → fall to HTTP (Tier 4)
5. **All else** → Plain HTTP POST (Tier 4, no streaming)

`getConnectionMode()` returns: `'websocket'`, `'reconnecting'`, `'sse'`, `'chunked'`, or `'http'`

## Performance Characteristics

| Metric | Chunked | SSE | WebSocket |
|--------|---------|-----|-----------|
| First byte latency | ~same | ~same | Lower (no HTTP overhead) |
| Per-message overhead | ~20 bytes (JSON + newline) | ~30 bytes (event + data) | ~2 bytes (frame) |
| Proxy compatibility | Excellent | Good | Poor on some networks |
| Mobile battery | Good | Good | Better (persistent) |
| Reconnection | Per-request | Built-in | Custom |

### Chunk Size

Chunks are sent as they arrive from the AI backend — no artificial buffering. This gives the lowest possible latency. The NDJSON format adds minimal overhead (~20 bytes per chunk for the JSON wrapper).

### Keepalive

A keepalive JSON line (`{"type":"keepalive","ts":...}`) is sent every 15 seconds during processing. This prevents:
- Nginx/reverse proxy timeouts (usually 60s default)
- Load balancer idle connection kills
- Client-side timeout false positives

## Use Cases

**Best for:**
- Networks that block WebSocket but allow HTTP
- Environments where SSE EventSource is unavailable or filtered
- Corporate proxies that buffer SSE but pass chunked HTTP
- Simple HTTP clients (curl, httpie, scripts) consuming streams

**Not ideal for:**
- High-frequency bidirectional communication (use WebSocket)
- Clients that need automatic reconnection (use SSE)

## Testing

```bash
# Run test suite (requires server running)
node test-chunked-stream.js http://localhost:3000

# Manual curl test
curl -N -X POST http://localhost:3000/api/chat-chunked \
  -H 'Content-Type: application/json' \
  -d '{"message":"Hello"}'

# Health check
curl http://localhost:3000/api/chat-chunked
```

## Browser Compatibility

| Browser | Supported | Notes |
|---------|-----------|-------|
| Chrome 42+ | ✅ | Full ReadableStream support |
| Firefox 65+ | ✅ | Full ReadableStream support |
| Safari 10.1+ | ✅ | ReadableStream since macOS Sierra |
| Edge 14+ | ✅ | Full support |
| IE 11 | ❌ | No Fetch/ReadableStream — falls to plain HTTP |
| iOS Safari 10.3+ | ✅ | Works on all modern iPhones |
| Android Chrome 42+ | ✅ | Works on Android 5+ |

For browsers without ReadableStream, the client auto-detects and sets `hasFailed() = true`, causing the dispatcher to skip to plain HTTP.
