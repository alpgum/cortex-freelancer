# Stripe Mock → Live Switch Runbook

Exact steps to switch from mock/test mode to live Stripe, with rollback instructions.

---

## Pre-flight

- [ ] All items in `docs/STRIPE_LIVE_CHECKLIST.md` completed
- [ ] Live products & prices created in Stripe Dashboard (live mode)
- [ ] Webhook endpoint created pointing to `https://cortexfreelancer.com/api/webhook`
- [ ] Customer portal configured in live mode
- [ ] Confirm no active test subscriptions that will interfere

---

## Step 1 — Capture Current State (Rollback Snapshot)

Save current env values so you can revert:

```bash
# From Vercel Dashboard → Settings → Environment Variables → Production
# Copy these somewhere safe:
STRIPE_SECRET_KEY=<current value or empty>
STRIPE_PRICE_MONTHLY=<current value or empty>
STRIPE_PRICE_ANNUAL=<current value or empty>
STRIPE_WEBHOOK_SECRET=<current value or empty>
```

---

## Step 2 — Set Live Environment Variables

In **Vercel Dashboard → Project → Settings → Environment Variables**, update **Production** only:

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_PRICE_MONTHLY` | `price_...` (live monthly price ID) |
| `STRIPE_PRICE_ANNUAL` | `price_...` (live annual price ID) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (live webhook signing secret) |

> Keep Preview/Development environments on test keys.

---

## Step 3 — Redeploy

```bash
# Trigger a production redeploy to pick up new env vars
vercel --prod
```

Or redeploy from Vercel Dashboard → Deployments → latest → Redeploy.

---

## Step 4 — Verify Webhook Connectivity

1. Go to Stripe Dashboard → Developers → Webhooks (live mode)
2. Find your endpoint (`https://cortexfreelancer.com/api/webhook`)
3. Click **Send test webhook** → select `checkout.session.completed`
4. Confirm the endpoint returns `200` with `{ "received": true }`

---

## Step 5 — Smoke Test (Real Payment)

1. Open `https://cortexfreelancer.com/pricing`
2. Click **Upgrade to Pro**, enter your own email
3. Pay with a real card
4. Verify:
   - [ ] Stripe Checkout loads and payment succeeds
   - [ ] Redirect to `/checkout-success` works
   - [ ] Webhook `checkout.session.completed` received (check Stripe Dashboard → Webhooks → Recent events)
   - [ ] Firestore `users/{uid}` shows `isPro: true`
   - [ ] Pro activation email received
5. Open billing portal from nav → **Manage** link
   - [ ] Portal loads with correct subscription
6. **Refund the test payment** in Stripe Dashboard → Payments → select → Refund

---

## Step 6 — Monitor

- Watch Stripe Dashboard → Events for the first 30 minutes
- Watch Sentry for errors in `/api/checkout`, `/api/webhook`, `/api/billing-portal`
- Check Vercel function logs: `vercel logs --follow`

---

## Rollback Procedure

If something goes wrong, revert to mock/test mode:

### Option A — Revert to Test Keys

1. In Vercel Dashboard → Environment Variables → Production, replace live keys with test keys:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_MONTHLY=price_test_...
STRIPE_PRICE_ANNUAL=price_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

2. Redeploy: `vercel --prod`
3. The app will now use test-mode Stripe. Existing live subscriptions remain in Stripe but the app won't create new ones.

### Option B — Full Mock Mode

1. Remove `STRIPE_SECRET_KEY` from Vercel Production env vars (or set to empty)
2. Redeploy: `vercel --prod`
3. The app enters mock mode — checkout returns a fake URL, webhooks are no-ops

### Option C — Emergency: Disable Checkout Only

If only checkout is broken but webhooks are fine:

1. In Stripe Dashboard → Products, **archive** the live prices
2. New checkout sessions will fail gracefully, but existing subscriptions continue

---

## Post-Switch Cleanup

- [ ] Delete any test customers from Firestore (`users/` with test emails)
- [ ] Remove test entries from `data/customers.json`
- [ ] Verify Preview/Dev environments still use test keys
- [ ] Update team on the switch (Slack / email)
