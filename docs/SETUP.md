# Cortex Freelancer — Setup Guide

## Quick Start

```bash
# 1. Clone and enter the project
cd projects/cortex-freelancer

# 2. Copy the env file and fill in your values
cp .env.example .env

# 3. Install Vercel CLI (if not installed)
npm i -g vercel

# 4. Link to your Vercel project
vercel link

# 5. Run locally
vercel dev
```

The site will be available at `http://localhost:3000`.

## Environment Variables

All env vars are documented in `.env.example`. Here's a summary by category:

### Required for core functionality

| Variable | Source | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | [Stripe API keys](https://dashboard.stripe.com/apikeys) | All server-side Stripe operations |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhooks page | Verify incoming Stripe webhook signatures |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Products | Price ID for $29/mo Pro plan |
| `STRIPE_PRICE_PRO_ANNUAL` | Stripe Products | Price ID for $249/yr Pro plan |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Console > Service accounts | Server-side Firestore access (base64-encoded JSON) |
| `FIREBASE_API_KEY` | Firebase Console > Project Settings | Client-side Firebase init |
| `FIREBASE_AUTH_DOMAIN` | Firebase Console | Firebase Auth domain |
| `FIREBASE_PROJECT_ID` | Firebase Console | Firebase project identifier |
| `ADMIN_TOKEN` | Self-generated | Auth for admin endpoints (`/api/toggle-pro`, `/api/export-events`) |
| `CRON_SECRET` | Self-generated | Auth for `/api/cron/*` scheduled jobs |

### Required for specific features

| Variable | Source | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | Claude AI chat feature |
| `RESEND_API_KEY` | [Resend](https://resend.com/api-keys) | Transactional email (contact form, daily metrics) |
| `ADMIN_EMAIL` | Your email | Receives daily metrics digest |

### Optional

| Variable | Source | Purpose |
|---|---|---|
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhooks | Revenue notifications to Slack |
| `SENTRY_DSN` | [Sentry](https://sentry.io) | Error monitoring |
| `GA_MEASUREMENT_ID` | Google Analytics | Client-side analytics |
| `STRIPE_COUPON_LAUNCH50` | Stripe Coupons | Launch 50% off coupon ID |
| `STRIPE_COUPON_FRIEND20` | Stripe Coupons | Friend referral 20% off coupon ID |
| `STRIPE_COUPON_ANNUAL10` | Stripe Coupons | Annual 10% off coupon ID |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/api-keys) | Only checked by `/api/health` status endpoint |
| `DOMAIN` | — | Override base URL for Stripe redirect URLs |

## Setting Up Vercel Environment Variables

1. Go to [vercel.com](https://vercel.com) → select your project → **Settings** → **Environment Variables**.
2. Add each variable from the table above.
3. For each variable, select the appropriate environments:
   - **Production** — use live/production keys
   - **Preview** — use test/sandbox keys
   - **Development** — use test/sandbox keys (pulled by `vercel dev`)
4. After adding all variables, redeploy from the **Deployments** tab.

> See also: [VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md) for step-by-step screenshots.

## Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** with Email/Password sign-in.
3. Enable **Cloud Firestore** in production mode.
4. **Client config** — go to Project Settings > Your apps > Web app, copy the config values into your `.env`.
5. **Server service account** — go to Project Settings > Service accounts > Generate new private key. Then base64-encode the JSON:
   ```bash
   base64 -i service-account.json | tr -d '\n'
   ```
   Set the output as `FIREBASE_SERVICE_ACCOUNT_KEY`.

> See also: [FIRESTORE_DEPLOY.md](FIRESTORE_DEPLOY.md) for Firestore rules and index deployment.

## Stripe Setup

### Test Mode

1. Create a [Stripe account](https://dashboard.stripe.com/register) (starts in test mode).
2. Copy your **Secret key** (`sk_test_...`) from API keys page.
3. Create a product called "Cortex Freelancer Pro" with two prices:
   - $29/month recurring → copy the price ID for `STRIPE_PRICE_PRO_MONTHLY`
   - $249/year recurring → copy the price ID for `STRIPE_PRICE_PRO_ANNUAL`
4. Set up a webhook endpoint pointing to `https://your-domain.vercel.app/api/stripe-webhook` with these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook **Signing secret** (`whsec_...`) for `STRIPE_WEBHOOK_SECRET`.

### Going Live

1. Activate your Stripe account (complete identity verification).
2. Switch to live mode in the Stripe dashboard.
3. Create the same product/prices in live mode (new price IDs).
4. Create a new webhook endpoint for live mode.
5. Update Vercel **Production** env vars with live keys.
6. Keep test keys in Preview/Development environments.

> See also: [STRIPE_LIVE_SWITCH_RUNBOOK.md](STRIPE_LIVE_SWITCH_RUNBOOK.md) for the full go-live checklist.

## Local Development

```bash
# Pull env vars from Vercel (after vercel link)
vercel env pull .env

# Start local dev server
vercel dev
```

The local server runs Vercel serverless functions from `/api` and serves static files from `/app` and root.

### Testing Stripe Webhooks Locally

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Copy the webhook signing secret from the CLI output and set it as `STRIPE_WEBHOOK_SECRET` in your `.env`.

### Authentication

See [AUTH_TEST_REPORT.md](AUTH_TEST_REPORT.md) for the complete auth flow documentation including Google Sign-In, email signup/login, logout, and auth guard behavior.

### Mock Mode

If `STRIPE_SECRET_KEY` is not set or starts with `sk_test_mock`, the API runs in mock mode — Stripe calls return simulated responses. Useful for UI development without a Stripe account.
