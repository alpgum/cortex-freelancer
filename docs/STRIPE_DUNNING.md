# Stripe Dunning & Failed Payment Setup

Smart Retries configuration and failed payment email templates for Cortex Freelancer.

---

## 1. Enable Smart Retries

Stripe's Smart Retries uses machine learning to retry failed payments at the optimal time.

1. Go to **Stripe Dashboard** > **Settings** > **Billing** > **Subscriptions and emails**
2. Under **Manage failed payments**:
   - **Smart Retries**: Enable (recommended)
   - Stripe will automatically retry up to 4 times over ~3 weeks
3. Under **Retry schedule** (if not using Smart Retries):
   - 1st retry: 3 days after failure
   - 2nd retry: 5 days after 1st retry
   - 3rd retry: 7 days after 2nd retry

---

## 2. Configure Subscription Status After Failures

1. In **Settings** > **Billing** > **Subscriptions and emails**:
2. Under **If all retries for a payment fail**:
   - Select: **Cancel the subscription**
   - This ensures users who can't pay are moved back to Free
3. Our webhook handler (`/api/webhook`) listens for `customer.subscription.deleted` and revokes Pro access in Firestore

---

## 3. Failed Payment Email Sequence

### Enable Stripe's Built-in Emails

1. Go to **Settings** > **Emails**
2. Under **Failed payment emails**, enable:
   - **Send emails when payments fail**: On
   - **Include link to update payment method**: On (uses Stripe-hosted page)

### Email Timing

Stripe sends failed payment emails on this schedule:
- **Email 1**: Immediately after first failure
- **Email 2**: After 1st retry fails (~3 days)
- **Email 3**: After 2nd retry fails (~8 days)
- **Final email**: When subscription is cancelled (~15-21 days)

---

## 4. Failed Payment Email Template

### First Failure Email

```
Subject: Action needed — your Cortex Pro payment failed

Hey [NAME],

We tried to charge your card for your Cortex Freelancer Pro subscription ($29/mo), but the payment didn't go through.

This can happen if your card expired, has insufficient funds, or was replaced by your bank.

Update your payment method now:
[UPDATE PAYMENT LINK]

We'll retry automatically, but updating your card ensures no interruption to your Pro access.

— The Cortex Team
```

### Final Warning Email

```
Subject: Your Cortex Pro access will be cancelled soon

Hey [NAME],

We've been unable to process your Cortex Pro payment after several attempts. Your subscription will be cancelled in 3 days unless you update your payment method.

After cancellation, you'll lose access to:
- Unlimited profile analyses
- Invoice generator with PDF export
- AI proposal writer
- 78+ professional templates
- Priority support

Update your payment method to keep Pro:
[UPDATE PAYMENT LINK]

— The Cortex Team
```

### Post-Cancellation Email

```
Subject: Your Cortex Pro subscription has been cancelled

Hey [NAME],

Your Cortex Freelancer Pro subscription has been cancelled due to failed payment. Your account has been moved to the Free plan.

You can resubscribe anytime at:
https://cortexfreelancer.com/pricing

If this was a mistake or you need help, reply to this email.

— The Cortex Team
```

---

## 5. Webhook Integration

Our webhook at `/api/webhook` handles these events:

| Event | Action |
|-------|--------|
| `invoice.payment_failed` | Log the failure, optionally send internal alert |
| `customer.subscription.updated` | Check for `cancel_at_period_end` changes |
| `customer.subscription.deleted` | Revoke Pro access in Firestore |

---

## 6. Testing Failed Payments

### In Stripe Test Mode

Use these test card numbers to simulate failures:

| Card Number | Scenario |
|-------------|----------|
| `4000 0000 0000 0341` | Attaching succeeds, but first charge fails |
| `4000 0000 0000 9995` | Payment is declined (insufficient funds) |
| `4000 0000 0000 0069` | Expired card |

### Test Steps

1. Create a subscription with the failing test card
2. Verify `invoice.payment_failed` webhook fires
3. Verify Stripe sends the first failed payment email
4. Fast-forward the test clock (or wait for retries)
5. Verify final cancellation email and Pro access revocation
