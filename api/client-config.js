const { cors } = require('./middleware/cors');

/**
 * CF-265: Client Configuration Endpoint
 * Returns public environment variables needed by the frontend.
 * Only exposes non-secret values (DSNs, public keys, feature flags).
 *
 * GET /api/client-config → { sentryDsn, environment, version }
 */
module.exports = function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Cache for 5 minutes — config rarely changes
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');

  res.json({
    sentryDsn: process.env.SENTRY_DSN || '',
    environment: process.env.VERCEL_ENV || 'production',
    version: process.env.VERCEL_GIT_COMMIT_SHA
      ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
      : '1.0.0',
  });
};
