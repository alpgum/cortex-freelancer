# Secret Rotation Procedure

## Overview

All secrets should be rotated on a regular schedule or immediately if compromised.
This document covers rotation procedures for each secret used by Cortex Freelancer.

---

## Rotation Schedule

| Secret | Rotation Frequency | Risk if Leaked |
|--------|-------------------|----------------|
| ANTHROPIC_API_KEY | 90 days / on compromise | High — AI cost abuse |
| STRIPE_SECRET_KEY | 90 days / on compromise | Critical — payment data |
| STRIPE_WEBHOOK_SECRET | On endpoint change | Medium |
| FIREBASE_SERVICE_ACCOUNT_KEY | 180 days / on compromise | High — DB access |
| RESEND_API_KEY | 90 days / on compromise | Medium — email abuse |
| ADMIN_TOKEN | 30 days | High — admin access |
| CRON_SECRET | 90 days | Low |
| SLACK_WEBHOOK_URL | On compromise only | Low |
| SCRAPE_DO_API_KEY | 90 days | Low |

---

## Step-by-Step Rotation

### 1. ANTHROPIC_API_KEY

```bash
# 1. Generate new key at https://console.anthropic.com/settings/keys
# 2. Update in deployment platform:

# Railway:
railway variables set ANTHROPIC_API_KEY=sk-ant-new-key...

# Render: Dashboard → Service → Environment → Edit ANTHROPIC_API_KEY

# Docker:
# Update .env.local, then:
docker compose restart cortex-freelancer

# 3. Verify: curl https://your-domain/api/health
# 4. Revoke old key in Anthropic Console
```

### 2. STRIPE_SECRET_KEY

```bash
# ⚠️ CRITICAL — Test in staging first!

# 1. In Stripe Dashboard → Developers → API keys → Roll key
#    Stripe provides a grace period where both old & new keys work
# 2. Update new key in all deployment targets
# 3. Test a checkout flow end-to-end
# 4. The old key auto-expires after Stripe's grace period
```

### 3. STRIPE_WEBHOOK_SECRET

```bash
# 1. Stripe Dashboard → Developers → Webhooks → Select endpoint
# 2. Click "Reveal" under Signing secret, or rotate
# 3. Update STRIPE_WEBHOOK_SECRET in deployment
# 4. Test: trigger a test event from Stripe webhook dashboard
```

### 4. FIREBASE_SERVICE_ACCOUNT_KEY

```bash
# 1. Google Cloud Console → IAM → Service Accounts
# 2. Select the service account → Keys → Add Key → Create new key (JSON)
# 3. Base64 encode: cat new-key.json | base64 -w0
# 4. Update FIREBASE_SERVICE_ACCOUNT_KEY with the base64 string
# 5. Delete old key from Google Cloud Console
```

### 5. ADMIN_TOKEN

```bash
# 1. Generate new token:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Update in deployment platform
# 3. Update any scripts/tools using the admin token
```

### 6. RESEND_API_KEY

```bash
# 1. Resend Dashboard → API Keys → Create new key
# 2. Update RESEND_API_KEY in deployment
# 3. Test: trigger a test email via /api/contact
# 4. Delete old key in Resend Dashboard
```

---

## Emergency Rotation (Compromise Response)

If any secret is compromised:

1. **Immediately** rotate the compromised secret using steps above
2. **Check logs** for unauthorized usage during the exposure window
3. **Audit** — review recent API calls, payments, or admin actions
4. **Notify** — alert team via Slack (#security channel)
5. **Document** — log the incident in `docs/incidents/`

```bash
# Quick rotation script for all critical secrets:
# (Update values, then run)

railway variables set \
  ANTHROPIC_API_KEY="sk-ant-new..." \
  STRIPE_SECRET_KEY="sk_live_new..." \
  ADMIN_TOKEN="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
```

---

## Verification Checklist

After rotating any secret:

- [ ] New secret is set in ALL deployment targets (Railway, Render, Docker, etc.)
- [ ] Application restarts successfully (`/api/health` returns 200)
- [ ] Affected feature works end-to-end (payments, AI, auth, etc.)
- [ ] Old secret is revoked/deleted from the provider
- [ ] Rotation is logged in `memory/` or incident docs
- [ ] No secrets are committed to git (`git diff --cached` check)

---

## Preventing Secret Leaks

1. **Never** commit `.env.local` or any file with real secrets
2. Use `git secrets` or `gitleaks` in CI to scan for leaked secrets
3. Use platform-native secret management (Railway Variables, Render Environment)
4. For Docker, use Docker Secrets or mount `.env` as a volume (not baked into image)
5. Run `node scripts/validate-env.js --strict` before every deployment
