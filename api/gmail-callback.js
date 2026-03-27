/**
 * Gmail OAuth2 Callback Handler
 *
 * GET /api/gmail-callback?code=...&state=...
 *
 * Exchanges authorization code for tokens, stores in Firestore,
 * redirects user back to the app.
 */

const { withErrorHandler } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');
const gmail = require('./lib/gmail');

module.exports = withErrorHandler(async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error } = req.query;

  // User denied consent
  if (error) {
    console.log('[gmail-callback] User denied consent:', error);
    return res.redirect('/app/index.html?gmail_error=denied');
  }

  if (!code || !state) {
    return res.redirect('/app/index.html?gmail_error=missing_params');
  }

  // Decode state to get uid
  let uid;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    uid = decoded.uid;

    // Reject stale states (>10 min old)
    if (Date.now() - decoded.ts > 600000) {
      return res.redirect('/app/index.html?gmail_error=expired');
    }
  } catch {
    return res.redirect('/app/index.html?gmail_error=invalid_state');
  }

  if (!uid) {
    return res.redirect('/app/index.html?gmail_error=missing_uid');
  }

  try {
    // Exchange code for tokens
    const tokens = await gmail.exchangeCode(code);

    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      scope: tokens.scope,
      connectedAt: new Date().toISOString(),
    };

    // Get user's Gmail profile
    let gmailEmail = null;
    try {
      const profile = await gmail.getProfile(tokens.access_token);
      gmailEmail = profile.emailAddress;
      tokenData.gmailEmail = gmailEmail;
    } catch (err) {
      console.warn('[gmail-callback] Could not fetch Gmail profile:', err.message);
    }

    // Store tokens in Firestore
    const firestore = getFirestore();
    if (firestore) {
      await firestore.collection('gmail_tokens').doc(uid).set(tokenData);

      // Update user document with Gmail connection status
      await firestore.collection('users').doc(uid).set({
        gmailConnected: true,
        gmailEmail,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      console.log(`[gmail-callback] Gmail connected for user ${uid} (${gmailEmail})`);
    }

    // Redirect back to app with success
    const redirectUrl = gmailEmail
      ? `/app/index.html?gmail_connected=true&gmail_email=${encodeURIComponent(gmailEmail)}`
      : '/app/index.html?gmail_connected=true';

    res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('[gmail-callback] Token exchange failed:', err.message);
    res.redirect('/app/index.html?gmail_error=token_exchange_failed');
  }
});
