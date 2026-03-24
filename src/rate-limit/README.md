# CFX-042 — Chat Rate Limiting (Client + Server)

This folder contains the **chat-specific** rate limiting implementation.

## Goals

- Prevent abuse/spam without breaking UX
- Smooth client throttling (cooldown + burst)
- Server protection with per-session (fallback IP) quotas
- Clear feedback via headers and UI

## Server-side (token bucket)

**File:** `src/rate-limit/server-middleware.js`

- Key: `sessionId` (preferred) → `sid:<sessionId>`
- Fallback: client IP → `ip:<ip>`
- Buckets:
  - `CHAT_RATELIMIT_PER_MIN` (default `10`) tokens per minute
  - `CHAT_RATELIMIT_PER_HOUR` (default `50`) tokens per hour

### Headers

Responses set:

- `X-RateLimit-Limit`: numeric limit (min of configured limits)
- `X-RateLimit-Remaining`: remaining messages before rate limit triggers (min bucket)
- `X-RateLimit-Reset`: epoch seconds when next message is allowed
- `Retry-After`: seconds to wait (only when limited)

Extra debug headers are also emitted:

- `X-RateLimit-Remaining-Minute`
- `X-RateLimit-Remaining-Hour`

### Integration points

The SSE endpoints were updated to use this limiter:

- `api/chat-stream.js`
- `api/chat-stream-railway.js`

## Client-side (cooldown + queue)

**Source:** `src/rate-limit/rate-limiter.js`

**Browser script:** `app/js/chat-rate-limiter.js`

Features:

- `burst=3`: allow 3 rapid sends
- After burst: enforce `minIntervalMs=1000`
- Queue messages while in cooldown or while server says to wait
- Observe server headers and display:
  - remaining quota
  - cooldown countdown
  - queue length

### UI

`app/js/chat-ui.js` renders a small indicator under the input bar:

- `Quota: <n> left`
- `Queue: <n>`
- `Cooldown: <n>s`

## Notes / limitations

- Server limiter is **in-memory**; it will not coordinate across multiple instances.
  - For multi-instance deployments, replace the store with Redis.
- Client-side limiter is best-effort; server-side limiter is the source of truth.
