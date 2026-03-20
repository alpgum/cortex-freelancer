const fs = require('fs');
const path = require('path');

const CUSTOMERS_FILE = path.join(__dirname, '..', 'data', 'customers.json');
const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Price IDs — replace with real Stripe price IDs when ready
const PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly_placeholder',
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual_placeholder'
};

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

function setupStripeRoutes(app) {
  // POST /api/checkout — Create checkout session
  app.post('/api/checkout', async (req, res) => {
    try {
      const { email, plan } = req.body;

      if (!email || !plan) {
        return res.status(400).json({ error: 'Email and plan are required.' });
      }

      if (!['pro_monthly', 'pro_annual'].includes(plan)) {
        return res.status(400).json({ error: 'Invalid plan. Use pro_monthly or pro_annual.' });
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

        return res.json({ url: '/checkout-success?mock=true&email=' + encodeURIComponent(email) });
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

      res.json({ url: session.url });
    } catch (err) {
      console.error('Checkout error:', err.message);
      res.status(500).json({ error: 'Failed to create checkout session.' });
    }
  });

  // POST /api/webhook — Stripe webhook handler
  // NOTE: raw body middleware is mounted in server.js for /api/webhook to allow Stripe signature verification.
  app.post('/api/webhook', async (req, res) => {
    if (MOCK_MODE) {
      return res.json({ received: true, mock: true });
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed.' });
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
    if (!sessionId) return res.status(400).json({ error: 'session_id required' });

    if (MOCK_MODE) {
      return res.json({ status: 'complete', email: null });
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const email = session.customer_email || session.customer_details?.email;
      res.json({ status: session.payment_status, email });
    } catch (err) {
      res.status(400).json({ error: 'Invalid session' });
    }
  });

  // POST /api/admin/toggle-pro — Manual admin unlock/revoke
  app.post('/api/admin/toggle-pro', (req, res) => {
    const { email, token } = req.body;
    if (token !== (process.env.ADMIN_TOKEN || 'cortex-admin-2026')) {
      return res.status(401).json({ error: 'Invalid admin token.' });
    }
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const customers = readCustomers();
    const existing = customers.find(c => c.email === email.toLowerCase().trim());

    if (existing) {
      existing.status = existing.status === 'active' ? 'cancelled' : 'active';
      if (existing.status === 'active') existing.plan = existing.plan || 'pro_monthly';
      writeCustomers(customers);
      return res.json({ email: existing.email, status: existing.status });
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
    res.json({ email: email.toLowerCase().trim(), status: 'active' });
  });

  // GET /api/customer/:email — Check subscription status
  app.get('/api/customer/:email', (req, res) => {
    const email = req.params.email.toLowerCase().trim();
    const customers = readCustomers();
    const customer = customers.find(c => c.email === email && c.status === 'active');

    res.json({
      active: !!customer,
      plan: customer ? customer.plan : null
    });
  });
}

// Need express for raw body parser in webhook
const express = require('express');

module.exports = { setupStripeRoutes };
