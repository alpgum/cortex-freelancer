# Firestore Deploy Guide

## Prerequisites

- Firebase CLI installed: `npm install -g firebase-tools`
- Logged in: `firebase login`
- Project configured: `firebase use YOUR_PROJECT_ID`

## Deploying Security Rules

```bash
firebase deploy --only firestore:rules
```

Rules file: `firestore.rules` (project root)

## Deploying Indexes

```bash
firebase deploy --only firestore:indexes
```

Index config: `firestore.indexes.json` (project root)

## Deploy Both

```bash
firebase deploy --only firestore
```

## Verifying Rules

1. Open Firebase Console > Firestore > Rules
2. Check the published date matches your deploy
3. Test with the Rules Playground in the console

## Rollback

Firebase keeps a history of rules. To rollback:

1. Open Firebase Console > Firestore > Rules
2. Click "Revisions" to see previous versions
3. Select the desired version and publish

## Collections Reference

| Collection | Purpose |
|---|---|
| `users` | User profiles, pro status, subscription data |
| `processed_events` | Stripe webhook event log (idempotency) |
| `payment_errors` | Checkout/payment error telemetry |
| `client_errors` | Client-side error logs |
| `abuse_incidents` | Abuse prevention blocks |
| `daily_metrics` | Cron-generated daily stats |

## Environment

- **Dev**: Use Firebase Emulator (`firebase emulators:start --only firestore`)
- **Prod**: Deploy via CLI after testing locally
