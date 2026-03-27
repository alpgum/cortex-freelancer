/**
 * Upwork OAuth2 Callback
 *
 * GET /api/upwork-callback?code=...&state=...
 */

const { withErrorHandler } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');
const upwork = require('./lib/upwork-oauth');

module.exports = withErrorHandler(async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error } = req.query;

  if (error) {
    console.log('[upwork-callback] User denied consent:', error);
    return res.redirect('/app/index.html?upwork_error=denied');
  }

  if (!code || !state) {
    return res.redirect('/app/index.html?upwork_error=missing_params');
  }

  let uid;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    uid = decoded.uid;
    if (Date.now() - decoded.ts > 600000) {
      return res.redirect('/app/index.html?upwork_error=expired');
    }
  } catch {
    return res.redirect('/app/index.html?upwork_error=invalid_state');
  }

  if (!uid) return res.redirect('/app/index.html?upwork_error=missing_uid');

  try {
    const tokens = await upwork.exchangeCode(code);

    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      token_type: tokens.token_type,
      connectedAt: new Date().toISOString(),
    };

    // Fetch profile data (best-effort)
    let profileData = null;
    try {
      const me = await upwork.getMyProfile(tokens.access_token);
      const p = me?.profile || {};
      profileData = {
        name: p.name || null,
        title: p.title || null,
        hourlyRate: p.hourlyRate || null,
        skills: Array.isArray(p.skills) ? p.skills : [],
        profileUrl: p.profileUrl || null,
      };
      tokenData.profile = profileData;
    } catch (err) {
      console.warn('[upwork-callback] Could not fetch profile:', err.message);
    }

    const firestore = getFirestore();
    if (firestore) {
      await firestore.collection('upwork_tokens').doc(uid).set(tokenData);
      await firestore.collection('users').doc(uid).set({
        upworkConnected: true,
        upworkProfile: profileData,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      console.log(`[upwork-callback] Upwork connected for user ${uid}`);
    }

    const redirect = profileData?.name
      ? `/app/index.html?upwork_connected=true&upwork_name=${encodeURIComponent(profileData.name)}`
      : '/app/index.html?upwork_connected=true';

    res.redirect(302, redirect);
  } catch (err) {
    console.error('[upwork-callback] Token exchange failed:', err.message);
    res.redirect('/app/index.html?upwork_error=token_exchange_failed');
  }
});
