# Render.com Fallback Deployment — CFX-012

> Render.com serves as the **fallback** hosting platform. Railway is **primary**.  
> Both platforms run the same Docker image with identical env vars.

## Quick Start

### 1. Connect Repository
1. Go to [render.com/new/blueprint](https://render.com/new/blueprint)
2. Connect the `alpgum/cortex-freelancer` GitHub repo
3. Render auto-detects `render.yaml` in the repo root
4. Fill in environment variables (marked `sync: false`)
5. Click **Deploy Blueprint**

### 2. Set Environment Variables
Copy all env vars from Railway → Render Dashboard → Environment:

| Variable | Required | Notes |
|----------|----------|-------|
| `STRIPE_SECRET_KEY` | ✅ | Same key for both platforms |
| `STRIPE_WEBHOOK_SECRET` | ✅ | **Different per platform** — register separate webhook endpoint |
| `ANTHROPIC_API_KEY` | ✅ | Same key |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | ✅ | Same JSON blob |
| `FIREBASE_*` | ✅ | Same project config |
| `RESEND_API_KEY` | ✅ | Same key |
| `ADMIN_TOKEN` | ✅ | Same token |
| `DOMAIN` | ⚠️ | Set to Render URL or custom domain |
| `SENTRY_DSN` | 💡 | Same DSN |
| `CRON_SECRET` | ✅ | Same secret |

### 3. Custom Domain (Optional)
- Render Dashboard → Settings → Custom Domains
- Add `fallback.cortexfreelancer.com` or similar
- Render provides automatic SSL via Let's Encrypt

### 4. Stripe Webhook
Register a **separate** Stripe webhook for the Render URL:
```
https://cortex-freelancer.onrender.com/api/stripe-webhook
```
Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

---

## Architecture

```
                    ┌─────────────────┐
                    │  cortexfreelancer│
                    │    .com (DNS)    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Vercel CDN    │  ← Static pages (current)
                    │   (landing)     │
                    └────────┬────────┘
                             │ /api/* /ws/*
                ┌────────────┴────────────┐
                │                         │
       ┌────────▼────────┐       ┌────────▼────────┐
       │    Railway       │       │    Render.com    │
       │   (PRIMARY)      │       │   (FALLBACK)     │
       │  Docker + WS     │       │  Docker + WS     │
       │  Port 3847       │       │  Port 10000      │
       └──────────────────┘       └──────────────────┘
```

---

## Platform Comparison

| Feature | Railway | Render |
|---------|---------|--------|
| **WebSocket** | ✅ Native | ✅ Native |
| **Docker** | ✅ Custom Dockerfile | ✅ Custom Dockerfile |
| **Auto-deploy** | ✅ Git push | ✅ Git push |
| **Health checks** | ✅ `/api/health` | ✅ `/api/health` |
| **SSL** | ✅ Auto | ✅ Auto (Let's Encrypt) |
| **Region** | Frankfurt | Frankfurt |
| **Free tier** | 500 hrs/mo | 750 hrs/mo |
| **Starter plan** | ~$5/mo | ~$7/mo |
| **Cold starts** | None (always on) | ⚠️ Free tier spins down after 15min idle |
| **WS idle timeout** | None known | None (Render proxies keep WS alive) |
| **Deploy speed** | ~2-3 min | ~3-5 min |
| **Logs** | Dashboard + CLI | Dashboard + CLI |
| **Env var management** | Dashboard + CLI | Dashboard + Blueprint |

### Key Render.com Notes
- **Port**: Render expects `PORT=10000` (set in render.yaml)
- **WebSocket**: Works natively — `wss://your-app.onrender.com/ws/chat`
- **No proxy config needed**: Render handles WSS termination at edge
- **Cold starts on free tier**: First request after idle takes 10-30s. Use Starter plan ($7/mo) for always-on.
- **Deploy**: Auto on `git push` to `main` branch

---

## Files

| File | Purpose |
|------|---------|
| `render.yaml` | Render Blueprint — infrastructure as code |
| `Dockerfile.render` | Render-optimized Docker build (port 10000, multi-stage) |
| `Dockerfile` | Railway Docker build (port 3847) |
| `scripts/render-deploy.sh` | Deploy script with pre/post checks |
| `scripts/failover-check.sh` | Multi-platform health monitoring |

---

## Failover Strategy

### Automatic Failover (DNS-based)
For production failover, use DNS-level routing:

1. **Cloudflare DNS** (if using CF): 
   - Primary: CNAME → Railway URL
   - Failover: Cloudflare Load Balancing → Render URL
   - Health checks at `/api/health` every 60s

2. **Manual failover**:
   - Update DNS CNAME from Railway URL → Render URL
   - TTL should be 60s for fast failover

### Health Check Script
```bash
# One-shot check
./scripts/failover-check.sh

# Continuous monitoring (every 60s)
./scripts/failover-check.sh --loop 60

# JSON output (for automation)
./scripts/failover-check.sh --json
```

### Failover Procedure (Manual)
1. Detect: Railway health check fails for 3+ minutes
2. Verify: Run `./scripts/failover-check.sh` — confirm Render is healthy
3. Switch: Update DNS or proxy to point to Render URL
4. Notify: Slack webhook alert
5. Monitor: Watch Render logs for issues
6. Revert: When Railway recovers, switch back

### Failover Procedure (Automated via Cron)
```bash
# Add to OpenClaw cron or system crontab
*/5 * * * * /path/to/scripts/failover-check.sh --json >> /var/log/cortex-health.json
```

---

## Deployment Automation

### Git-based Auto-deploy
Both Railway and Render auto-deploy from `main` branch:
- Push to `main` → both platforms build and deploy
- Push to `staging` → only staging env (if configured)

### Branch Strategy
```
main     → Production (Railway + Render)
staging  → Staging (Railway only, or Render preview)
feature/* → No auto-deploy
```

### CI/CD Integration (GitHub Actions)
Add to `.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Railway deploys automatically via git integration
      # Render deploys automatically via git integration
      
      # Post-deploy health checks
      - name: Wait for deploys
        run: sleep 90
      
      - name: Check Railway
        run: curl -sf https://cortex-freelancer-production.up.railway.app/api/health
      
      - name: Check Render
        run: curl -sf https://cortex-freelancer.onrender.com/api/health
```

---

## Monitoring & Logging

### Render Dashboard
- **Logs**: Real-time log streaming in Dashboard
- **Metrics**: CPU, Memory, Request count
- **Events**: Deploy history, health check results

### Custom Monitoring
The `/ws/health` endpoint provides:
- Active WebSocket connections
- Connection states (healthy/degraded/stale/dead)
- Error counters by code and category
- Resource usage (memory, CPU)
- Timeout configuration

### Alerts
Set up Render notifications:
- Deploy failures → Email/Slack
- Health check failures → Email/Slack
- Service restart → Email

---

## Troubleshooting

### WebSocket not connecting on Render
1. Ensure client connects to `wss://` (not `ws://`) — Render terminates SSL
2. Check the path is `/ws/chat` (not `/ws/`)
3. Verify PORT env var is 10000
4. Check Render Dashboard logs for connection errors

### Cold start issues (free tier)
- Upgrade to Starter plan ($7/mo) for always-on
- Or use a keep-alive cron that pings the health endpoint every 10 minutes

### Build failures
- Check Dockerfile.render syntax
- Ensure `package-lock.json` is committed
- Check Render build logs for npm install errors

### Different behavior vs Railway
- Both use the same server.js — behavior should be identical
- Check env vars match between platforms
- WebSocket timeout profiles may need tuning (WS_TIMEOUT_PROFILE)
