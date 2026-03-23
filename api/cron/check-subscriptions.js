const { getFirestore } = require('../lib/firestore');
const { sendError, withErrorHandler } = require('../middleware/error-handler');

async function handler(req, res) {
  // Vercel Cron sends GET requests with this header
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED', 'auth_error');
  }

  const firestore = getFirestore();

  if (!firestore) {
    console.warn('[cron/check-subscriptions] Firestore not available, skipping.');
    return res.status(200).json({
      success: true,
      message: 'Firestore not available — mock mode, nothing to do.',
      expired: 0
    });
  }

  const now = new Date();
  console.log(`[cron/check-subscriptions] Running at ${now.toISOString()}`);

  // Query users where isPro=true AND proExpiresAt < now
  const snapshot = await firestore
    .collection('users')
    .where('isPro', '==', true)
    .where('proExpiresAt', '<', now)
    .get();

  if (snapshot.empty) {
    console.log('[cron/check-subscriptions] No expired subscriptions found.');
    return res.status(200).json({ success: true, expired: 0 });
  }

  const batch = firestore.batch();
  const expiredUids = [];

  snapshot.forEach((doc) => {
    batch.update(doc.ref, { isPro: false });
    expiredUids.push(doc.id);
  });

  await batch.commit();
  console.log(`[cron/check-subscriptions] Deactivated ${expiredUids.length} expired pro users:`, expiredUids);

  res.status(200).json({
    success: true,
    expired: expiredUids.length,
    uids: expiredUids
  });
}

module.exports = withErrorHandler(handler);
