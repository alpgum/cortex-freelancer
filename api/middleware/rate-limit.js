const fs = require('fs');
const path = require('path');

const CUSTOMERS_FILE = path.join(__dirname, '..', '..', 'data', 'customers.json');

// In-memory store: IP -> { count, resetTime }
const hits = new Map();

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
}

// Run cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000).unref();

function isProUser(req) {
  const email = (
    req.query?.email ||
    req.body?.email ||
    ''
  ).toLowerCase().trim();

  if (!email) return false;

  try {
    const customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8'));
    return customers.some(c => c.email === email && c.status === 'active');
  } catch {
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
 * Use as: rateLimit(req, res) — returns true if blocked (caller should return early).
 */
function rateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const limit = isProUser(req) ? PRO_LIMIT : FREE_LIMIT;

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
  if (rateLimit(req, res)) return;
  next();
}

// [386] Expose rate limit stats for admin dashboard
const rateLimitLog = [];
const MAX_LOG_ENTRIES = 100;

const origRateLimit = rateLimit;
function rateLimitWithLogging(req, res) {
  const blocked = origRateLimit(req, res);
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
