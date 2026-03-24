# CFX-026: REST API with Polling

## Overview

Simplest chat transport — pure HTTP request/response with client-side polling. Final fallback when WebSocket, SSE, Chunked Transfer, and Long Polling all fail.

**Transport Hierarchy:**
1. WebSocket (real-time, full-duplex)
2. Server-Sent Events (SSE, streaming)
3. HTTP Chunked Transfer (streaming over plain HTTP)
4. Long Polling (efficient HTTP with 25s hang)
5. **→ REST Polling** ← This implementation

Works on any network that supports basic HTTP POST requests.

## Architecture

```
Client                              Server (/api/chat-rest)
  │                                    │
  │── POST {action:"send"} ──────────►│ Queue request
  │◄── {requestId, status:"queued"} ──│
  │                                    │
  │── POST {action:"poll"} ──────────►│ Check status
  │◄── {status:"processing", 65%} ───│
  │                                    │
  │── POST {action:"poll"} ──────────►│ Check status
  │◄── {status:"complete"} ──────────│
  │                                    │
  │── POST {action:"result"} ────────►│ Return full response
  │◄── {result:"...", meta:{}} ───────│
```

## API (Single Endpoint)

All operations go through `POST /api/chat-rest` with an `action` field.

### Send Message

```json
// Request
POST /api/chat-rest
{
  "action": "send",
  "message": "Help me price my freelance services",
  "sessionId": "optional-session-id",
  "profile": { "name": "...", "hourlyRate": 85 },
  "goals": { "incomeGoal": 10000 }
}

// Response (201)
{
  "requestId": "rest_1711324800_abc123def456",
  "sessionId": "session_1711324800_xyz",
  "status": "queued",
  "position": 1,
  "estimatedWaitMs": 0,
  "pollInterval": 1000,
  "rateLimit": { "remaining": 19 }
}
```

### Poll Status

```json
// Request
POST /api/chat-rest
{ "action": "poll", "requestId": "rest_1711324800_abc123def456" }

// Response — Processing
{
  "requestId": "rest_1711324800_abc123def456",
  "status": "processing",
  "progress": 0.65,
  "estimatedTimeRemaining": 3000,
  "pollInterval": 1000
}

// Response — Complete
{
  "requestId": "rest_1711324800_abc123def456",
  "status": "complete",
  "hasResult": true,
  "resultLength": 1250,
  "pollInterval": 60000
}
```

### Get Result

```json
// Request
POST /api/chat-rest
{ "action": "result", "requestId": "rest_1711324800_abc123def456" }

// Response
{
  "requestId": "rest_1711324800_abc123def456",
  "status": "complete",
  "result": "Based on your profile, I recommend...",
  "sessionId": "session_1711324800_xyz",
  "meta": {
    "model": "claude-sonnet-4",
    "processingTimeMs": 8500,
    "usage": { "input_tokens": 320, "output_tokens": 890 }
  },
  "completedAt": "2026-03-25T01:15:30.123Z"
}
```

### Cancel Request

```json
POST /api/chat-rest
{ "action": "cancel", "requestId": "rest_1711324800_abc123def456" }

// Response
{ "requestId": "...", "status": "cancelled", "message": "Request cancelled successfully" }
```

### Health Check

```json
POST /api/chat-rest
{ "action": "health" }

// Response
{
  "status": "healthy",
  "transport": "rest-polling",
  "queue": { "total": 3, "queued": 1, "processing": 1, "complete": 1 },
  "rateLimit": { "windowMs": 300000, "maxRequests": 20, "activeClients": 5 }
}
```

## Error Responses

| Status | Code  | Meaning                          |
|--------|-------|----------------------------------|
| 400    | E400  | Invalid action or missing fields |
| 404    | E404  | Request not found or expired     |
| 405    | E405  | Method not allowed (use POST)    |
| 409    | E409  | Result not ready yet             |
| 410    | —     | Request expired                  |
| 429    | E429  | Rate limit exceeded              |
| 503    | E503  | Server busy / AI unavailable     |
| 500    | E500  | Internal error                   |

## Status Lifecycle

```
queued → processing → complete
                    → error
       → cancelled
       → expired
```

## Client Usage

### Minimal Example

```javascript
async function askCortex(message) {
  // 1. Submit
  const submit = await fetch('/api/chat-rest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send', message })
  }).then(r => r.json());

  // 2. Poll until done
  while (true) {
    await new Promise(r => setTimeout(r, submit.pollInterval || 1000));

    const status = await fetch('/api/chat-rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'poll', requestId: submit.requestId })
    }).then(r => r.json());

    if (status.status === 'complete') {
      // 3. Get result
      return fetch('/api/chat-rest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'result', requestId: submit.requestId })
      }).then(r => r.json());
    }

    if (status.status === 'error') throw new Error(status.error);
  }
}
```

### With RestPollingClient

```html
<script src="/cfx-026-rest-polling/client.js"></script>
<script>
  var client = new CortexRestPolling({ baseUrl: '' });
  client.sendMessage('Help with pricing', {
    onProgress: function(s) { console.log(s.status, s.progress); },
    onComplete: function(r) { console.log('Done:', r.result); },
    onError: function(e) { console.error(e); }
  });
</script>
```

## Production Limits

| Setting             | Value                |
|---------------------|----------------------|
| Rate limit          | 20 req / 5 min / IP  |
| Message size        | 4,000 chars max      |
| Concurrent requests | 100 max              |
| Request TTL         | 10 minutes           |
| Result cache TTL    | 5 minutes            |
| Process timeout     | 120 seconds          |

## Files

| File              | Purpose                                   |
|-------------------|-------------------------------------------|
| `server.js`       | Standalone Express server (dev/test)       |
| `client.js`       | Browser client with adaptive polling       |
| `queue-manager.js`| Request queue with TTL management          |
| `rate-limiter.js` | IP-based sliding window rate limiter       |
| `integration.js`  | Chat dispatcher integration patch          |
| `test-server.js`  | Dev server with mock processor             |
| `test-client.html`| Browser test UI                            |
| **`../api/chat-rest.js`** | **Production serverless handler** |

## Performance Characteristics

- **Latency**: 2-8s typical (AI processing) + polling overhead
- **Bandwidth**: ~2-5 polls per request (adaptive intervals)
- **Compatibility**: Any browser with `fetch` + `Promise` + `AbortController`
- **Fallback**: Works on IE11+ with polyfills via basic XMLHttpRequest
- **Battery**: Doubles poll interval when battery < 20% (mobile)
