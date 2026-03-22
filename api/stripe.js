const fs = require('fs');
const path = require('path');

const CUSTOMERS_FILE = path.join(__dirname, '..', 'data', 'customers.json');
const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const { PRICE_IDS } = require('../config/stripe-prices');

function readCustomers() {
  try {
    return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeCustomers(data) {
  const dir = path.dirname(CUSTOMERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const { corsMiddleware } = require('./_middleware/cors');
const { sendError, expressErrorHandler } = require('./_middleware/error-handler');

function setupStripeRoutes(app) {
  app.use('/api', corsMiddleware);
  // POST /api/checkout — Create checkout session
  app.post('/api/checkout', async (req, res) => {
    try {
      const { email, plan } = req.body;

      if (!email || !plan) {
        return sendError(res, 400, 'Email and plan are required.', 'MISSING_FIELDS', 'validation_error');
      }

      if (!['pro_monthly', 'pro_annual'].includes(plan)) {
        return sendError(res, 400, 'Invalid plan. Use pro_monthly or pro_annual.', 'INVALID_PLAN', 'validation_error');
      }

      // Mock mode — skip Stripe, auto-create customer
      if (MOCK_MODE) {
        const customers = readCustomers();
        const existing = customers.find(c => c.email === email.toLowerCase().trim());

        if (!existing) {
          customers.push({
            email: email.toLowerCase().trim(),
            plan,
            stripe_customer_id: 'mock_cus_' + Date.now(),
            stripe_subscription_id: 'mock_sub_' + Date.now(),
            created_at: new Date().toISOString(),
            status: 'active'
          });
          writeCustomers(customers);
        } else if (existing.status !== 'active') {
          existing.status = 'active';
          existing.plan = plan;
          writeCustomers(customers);
        }

        return res.json({ success: true, url: '/checkout-success?mock=true&email=' + encodeURIComponent(email) });
      }

      // Real Stripe mode
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: email,
        line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
        success_url: `${req.protocol}://${req.get('host')}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/pricing`,
        metadata: { plan }
      });

      res.json({ success: true, url: session.url });
    } catch (err) {
      console.error('Checkout error:', err.message);
      sendError(res, 500, 'Failed to create checkout session.', 'INTERNAL_ERROR', 'server_error');
    }
  });

  // POST /api/webhook — Stripe webhook handler
  // NOTE: raw body middleware is mounted in server.js for /api/webhook to allow Stripe signature verification.
  app.post('/api/webhook', async (req, res) => {
    if (MOCK_MODE) {
      return res.json({ received: true, mock: true });
    }

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
      console.error('[stripe] STRIPE_WEBHOOK_SECRET is not set — rejecting request');
      return sendError(res, 500, 'Webhook not configured.', 'WEBHOOK_NOT_CONFIGURED', 'server_error');
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return sendError(res, 400, 'Missing stripe-signature header.', 'MISSING_SIGNATURE', 'validation_error');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('[stripe] Webhook signature verification failed:', err.message);
      return sendError(res, 400, 'Webhook signature verification failed.', 'INVALID_SIGNATURE', 'validation_error');
    }

    const customers = readCustomers();

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.customer_email?.toLowerCase().trim();
      if (!email) return res.json({ received: true });

      const existing = customers.find(c => c.email === email);
      if (existing) {
        existing.status = 'active';
        existing.plan = session.metadata?.plan || 'pro_monthly';
        existing.stripe_customer_id = session.customer;
        existing.stripe_subscription_id = session.subscription;
      } else {
        customers.push({
          email,
          plan: session.metadata?.plan || 'pro_monthly',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          created_at: new Date().toISOString(),
          status: 'active'
        });
      }
      writeCustomers(customers);
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customer = customers.find(c => c.stripe_subscription_id === subscription.id);
      if (customer) {
        customer.status = 'cancelled';
        writeCustomers(customers);
      }
    }

    res.json({ received: true });
  });

  // GET /api/checkout-status — Verify completed checkout session (for success page)
  app.get('/api/checkout-status', async (req, res) => {
    const sessionId = req.query.session_id;
    if (!sessionId) return sendError(res, 400, 'session_id required', 'MISSING_SESSION_ID', 'validation_error');

    if (MOCK_MODE) {
      return res.json({ success: true, status: 'complete', email: null });
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const email = session.customer_email || session.customer_details?.email;
      res.json({ success: true, status: session.payment_status, email });
    } catch (err) {
      sendError(res, 400, 'Invalid session', 'INVALID_SESSION', 'validation_error');
    }
  });

  // POST /api/toggle-pro — Manual admin unlock/revoke
  app.post('/api/toggle-pro', (req, res) => {
    const { email, token } = req.body;
    if (token !== (process.env.ADMIN_TOKEN || 'cortex-admin-2026')) {
      return sendError(res, 401, 'Invalid admin token.', 'INVALID_TOKEN', 'auth_error');
    }
    if (!email) {
      return sendError(res, 400, 'Email is required.', 'MISSING_EMAIL', 'validation_error');
    }

    const customers = readCustomers();
    const existing = customers.find(c => c.email === email.toLowerCase().trim());

    if (existing) {
      existing.status = existing.status === 'active' ? 'cancelled' : 'active';
      if (existing.status === 'active') existing.plan = existing.plan || 'pro_monthly';
      writeCustomers(customers);
      return res.json({ success: true, email: existing.email, status: existing.status });
    }

    customers.push({
      email: email.toLowerCase().trim(),
      plan: 'pro_monthly',
      stripe_customer_id: 'admin_manual_' + Date.now(),
      stripe_subscription_id: 'admin_manual_' + Date.now(),
      created_at: new Date().toISOString(),
      status: 'active'
    });
    writeCustomers(customers);
    res.json({ success: true, email: email.toLowerCase().trim(), status: 'active' });
  });

  // GET /api/customer?email=... — Check subscription status
  app.get('/api/customer', (req, res) => {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) {
      return sendError(res, 400, 'Email query param required', 'MISSING_EMAIL', 'validation_error');
    }
    const customers = readCustomers();
    const customer = customers.find(c => c.email === email && c.status === 'active');

    res.json({
      success: true,
      active: !!customer,
      plan: customer ? customer.plan : null
    });
  });

  // Mount Express error handler after all stripe routes
  app.use(expressErrorHandler);
}

module.exports = { setupStripeRoutes };
