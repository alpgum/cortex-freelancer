# Stripe Live Mode Checklist

Step-by-step guide for going live with Stripe on Cortex Freelancer.

---

## 1. Create Products & Prices

### In the Stripe Dashboard (Live Mode)

1. Go to **Products** > **Add product**
2. Create **Cortex Freelancer Pro — Monthly**:
   - Name: `Cortex Freelancer Pro — Monthly`
   - Description: `Unlimited analyses, invoice generator, proposal writer, 78+ templates, all job matches with filters, and your full AI team.`
   - Price: **$29.00 USD / month** (recurring)
   - Copy the **Price ID** (starts with `price_`)
3. Create **Cortex Freelancer Pro — Annual**:
   - Name: `Cortex Freelancer Pro — Annual`
   - Description: `Everything in Pro, billed yearly. Lock in the best price.`
   - Price: **$249.00 USD / year** (recurring)
   - Copy the **Price ID** (starts with `price_`)

### Update Environment Variables

```bash
# In Vercel project settings > Environment Variables (Production)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_MONTHLY=price_live_monthly_id_here
STRIPE_PRICE_ANNUAL=price_live_annual_id_here
STRIPE_WEBHOOK_SECRET=whsec_live_...
```

---

## 2. Set Up Webhook

1. Go to **Developers** > **Webhooks** > **Add endpoint**
2. Endpoint URL: `https://cortexfreelancer.com/api/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the **Signing secret** (`whsec_...`) and add it as `STRIPE_WEBHOOK_SECRET` in Vercel

### Test the Webhook

```bash
stripe listen --forward-to localhost:3000/api/webhook
stripe trigger checkout.session.completed
```

---

## 3. Configure Customer Portal

1. Go to **Settings** > **Billing** > **Customer portal**
2. Enable the following features:
   - **Cancel subscription**: On (at end of billing period)
   - **Switch plans**: On (monthly <> annual)
   - **Update payment method**: On
   - **View invoice history**: On
3. Set return URL: `https://cortexfreelancer.com/pricing`
4. Customize branding:
   - Business name: `Cortex Freelancer`
   - Primary color: `#ff8844`
   - Accent color: `#00ff88`

---

## 4. Test with a Real Card

### Before Going Live

1. Switch Stripe Dashboard to **Live mode** (toggle in top-right)
2. Verify all environment variables are set in Vercel **Production** environment
3. Deploy the latest code

### Test Checkout Flow

1. Open `https://cortexfreelancer.com/pricing`
2. Click **Upgrade to Pro** with your real email
3. Complete payment using a real card (use a $1 test or immediately refund)
4. Verify:
   - [ ] Checkout session redirects to Stripe
   - [ ] Payment completes successfully
   - [ ] Webhook fires and user is marked as Pro in Firestore
   - [ ] `checkout-success` page shows correctly
   - [ ] Dashboard shows "Pro Plan Active"

### Test Billing Portal

1. Click **Manage Subscription** on the pricing or dashboard page
2. Verify:
   - [ ] Portal opens with correct subscription details
   - [ ] User can update payment method
   - [ ] User can switch between monthly/annual
   - [ ] User can cancel (takes effect at period end)

### Test Cancellation & Resubscription

1. Cancel the subscription via portal
2. Verify:
   - [ ] Webhook `customer.subscription.updated` fires with `cancel_at_period_end: true`
   - [ ] User retains Pro access until period end
   - [ ] After period ends, Pro access is revoked

---

## 5. Pre-Launch Checklist

- [ ] Live Stripe API keys set in Vercel Production env
- [ ] Webhook endpoint verified and receiving events
- [ ] Customer portal configured and branded
- [ ] Products/prices match the pricing page ($29/mo, $249/yr)
- [ ] Checkout → payment → webhook → Pro activation tested end-to-end
- [ ] Billing portal manage/cancel/switch tested
- [ ] Error handling works (invalid card, network failure)
- [ ] Receipt emails enabled in Stripe Dashboard
- [ ] Refund policy page is live at `/refund`

---

## 6. Go Live

1. Remove any test/mock data from Firestore
2. Verify `MOCK_MODE` is `false` (i.e., `STRIPE_SECRET_KEY` is set)
3. Monitor the Stripe Dashboard for the first few real transactions
4. Check Sentry for any errors in `/api/checkout`, `/api/webhook`, `/api/portal`
