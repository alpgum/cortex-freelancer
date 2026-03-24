# CFX-034 — Error Recovery UI (Retry + Help)

## Purpose
When a transport fails (WebRTC/WS/SSE/etc.), users should get **clear next steps** instead of dead ends.

This component is **non-blocking**: it does **not** stop background retries (e.g., `CortexWsReconnect` reconnect loop). It simply provides explicit user actions.

## Deliverables
- `app/js/error-recovery-ui.js`
- `app/css/error-recovery-ui.css`
- Demo: `app/demos/cfx-034-error-recovery-demo.html`

## UI/UX
A mobile-friendly, accessible **bottom-sheet** style panel with actions:
- **Retry** (same transport / resend)
- **Try next transport** (force fallback when possible)
- **Copy diagnostics** (mode, error code, timestamp + best-effort transport stats)
- **Open status page** (defaults to `/status`)

## Public API
Available globally as `window.CortexErrorRecoveryUI`:

### `show(options)`
Manual invocation.

```js
CortexErrorRecoveryUI.show({
  title: 'Connection issue',
  subtitle: 'Could not connect. We will keep retrying in the background.',
  tone: 'danger', // 'danger' | 'warn' | 'ok'
  errorCode: 'E100',
  errorMessage: 'Connection timed out',
  timestamp: new Date().toISOString(),
  mode: 'webrtc',
  statusUrl: '/status',

  // Optional overrides
  onRetry: () => {/* your retry */},
  onTryNext: () => {/* your force-fallback */},

  // If true/undefined: show "Try next transport"
  // If false: hide it
  showTryNext: true,

  // For chat flows: if provided, used by default Retry action
  retryFn: () => resendLastMessage(),
});
```

### `showFromError(error, ctx)`
Best for structured errors (CFX-007). Extracts `code`/`error` when available.

```js
CortexErrorRecoveryUI.showFromError({ code: 'E100', error: 'Connection failed' }, {
  retryFn: () => resendLastMessage(),
  statusUrl: '/status',
});
```

### `hide()`
Dismiss the panel.

### `buildDiagnosticsText(ctx)`
Builds a copyable diagnostics blob (JSON).

### `bindToTransport()` (optional)
Attaches best-effort listeners:
- `CortexTransport.on('error', ...)` (CFX-025 transport-manager)
- `CortexWsReconnect.on('failed', ...)`

Call it once after those globals are available.

```js
CortexErrorRecoveryUI.bindToTransport();
```

## Default action behavior
If you do **not** provide custom callbacks:

- **Retry**:
  1) calls `retryFn` if provided
  2) else tries `CortexTransport.connect({ transport: current })`
  3) else falls back to `CortexChatDispatcher.reconnect()`

- **Try next transport**:
  1) if `CortexTransport` is available: calls `connect({ skip: [current] })`
  2) else if WebRTC is active and dispatcher supports it: `CortexChatDispatcher.enableWebRTC(false)` + `reconnect()`
  3) else falls back to `CortexChatDispatcher.reconnect()`

- **Copy diagnostics**:
  - mode (from `CortexChatDispatcher.getConnectionMode()` or `CortexTransport.getStatus()`)
  - error code + message
  - timestamp
  - best-effort `CortexWsReconnect` state + queue length
  - best-effort WebRTC stats (`CortexChatDispatcher.getConnectionStats()`)

## Minimal integration points
### 1) Include CSS + JS on chat page
`app/chat.html` should include:

```html
<link rel="stylesheet" href="/app/css/error-recovery-ui.css">
<script src="/app/js/error-recovery-ui.js"></script>
```

### 2) Invoke from existing error handler (CFX-007)
`app/js/chat-error-handler.js` now calls the recovery panel for **transport-ish** categories:
- `connection`
- `network`
- `timeout`

This keeps the UI from being noisy for validation errors (empty message, too long, etc.).

### 3) (Optional) Bind to transport fallback manager
If you actively use `app/js/transport-manager.js` (CFX-025), you can auto-show the panel on `CortexTransport` errors:

```js
CortexErrorRecoveryUI.bindToTransport();
```

## Demo
Open:
- `app/demos/cfx-034-error-recovery-demo.html`

Use the buttons to simulate:
- E100 connection timeout
- E201 response timeout
- E500 server error

Verify the UI:
- renders on screen
- buttons are clickable and keyboard focusable
- "Copy diagnostics" places JSON on clipboard

## Notes / Non-blocking guarantee
The component does **not**:
- stop `CortexWsReconnect` retries
- intercept network calls
- block input or navigation

It is a **helper** overlay; users can dismiss it anytime.
