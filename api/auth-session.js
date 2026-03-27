/**
 * Session Management API
 *
 * POST /api/auth-session — Create/refresh session
 * GET  /api/auth-session — Get active sessions
 * DELETE /api/auth-session — Revoke session
 *
 * Tracks user sessions across devices for security.
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');
const { verifyAuth } = require('./auth-verify');
const crypto = require('crypto');

function getDeviceInfo(req) {
  const ua = req.headers['user-agent'] || '';
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

  // Basic device detection
  let device = 'desktop';
  if (/iPhone|iPad|iPod/i.test(ua)) device = 'ios';
  else if (/Android/i.test(ua)) device = 'android';
  else if (/Mobile/i.test(ua)) device = 'mobile';

  // Basic browser detection
  let browser = 'other';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'chrome';
  else if (/Firefox/i.test(ua)) browser = 'firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'safari';
  else if (/Edg/i.test(ua)) browser = 'edge';

  return {
    device,
    browser,
    ipHash: crypto.createHash('sha256').update(ip).digest('hex').substring(0, 12),
    userAgent: ua.substring(0, 200),
  };
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  const user = await verifyAuth(req);
  if (!user) {
    return sendError(res, 401, 'Authentication required', 'UNAUTHORIZED', 'auth_error');
  }

  const firestore = getFirestore();
  if (!firestore) {
    return sendError(res, 503, 'Session service unavailable', 'SERVICE_UNAVAILABLE', 'server_error');
  }

  const sessionsRef = firestore.collection('users').doc(user.uid).collection('sessions');

  // POST — Create/refresh session
  if (req.method === 'POST') {
    const deviceInfo = getDeviceInfo(req);
    const sessionId = req.body?.sessionId || crypto.randomBytes(16).toString('hex');

    await sessionsRef.doc(sessionId).set({
      ...deviceInfo,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      active: true,
    }, { merge: true });

    // Clean up old sessions (keep max 10)
    const allSessions = await sessionsRef.orderBy('lastActiveAt', 'desc').get();
    if (allSessions.size > 10) {
      const batch = firestore.batch();
      allSessions.docs.slice(10).forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    return res.json({
      success: true,
      sessionId,
      device: deviceInfo.device,
      browser: deviceInfo.browser,
    });
  }

  // GET — List active sessions
  if (req.method === 'GET') {
    const snapshot = await sessionsRef.where('active', '==', true).orderBy('lastActiveAt', 'desc').get();
    const sessions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({ success: true, sessions });
  }

  // DELETE — Revoke a session
  if (req.method === 'DELETE') {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return sendError(res, 400, 'sessionId required', 'MISSING_SESSION_ID', 'validation_error');
    }

    await sessionsRef.doc(sessionId).update({ active: false, revokedAt: new Date().toISOString() });

    return res.json({ success: true, message: 'Session revoked' });
  }

  sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
});
