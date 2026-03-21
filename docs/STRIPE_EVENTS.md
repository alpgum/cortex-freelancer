# Stripe Webhook Events

Events we listen to in our webhook handlers, what they do, and where they're handled.

## Events

### `checkout.session.completed`

**Handler:** `api/webhook.js`

Fired when a customer completes Stripe Checkout successfully.

**Actions:**
1. Updates local JSON store (`data/customers.json`) with customer status, plan, and Stripe IDs
2. Updates Firestore `users/{uid}` — sets `isPro: true`, plan, `proExpiresAt`, Stripe customer/subscription IDs
3. Sends Pro activation email via Resend (`_services/email.js`)
4. Records first paying customer milestone in `milestones/first_paying_customer` (once)
5. Marks event as processed for idempotency (`processed_events/{eventId}`)

**Required metadata:** `uid` (user ID), `plan` (e.g. `pro_monthly`, `pro_annual`)

---

### `customer.subscription.deleted`

**Handler:** `api/webhook.js`

Fired when a subscription is fully cancelled (end of billing period or immediate).

**Actions:**
1. Updates local JSON store — sets customer status to `cancelled`
2. Updates Firestore — finds user by `stripeSubscriptionId`, sets `isPro: false`
3. Marks event as processed for idempotency

---

## Idempotency

All events are deduplicated using:
- In-memory `Set` cache (`processedEventsCache`)
- Firestore `processed_events` collection

Duplicate events are acknowledged with `{ received: true, duplicate: true }`.

## Signature Verification

All incoming webhooks are verified using `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`. Requests missing or failing signature checks are rejected with 400.

## Environment Variables

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API key (absence enables mock mode) |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret |
| `ADMIN_EMAIL` | Recipient for daily metrics emails |
| `RESEND_API_KEY` | Email delivery via Resend |

## Mock Mode

When `STRIPE_SECRET_KEY` is not set, the webhook handler returns `{ received: true, mock: true }` without processing any events. This is used in local development.
