# CFX-022: Progressive Connection Fallback Strategy

## Overview

Cortex Freelancer uses a three-tier progressive degradation strategy to ensure the chat works on any network condition, from ideal to extremely restrictive.

```
┌─────────────┐   fail   ┌──────────┐   fail   ┌──────────────┐
│  WebSocket  │ ───────→ │   SSE    │ ───────→ │ Long Polling │
│  (Tier 1)   │          │ (Tier 2) │          │   (Tier 3)   │
└─────────────┘          └──────────┘          └──────────────┘
   Real-time              Streaming              Universal
   Bidirectional          Server-push            HTTP POST
```

## Transport Tiers

### Tier 1: WebSocket (`ws-bridge-railway.js`)
- **Protocol:** `wss://` persistent connection
- **Latency:** ~50ms token delivery
- **Features:** Bidirectional, health pings, connection monitoring
- **Requirements:** WebSocket-capable proxy/network
- **Battery impact:** Low (single persistent connection)
- **When it fails:** Corporate proxies, some CDNs, restrictive firewalls

### Tier 2: SSE (`chat-stream.js`)
- **Protocol:** HTTP POST → `text/event-stream` response
- **Latency:** ~100ms token delivery
- **Features:** Token-by-token streaming, abort support
- **Requirements:** HTTP/1.1+ with chunked transfer
- **Battery impact:** Low-medium (connection held during response)
- **When it fails:** Very old browsers, proxies that buffer entire responses

### Tier 3: Long Polling (`chat-poll.js`)
- **Protocol:** Standard HTTP POST request/response
- **Latency:** 1-2s (polling interval dependent)
- **Features:** Adaptive intervals, battery-aware, chunk cursoring
- **Requirements:** Basic HTTP (works everywhere)
- **Battery impact:** Medium (periodic requests)
- **When it fails:** Almost never — works on any HTTP-capable device

## Fallback Logic (`connection-fallback.js`)

### Detection
1. Manager tries WebSocket first
2. On 2 consecutive failures → marks transport as failed, falls to SSE
3. On 2 consecutive SSE failures → marks failed, falls to Long Polling
4. Successful response → marks transport as working, saves preference

### Preference Persistence
- Last working transport saved to `localStorage` (`cortex_transport_preference`)
- Expires after 24 hours → retries higher tiers periodically
- Can be manually reset via `manager.reset()`
- Can be forced via `manager.forceTransport('longpoll')`

### Recovery
- Every 24h, the saved preference expires
- On next message, system retries from WebSocket
- If higher tier works again, it auto-upgrades

## Long Polling Architecture

### Server Flow (`/api/chat-poll`)

```
Client                          Server
  │                               │
  ├─ POST {action:"send"} ──────→│ Creates pollId, starts processing
  │←── {pollId, status} ─────────┤
  │                               │
  ├─ POST {action:"poll"} ──────→│ Hangs up to 25s waiting for data
  │        ... (waiting) ...      │
  │←── {chunks[], status} ───────┤ Returns new chunks or timeout
  │                               │
  ├─ POST {action:"poll"} ──────→│ Gets remaining chunks
  │←── {fullText, status} ───────┤ Complete!
  │                               │
  ├─ POST {action:"ack"} ───────→│ Cleanup
  │←── {ok: true} ───────────────┤
```

### Adaptive Polling Intervals

| Condition          | Interval | Rationale                           |
| ------------------ | -------- | ----------------------------------- |
| Active streaming   | 1.0s     | Fast token delivery                 |
| Active (mobile)    | 1.5s     | Slightly slower to save battery     |
| Idle               | 5.0s     | No active request                   |
| Low battery        | 2× base  | Conserve power                      |
| Error (1st retry)  | 2.0s     | Quick retry                         |
| Error (escalating) | up to 30s| Exponential backoff (×1.5 per fail) |

### Request Deduplication
- `_requestInFlight` flag prevents overlapping poll requests
- Ensures exactly one HTTP request is pending at any time

