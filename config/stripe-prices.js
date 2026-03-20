const PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly_placeholder',
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual_placeholder'
};

// Validate price IDs are set when not in mock mode
if (process.env.STRIPE_SECRET_KEY) {
  for (const [plan, id] of Object.entries(PRICE_IDS)) {
    if (id.includes('placeholder')) {
      console.warn(`[stripe-prices] WARNING: ${plan} is using a placeholder price ID. Set the corresponding env var.`);
    }
  }
}

// Warn if test keys are used in production
if (process.env.NODE_ENV === 'production' && process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  console.warn('[stripe-prices] WARNING: Using Stripe test keys in production environment.');
}

module.exports = { PRICE_IDS };
