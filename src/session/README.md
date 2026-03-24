# CFX-041 — User Session Management (Persistent Conversations)

This folder provides the **client-side session management** building blocks for the Cortex Freelancer chat UI.

## What it does

- Generates a stable **sessionId** on first visit
- Persists sessionId in **localStorage** with a **cookie fallback**
- Persists message history in **IndexedDB**
- Keeps a small **localStorage cache** of the last N messages for fast synchronous restore
- Auto-expires sessions after inactivity (default **24h**)
- Uses **BroadcastChannel** for multi-tab session sync (new messages + clear session)
- Tracks metadata: `startedAt`, `lastActiveAt`, `messageCount`

## Files

- `session-storage.js` — IndexedDB wrapper (messages + metadata)
- `session-manager.js` — orchestration (id creation, expiry, multi-tab, cache)

## Integration expectations

The current production UI is plain HTML/JS under `app/`. For now, the chat uses a compatibility layer exposing the historical `window.CortexChatSessions` API.

The intended long-term integration:

- Chat UI calls `SessionManager.getSessionId()` and sends it with every request
- Chat UI restores the conversation from `SessionManager.getHistorySync()` immediately
- `SessionManager.hydrateFromStorage()` refreshes the cache from IndexedDB asynchronously

## Config

- Inactivity timeout: `timeoutMs` (default 24h)
- Stored messages cap: `maxStoredMessages` (default 200)
- Local cache cap: `maxCacheMessages` (default 50)

Example:

```js
var sm = new CortexSessionManager({ timeoutMs: 24*60*60*1000 });
var sid = sm.getSessionId();
```
