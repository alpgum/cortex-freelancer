# CFX-030 — Cortex Freelancer PWA (Offline‑First)

This folder contains the **offline-first PWA layer** for the Cortex Freelancer web app.

## What’s in here

- `enhanced-service-worker.js`
  - Cache-first for static assets (stale-while-revalidate)
  - Network-first for navigations
  - **Offline chat** support:
    - queues `/api/chat` POST messages when offline
    - background sync flush (`sync` event tag: `chat-sync`)
    - caches conversation payloads for offline viewing
  - optional Push Notification handlers (`push`, `notificationclick`)

- `manifest.json`
  - Richer web app manifest (shortcuts, screenshots, file handlers, etc.)
  - Note: some fields are “nice-to-have” and can be trimmed for maximum browser compatibility.

- `offline-enhanced.html`
  - Offline hub UI: queued message status + offline tools + cached conversations

- `install-prompt.js`
  - Smart install banner (Chrome/Edge/Android)
  - iOS Safari “Add to Home Screen” instructions

- `chat-offline.js`
  - Client-side progressive enhancement for `/app/chat.html`
  - Shows online/offline pill, queues messages, and marks queued messages in UI
  - Saves conversations to Service Worker for offline replay

## Current repo state (important)

This repo already has:

- `/manifest.json` (basic)
- `/service-worker.js` (legacy wrapper importing `/sw.js`)
- `/sw.js` (existing caching SW)
- `/offline.html` (offline fallback)

**This CFX-030 folder does not automatically replace those**. See `INTEGRATION.md` for the recommended upgrade path.

## Local testing checklist

1. Load `/app/index.html` in Chrome.
2. DevTools → Application:
   - Service Workers: verify SW registered
   - Manifest: verify installable
3. Enable “Offline” in DevTools → Network.
4. Open `/app/chat.html`:
   - Send a message → it should be **queued** (UI shows queued state)
5. Disable “Offline”:
   - queued messages should flush after reconnect / background sync.

## Notes / limitations

- **Background Sync** is not available on iOS Safari. On iOS, we rely on “flush on reconnect + when the tab is active”.
- **Push Notifications** require server-side support (VAPID keys + subscription storage + sending). This folder only includes the SW event handlers.
