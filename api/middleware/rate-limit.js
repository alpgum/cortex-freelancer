// In-memory store: IP -> { count, resetTime }
const hits = new Map();

// Cache pro status to avoid Firestore reads on every request
// uid/email -> { isPro, cachedAt }
const proCache = new Map();
const PRO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const WINDOW_MS = 60 * 1000; // 1 minute
const FREE_LIMIT = 10;
const PRO_LIMIT = 100;

function cleanup() {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now > entry.resetTime) {
      hits.delete(ip);
    }
  }
  // Clean expired pro cache entries
  for (const [key, entry] of proCache) {
    if (now - entry.cachedAt > PRO_CACHE_TTL) {
      proCache.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000).unref();

async function isProUser(req) {
  const identifier = (
    req.query?.email ||
    req.body?.email ||
    req.query?.uid ||
    req.user?.uid ||
    ''
  ).toLowerCase().trim();

  if (!identifier) return false;

  // Check cache first
  const cached = proCache.get(identifier);
  if (cached && (Date.now() - cached.cachedAt < PRO_CACHE_TTL)) {
    return cached.isPro;
  }

  // Check Firestore
  try {
    const { isProUser: checkPro } = require('../services/user');
    const isPro = await checkPro(identifier);
    proCache.set(identifier, { isPro, cachedAt: Date.now() });
    return isPro;
  } catch (err) {
    // Fallback: not pro
    return false;
  }
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';
}

/**
 * Rate limit middleware.
 * Use as: await rateLimit(req, res) — returns true if blocked (caller should return early).
 * Also supports sync usage for backwards compat (defaults to free limit).
 */
async function rateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();

  // Determine limit — async pro check with cache
  let limit = FREE_LIMIT;
  try {
    const isPro = await isProUser(req);
    if (isPro) limit = PRO_LIMIT;
  } catch {
    // Default to free limit
  }

  let entry = hits.get(ip);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + WINDOW_MS };
    hits.set(ip, entry);
  }

  entry.count++;

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT',
        type: 'rate_limit_error'
      },
      retryAfter
    });
    return true;
  }

  return false;
}

/**
 * Express middleware version — use with app.use().
 */
function rateLimitMiddleware(req, res, next) {
  rateLimit(req, res).then(blocked => {
    if (!blocked) next();
  });
}

// [386] Expose rate limit stats for admin dashboard
const rateLimitLog = [];
const MAX_LOG_ENTRIES = 100;

const origRateLimit = rateLimit;
async function rateLimitWithLogging(req, res) {
  const blocked = await origRateLimit(req, res);
  if (blocked) {
    const ip = getClientIp(req);
    const crypto = require('crypto');
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 12);
    const entry = hits.get(ip);
    rateLimitLog.push({
      timestamp: new Date().toISOString(),
      ipHash: ipHash,
      endpoint: (req.url || '').split('?')[0],
      count: entry ? entry.count : 0
    });
    if (rateLimitLog.length > MAX_LOG_ENTRIES) rateLimitLog.shift();
  }
  return blocked;
}

function getRateLimitStats() {
  return { hits: rateLimitLog.slice(-50) };
}

module.exports = { rateLimit: rateLimitWithLogging, rateLimitMiddleware, getRateLimitStats };
