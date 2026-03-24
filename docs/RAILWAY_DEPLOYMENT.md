# Railway Production Deployment — Cortex Freelancer

> CFX-011: Permanent production hosting on Railway, replacing Cloudflare tunnel workarounds.

## Why Railway?

| Issue | Cloudflare Tunnel | Railway |
|-------|------------------|---------|
| WebSocket idle timeout | ~100s (forced keepalive needed) | **None** (native WS support) |
| URL stability | Changes on restart (quick tunnel) | **Fixed** subdomain |
| Gateway dependency | Requires local OpenClaw running | **None** (direct Anthropic SDK) |
| SSL | Via tunnel (adds latency) | **Auto-provisioned** |
| Uptime | Tied to local machine | **99.9%+ SLA** |
| Deploy | Manual restart | **Git push auto-deploy** |

## Architecture

```
                     Railway
┌──────────────────────────────────────────┐
│  Cortex Freelancer (Node.js container)   │
│                                          │
│  server.js                               │
│    ├── Express (HTTP routes, API)         │
│    ├── ws-bridge-railway.js (WebSocket)   │
│    │     └── Anthropic SDK (streaming)    │
│    └── Static files + rewrites           │
│                                          │
│  Auto-detected via RAILWAY_ENVIRONMENT   │
└──────────────────────────────────────────┘
         │                      │
    HTTPS (443)         WSS (/ws/chat)
         │                      │
    ┌────┴────┐          ┌──────┴───────┐
    │ Browser │          │ Chat Widget  │
    │ (pages) │          │ (real-time)  │
    └─────────┘          └──────────────┘
```

**Key difference from local dev:**
- Local: `ws-bridge.js` spawns `openclaw` CLI → needs OpenClaw gateway
- Railway: `ws-bridge-railway.js` calls Anthropic SDK directly → zero dependencies

The switch is automatic via `RAILWAY_ENVIRONMENT` env var (set by Railway).

## Deployment Steps

### 1. Login & Initialize

```bash
# Login to Railway
railway login

# Initialize project
./scripts/railway-deploy.sh --init
```

### 2. Set Environment Variables

```bash
# Auto-set Railway-specific vars
./scripts/railway-deploy.sh --env-setup

# Then set secrets via Railway dashboard or CLI:
railway variables set ANTHROPIC_API_KEY=sk-ant-xxx
railway variables set STRIPE_SECRET_KEY=sk_live_xxx
railway variables set STRIPE_WEBHOOK_SECRET=whsec_xxx
railway variables set STRIPE_PRICE_PRO_MONTHLY=price_xxx
railway variables set STRIPE_PRICE_PRO_ANNUAL=price_xxx
railway variables set FIREBASE_API_KEY=xxx
railway variables set FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
railway variables set FIREBASE_PROJECT_ID=xxx
railway variables set FIREBASE_STORAGE_BUCKET=xxx.appspot.com
railway variables set FIREBASE_MESSAGING_SENDER_ID=xxx
railway variables set FIREBASE_APP_ID=xxx
railway variables set FIREBASE_SERVICE_ACCOUNT_KEY=<base64-encoded-json>
railway variables set RESEND_API_KEY=re_xxx
railway variables set CRON_SECRET=<secure-random>
railway variables set ADMIN_TOKEN=<secure-token>
railway variables set ADMIN_EMAIL=alp@example.com
```

### 3. Deploy

```bash
# Deploy from current directory
./scripts/railway-deploy.sh --deploy

# Or directly:
railway up --detach
```

### 4. Setup Domain

```bash
# Get Railway-generated domain
railway domain

# Or add custom domain via dashboard:
# Railway Dashboard → Settings → Domains → cortexfreelancer.com
```

### 5. Verify

```bash
# Health check
curl https://cortex-freelancer.up.railway.app/api/health

# WebSocket test (using wscat)
npx wscat -c wss://cortex-freelancer.up.railway.app/ws/chat

# Send test message:
{"type":"chat","message":"How should I price my freelance services?","sessionId":"test-001"}
```

## Auto-Deploy Pipeline

Railway auto-deploys on git push when linked to GitHub:

1. **Railway Dashboard** → **Settings** → **Source** → Connect GitHub repo
2. Select `alpgum/cortex-freelancer`
3. Branch: `main`
4. Auto-deploy: **Enabled**

Every `git push origin main` triggers a build + deploy.

### Deployment Workflow

```
git push origin main
     │
     ▼
Railway detects push
     │
     ▼
Build (Dockerfile.railway)
     │
     ▼
Health check (/api/health)
     │
     ▼
Traffic switch (zero-downtime)
```

## Rollback

```bash
# Rollback to previous deployment
./scripts/railway-deploy.sh --rollback
# or
railway rollback
```

## Monitoring

### Health Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | App health + env check |
| `/ws/health` | HTTP GET (on WS port) | WebSocket bridge metrics |

### Railway Dashboard

- **Metrics:** CPU, memory, network in real-time
- **Logs:** `railway logs --tail 100` or dashboard
- **Deployments:** History with one-click rollback

### Structured Logging

All WebSocket events use structured JSON logging:
```json
{"ts":"2026-03-25T00:00:00.000Z","level":"info","ctx":"api","msg":"Stream complete","elapsed":2341}
```

## Environment-Specific Config

| Variable | Local Dev | Railway Production |
|----------|-----------|-------------------|
| `RAILWAY_ENVIRONMENT` | _(unset)_ | `production` |
| `NODE_ENV` | `development` | `production` |
| `WS_TIMEOUT_PROFILE` | `development` | `production` |
| `DOMAIN` | `http://localhost:3847` | `https://cortex-freelancer.up.railway.app` |
| `ANTHROPIC_MODEL` | _(any)_ | `claude-sonnet-4-20250514` |

## Migration from Cloudflare Tunnel

### Phase 1: Parallel Run (Current)
- Cloudflare tunnel continues serving traffic
- Railway deployed and tested independently
- Verify WebSocket stability on Railway

### Phase 2: DNS Switch
- Update DNS to point to Railway domain
- Or update Vercel `OPENCLAW_BRIDGE_URL` to Railway WebSocket URL
- Keep tunnel as fallback for 48h

### Phase 3: Tunnel Decommission
- Remove cloudflared config
- Remove aggressive timeout profile (no longer needed)
- Clean up tunnel-specific code paths

## Cost Estimate

Railway Starter plan:
- **$5/month** base (includes $5 usage credit)
- ~$0.000231/min CPU, ~$0.000231/GB-min RAM
- For Cortex traffic: **~$5-10/month estimated**

vs. Current setup:
- Cloudflare tunnel: Free but unreliable
- Vercel: Free tier (serverless, no WS)
- Local machine: Must be always-on

## Troubleshooting

### Build fails
```bash
railway logs --build
# Check Dockerfile.railway for issues
```

### Health check fails
- Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is set (health endpoint checks Firestore)
- Check `/api/health` response for missing vars

### WebSocket disconnects
- Railway has no idle timeout, so this shouldn't happen
- Check `/ws/health` for connection state metrics
- Verify client reconnect logic works

### High latency
- Railway auto-selects nearest region
- Check Anthropic API response times in logs
- Consider upgrading to Pro plan for dedicated resources

## Files

| File | Purpose |
|------|---------|
| `railway.json` | Railway build & deploy config |
| `Dockerfile.railway` | Production container (slim, no Chromium) |
| `api/ws-bridge-railway.js` | Direct Anthropic SDK bridge (no OpenClaw) |
| `scripts/railway-deploy.sh` | Deployment automation script |
| `server.js` | Auto-detects Railway vs local mode |
