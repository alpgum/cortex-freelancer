const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { cors } = require('./_middleware/cors');
const { sanitize } = require('./_middleware/sanitize');

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
    res.status(429).json({ error: 'Too many requests. Please try again later.', retryAfter });
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

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (adminRateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, token } = req.body || {};

  const expectedToken = process.env.ADMIN_TOKEN || 'cortex-admin-2026';
  const tokenBuffer = Buffer.from(String(token || ''));
  const expectedBuffer = Buffer.from(expectedToken);
  const tokenValid = tokenBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(tokenBuffer, expectedBuffer);

  if (!tokenValid) {
    logAdminAction(req, email || 'unknown', 'auth_failed');
    return res.status(401).json({ error: 'Invalid admin token.' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const customers = readCustomers();
  const normalizedEmail = email.toLowerCase().trim();
  const existing = customers.find(c => c.email === normalizedEmail);

  if (existing) {
    existing.status = existing.status === 'active' ? 'cancelled' : 'active';
    if (existing.status === 'active') existing.plan = existing.plan || 'pro_monthly';
    writeCustomers(customers);
    logAdminAction(req, existing.email, `toggled_to_${existing.status}`);
    return res.json({ email: existing.email, status: existing.status });
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
  res.json({ email: normalizedEmail, status: 'active' });
};
