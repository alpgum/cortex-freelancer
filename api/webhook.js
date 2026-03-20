const fs = require('fs');
const path = require('path');

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

function writeCustomers(data) {
  const dir = path.dirname(CUSTOMERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Vercel serverless config: disable body parsing so we get raw body for Stripe signature
module.exports.config = {
  api: { bodyParser: false }
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (MOCK_MODE) {
    return res.json({ received: true, mock: true });
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
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
};
