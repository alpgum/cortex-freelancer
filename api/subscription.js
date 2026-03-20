const fs = require('fs');
const path = require('path');
const { cors } = require('./_middleware/cors');
const { rateLimit } = require('./_middleware/rate-limit');

const CUSTOMERS_FILE = path.join(__dirname, '..', 'data', 'customers.json');
const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

function readCustomers() {
  try { return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8')); }
  catch { return []; }
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = (req.query.email || '').toLowerCase().trim();
  const uid = (req.query.uid || '').trim();

  if (!email && !uid) {
    return res.status(400).json({ error: 'email or uid query param required' });
  }

  const customers = readCustomers();
  const customer = email
    ? customers.find(c => c.email === email)
    : customers.find(c => c.uid === uid || c.stripe_customer_id === uid);

  if (MOCK_MODE) {
    return res.json({
      status: customer ? (customer.status || 'active') : 'active',
      plan: customer ? (customer.plan || 'pro_monthly') : 'pro_monthly',
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      cancel_at_period_end: false,
      mock: true
    });
  }

  if (!customer || !customer.stripe_customer_id) {
    return res.json({
      status: 'none',
      plan: null,
      current_period_end: null,
      cancel_at_period_end: false
    });
  }

  try {
    const stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id, {
      expand: ['subscriptions']
    });

    const sub = stripeCustomer.subscriptions?.data?.[0] || null;

    if (!sub) {
      return res.json({
        status: 'none',
        plan: null,
        current_period_end: null,
        cancel_at_period_end: false
      });
    }

    return res.json({
      status: sub.status,
      plan: customer.plan || sub.items?.data?.[0]?.price?.lookup_key || null,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: !!sub.cancel_at_period_end
    });
  } catch (err) {
    console.error('subscription status error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve subscription status' });
  }
};
