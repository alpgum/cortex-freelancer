const MOCK_MODE = !process.env.STRIPE_SECRET_KEY;

let stripe;
if (!MOCK_MODE) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    // Mock mode — redirect to pricing page
    if (MOCK_MODE) {
      return res.json({ url: '/pricing?portal=mock&email=' + encodeURIComponent(email) });
    }

    // Real Stripe mode — find customer by email, then create portal session
    const customers = await stripe.customers.list({ email: email.toLowerCase().trim(), limit: 1 });

    if (!customers.data.length) {
      return res.status(404).json({ error: 'No subscription found for this email.' });
    }

    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${protocol}://${host}/pricing`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Billing portal error:', err.message);
    res.status(500).json({ error: 'Failed to create billing portal session.' });
  }
};
