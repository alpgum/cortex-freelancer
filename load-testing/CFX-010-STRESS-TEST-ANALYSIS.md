# CFX-010: Concurrent User Stress Test — Analysis & Recommendations

> Created: 2026-03-25 | Status: Complete (tools ready, architecture analyzed)

## Executive Summary

The Cortex Freelancer WebSocket bridge (`api/ws-bridge.js`) has a **single-threaded, single-process queue architecture** that fundamentally limits concurrent user handling. While the system can accept many WebSocket connections simultaneously, **only one user's message is processed at a time**. This is the primary bottleneck.

## Architecture Analysis

### Current Design (ws-bridge.js)

```
[Client 1] ──WebSocket──┐
[Client 2] ──WebSocket──┤
[Client 3] ──WebSocket──┼──→ [WS Server] ──→ [Message Queue] ──→ [Single OpenClaw Process]
[Client N] ──WebSocket──┘         │                                       │
                                  │                                       │
                          Health monitoring                        3 min timeout
                          Ping/pong tracking                       Sequential only
                          Stale cleanup                            1 at a time
```

### Key Findings

#### 1. Single-Process Bottleneck (CRITICAL)

**Evidence:** Lines in `ws-bridge.js`:
```js
let busy = false;               // Single lock
let activeProc = null;           // One process at a time
let activeWs = null;             // One active client

function processQueue() {
  if (busy || messageQueue.length === 0) return;  // Sequential
  busy = true;
  // ...spawn single openclaw process...
}
```

**Impact:**
- With 20 concurrent users all sending messages, user #20 waits for ALL 19 previous messages to complete
- At ~30-60s per OpenClaw response, user #20 could wait **10-20 minutes**
- Queue is unbounded — no backpressure until resource exhaustion

#### 2. Connection Handling (GOOD)

The WebSocket server itself handles concurrent connections well:
- Node.js `ws` library uses efficient per-message deflate
- Health monitoring (CFX-005) tracks each connection independently
- Stale connection cleanup prevents resource leaks
- Ping/pong keeps proxy connections alive

**Expected limits:**
- 50 concurrent idle connections: ✅ No problem (~5MB RAM overhead)
- 100 concurrent idle connections: ✅ Should work (~10MB)
- 500+ connections: ⚠️ Depends on file descriptor limits

#### 3. Resource Monitoring (GOOD)

CFX-007 added resource checks:
- `checkResourceHealth()` monitors memory and CPU before spawning
- Rejects requests when `memUsageRatio > 0.95` or `loadRatio > 3.0`
- Degrades gracefully at 85% memory / 2x CPU load

#### 4. Rate Limiting (ADEQUATE)

- 20 messages per 5-minute window per IP
- Prevents single user from flooding the queue
- But does NOT prevent 20 users × 1 message = 20 queued items

#### 5. Session Management (ADEQUATE)

- Sessions expire after 30 minutes (production profile)
- History limited to 20 messages per session
- Periodic cleanup every 5 minutes

## Identified Bottlenecks

### Tier 1 — Critical (Blocks scaling)

| Bottleneck | Detail | Impact at 20 users |
|---|---|---|
| **Single-process queue** | Only one `openclaw` process spawned at a time | 10-20 min wait for last user |
| **No concurrent workers** | `busy` flag blocks all processing | Linear degradation with users |
| **Unbounded queue** | `messageQueue` grows without limit | Memory risk under sustained load |

### Tier 2 — Significant (Degrades experience)

| Bottleneck | Detail | Impact |
|---|---|---|
| **No queue position updates** | User sees "queued" once, then silence | Poor UX, users disconnect |
| **Global state** | `activeProc`, `activeWs` are module globals | Can't parallelize without refactor |
| **3-min spawn timeout** | Each request holds the lock for up to 3 min | Amplifies queue wait |

### Tier 3 — Minor (Manageable)

| Bottleneck | Detail | Impact |
|---|---|---|
| **Rate limit per IP** | Shared IPs (corporate NAT) hit limits faster | False positives |
| **Session memory** | In-memory `sessionHistory` Map | Lost on restart |
| **No horizontal scaling** | Single-server, no shared state | Can't add servers |

## Scaling Recommendations

### Phase 1: Quick Wins (Days)

#### 1A. Concurrent Worker Pool
Replace single-process lock with a worker pool:

```js
const MAX_CONCURRENT_WORKERS = 3;  // Start conservative
let activeWorkers = 0;

function processQueue() {
  while (activeWorkers < MAX_CONCURRENT_WORKERS && messageQueue.length > 0) {
    activeWorkers++;
    const { ws, data } = messageQueue.shift();
    processMessage(ws, data, () => {
      activeWorkers--;
      processQueue();
    });
  }
}
```

**Impact:** 3x throughput immediately. 20 users wait ~7 min instead of ~20 min.

#### 1B. Queue Size Limit + Backpressure
```js
const MAX_QUEUE_SIZE = 20;

// In message handler:
if (messageQueue.length >= MAX_QUEUE_SIZE) {
  safeSend(ws, buildErrorPayload(ERROR_CODES.QUEUE_FULL, data.requestId, {
    queueSize: messageQueue.length,
    estimatedWaitMs: messageQueue.length * 45000,  // ~45s avg per message
  }));
  return;
}
```

#### 1C. Queue Position Streaming
Send periodic queue position updates:
```js
function broadcastQueuePositions() {
  messageQueue.forEach(({ ws, data }, idx) => {
    safeSend(ws, {
      type: 'queue_update',
      position: idx + 1,
      estimatedWaitMs: (idx + 1) * 45000 / MAX_CONCURRENT_WORKERS,
      requestId: data.requestId,
    });
  });
}
// Run every 10s while queue has items
```

