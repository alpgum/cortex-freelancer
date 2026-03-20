const fs = require('fs');
const path = require('path');
const { rateLimit } = require('./_middleware/rate-limit');

const CUSTOMERS_FILE = path.join(__dirname, '..', 'data', 'customers.json');
const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly_placeholder',
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual_placeholder'
};

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

  if (req.method === 'GET') {
    // GET /api/checkout?session_id=... — verify completed checkout
    const sessionId = req.query.session_id;
    if (!sessionId) return res.status(400).json({ error: 'session_id required', code: 'MISSING_SESSION_ID' });

    if (MOCK_MODE) {
      return res.json({ status: 'complete', email: null });
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const email = session.customer_email || session.customer_details?.email;
      res.json({ status: session.payment_status, email });
    } catch (err) {
      res.status(400).json({ error: 'Invalid session', code: 'INVALID_SESSION' });
    }
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const { email, plan, uid } = req.body || {};

    if (!email || !plan) {
      return res.status(400).json({ error: 'Email and plan are required.', code: 'MISSING_FIELDS' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.', code: 'INVALID_EMAIL' });
    }

    if (!['pro_monthly', 'pro_annual'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Use pro_monthly or pro_annual.', code: 'INVALID_PLAN' });
    }

    // Mock mode — skip Stripe, auto-create customer
    if (MOCK_MODE) {
      const customers = readCustomers();
      const existing = customers.find(c => c.email === email.toLowerCase().trim());

      if (!existing) {
        const entry = {
          email: email.toLowerCase().trim(),
          plan,
          stripe_customer_id: 'mock_cus_' + Date.now(),
          stripe_subscription_id: 'mock_sub_' + Date.now(),
          created_at: new Date().toISOString(),
          status: 'active'
        };
        if (uid) entry.uid = uid;
        customers.push(entry);
        writeCustomers(customers);
      } else if (existing.status !== 'active') {
        existing.status = 'active';
        existing.plan = plan;
        writeCustomers(customers);
      }

      return res.json({ url: '/checkout-success?mock=true&email=' + encodeURIComponent(email) });
    }

    // Real Stripe mode
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${protocol}://${host}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${protocol}://${host}/pricing`,
      metadata: { plan, ...(uid && { uid }) }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);

    if (err.type === 'StripeCardError') {
      return res.status(402).json({ error: 'Your card was declined. Please try another payment method.', code: 'CARD_DECLINED' });
    }
    if (err.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: 'Invalid checkout request. Please try again.', code: 'STRIPE_INVALID_REQUEST' });
    }
    if (err.type === 'StripeAuthenticationError') {
      return res.status(500).json({ error: 'Payment service configuration error. Please contact support.', code: 'STRIPE_AUTH_ERROR' });
    }
    if (err.type === 'StripeRateLimitError') {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMIT' });
    }
    if (err.type === 'StripeConnectionError') {
      return res.status(502).json({ error: 'Could not connect to payment service. Please try again.', code: 'STRIPE_CONNECTION' });
    }

    res.status(500).json({ error: 'Something went wrong. Please try again or contact support.', code: 'INTERNAL_ERROR' });
  }
};
