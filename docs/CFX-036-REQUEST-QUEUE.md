# CFX-036 — Request Queuing (Client)

## Problem
When users hit **Send** multiple times quickly (or transports reconnect/fallback), the client can create multiple concurrent in-flight requests. This causes:
- UI thrash (multiple “streaming” placeholders + typing indicator fights)
- transport thrash (WS/SSE/chunked overlap)
- increased duplication risk during fallback/reconnect

## Solution
A **client-side FIFO request queue** sits at the dispatcher layer:
- If a request is in-flight, additional sends are queued.
- When the in-flight request resolves (or is cancelled), the next item starts.
- Supports priority items (`priority: "system" | "retry" | number`).
- Exposes queue state (`inFlight`, `queued`) for UI.
- Supports cancel current and optional clear queue.

## Files
- `app/js/request-queue.js` — Queue module + dispatcher patcher
- `app/js/chat-dispatcher.js` — updated to accept `(message, callbacks, options)` and support `options.signal` + `cancelRequest()`
- `app/js/webrtc-dispatcher.js` — same as above
- `app/js/chat-chunked-stream.js` — supports `opts.signal` and passes `requestId`
- `app/js/ws-reconnect.js` — adds `removeQueuedByRequestId()` helper
- `app/js/chat-ui.js` — shows queued count in status + adds Cancel button + ESC cancel
- `app/chat.html` — loads `request-queue.js` before `chat-ui.js`
- `app/request-queue-demo.html` — standalone demo/test harness (fake dispatcher)

## Integration details
### 1) Dispatcher patching (default)
`request-queue.js` auto-detects `window.CortexChatDispatcher` and patches:
- `window.CortexChatDispatcher.send(...)` → queued send
- Exposes `window.CortexRequestQueue` API

This means existing UI code can keep calling `CortexChatDispatcher.send(...)` without changes.

### 2) Stable request id across transport fallback
Both dispatchers now accept:

```js
CortexChatDispatcher.send(message, callbacks, {
  clientRequestId: "...", // optional
  requestId: "...",       // optional (alias)
  signal: abortSignal,     // optional AbortSignal for cancellation
  priority: "user"|"retry"|"system"|number
});
```

If the dispatcher falls back from WS → SSE → chunked → HTTP, it reuses the same `clientRequestId` so the request can be treated as a single logical attempt.

## UI hooks
### Queue state
`window.CortexRequestQueue.getState()` returns:

```json
{ "inFlight": true, "currentId": "...", "queued": 2, "queueIds": ["...","..."] }
```

`window.CortexRequestQueue.on('change', fn)` fires on every enqueue/dequeue/cancel.

### Cancel
- Header button: **Cancel** (Shift-click clears queued)
- Keyboard: **ESC** cancels current, **Shift+ESC** cancels + clears queue

## Cancel semantics
- For fetch-based transports (SSE/HTTP/chunked): cancellation uses `AbortController`.
- For WS/WebRTC: cancellation is best-effort client-side (drops handlers + sends `{type:'cancel'}` which servers may ignore).

If you want true server-side cancellation, add support for `{type:'cancel', requestId}` in the WS/WebRTC bridges and abort/kill the active job.

## Avoiding double-submits on reconnect
This change reduces duplication by:
- enforcing one in-flight request at a time
- using a stable `clientRequestId` across fallback tiers
- optionally removing transport-level queued WS messages via `CortexWsReconnect.removeQueuedByRequestId(requestId)` on cancel

For *strong* guarantees, the server should treat `clientRequestId` as an idempotency key.

## Persistence (optional)
By default the queue is **in-memory**.

If you need persistence (e.g., page reload mid-queue), you can store pending items in `localStorage`:
- serialize only safe fields (message + timestamp + priority)
- never store sensitive metadata
- on load, rehydrate as queued sends (do **not** auto-send without explicit user confirmation)

## Demo / Test Harness
Open:
- `/app/request-queue-demo.html`

It uses a fake streaming dispatcher and validates:
- rapid-fire sends are processed sequentially
- queued positions are reported
- cancel current / cancel+clear work
