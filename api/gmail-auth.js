/**
 * Gmail OAuth2 Authorization Flow
 *
 * GET  /api/gmail-auth          — Initiate OAuth, redirect to Google consent
 * GET  /api/gmail-auth?action=status — Check if user has Gmail connected
 * POST /api/gmail-auth          — Disconnect Gmail (revoke tokens)
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');
const gmail = require('./lib/gmail');

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  const config = gmail.getConfig();
  if (!config) {
    return sendError(res, 503, 'Gmail integration not configured.', 'GMAIL_NOT_CONFIGURED', 'config_error');
  }

  // GET — Initiate OAuth or check status
  if (req.method === 'GET') {
    const { action, uid } = req.query;

    // Status check
    if (action === 'status') {
      if (!uid) {
        return sendError(res, 400, 'uid is required', 'MISSING_UID', 'validation_error');
      }

      const firestore = getFirestore();
      if (!firestore) {
        return res.json({ connected: false, reason: 'firestore_unavailable' });
      }

      try {
        const doc = await firestore.collection('gmail_tokens').doc(uid).get();
        if (!doc.exists) {
          return res.json({ connected: false });
        }

        const data = doc.data();
        // Check if tokens are still valid by trying to get profile
        try {
          const tokens = await gmail.getValidToken(data);
          const profile = await gmail.getProfile(tokens.access_token);

          // Update tokens if refreshed
          if (tokens.access_token !== data.access_token) {
            await firestore.collection('gmail_tokens').doc(uid).set(tokens, { merge: true });
          }

          return res.json({
            connected: true,
            email: profile.emailAddress,
            messagesTotal: profile.messagesTotal,
          });
        } catch {
          return res.json({ connected: false, reason: 'token_expired' });
        }
      } catch (err) {
        console.error('[gmail-auth] Status check failed:', err.message);
        return res.json({ connected: false, reason: 'error' });
      }
    }

    // Initiate OAuth flow
    const oauthUid = req.query.uid;
    if (!oauthUid) {
      return sendError(res, 400, 'uid is required to initiate OAuth', 'MISSING_UID', 'validation_error');
    }

    // State includes uid for callback mapping
    const state = Buffer.from(JSON.stringify({ uid: oauthUid, ts: Date.now() })).toString('base64url');
    const authUrl = gmail.buildAuthUrl(state);

    if (!authUrl) {
      return sendError(res, 503, 'Failed to build auth URL', 'AUTH_URL_FAILED', 'server_error');
    }

    res.redirect(302, authUrl);
    return;
  }

  // POST — Disconnect Gmail
  if (req.method === 'POST') {
    const { uid } = req.body || {};
    if (!uid) {
      return sendError(res, 400, 'uid is required', 'MISSING_UID', 'validation_error');
    }

    const firestore = getFirestore();
    if (firestore) {
      try {
        // Revoke token at Google
        const doc = await firestore.collection('gmail_tokens').doc(uid).get();
        if (doc.exists) {
          const { access_token } = doc.data();
          if (access_token) {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${access_token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }).catch(() => {}); // Best effort revocation
          }
          await firestore.collection('gmail_tokens').doc(uid).delete();
        }
      } catch (err) {
        console.error('[gmail-auth] Disconnect error:', err.message);
      }
    }

    return res.json({ success: true, message: 'Gmail disconnected' });
  }

  sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
});
