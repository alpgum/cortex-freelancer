# Upwork OAuth2 Live Test (Phase 4)

This project uses **Upwork OAuth2** (Authorization Code + Refresh Token) and stores tokens in Firestore (`upwork_tokens/{uid}`).

## 0) Prereqs

- Upwork developer app created at <https://developers.upwork.com>
- Callback URL configured in the Upwork app settings
- Firestore enabled (recommended) + service account configured so tokens persist

## 1) Required env vars

```bash
UPWORK_CLIENT_ID=...
UPWORK_CLIENT_SECRET=...

# Optional override. If unset, defaults to:
#   https://$DOMAIN/api/upwork-callback
#   or http://localhost:$PORT/api/upwork-callback
UPWORK_REDIRECT_URI=https://your-domain-or-tunnel/api/upwork-callback

# Needed for token persistence
FIREBASE_SERVICE_ACCOUNT_KEY=...   # or whatever your config expects
```

Notes:
- Upwork typically requires the redirect URI to **exactly match** what’s configured.
- For local testing, use an HTTPS tunnel (cloudflared/ngrok) and set `UPWORK_REDIRECT_URI` to that tunnel URL.

## 2) Run locally

```bash
npm install
npm start
```

## 3) Verify end-to-end OAuth flow

1. Sign into Cortex (so you have a real `uid`).
2. Go to:
   - `/tools/external-connections` or
   - `/tools/upwork-integration`
3. Click **Connect Upwork** → authorize on Upwork → you should land back on `/app/index.html?upwork_connected=true`.

### API-level status check

```bash
curl "http://localhost:3847/api/upwork-auth?action=status&uid=YOUR_UID"
```

Expected:
- `connected: true`
- `profile.name` populated when Upwork profile endpoints are available for your app.

## 4) Verify live job search

```bash
curl -X POST "http://localhost:3847/api/upwork-jobs" \
  -H "Content-Type: application/json" \
  -d '{"uid":"YOUR_UID","skills":["javascript","react","node"],"hourlyRate":80}'
```

Expected:
- `_meta.source` is `upwork_api` when OAuth is working
- `jobs[]` returns real Upwork jobs

## 5) Refresh cycle test

In Firestore, edit the user doc:
- `upwork_tokens/{uid}.expires_at` → set to a timestamp in the past

Then call:

```bash
curl "http://localhost:3847/api/upwork-auth?action=status&uid=YOUR_UID"
```

Expected:
- Server refreshes token automatically and updates the Firestore doc (new `access_token` + `expires_at`).

## 6) Revoked access test

1. Revoke the app in Upwork (Account → Settings → Connected Services / Security).
2. Call status again.

Expected:
- `connected: false` with `reason: "revoked"`
- Token doc is cleaned up (best-effort)

## 7) Rate limit behavior

If Upwork responds with HTTP `429`, the API will throw a `RATE_LIMIT` error internally.
- The job search endpoint will fall back to RSS/local-proxy sources when OAuth search fails.

---

If you hit an Upwork REST 404/400, check that your app has the right permissions and that the Upwork REST APIs you’re calling are enabled for your account (Upwork has been shifting some functionality to GraphQL). The code supports common REST endpoints:
- `/auth/v1/info(.json)`
- `/profiles/v1/providers/{profileKey}/brief(.json)`
- `/profiles/v2/search/jobs(.json)`
- `/profiles/v1/jobs/{jobKey}(.json)`
