# CFX-035 — Connection Status Indicator

## What it does
Adds a small, always-visible connection indicator (auto-mounts in the chat header when available; otherwise bottom-right) that shows:

- **Transport/mode**: `webrtc`, `grpc`, `socketio`, `ws`, `sse`, `chunked`, `long-poll`, `http`
- **Health**: `good`, `degraded`, `poor`, `offline`
- **Latency estimate** (when available)

Tapping/clicking opens a **Connection details** panel with:

- Mode history (last N switches)
- Last error code (best-effort)
- Latency estimate
- **Force fallback** button

The module is defensive: if transport/health hooks aren’t available, it falls back to polling and shows `unknown/offline` rather than throwing.

## Files
- `app/js/connection-indicator.js`
- `app/css/connection-indicator.css`

## Wiring (chat page)
Already wired into `app/chat.html`:

- In `<head>`:
  - `/<app>/css/connection-indicator.css`
- In scripts:
  - `/<app>/js/connection-indicator.js` (auto-inits on DOM ready)

If you need to wire manually on another page:

```html
<link rel="stylesheet" href="/app/css/connection-indicator.css">
<script src="/app/js/connection-indicator.js"></script>
```

## Data sources / integration
The indicator uses whichever hooks exist (priority order):

1. **`window.CortexTransport`** (CFX-025 transport manager)
   - Reads `getStatus()` and tries to compute latency from `stats.avgLatencyMs` / `stats.rttMs`
   - Force fallback: `disconnect()` then `connect({ skip:[current] })`

2. **`window.CortexChatDispatcher`** (chat dispatcher)
   - Reads `getConnectionMode()`
   - Latency (if present): `getConnectionStats().webrtc.stats.*`
   - Force fallback (best-effort):
     - If on `webrtc` and `enableWebRTC(false)` exists → disables WebRTC to fall back to WS
     - Calls `reconnect()` if available

3. **`window.CortexWsReconnect`** (CFX-004)
   - Live updates via `stateChange`, `reconnecting`, `failed`
   - Latency: sends a periodic `ping` and measures RTT on the next `pong` (rolling average of last 10)

4. **Error capture (best-effort)**
   - Wraps `CortexFreelancer.ChatErrorHandler.handleError` (CFX-007) if present to capture `error.code` and last error text.

## Health mapping
- `offline`: not connected
- `good`: connected and latency < 250ms (or unknown latency)
- `degraded`: 250–800ms, or reconnecting while still connected
- `poor`: ≥800ms, or reconnecting while disconnected

## Accessibility notes
- Indicator button has `aria-label` describing current mode + health.
- Details panel uses `role="dialog"` and closes on **Escape**.

## Customization
- CSS is isolated under `.cfx035-*` classnames.
- Change placement via `.cfx035-conn { right/bottom }` in `connection-indicator.css`.

## Known limitations
- For the current WebRTC/WS/SSE/chunked dispatcher, forcing fallback **beyond disabling WebRTC** isn’t reliably possible without adding explicit APIs to skip transports inside the dispatcher.
- Latency for WS is RTT of ping/pong (approximate); other transports rely on whatever stats they expose.
