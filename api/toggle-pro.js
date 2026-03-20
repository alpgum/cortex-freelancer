const fs = require('fs');
const path = require('path');
const { rateLimit } = require('./_middleware/rate-limit');

const CUSTOMERS_FILE = path.join(__dirname, '..', 'data', 'customers.json');

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
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, token } = req.body || {};

  if (token !== (process.env.ADMIN_TOKEN || 'cortex-admin-2026')) {
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
  res.json({ email: normalizedEmail, status: 'active' });
};
