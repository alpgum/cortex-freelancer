# CFX-030 PWA Integration Guide

This project already ships a PWA baseline (`/sw.js`, `/service-worker.js`, `/manifest.json`, `/offline.html`).

CFX-030 adds **offline chat queueing + background sync + install UX**. To enable it safely, do the steps below.

## 1) Service Worker upgrade

### Option A (recommended): replace the root `/sw.js` implementation

1. Copy the enhanced SW into the root SW:

```bash
cp projects/cortex-freelancer/pwa/enhanced-service-worker.js projects/cortex-freelancer/sw.js
```

2. Keep `/service-worker.js` as-is (it imports `/sw.js`).
3. Bump `CACHE_VERSION` when you ship new assets.

Why: **Service Workers must live at the origin root** (or above the pages they control). Keeping it at `/sw.js` preserves scope for `/app/*`.

### Option B: keep existing `/sw.js` and import the enhanced one

If you want a smaller diff, change `/sw.js` to:

```js
self.importScripts('/pwa/enhanced-service-worker.js');
```

This also preserves scope (because `/sw.js` remains the registration target).

## 2) Manifest

The site currently links to `/manifest.json`.

You can either:

- **Replace** root manifest:

```bash
cp projects/cortex-freelancer/pwa/manifest.json projects/cortex-freelancer/manifest.json
```

- Or keep the current manifest and cherry-pick fields.

### Icons & screenshots

The enhanced manifest references icon sizes and screenshots that may not exist yet:

- `/icons/icon-72x72.png`, `/icons/icon-96x96.png`, `/icons/icon-128x128.png`, `/icons/icon-144x144.png`, `/icons/icon-152x152.png`, `/icons/icon-384x384.png`
- `/images/screenshots/*.png`
- `/icons/*-shortcut.png`

Either add these assets or remove those entries.

## 3) Offline page

You can keep `/offline.html` or swap to the richer offline hub:

```bash
cp projects/cortex-freelancer/pwa/offline-enhanced.html projects/cortex-freelancer/offline.html
```

## 4) Client integration (already applied in this repo)

CFX-030 adds progressive enhancement scripts:

- `/app/chat.html`
  - includes `/pwa/chat-offline.js`
  - includes `/pwa/install-prompt.js`
  - best-effort background sync registration (`chat-sync`)

- `/app/index.html`
  - includes `/pwa/install-prompt.js`

If you move files, ensure these paths still resolve.

## 5) Background Sync

The enhanced SW listens for:

- `sync` event tag: `chat-sync`

The chat page registers it when supported. If you want periodic retries, re-register after each send or on reconnect.

## 6) Push Notifications (optional)

The Service Worker contains handlers for:

- `push`
- `notificationclick`

To enable Push end-to-end you still need server work:

1. Generate VAPID keys
2. Subscribe client (`PushManager.subscribe`)
3. Store subscriptions
4. Send notifications from server on AI responses

This task intentionally stops at SW wiring.

## 7) Cache strategy summary

- **Static assets**: cache-first + stale-while-revalidate
- **Navigations**: network-first + offline fallback
- **Chat**: POST queueing when offline + flush via background sync

## Verification

- Chrome DevTools → Application → Service Workers: verify active
- DevTools → Network → Offline:
  - load `/app/chat.html` (should still load)
  - send a message (should be queued)
- Turn online:
  - queued messages should flush