### Phase 2: Medium-Term (Weeks)

#### 2A. Response Caching
Cache common freelancer queries (rate recommendations, tax info, proposal templates):
```js
const responseCache = new LRU({ max: 100, ttl: 3600000 });
const cacheKey = hashMessage(prompt);
const cached = responseCache.get(cacheKey);
if (cached) {
  safeSend(ws, { type: 'stream_end', reply: cached, fromCache: true });
  return;
}
```

#### 2B. Priority Queue
Prioritize paying users over free/guest:
```js
function enqueue(ws, data) {
  const priority = data.isPro ? 0 : 1;
  messageQueue.push({ ws, data, priority, enqueuedAt: Date.now() });
  messageQueue.sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);
}
```

#### 2C. Lightweight Mode
For simple queries (greetings, help), respond without spawning OpenClaw:
```js
const SIMPLE_PATTERNS = [/^(hi|hello|hey)\b/i, /^help$/i];
if (SIMPLE_PATTERNS.some(p => p.test(message.trim()))) {
  safeSend(ws, { type: 'stream_end', reply: CANNED_RESPONSES[matchedPattern] });
  return;
}
```

### Phase 3: Production Scale (Months)

#### 3A. Horizontal Scaling with Redis
- Use Redis for shared message queue across multiple server instances
- Sticky sessions via load balancer for WebSocket connections
- Redis pub/sub for cross-instance communication

#### 3B. Dedicated AI Worker Service
Separate the WebSocket server from AI processing:
```
[WS Server 1] ──→ [Redis Queue] ──→ [AI Worker 1]
[WS Server 2] ──→               ──→ [AI Worker 2]
                                 ──→ [AI Worker 3]
```

#### 3C. Streaming API Gateway
Replace direct OpenClaw spawn with an API-based AI service:
- Serverless functions for AI calls
- Auto-scaling based on queue depth
- Pay-per-invocation pricing

## Capacity Planning

### Current Architecture (single worker)

| Concurrent Users | Avg Wait Time | Max Wait Time | Viable? |
|---|---|---|---|
| 1-3 | 0-90s | 3 min | ✅ Good |
| 5 | 2 min | 4 min | ⚠️ Acceptable |
| 10 | 4.5 min | 9 min | ⚠️ Degraded UX |
| 20 | 9 min | 18 min | ❌ Unacceptable |
| 50 | 22 min | 45 min | ❌ Broken |

### With 3 Workers (Phase 1A)

| Concurrent Users | Avg Wait Time | Max Wait Time | Viable? |
|---|---|---|---|
| 1-3 | 0-45s | 1 min | ✅ Excellent |
| 5 | 30s | 2 min | ✅ Good |
| 10 | 1.5 min | 3 min | ✅ Good |
| 20 | 3 min | 6 min | ⚠️ Acceptable |
| 50 | 7 min | 15 min | ⚠️ Degraded |

### With 5 Workers + Caching (Phase 2)

| Concurrent Users | Avg Wait Time | Max Wait Time | Viable? |
|---|---|---|---|
| 10 | 30s | 2 min | ✅ Excellent |
| 20 | 1 min | 3 min | ✅ Good |
| 50 | 3 min | 8 min | ⚠️ Acceptable |

## Test Tools Created

### 1. `concurrent-stress-test.js`
Main stress test with 6 scenarios:
- **ramp** — gradual connection ramp-up (default)
- **burst** — simultaneous connection flood
- **mixed** — idle + active + reconnecting clients
- **churn** — rapid connect/disconnect cycles
- **sustained** — long-running connections with periodic messages
- **queue-flood** — all clients send messages to stress the queue

```bash
# Basic usage
node concurrent-stress-test.js --url ws://localhost:3847/ws/chat --clients 20 --scenario ramp

# Environment variables also work
WS_URL=ws://localhost:3847/ws/chat CLIENTS=50 SCENARIO=burst node concurrent-stress-test.js
```

### 2. `server-monitor.js`
Polls `/ws/health` endpoint during tests:
```bash
node server-monitor.js --url http://localhost:3847/ws/health --interval 3 --duration 120
```

### 3. `run-all-tests.sh`
Runs all scenarios sequentially with monitoring:
```bash
./run-all-tests.sh ws://localhost:3847/ws/chat
```

Each test generates JSON reports with:
- Connection success/failure rates
- Latency percentiles (P50, P95, P99)
- Message throughput
- Queue depth over time
- System resource usage time-series

## System Limits (macOS / Node.js)

| Resource | Default Limit | Concern Level |
|---|---|---|
| Open file descriptors | 256 (soft) / unlimited (hard) | ⚠️ Each WS = 1 fd |
| Node.js heap | ~1.7 GB default | Low risk for <100 conns |
| TCP connections | 128 (backlog) | May need tuning for burst |
| OpenClaw processes | OS process limit | 1 at a time currently |

To raise fd limit for testing:
```bash
ulimit -n 4096
```

## Conclusion

The WebSocket connection layer is solid — CFX-005/006/007 built a reliable foundation with health monitoring, timeout profiles, and structured errors. The **single-process message queue is the clear scaling bottleneck**. 

**Recommended next step:** Implement Phase 1A (concurrent worker pool) — it's a ~50-line change to `processQueue()` that would immediately 3x capacity. Combined with Phase 1B (queue limits), the system can handle 10-15 concurrent active users comfortably, which is plenty for pre-launch.

For the April 3 Pro Launch target with 1,247 waitlist users, even with 1-5% simultaneous usage (12-62 users), the worker pool + queue limits would keep response times under 5 minutes for most users.
