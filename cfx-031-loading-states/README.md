# CFX-031 — Loading State Improvements (Cortex Freelancer)

Pure HTML/CSS/JS loading-state system for the Cortex Freelancer web chat.

## What you get

- **Progress indicators**: typing dots + progress bar + ETA text
- **Status messages**: `Connecting…`, `Thinking…`, `Generating…`, `Almost done…`, `Still working…`
- **Skeleton loading**: message placeholder while the assistant “loads”
- **Streaming progress**: token counter + progress updates while streaming
- **Connection state feedback**: good / degraded / poor indicator (green/yellow/red)
- **Timeout warnings**: shows “Still working…” + enables cancel
- **Cancel support**: cancel button calls your callback (abort WS/SSE/fetch/etc)

## Files

- `loading-states.js` — `LoadingStateManager` module (global `window.LoadingStateManager`)
- `loading-states.css` — styles + animations + reduced-motion support
- `demo.html` — interactive demo of all states

## Quick start

1) Include the CSS + JS:

```html
<link rel="stylesheet" href="/cfx-031-loading-states/loading-states.css">
<script src="/cfx-031-loading-states/loading-states.js"></script>
```

2) Ensure your chat root container exists:

```html
<div class="chat-container" id="chatRoot">
  <!-- your chat UI here -->
</div>
```

3) Create the manager:

```js
const loading = new LoadingStateManager({
  containerSelector: '#chatRoot',
  timeoutWarning: 30000,           // ms until “Still working…”
  estimatedResponseTime: 5000,     // optional, for future ETA logic
  onCancel: (requestId) => {
    // Abort your in-flight request (AbortController, WS close, SSE close, etc.)
    console.log('Cancel requested for', requestId);
  }
});
```

## Typical lifecycle (non-streaming)

```js
const requestId = loading.startRequest({ requestId: crypto.randomUUID?.() });
loading.setRequestStatus('connecting');

// once connected / request sent
loading.setRequestStatus('thinking');

// as you generate server-side (optional)
loading.updateRequestProgress(40);
loading.setRequestStatus('generating');

// when done
loading.completeRequest();
```

## Streaming lifecycle (SSE / WS / chunked fetch)

Call these as you stream tokens/chunks:

```js
loading.startRequest({ requestId: 'stream-123', showSkeleton: false });
loading.setRequestStatus('streaming');

let tokens = 0;
onToken(() => {
  tokens += 1;
  loading.setStreamingTokens(tokens);

  // optional: map token count to an artificial progress
  const progress = Math.min(95, (tokens / 300) * 100);
  loading.updateRequestProgress(progress);
});

onComplete(() => loading.completeRequest());
onError((err) => loading.failRequest(err?.message || 'Streaming failed'));
```

## Integrating with existing connection methods (CFX-001 → CFX-030)

### WebSocket
- Call `loading.startRequest()` when you send a prompt.
- Set status to `connecting` until the socket is open / ready.
- When you receive partial tokens/messages: `setRequestStatus('streaming')` + `setStreamingTokens(n)`.
- On final message: `completeRequest()`.
- On cancel: close the WS or send a `cancel` control message.

### SSE
- Call `startRequest()` when you create the `EventSource`.
- On first chunk: `setRequestStatus('streaming')`.
- On cancel: `eventSource.close()`.

### Polling
- Call `startRequest()` when job is submitted.
- Each poll tick: update progress + status (`thinking`/`generating`).
- When job finishes: `completeRequest()`.

## Connection health indicator

The module pings `GET /api/health` every 10 seconds and uses the rolling average latency to show:

- **good**: < 1s
- **degraded**: 1–3s
- **poor**: > 3s or failures

If your health endpoint differs, change `pingConnection()` to target the correct URL.

## Accessibility

- Overlay uses `aria-live="polite"` for status text announcements.
- Cancel button is keyboard-focusable with visible focus ring.
- Supports `prefers-reduced-motion: reduce` (disables shimmer/bounce/pulse animations).
- Supports `prefers-contrast: high`.

## Demo

Open `demo.html` in a browser:

```bash
cd cfx-031-loading-states
python3 -m http.server 8000
# then visit http://localhost:8000/demo.html
```

Keyboard shortcuts in the demo:
- `Alt+1` Basic loading
- `Alt+2` Skeleton loading
- `Alt+3` Streaming
- `Alt+C` Cancel

## API reference

### `startRequest(options)`
- `options.requestId` (string): optional request id
- `options.showSkeleton` (boolean): default `true`
- `options.onCancel` (function): optional per-request cancel callback

### `setRequestStatus(status, customMessage?)`
Statuses: `connecting | thinking | generating | streaming | almost_done | timeout_warning | error | cancelled | complete`

### `updateRequestProgress(progress, etaSeconds?)`
- progress: 0..100

### `setStreamingTokens(count)`

### `completeRequest()` / `failRequest(message?)`

## Notes / caveats

- The progress bar is **optimistic/simulated** (it never hits 100% until you call `completeRequest()`).
- The module inserts a fixed-position overlay into your container; it covers the viewport.
- If your app already has an overlay system, you can reuse the CSS classes and only call the public API methods.
