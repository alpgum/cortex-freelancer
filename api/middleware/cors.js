const ALLOWED_ORIGINS = [
  'https://cortexfreelancer.com',
  'https://www.cortexfreelancer.com',
  'http://localhost:3847'
];

/**
 * CORS middleware.
 * Use as: cors(req, res) — returns true if preflight handled (caller should return early).
 */
function cors(req, res) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

/**
 * Express middleware version — use with app.use().
 */
function corsMiddleware(req, res, next) {
  if (cors(req, res)) return;
  next();
}

module.exports = { cors, corsMiddleware };
