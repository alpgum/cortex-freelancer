/**
 * [CF-171] Stripe Products & Prices Configuration (Client-Side)
 * Constants for Pro Monthly ($19/mo) and Pro Yearly ($149/yr) plans.
 * Exposed on window.CortexFreelancer.StripeConfig
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var PRODUCTS = {
    pro: {
      name: 'Cortex Freelancer Pro',
      description: 'Unlock all tools, analytics, and priority support.',
      features: [
        'Access to all 25+ tools',
        'Advanced analytics dashboard',
        'Priority email support',
        'Custom templates',
        'Export & sharing',
        'Early access to new features'
      ]
    }
  };

  var PRICES = {
    pro_monthly: {
      id: 'pro_monthly',
      product: 'pro',
      nickname: 'Pro Monthly',
      amount: 1900, // cents
      currency: 'usd',
      interval: 'month',
      intervalCount: 1,
      displayPrice: '$19',
      displayInterval: '/mo',
      popular: false
    },
    pro_annual: {
      id: 'pro_annual',
      product: 'pro',
      nickname: 'Pro Yearly',
      amount: 14900, // cents
      currency: 'usd',
      interval: 'year',
      intervalCount: 1,
      displayPrice: '$149',
      displayInterval: '/yr',
      popular: true,
      savings: '$79/yr saved vs monthly'
    }
  };

  /**
   * Get price config by plan ID.
   */
  function getPrice(planId) {
    return PRICES[planId] || null;
  }

  /**
   * Get product config by product ID.
   */
  function getProduct(productId) {
    return PRODUCTS[productId] || null;
  }

  /**
   * Get all available prices.
   */
  function getAllPrices() {
    var result = [];
    for (var key in PRICES) {
      if (PRICES.hasOwnProperty(key)) result.push(PRICES[key]);
    }
    return result;
  }

  /**
   * Format a price amount (in cents) for display.
   */
  function formatAmount(cents, currency) {
    var dollars = (cents / 100).toFixed(2).replace(/\.00$/, '');
    var symbols = { usd: '$', eur: '€', gbp: '£' };
    var sym = symbols[(currency || 'usd').toLowerCase()] || '$';
    return sym + dollars;
  }

  /**
   * Calculate monthly equivalent for annual plan.
   */
  function monthlyEquivalent(planId) {
    var price = PRICES[planId];
    if (!price) return null;
    if (price.interval === 'month') return price.amount;
    if (price.interval === 'year') return Math.round(price.amount / 12);
    return price.amount;
  }

  window.CortexFreelancer.StripeConfig = {
    PRODUCTS: PRODUCTS,
    PRICES: PRICES,
    getPrice: getPrice,
    getProduct: getProduct,
    getAllPrices: getAllPrices,
    formatAmount: formatAmount,
    monthlyEquivalent: monthlyEquivalent
  };
})();
