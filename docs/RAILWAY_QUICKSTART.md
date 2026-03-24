# Railway Quick Start — 5-Minute Deploy

## Prerequisites
- Railway account (https://railway.app — GitHub login works)
- Railway CLI: `brew install railway`

## Steps

```bash
cd projects/cortex-freelancer

# 1. Login (opens browser)
railway login

# 2. Create project
railway init --name cortex-freelancer

# 3. Set environment variables
railway variables set NODE_ENV=production
railway variables set RAILWAY_ENVIRONMENT=production
railway variables set WS_TIMEOUT_PROFILE=production
railway variables set ANTHROPIC_API_KEY=sk-ant-xxx
railway variables set ANTHROPIC_MODEL=claude-sonnet-4-20250514
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
railway variables set FIREBASE_SERVICE_ACCOUNT_KEY=<base64>
railway variables set RESEND_API_KEY=re_xxx
railway variables set CRON_SECRET=xxx
railway variables set ADMIN_TOKEN=xxx

# 4. Deploy
railway up --detach

# 5. Get domain
railway domain

# 6. Test
curl https://<your-domain>/api/health
```

## Connect GitHub (auto-deploy)
Railway Dashboard → Settings → Source → Connect `alpgum/cortex-freelancer` → branch `main`

## That's it! 🚀
