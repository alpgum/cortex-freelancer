# Cortex Freelancer

AI Business Manager for Freelancers.

## Quick Start

```bash
npm install
npm start        # http://localhost:3847
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | No | Stripe secret key (`sk_test_...` or `sk_live_...`). When missing, the app runs in **mock mode** — checkout auto-creates customer records without hitting Stripe. |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret (`whsec_...`). Required for real webhook signature verification. |
| `STRIPE_PRICE_PRO_MONTHLY` | No | Stripe Price ID for the $29/mo plan (e.g. `price_1Abc...`). Falls back to placeholder in mock mode. |
| `STRIPE_PRICE_PRO_ANNUAL` | No | Stripe Price ID for the $249/yr plan. Falls back to placeholder in mock mode. |
| `ADMIN_TOKEN` | No | Token for the admin toggle-pro endpoint. Defaults to `cortex-admin-2026`. |

Create a `.env` file (already in `.gitignore`):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
ADMIN_TOKEN=your-secret-token
```

## CFX-025: WebRTC Transport

WebRTC peer-to-peer data channel transport for real-time, low-latency communication:

### Features
- **P2P Data Channels**: Direct browser ↔ server communication
- **Automatic Fallback**: WebSocket → SSE → HTTP if WebRTC fails
- **NAT Traversal**: STUN/TURN server support for corporate networks
- **Transport Abstraction**: Same interface as existing transports

### Setup
```bash
# Install WebRTC dependencies
npm install node-datachannel

# Optional: Configure TURN server
export TURN_URL=turn:your-server.com:3478
export TURN_USERNAME=cortex
export TURN_CREDENTIAL=password123
```

### Testing
- Visit `/webrtc-test` for interactive WebRTC testing
- Check `/api/webrtc/health` for connection statistics
- Monitor browser console for WebRTC debug logs

### Documentation
See [docs/webrtc-setup.md](docs/webrtc-setup.md) for complete setup, configuration, and troubleshooting guide.

## Stripe Integration

### Test Mode (no keys)
When `STRIPE_SECRET_KEY` is not set, the app runs in mock mode:
- `POST /api/checkout` — creates a local customer record and redirects to `/checkout-success`
- No real Stripe calls are made
- The "Test Pro" button in the app also unlocks Pro via `localStorage`

### Live Mode
Set all four Stripe env vars. Create products + prices in the Stripe Dashboard, then:
1. Set `STRIPE_PRICE_PRO_MONTHLY` and `STRIPE_PRICE_PRO_ANNUAL` to the price IDs
2. Set up a webhook endpoint pointing to `https://yourdomain.com/api/webhook` listening for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
3. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### Admin Unlock
Manually grant/revoke Pro for any email:

```bash
curl -X POST http://localhost:3847/api/admin/toggle-pro \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","token":"cortex-admin-2026"}'
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/checkout` | Create Stripe Checkout session (or mock). Body: `{email, plan}` |
| `POST` | `/api/webhook` | Stripe webhook handler |
| `GET` | `/api/checkout-status?session_id=...` | Verify completed checkout session |
| `GET` | `/api/customer/:email` | Check Pro subscription status |
| `POST` | `/api/admin/toggle-pro` | Admin: grant/revoke Pro. Body: `{email, token}` |
| `POST` | `/api/waitlist` | Join waitlist. Body: `{email, country}` |
| `GET` | `/api/waitlist/count` | Public waitlist count |
| `POST` | `/api/download/free-kit` | Download free kit. Body: `{email}` |

## Deployment

Deployed on Vercel. Push to `main` to deploy.