### Server-Side Timeouts
- Long poll hangs max 25s (below most proxy 30s limits)
- Response TTL: 5 minutes (completed responses stay for late polls)
- Session TTL: 30 minutes
- Processing timeout: 120s (kills stuck processes)

## Browser Support Matrix

| Browser            | WebSocket | SSE | Long Polling |
| ------------------ | --------- | --- | ------------ |
| Chrome 80+         | ✅        | ✅  | ✅           |
| Firefox 78+        | ✅        | ✅  | ✅           |
| Safari 14+         | ✅        | ✅  | ✅           |
| Edge 80+           | ✅        | ✅  | ✅           |
| Samsung Internet 12+| ✅       | ✅  | ✅           |
| Opera 67+          | ✅        | ✅  | ✅           |
| IE 11              | ✅*       | ❌  | ✅           |
| UC Browser         | ✅        | ❌  | ✅           |
| Opera Mini         | ❌        | ❌  | ✅           |
| Feature phones     | ❌        | ❌  | ✅**         |

\* IE11 WebSocket has quirks
\** Requires basic JS + fetch/XHR

## Performance Characteristics

| Metric              | WebSocket | SSE    | Long Polling |
| ------------------- | --------- | ------ | ------------ |
| First token latency | ~50ms     | ~100ms | ~1-2s        |
| Bandwidth overhead  | Low       | Low    | Medium       |
| Server connections  | 1 persist | 1/req  | 1/poll       |
| CPU (client)        | Minimal   | Low    | Low-medium   |
| Battery (mobile)    | Low       | Low    | Medium       |
| Works behind proxy  | Sometimes | Usually| Always       |
| Works on 2G/3G      | Fragile   | OK     | Best         |

## Network Condition Handling

### Corporate/Restrictive Networks
- WebSocket blocked → SSE attempt → Long Polling works
- Proxy buffering breaks SSE → Long Polling works
- HTTPS inspection doesn't affect Long Polling

### Mobile Networks (2G/3G/poor signal)
- WebSocket drops frequently → SSE streams but slow → Long Polling most reliable
- Battery-aware polling reduces impact on low battery
- Adaptive intervals reduce bandwidth on metered connections

### Intermittent Connectivity
- WebSocket disconnects instantly → SSE fails mid-stream
- Long Polling: each request is independent, natural recovery
- Missed chunks retrieved on next poll (server buffers responses)

## Files

| File | Purpose |
| ---- | ------- |
| `api/chat-poll.js` | Long polling server endpoint |
| `app/js/chat-long-polling.js` | Client long polling transport |
| `app/js/connection-fallback.js` | Progressive degradation orchestrator |
| `tests/long-polling.test.js` | Integration & unit tests |
| `api/ws-bridge-railway.js` | WebSocket (Tier 1) |
| `api/chat-stream.js` | SSE (Tier 2) |

## Usage

### Basic (auto-fallback)
```html
<script src="/app/js/chat-streaming.js"></script>
<script src="/app/js/chat-long-polling.js"></script>
<script src="/app/js/connection-fallback.js"></script>
<script>
  var manager = CortexFreelancer.ConnectionFallback.create({
    wsUrl: 'wss://your-domain.com',
    sseUrl: '/api/chat-stream',
    pollUrl: '/api/chat-poll',
    onToken: function(token, full) { /* render token */ },
    onDone: function(text, meta) { /* response complete */ },
    onError: function(err) { /* handle error */ },
    onTransportChange: function(transport, label) {
      console.log('Now using:', label);
    },
  });

  manager.send('How do I negotiate a rate increase?');
</script>
```

### Force specific transport
```js
manager.forceTransport('longpoll'); // Skip WS and SSE
manager.send('My message');
```

### Check status
```js
console.log(manager.getStatus());
// { currentTransport: 'longpoll', support: {...}, failedTransports: [...] }
```

### Reset and retry from top
```js
manager.reset(); // Clears failed list, retries from WebSocket
```
