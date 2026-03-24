# Environment Variables & Security — Cortex Freelancer

## Quick Reference

| Command | What it does |
|---------|-------------|
| `node config/validate-env.js` | Validate current env config |
| `node config/validate-env.js --platform railway` | Validate for specific platform |
| `node config/validate-env.js --strict` | Fail on warnings too |
| `node config/validate-env.js --report` | Full config status report |
| `node config/config-drift.js` | Detect drift across platforms |

## Architecture

```
.env.template          ← Canonical template (tracked in git)
     │
     ├── .env.local              ← Local dev (gitignored)
     ├── .env.staging            ← Staging (gitignored)  
     ├── .env.production.local   ← Docker prod (gitignored)
     │
     ├── render.yaml             ← Render blueprint (sync: false = manual)
     ├── docker/.env.example     ← Docker reference (tracked, no values)
     └── docker/k8s/secrets.yaml.template  ← K8s reference (tracked)
```

## Sensitivity Classification

| Level | Icon | Treatment | Examples |
|-------|------|-----------|----------|
| **SECRET** | 🔴 | Never log, never expose, rotate regularly | API keys, tokens, passwords |
| **PRIVATE** | 🟡 | Safe to log server-side, not to expose | Internal URLs, email addresses |
| **PUBLIC** | 🟢 | Safe everywhere, can be in client bundle | Firebase config, GA ID, ports |

## Platform Configuration

### Railway
- Set via Railway Dashboard → Project → Variables
- Supports environment-specific variables (production/staging)
- Auto-injected: `RAILWAY_ENVIRONMENT`, `PORT`
- **Required secrets:** All 🔴 variables from schema

### Render
- Defined in `render.yaml` with `sync: false` for secrets
- Set actual values in Render Dashboard → Service → Environment
- Auto-injected: `RENDER`, `PORT=10000`
- **Required secrets:** All 🔴 variables from schema

### Docker (Self-hosted / DigitalOcean)
- Copy `.env.template` → `.env.production.local`
- Docker Compose reads from `env_file`
- K8s: Apply `secrets.yaml` with base64-encoded values
- **Never mount .env files as volumes in production**

### Vercel (Edge/SSE only)
- Set via Vercel Dashboard → Project → Environment Variables
- Auto-injected: `VERCEL`, `VERCEL_REGION`
- Edge functions get: `EDGE_API_SECRET`, `CRON_SECRET`

## Secret Rotation Schedule

| Secret | Rotation | How to rotate |
|--------|----------|---------------|
| `STRIPE_SECRET_KEY` | 90 days | Stripe Dashboard → API Keys → Roll key |
| `ANTHROPIC_API_KEY` | 90 days | Anthropic Console → API Keys |
| `RESEND_API_KEY` | 90 days | Resend Dashboard → API Keys |
| `ADMIN_TOKEN` | 30 days | Generate new: `openssl rand -hex 32` |
| `CRON_SECRET` | 90 days | Generate new: `openssl rand -hex 32` |
| `EDGE_API_SECRET` | 90 days | Generate new: `openssl rand -hex 32` |
| `SLACK_WEBHOOK_URL` | On compromise | Slack → App → Webhooks → Regenerate |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | On compromise | Firebase Console → Service Accounts |
| `SCRAPE_DO_API_KEY` | 90 days | Scrape.do Dashboard |

### Rotation Procedure

1. Generate new secret value
2. Set new value in **all platforms** (Railway, Render, Docker, etc.)
3. Deploy to each platform
4. Verify health checks pass (`/api/health`)
5. Revoke old secret value
6. Run `node config/config-drift.js` to confirm sync

## Security Rules

### DO ✅
- Use `config/validate-env.js` before every deploy
- Store secrets in platform-native secret managers
- Use `.env.template` as the single source of truth
- Rotate secrets on the schedule above
- Use `getSafeConfig()` when logging config
- Run drift detection in CI/CD

### DON'T ❌
- Never commit `.env.local`, `.env.production.local`, or any file with real secrets
- Never log full secret values (use `getSafeConfig()`)
- Never hardcode secrets in source code
- Never use default `ADMIN_TOKEN` in production
- Never use `sk_test_` Stripe keys in production
- Never share secrets over insecure channels (use 1Password, Bitwarden, etc.)

## .gitignore Entries

```
.env
.env.*
!.env.template
.env.production.local
docker/k8s/secrets.yaml
```

## Startup Validation

Add to `server.js` (first line after requires):

```javascript
require('./config/startup-check')();
```

This will:
- Validate all env vars against schema
- Log a clean summary with sensitivity counts
- **Crash the server in production** if critical config is missing
- Warn in development mode

## Generating Secure Tokens

```bash
# Admin token (32 bytes hex = 64 chars)
openssl rand -hex 32

# Cron/Edge secret
openssl rand -hex 32

# Firebase service account key (from Firebase Console)
# Download JSON → single-line it:
cat service-account.json | jq -c .
```

## CI/CD Integration

Add to your deploy pipeline:

```yaml
# GitHub Actions example
- name: Validate config
  run: node config/validate-env.js --strict --platform ${{ matrix.platform }}
  env:
    # ... inject from GitHub Secrets
```

```yaml
# Railway deploy hook
build:
  - node config/validate-env.js --platform railway
```
