# Vercel Environment Variables Setup

This guide walks through configuring all required environment variables in the Vercel dashboard for Cortex Freelancer.

## Required Environment Variables

| Variable | Source | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard | Secret API key for server-side Stripe operations |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard | Webhook signing secret for verifying Stripe events |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Dashboard | Price ID for the Pro monthly plan |
| `STRIPE_PRICE_PRO_ANNUAL` | Stripe Dashboard | Price ID for the Pro annual plan |
| `ADMIN_TOKEN` | Self-generated | Secret token for admin API authentication |
| `ANTHROPIC_API_KEY` | Anthropic Console | API key for Claude AI features |
| `FIREBASE_API_KEY` | Firebase Console | Firebase Web API key |
| `FIREBASE_AUTH_DOMAIN` | Firebase Console | Firebase Auth domain (e.g. `project-id.firebaseapp.com`) |
| `FIREBASE_PROJECT_ID` | Firebase Console | Firebase project identifier |

## Step-by-Step Setup

### 1. Open Vercel Environment Variables

1. Go to [vercel.com](https://vercel.com) and select your **Cortex Freelancer** project.
2. Navigate to **Settings** > **Environment Variables**.

### 2. Add Stripe Variables

1. In the [Stripe Dashboard](https://dashboard.stripe.com/apikeys), copy your **Secret key** (starts with `sk_live_` or `sk_test_`).
2. In Vercel, add:
   - **Key:** `STRIPE_SECRET_KEY` — **Value:** your secret key
3. Go to **Developers** > **Webhooks** in Stripe. Select your endpoint and copy the **Signing secret** (starts with `whsec_`).
4. Add:
   - **Key:** `STRIPE_WEBHOOK_SECRET` — **Value:** the signing secret
5. Go to **Products** in Stripe. Open your Pro plan and copy the Price IDs for monthly and annual intervals.
6. Add:
   - **Key:** `STRIPE_PRICE_PRO_MONTHLY` — **Value:** monthly price ID (starts with `price_`)
   - **Key:** `STRIPE_PRICE_PRO_ANNUAL` — **Value:** annual price ID (starts with `price_`)

### 3. Add Admin Token

1. Generate a secure random token (e.g. `openssl rand -hex 32`).
2. Add:
   - **Key:** `ADMIN_TOKEN` — **Value:** the generated token

### 4. Add Anthropic API Key

1. Go to the [Anthropic Console](https://console.anthropic.com/) and create or copy an API key.
2. Add:
   - **Key:** `ANTHROPIC_API_KEY` — **Value:** your API key (starts with `sk-ant-`)

### 5. Add Firebase Variables

1. In the [Firebase Console](https://console.firebase.google.com/), open your project.
2. Go to **Project Settings** > **General** > **Your apps** and find the Firebase config object.
3. Add:
   - **Key:** `FIREBASE_API_KEY` — **Value:** `apiKey` value
   - **Key:** `FIREBASE_AUTH_DOMAIN` — **Value:** `authDomain` value
   - **Key:** `FIREBASE_PROJECT_ID` — **Value:** `projectId` value

### 6. Select Environments

For each variable, check the environments it should apply to:

- **Production** — live site
- **Preview** — PR deploy previews
- **Development** — `vercel dev` locally

> Use test/sandbox keys for **Preview** and **Development** environments. Use live keys only for **Production**.

### 7. Deploy

After adding all variables, trigger a new deployment:

1. Go to **Deployments** tab.
2. Click the **...** menu on the latest deployment and select **Redeploy**.

The new deployment will pick up all environment variables.
