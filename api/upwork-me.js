/**
 * Upwork OAuth2 — "Me" endpoint (profile + auth info)
 *
 * GET /api/upwork-me?uid=...
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');
const upwork = require('./lib/upwork-oauth');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { uid } = req.query || {};
  if (!uid) return sendError(res, 400, 'uid required', 'MISSING_UID', 'validation_error');

  const firestore = getFirestore();
  if (!firestore) return sendError(res, 503, 'Firestore not configured', 'FIRESTORE_NOT_CONFIGURED', 'config_error');

  const doc = await firestore.collection('upwork_tokens').doc(uid).get();
  if (!doc.exists) return sendError(res, 401, 'Upwork not connected', 'UPWORK_NOT_CONNECTED', 'auth_error');

  try {
    const tokens = await upwork.getValidToken(doc.data());

    if (tokens.access_token !== doc.data().access_token) {
      await firestore.collection('upwork_tokens').doc(uid).set(tokens, { merge: true });
    }

    const me = await upwork.getMyProfile(tokens.access_token);

    return res.json({
      success: true,
      data: {
        profileKey: me.profileKey || null,
        profile: me.profile || null,
        info: me.info || null,
      },
    });
  } catch (err) {
    if (err?.code === 'REFRESH_REVOKED' || err?.code === 'NO_REFRESH_TOKEN') {
      try { await firestore.collection('upwork_tokens').doc(uid).delete(); } catch {}
      return sendError(res, 401, 'Upwork connection revoked. Please reconnect.', 'UPWORK_REVOKED', 'auth_error');
    }
    if (err?.code === 'RATE_LIMIT' || err?.status === 429) {
      return sendError(res, 429, 'Upwork rate limited. Try again later.', 'UPWORK_RATE_LIMIT', 'rate_limit');
    }
    console.error('[upwork-me] Error:', err.message);
    return sendError(res, 502, 'Upwork API error', 'UPWORK_API_ERROR', 'service_error');
  }
});
