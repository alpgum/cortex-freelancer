# CFX-033 — Response Caching

Goal: serve repeat prompts instantly (no network call) and reduce load on transports.

## What’s implemented

- Client-side, local-only cache in `app/js/response-cache.js`
  - Storage: `localStorage` when available, in-memory fallback otherwise
  - TTL + LRU eviction (defaults: 24h, 120 entries, ~1.5MB)
  - Key includes: conversation/thread id + current transport/mode + prompt hash
- Chat page integration (`app/chat.html` + `app/js/chat-ui.js`)
  - On send: checks cache first; on hit renders immediately with a **cached** badge and skips the network call
  - On completion: stores the final reply in cache (both streaming and non-streaming)
  - “Clear cache” button in header clears local cached responses

## Notes / knobs

- Current integration uses `hashIncludesContext: false` (hash prompt only). This maximizes cache hits but can return stale answers if the same prompt depends on prior context.
  - If you want context-sensitive caching, set `hashIncludesContext: true` and pass a richer `request` object into `buildKey()`.
- Cache is best-effort. If storage is blocked (Safari private mode/quota), the app continues normally.

## Developer API

```js
const cache = CortexFreelancer.ResponseCache.create({ namespace: 'cortex' });
const key = await cache.buildKey({ conversationId, transport, prompt });
const hit = cache.get(key);
cache.set(key, { text: reply }, { threadId: conversationId, transport });
```
