/**
 * Upwork OAuth2 Authorization Flow
 *
 * GET  /api/upwork-auth            — Initiate OAuth, redirect to Upwork
 * GET  /api/upwork-auth?action=status — Check connection status
 * POST /api/upwork-auth            — Disconnect Upwork
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');
const upwork = require('./lib/upwork-oauth');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  const config = upwork.getConfig();
  if (!config) {
    return sendError(res, 503, 'Upwork OAuth not configured. Set UPWORK_CLIENT_ID and UPWORK_CLIENT_SECRET.', 'UPWORK_NOT_CONFIGURED', 'config_error');
  }

  if (req.method === 'GET') {
    const { action, uid } = req.query;

    // Status check
    if (action === 'status') {
      if (!uid) return sendError(res, 400, 'uid required', 'MISSING_UID', 'validation_error');

      const firestore = getFirestore();
      if (!firestore) return res.json({ connected: false });

      try {
        const doc = await firestore.collection('upwork_tokens').doc(uid).get();
        if (!doc.exists) return res.json({ connected: false });

        const data = doc.data();
        try {
          const tokens = await upwork.getValidToken(data);
          const profile = await upwork.getMyProfile(tokens.access_token);

          if (tokens.access_token !== data.access_token) {
            await firestore.collection('upwork_tokens').doc(uid).set(tokens, { merge: true });
          }

          return res.json({
            connected: true,
            profile: {
              name: profile.profile?.dev_full_name || null,
              title: profile.profile?.dev_blurb || null,
              hourlyRate: profile.profile?.dev_bill_rate || null,
            },
          });
        } catch {
          return res.json({ connected: false, reason: 'token_expired' });
        }
      } catch (err) {
        console.error('[upwork-auth] Status check error:', err.message);
        return res.json({ connected: false });
      }
    }

    // Initiate OAuth — uid already destructured above
    if (!uid) return sendError(res, 400, 'uid required', 'MISSING_UID', 'validation_error');

    const state = Buffer.from(JSON.stringify({ uid, ts: Date.now() })).toString('base64url');
    const authUrl = upwork.buildAuthUrl(state);

    if (!authUrl) return sendError(res, 503, 'Failed to build auth URL', 'AUTH_URL_FAILED', 'server_error');

    res.redirect(302, authUrl);
    return;
  }

  if (req.method === 'POST') {
    const { uid } = req.body || {};
    if (!uid) return sendError(res, 400, 'uid required', 'MISSING_UID', 'validation_error');

    const firestore = getFirestore();
    if (firestore) {
      try {
        await firestore.collection('upwork_tokens').doc(uid).delete();
        await firestore.collection('users').doc(uid).set({
          upworkConnected: false,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (err) {
        console.error('[upwork-auth] Disconnect error:', err.message);
      }
    }

    return res.json({ success: true, message: 'Upwork disconnected' });
  }

  sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
});
