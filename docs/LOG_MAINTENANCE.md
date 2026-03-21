# Log Maintenance — Cortex Freelancer

## Firestore Collections with Log Data

| Collection         | Purpose                              | Retention   |
|--------------------|--------------------------------------|-------------|
| `client_errors`    | Browser-side JS errors               | 30 days     |
| `payment_errors`   | Stripe/checkout failures             | 90 days     |
| `processed_events` | Webhook & payment event log          | 90 days     |
| `track_events`     | Analytics events from `/api/track`   | 30 days     |
| `_health`          | Health-check pings (single doc)      | Overwritten |

## Manual Cleanup

### Delete client errors older than 30 days

From the Firebase Console → Firestore → `client_errors`:
1. Filter by `timestamp < (30 days ago ISO string)`.
2. Select all and delete.

Or use the admin panel **Client Error Logs → Clear All** button to wipe all entries.

### Delete old tracking events

```js
// Run in Firebase Admin script or Cloud Shell
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 30);

const snapshot = await db.collection('track_events')
  .where('timestamp', '<', cutoff.toISOString())
  .limit(500)
  .get();

const batch = db.batch();
snapshot.docs.forEach(doc => batch.delete(doc.ref));
await batch.commit();
// Repeat until snapshot is empty
```

## Automated Cleanup (Recommended)

Add a Vercel cron or Firebase scheduled function:

```js
// api/cron/cleanup-logs.js
const { getFirestore } = require('../_lib/firestore');

module.exports = async function handler(req, res) {
  const db = getFirestore();
  if (!db) return res.json({ skipped: true });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const iso = cutoff.toISOString();

  for (const col of ['client_errors', 'track_events']) {
    let deleted = 0;
    while (true) {
      const snap = await db.collection(col)
        .where('timestamp', '<', iso)
        .limit(400)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deleted += snap.size;
    }
    console.log(`Cleaned ${deleted} docs from ${col}`);
  }

  res.json({ success: true });
};
```

Then add to `vercel.json` crons:
```json
{ "path": "/api/cron/cleanup-logs", "schedule": "0 3 * * 0" }
```

## Log Levels in Production

- **Errors** (`client_errors`): All uncaught JS errors and unhandled promise rejections.
- **Payment errors** (`payment_errors`): Stripe checkout/webhook failures.
- **Info** (`processed_events`): Successful webhook processing records.

## Monitoring Log Volume

Check the admin panel badge counts. If `client_errors` exceeds 100 entries, investigate recurring errors before clearing.
