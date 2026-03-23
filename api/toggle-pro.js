const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { cors } = require('./middleware/cors');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const CUSTOMERS_FILE = path.join(__dirname, '..', 'data', 'customers.json');

// Dedicated rate limit for admin endpoint: 5 req/min per IP
const adminHits = new Map();
const ADMIN_WINDOW_MS = 60 * 1000;
const ADMIN_LIMIT = 5;

function adminRateLimit(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();

  let entry = adminHits.get(ip);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + ADMIN_WINDOW_MS };
    adminHits.set(ip, entry);
  }
  entry.count++;

  if (entry.count > ADMIN_LIMIT) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    sendError(res, 429, 'Too many requests. Please try again later.', 'RATE_LIMIT', 'rate_limit_error');
    return true;
  }
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of adminHits) {
    if (now > entry.resetTime) adminHits.delete(ip);
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';
}

function logAdminAction(req, email, action) {
  const ip = getClientIp(req);
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ level: 'info', source: 'toggle-pro', timestamp, ip, email, action }));
}

function readCustomers() {
  try { return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8')); }
  catch { return []; }
}

function writeCustomers(data) {
  const dir = path.dirname(CUSTOMERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (adminRateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { email, token } = req.body || {};

  const expectedToken = process.env.ADMIN_TOKEN || 'cortex-admin-2026';
  const tokenBuffer = Buffer.from(String(token || ''));
  const expectedBuffer = Buffer.from(expectedToken);
  const tokenValid = tokenBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(tokenBuffer, expectedBuffer);

  if (!tokenValid) {
    logAdminAction(req, email || 'unknown', 'auth_failed');
    return sendError(res, 401, 'Invalid admin token.', 'INVALID_TOKEN', 'auth_error');
  }

  if (!email) {
    return sendError(res, 400, 'Email is required.', 'MISSING_EMAIL', 'validation_error');
  }

  const customers = readCustomers();
  const normalizedEmail = email.toLowerCase().trim();
  const existing = customers.find(c => c.email === normalizedEmail);

  if (existing) {
    existing.status = existing.status === 'active' ? 'cancelled' : 'active';
    if (existing.status === 'active') existing.plan = existing.plan || 'pro_monthly';
    writeCustomers(customers);
    logAdminAction(req, existing.email, `toggled_to_${existing.status}`);
    return res.json({ success: true, email: existing.email, status: existing.status });
  }

  customers.push({
    email: normalizedEmail,
    plan: 'pro_monthly',
    stripe_customer_id: 'admin_manual_' + Date.now(),
    stripe_subscription_id: 'admin_manual_' + Date.now(),
    created_at: new Date().toISOString(),
    status: 'active'
  });
  writeCustomers(customers);
  logAdminAction(req, normalizedEmail, 'created_active');
  res.json({ success: true, email: normalizedEmail, status: 'active' });
});
