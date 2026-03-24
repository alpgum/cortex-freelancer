# CFX-037 — Response Streaming UI (smooth, sticky, accessible)

## Goal
Make streaming output feel smooth across transports (WebSocket / SSE / HTTP chunked), with minimal jank, good mobile performance, and accessibility support.

## What changed
### 1) Throttled streaming rendering (requestAnimationFrame)
File: `app/js/chat-ui.js`

Instead of updating DOM on every incoming chunk, we now:
- Buffer `onChunk(chunkText)` updates in memory.
- Flush buffered text **at most once per animation frame** (via `requestAnimationFrame`).
- Update a single text node using `appendData()`.

This reduces layout/reflow churn and makes the cursor/text feel stable.

### 2) Sticky scroll behavior (auto-stick unless user scrolls up)
File: `app/js/chat-ui.js`

We track whether the user is “near bottom” of the scroll container:
- `stickToBottom = true` while the scroll position is within `thresholdPx` of the bottom.
- If the user scrolls up, `stickToBottom` flips false and we **stop auto-scrolling**.
- If the user scrolls back near bottom, it flips true again.

All scroll-to-bottom operations are also throttled to animation frames.

### 3) Optional typewriter effect for non-streaming fallback (HTTP)
File: `app/js/chat-ui.js`

When the dispatcher falls back to non-streaming HTTP:
- We optionally render the AI response with a lightweight typewriter effect.
- It uses a single text node and updates via `requestAnimationFrame`.
- At the end, we replace the content with the markdown-rendered HTML.

### 4) Reduced-motion support
File: `app/css/chat.css`

When `prefers-reduced-motion: reduce` is enabled:
- The blinking cursor animation is disabled.
- Message “pop-in” animation is disabled.
- Smooth scrolling is disabled.

This prevents motion-induced discomfort and improves perceived stability.

## Implementation notes
### Streaming DOM structure
During streaming/typewriter we render:

```html
<div class="chat-msg ai streaming">
  <span class="stream-text">(text node)</span>
  <span class="stream-cursor" aria-hidden="true"></span>
</div>
```

On finalize, we replace the inner HTML with `md(finalText)` and remove `.streaming`.

### Transport coverage
`chat-ui.js` uses `CortexChatDispatcher.getConnectionMode()` when available:
- `websocket`, `sse`, `chunked`, `reconnecting` → treated as streaming
- `http` → treated as non-streaming (typewriter optional)

This makes streaming UI improvements apply across WS/SSE/chunked automatically.

### Performance principles
- **Single active stream** at a time (simple state machine).
- **Single text node** updated per frame.
- **Avoid innerHTML churn** during streaming; only render markdown once at the end.

## Testing checklist
1. WebSocket streaming:
   - Tokens appear smoothly; cursor doesn’t flash/jump.
   - Scrolling up during stream doesn’t yank you back down.
2. SSE / chunked fallback:
   - Same behavior as WebSocket (incremental + smooth).
3. HTTP fallback:
   - Typewriter runs (unless reduced motion), then final markdown formatting applies.
4. Reduced motion:
   - Cursor is not blinking; smooth scroll disabled; message animations disabled.
5. Mobile:
   - No obvious jank while streaming long responses.

## Files changed
- `app/js/chat-ui.js`
- `app/css/chat.css`
- `docs/CFX-037-STREAMING-UI.md`
