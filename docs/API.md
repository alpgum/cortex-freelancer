# Cortex Freelancer API Documentation

Base URL: `https://cortexfreelancer.com/api`

## Endpoints

### Health

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/health` |
| **Auth** | None |
| **Request** | — |
| **Response** | `{ success, status: "ok", timestamp, version, uptime }` |

---

### Chat

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/chat` |
| **Auth** | None |
| **Middleware** | CORS, Rate Limit, Sanitize |
| **Request** | `{ messages: [{ role: "user"\|"assistant", content: string }] }` |
| **Response** | `{ success, reply: string }` |

- Max 20 messages kept for context window
- Content max 4000 chars per message
- Uses Anthropic Claude API

---

### Checkout (Create Session)

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/checkout` |
| **Auth** | None |
| **Middleware** | CORS, Rate Limit, Sanitize |
| **Request** | `{ email, plan: "pro_monthly"\|"pro_annual", uid? }` |
| **Response** | `{ success, url: string }` |

---

### Checkout (Get Status)

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/checkout?session_id={id}` |
| **Auth** | None |
| **Middleware** | CORS, Rate Limit |
| **Request** | Query: `session_id` (format: `cs_test_*` or `cs_live_*`) |
| **Response** | `{ success, status, email }` |

---

### Customer

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/customer?email={email}&uid={uid}` |
| **Auth** | None |
| **Middleware** | CORS, Rate Limit |
| **Request** | Query: `email` or `uid` (one required) |
| **Response** | `{ success, active, plan, subscription_status, current_period_end, tool_usage, member_since }` |

---

### Subscription

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/subscription?email={email}&uid={uid}` |
| **Auth** | None |
| **Middleware** | CORS, Rate Limit |
| **Request** | Query: `email` or `uid` (one required) |
| **Response** | `{ success, status, plan, current_period_end, cancel_at_period_end }` |

---

### Billing Portal (by Email)

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/billing-portal` |
| **Auth** | None |
| **Middleware** | CORS, Rate Limit |
| **Request** | `{ email }` |
| **Response** | `{ success, url }` |

---

### Portal (by Customer ID)

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/portal` |
| **Auth** | None |
| **Middleware** | CORS, Rate Limit |
| **Request** | `{ stripeCustomerId }` |
| **Response** | `{ success, url }` |

---

### Toggle Pro (Admin)

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/toggle-pro` |
| **Auth** | **Yes** — admin token (timing-safe comparison) |
| **Middleware** | CORS, Admin Rate Limit (5 req/min), Sanitize |
| **Request** | `{ email, token }` |
| **Response** | `{ success, email, status: "active"\|"cancelled" }` |

---

### Webhook (Stripe)

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/webhook` |
| **Auth** | **Yes** — Stripe signature (`stripe-signature` header) |
| **Middleware** | CORS, Rate Limit |
| **Request** | Raw Stripe event payload |
| **Response** | `{ received: true }` |

Handled events:
- `checkout.session.completed` — activates Pro, updates Firestore, sends email
- `customer.subscription.deleted` — deactivates Pro

---

### Waitlist (Add Signup)

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/waitlist` |
| **Auth** | None |
| **Middleware** | CORS, Sanitize |
| **Request** | `{ email, country, name?, source? }` |
| **Response** | `{ success, message, position, count }` |

- Duplicate emails return `409 Conflict`

---

### Waitlist (Count)

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/waitlist/count` |
| **Auth** | None |
| **Response** | `{ count }` |

---

### Waitlist (Admin List)

| | |
|---|---|
| **Method** | `GET` |
| **Path** | `/api/waitlist/admin?token={token}` |
| **Auth** | **Yes** — admin token in query param |
| **Response** | `{ total, byCountry, signups: [{ id, email, country, name, source, timestamp }] }` |

---

### Track Event

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/track` |
| **Auth** | None |
| **Middleware** | CORS, Sanitize |
| **Request** | `{ uid, event, properties? }` |
| **Response** | `{ success, id }` |

- Saves to Firestore `events` collection

---

### Send Email

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/send-email` |
| **Auth** | None |
| **Middleware** | CORS, Sanitize |
| **Request** | `{ type: "welcome"\|"pro_activated", email, name? }` |
| **Response** | `{ success }` |

- Uses Resend API

---

### Download (Free Kit)

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/download/free-kit` |
| **Auth** | None |
| **Middleware** | CORS |
| **Request** | `{ email }` |
| **Response** | `{ success, message, kit: { name, contents, download_path, note } }` |

- Auto-adds email to waitlist if not present

---

## Rate Limits

| Tier | Limit |
|------|-------|
| Free | 10 req/min per IP |
| Pro | 100 req/min per IP |
| Admin (toggle-pro) | 5 req/min per IP |

## CORS

Allowed origins: `cortexfreelancer.com`, `www.cortexfreelancer.com`, `localhost:3847`

## Error Format

All errors follow a standard format:

```json
{
  "success": false,
  "error": {
    "message": "Human-readable message",
    "code": "ERROR_CODE",
    "type": "error_type"
  }
}
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API (mock mode if unset) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `ANTHROPIC_API_KEY` | Claude API for chat |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firestore access |
| `RESEND_API_KEY` | Email sending |
| `ADMIN_TOKEN` | Admin auth (default: `cortex-admin-2026`) |
