# CFX-004: WebSocket Reconnection Logic

**Status:** ✅ Implemented  
**Date:** 2026-03-25  
**Priority:** High  

## Problem

External users chatting with the Cortex Freelancer experience WebSocket timeouts and drops. The existing reconnection logic in `chat-dispatcher.js` was basic:

- **Linear backoff** (2s × attempt) — too aggressive, no jitter
- **Only 5 retry attempts** — gives up too early
- **No message queue** — user messages lost during reconnection
- **No heartbeat-based dead connection detection** — relies only on browser's `onclose` event, which can be slow to fire (especially through Cloudflare tunnels)
- **Minimal UI feedback** — only "Live" vs "Reconnecting..."

## Root Causes

1. **Cloudflare tunnel idle timeout** (~60-100s) drops connections when OpenClaw is processing (23-120s before first token)
2. **No client-side dead connection detection** — if the TCP connection silently dies, the client doesn't know until the browser's native timeout (which can be 30-120s)
3. **Server heartbeat at 20s** helps, but no client-side verification that pongs actually arrive

## Solution

### New Module: `ws-reconnect.js`

Standalone reconnection manager with:

| Feature | Before | After |
|---------|--------|-------|
| Backoff | Linear (2s, 4s, 6s...) | Exponential + jitter (1s, 2s, 4s, 8s... max 30s) |
| Max retries | 5 | 10 |
| Message queue | None (lost) | Up to 50 messages, auto-flushed on reconnect |
| Dead detection | Browser `onclose` only | Client heartbeat ping/pong with 10s timeout |
| State machine | Implicit (2 states) | Explicit: DISCONNECTED → CONNECTING → CONNECTED → RECONNECTING → FAILED |
| UI states | 2 (Live, Reconnecting) | 5 (Connecting, Live, Reconnecting w/count, Offline, Failed w/retry button) |

### Architecture

```
ws-reconnect.js (connection manager)
    ↓ events
chat-dispatcher.js (message routing, fallback tiers)
    ↓ callbacks  
chat-ui.js (visual status)
```

### Connection State Machine

```
DISCONNECTED → CONNECTING → CONNECTED
                                ↓ (drop)
                          RECONNECTING ←──┐
                                ↓         │
                          (attempt N)  ───┘ (if N < max)
                                ↓ (N >= max)
                             FAILED
```

### Backoff Formula

```
delay = min(1000ms × 2^(attempt-1) + jitter(±20%), 30000ms)

Attempt 1:  ~1.0s
Attempt 2:  ~2.0s  
Attempt 3:  ~4.0s
Attempt 4:  ~8.0s
Attempt 5: ~16.0s
Attempt 6+: ~30.0s (capped)
```

Jitter prevents thundering herd when many clients reconnect simultaneously.

### Heartbeat Protocol

- Client sends `{ type: "ping" }` every 20s
- Server responds with `{ type: "pong" }`
- If no pong received within 10s → connection is dead → trigger reconnect
- Server already had 20s heartbeat interval; client now validates pong receipt

### Message Queue

- Messages sent while disconnected/reconnecting are queued (max 50)
- On successful reconnect, queue is flushed automatically
- UI shows queued count in status indicator
- If queue is full, oldest message is dropped (FIFO)

## Files Changed

| File | Change |
|------|--------|
| `app/js/ws-reconnect.js` | **NEW** — Core reconnection manager |
| `app/js/chat-dispatcher.js` | Refactored to use `CortexWsReconnect` instead of raw WebSocket |
| `app/js/chat-ui.js` | Enhanced `updateConnectionStatus()` with 5 states + retry button |
| `app/css/chat.css` | New styles for connecting/reconnecting/failed states + pulse animation |
| `app/chat.html` | Added `ws-reconnect.js` script tag before dispatcher |
| `app/js/__tests__/ws-reconnect.test.js` | **NEW** — Browser console test suite |

## Testing

### Manual Test: Simulate Drop

1. Open chat.html in browser
2. Open DevTools console
3. Run: `CortexWsReconnect.disconnect()` — verify status shows "Offline"
4. Run: `CortexWsReconnect.resetAndReconnect()` — verify "Connecting..." → "Live"
5. Send a message while disconnected — verify it queues and sends after reconnect

### Automated Test

Load `__tests__/ws-reconnect.test.js` in browser console, then:
```js
runReconnectTests()
```

### Edge Cases Verified

- [x] Connection drop during message send → message queued, sent on reconnect
- [x] Max retries exceeded → "Offline" with clickable retry button
- [x] Rapid disconnect/reconnect → no duplicate connections
- [x] Intentional disconnect (user navigates away) → no reconnect attempts
- [x] Server restart → client reconnects with backoff

## Server-Side Notes

The `ws-bridge.js` already had good server-side infrastructure:
- 20s heartbeat ping from server
- 15s keepalive during OpenClaw processing
- Dead connection cleanup

No server-side changes were needed. The fix is purely client-side.

## Impact

- **Before:** Users saw "Reconnecting..." briefly, then nothing. Messages typed during drops were lost.
- **After:** Users see clear status progression, messages are preserved, and they can manually retry if auto-reconnect fails.
