// Firebase Auth token verification middleware
// Verifies Firebase ID tokens from Authorization: Bearer <token> header

let adminAuth = null;

function getAuth() {
  if (adminAuth) return adminAuth;
  try {
    const admin = require('firebase-admin');
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
    adminAuth = admin.auth();
    return adminAuth;
  } catch (err) {
    console.warn('[auth] Firebase Admin Auth not available:', err.message);
    return null;
  }
}

/**
 * Verify Firebase ID token from Authorization header.
 * Returns decoded token or null if invalid/missing.
 */
async function verifyToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  const auth = getAuth();
  if (!auth) return null;

  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded;
  } catch (err) {
    console.warn('[auth] Token verification failed:', err.code || err.message);
    return null;
  }
}

/**
 * Require authentication middleware.
 * Sets req.user = { uid, email, ... } on success.
 * Returns true if blocked (caller should return early).
 */
async function requireAuth(req, res) {
  const decoded = await verifyToken(req);
  if (!decoded) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Authentication required. Provide a valid Firebase ID token.',
        code: 'UNAUTHORIZED',
        type: 'auth_error'
      }
    });
    return true;
  }
  req.user = {
    uid: decoded.uid,
    email: decoded.email || null,
    name: decoded.name || null,
    picture: decoded.picture || null,
    emailVerified: decoded.email_verified || false
  };
  return false;
}

/**
 * Optional authentication — sets req.user if token present, but doesn't block.
 */
async function optionalAuth(req) {
  const decoded = await verifyToken(req);
  if (decoded) {
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      picture: decoded.picture || null,
      emailVerified: decoded.email_verified || false
    };
  }
  return req.user || null;
}

/**
 * Express middleware version of requireAuth.
 */
function authMiddleware(req, res, next) {
  requireAuth(req, res).then(blocked => {
    if (!blocked) next();
  });
}

module.exports = { verifyToken, requireAuth, optionalAuth, authMiddleware };
