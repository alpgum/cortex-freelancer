/**
 * Firebase Auth Verification Middleware & API
 *
 * POST /api/auth-verify — Verify Firebase ID token server-side
 * Returns user info + Pro status from Firestore
 *
 * Also exports verifyAuth() for use as middleware in other endpoints.
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');

let admin = null;

function getAdmin() {
  if (admin) return admin;
  try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : null;
      if (serviceAccount) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else {
        admin.initializeApp();
      }
    }
    return admin;
  } catch {
    return null;
  }
}

/**
 * Verify Firebase ID token from Authorization header.
 * Returns decoded token or null.
 */
async function verifyIdToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) return null;

  const adm = getAdmin();
  if (!adm) return null;

  try {
    return await adm.auth().verifyIdToken(idToken);
  } catch (err) {
    console.warn('[auth-verify] Token verification failed:', err.message);
    return null;
  }
}

/**
 * Middleware: verify auth and attach user to req
 * Usage: const user = await verifyAuth(req);
 * Returns user data or null if not authenticated.
 */
async function verifyAuth(req) {
  const decoded = await verifyIdToken(req);
  if (!decoded) return null;

  const firestore = getFirestore();
  if (!firestore) {
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      emailVerified: decoded.email_verified,
      isPro: false,
    };
  }

  try {
    const userDoc = await firestore.collection('users').doc(decoded.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || userData.displayName,
      picture: decoded.picture || userData.photoURL,
      emailVerified: decoded.email_verified,
      isPro: userData.isPro || false,
      plan: userData.plan || 'free',
      proExpiresAt: userData.proExpiresAt || null,
      gmailConnected: userData.gmailConnected || false,
      upworkConnected: userData.upworkConnected || false,
      createdAt: userData.createdAt,
    };
  } catch (err) {
    console.warn('[auth-verify] Firestore lookup failed:', err.message);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      emailVerified: decoded.email_verified,
      isPro: false,
    };
  }
}

// ── API Endpoint ──────────────────────────────────────────────────────────

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const user = await verifyAuth(req);
  if (!user) {
    return sendError(res, 401, 'Invalid or expired authentication token.', 'UNAUTHORIZED', 'auth_error');
  }

  // Update last active timestamp
  const firestore = getFirestore();
  if (firestore) {
    firestore.collection('users').doc(user.uid).set({
      lastActiveAt: new Date().toISOString(),
    }, { merge: true }).catch(() => {});
  }

  res.json({
    success: true,
    user: {
      uid: user.uid,
      email: user.email,
      name: user.name,
      picture: user.picture,
      emailVerified: user.emailVerified,
      isPro: user.isPro,
      plan: user.plan,
      proExpiresAt: user.proExpiresAt,
      integrations: {
        gmail: user.gmailConnected,
        upwork: user.upworkConnected,
      },
    },
  });
});

// Export middleware for use in other endpoints
module.exports.verifyAuth = verifyAuth;
module.exports.verifyIdToken = verifyIdToken;
