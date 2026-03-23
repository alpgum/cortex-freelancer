const fs = require('fs');
const path = require('path');
const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

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

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) {
    return sendError(res, 400, 'Email query param required', 'MISSING_EMAIL', 'validation_error');
  }

  const customers = readCustomers();
  const customer = customers.find(c => c.email === email);

  // Mock mode — return realistic fake data
  if (MOCK_MODE) {
    return res.json({
      success: true,
      active: !!customer,
      plan: customer ? customer.plan : 'pro',
      subscription_status: customer ? (customer.status || 'active') : 'active',
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      tool_usage: { briefs: 12, seo_audits: 5, social_posts: 28 },
      member_since: '2025-11-01T00:00:00.000Z',
      mock: true
    });
  }

  // No local customer record — not a customer
  if (!customer || !customer.stripe_customer_id) {
    return res.json({
      success: true,
      active: false,
      plan: null,
      subscription_status: null,
      current_period_end: null,
      tool_usage: null,
      member_since: null
    });
  }

  const stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id, {
    expand: ['subscriptions']
  });

  const sub = stripeCustomer.subscriptions?.data?.[0] || null;

  return res.json({
    success: true,
    active: sub ? sub.status === 'active' : false,
    plan: customer.plan || (sub?.items?.data?.[0]?.price?.lookup_key) || null,
    subscription_status: sub ? sub.status : 'none',
    current_period_end: sub ? new Date(sub.current_period_end * 1000).toISOString() : null,
    tool_usage: customer.tool_usage || { briefs: 0, seo_audits: 0, social_posts: 0 },
    member_since: stripeCustomer.created
      ? new Date(stripeCustomer.created * 1000).toISOString()
      : null
  });
});
