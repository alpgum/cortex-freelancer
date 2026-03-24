# CFX-043 — Local-first Analytics

## What it does
- Tracks lightweight, privacy-conscious events for the Cortex Freelancer chat UI
- Stores events locally on the server as **daily NDJSON** files under `data/analytics/`
- Provides an admin-only dashboard + export endpoints (JSON/CSV)

## Tracked events (current)
- `page_view` (type: `page`)
- `message_sent` / `message_received` (type: `chat`) with `perf.totalMs`
- WebSocket connection state changes + `ws_connect_latency` (type: `connection` / `performance`)
- `chat_error`, `ws_failed` (type: `error`)

## Data format
Each event is stored as a single JSON line:
- `ts` (ms epoch)
- `type`, `name`
- `sessionId` (SHA-256 short hash of browser session id)
- `anonUserId` (SHA-256 short hash of a browser-stored anon user id)
- `page`, `referrer`
- `transport` (`ws`, `sse`, `http`, `chunked`, …)
- `perf` (optional): `totalMs`, `connectLatencyMs`
- `meta` (optional allowlist): `kind`, `errorCode`, `retryable`, `model`, `environment`

No IPs, emails, raw message text, or other PII are stored.

## Endpoints
### Public
- `POST /api/analytics`
  - Body: `{ ts?, type, name, sessionId, anonUserId?, page?, referrer?, transport?, perf?, meta? }`

### Admin (requires `ADMIN_TOKEN`)
- `GET /api/admin-analytics?mode=summary&days=14`
  - Header: `x-admin-token: <ADMIN_TOKEN>`
- `GET /api/admin-analytics?mode=export&format=json&days=14&token=<ADMIN_TOKEN>`
- `GET /api/admin-analytics?mode=export&format=csv&days=14&token=<ADMIN_TOKEN>`

## Dashboard
- `GET /admin/analytics`
  - Paste `ADMIN_TOKEN` into the page to load summary & export.

## Notes / future hooks
- Server module is `analytics/index.js` → easy to add sinks (Amplitude/Mixpanel) later.
- Client queues events in `localStorage` when offline and flushes on `online`.
