# CFX-038 — Mobile Optimization (Chat + Dashboards)

Goal: make the chat + key UI overlays feel solid on iOS Safari + Android Chrome (small screens, notches, and on-screen keyboard).

## What changed

### 1) Chat UI (touch + safe-area)
**File:** `app/css/chat.css`

- Added safe-area variables (`--safe-top/right/bottom/left`) and applied them to:
  - header padding (notch-safe)
  - suggestions + input bar horizontal padding (avoids clipped UI on notched devices)
  - input bar bottom padding (home indicator)
- Increased touch target sizes to meet ~44px guidance:
  - header actions (`.chat-back`) now have `min-height: 44px` + padding
  - chips (`.chat-chip`) now have `min-height: 44px`
  - send button now 44×44
  - textarea min-height now 44px
- Prevent iOS zoom-on-focus:
  - on coarse pointers, textarea font-size is bumped to **16px**
- Reduced scroll chaining / rubber-banding where supported:
  - `overscroll-behavior` on the page and `overscroll-behavior-y: contain` on the messages scroller

### 2) Fixed overlays no longer cover the input bar
Problem: the connection indicator + error recovery bottom-sheet are `position: fixed` and could overlap the chat input on phones.

**Files:**
- `app/css/connection-indicator.css`
- `app/css/error-recovery-ui.css`

Changes:
- Both now position from the bottom using:

```css
bottom: calc(12px + env(safe-area-inset-bottom, 0px) + var(--cfx-bottom-ui, 0px));
```

This lifts overlays above the chat input bar, including safe-area.

### 3) iOS keyboard reliability + dynamic offsets (minimal JS)
**File:** `app/js/chat-ui.js`

Added a small CFX-038 block that:

- Sets `--app-height` based on `visualViewport.height` (px) when available.
  - This improves behavior on iOS Safari variants where `100vh` / even `dvh` can be unreliable during keyboard open/close.
- Measures `.chat-input-bar` height and sets `--cfx-bottom-ui` so fixed overlays don’t cover the input bar.
- Uses `ResizeObserver` (when available) to keep that measurement accurate as the textarea grows.
- Optimized textarea auto-resize to run in `requestAnimationFrame` to reduce layout thrash.

## How to test (quick checklist)

### iOS Safari
1. Open `/app/chat.html`.
2. Tap the textarea:
   - the page should **not zoom**
   - input bar remains visible above the keyboard
3. Type multiple lines (textarea grows):
   - connection indicator + recovery sheet should remain above the input bar
4. Rotate portrait ↔ landscape:
   - header stays notch-safe
   - no clipped content

### Android Chrome
1. Same as above.
2. Verify scroll + overscroll feels contained in the messages list.

## Notes / design intent

- `--cfx-bottom-ui` is a generic “reserved bottom space” variable.
  - On chat pages it is measured automatically.
  - On coarse pointers we also provide a safe fallback in CSS until JS runs.
- These changes are intentionally small and localized to chat + the two overlay components.

## Files touched

- `app/css/chat.css`
- `app/css/connection-indicator.css`
- `app/css/error-recovery-ui.css`
- `app/js/chat-ui.js`
