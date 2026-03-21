# Stripe Dev / Sandbox Testing

## Test Mode Keys

Use the **test** keys from the Stripe Dashboard → Developers → API Keys:

| Variable | Where to set |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` in `.env` / Vercel env |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` in frontend config |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Stripe CLI or Dashboard |

## Test Price IDs

Create test products/prices in the Stripe Dashboard (Test mode) or via CLI:

```bash
# Monthly Pro — $29/mo
stripe prices create \
  --product-data.name="Cortex Pro Monthly" \
  --unit-amount=2900 \
  --currency=usd \
  --recurring.interval=month

# Annual Pro — $249/yr
stripe prices create \
  --product-data.name="Cortex Pro Annual" \
  --unit-amount=24900 \
  --currency=usd \
  --recurring.interval=year
```

Set the resulting price IDs in your environment:

```
STRIPE_PRICE_MONTHLY=price_test_xxxxx
STRIPE_PRICE_ANNUAL=price_test_xxxxx
```

## Test Card Numbers

| Scenario | Card Number | CVC | Expiry |
|---|---|---|---|
| Successful payment | `4242 4242 4242 4242` | Any 3 digits | Any future date |
| Requires authentication (3DS) | `4000 0025 0000 3155` | Any 3 digits | Any future date |
| Declined | `4000 0000 0000 0002` | Any 3 digits | Any future date |
| Insufficient funds | `4000 0000 0000 9995` | Any 3 digits | Any future date |
| Expired card | `4000 0000 0000 0069` | Any 3 digits | Any future date |

## Local Webhook Testing

1. Install the Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Login: `stripe login`
3. Forward events to your local server:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

4. Copy the webhook signing secret (`whsec_...`) printed by the CLI and set it as `STRIPE_WEBHOOK_SECRET`.
5. Trigger test events:

```bash
# Simulate a successful checkout
stripe trigger checkout.session.completed

# Simulate subscription cancellation
stripe trigger customer.subscription.deleted
```

## Testing Checkout Flow End-to-End

1. Start your local dev server (`npm run dev` or `vercel dev`).
2. Open `/pricing` in the browser.
3. Click **Upgrade to Pro** and enter a test email.
4. On the Stripe Checkout page, use test card `4242 4242 4242 4242`.
5. Confirm redirect to `/checkout-success`.
6. Check the Stripe CLI terminal for the forwarded webhook event.
7. Verify Firestore `users/{uid}` updated with `isPro: true`.

## Testing Customer Portal

```bash
stripe billing_portal sessions create --customer=cus_test_xxxxx
```

Or test via the app: sign in as a Pro user and click **Manage** in the nav.

## Mock Mode

If `STRIPE_SECRET_KEY` is not set, the API runs in **mock mode**:
- `/api/checkout` returns a fake redirect URL.
- `/api/webhook` acknowledges events without signature verification.

This is useful for frontend development without a Stripe account.

## Common Gotchas

- **Webhook secret mismatch**: The CLI signing secret (`whsec_...`) is different from the Dashboard webhook secret. Use the one matching your setup.
- **Price ID mismatch**: Test-mode and live-mode price IDs are different. Never mix them.
- **Clock skew**: Stripe webhooks have a 5-minute tolerance. Ensure your system clock is accurate.
- **Duplicate events**: Stripe may retry failed webhooks. The idempotency guard in `api/webhook.js` handles this.
