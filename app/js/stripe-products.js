/**
 * CF-171: Stripe Products and Prices for Pro Tier
 * Config module defining Stripe products, price IDs, and feature lists.
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ---- Price IDs (replace with live keys in production) ---- */
  var PRODUCTS = {
    proMonthly: {
      id: 'prod_cortex_pro_monthly',
      priceId: 'price_cortex_pro_monthly',
      name: 'Pro Monthly',
      amount: 1900,
      currency: 'usd',
      interval: 'month',
      displayPrice: '$19/mo',
      features: [
        'Unlimited proposals',
        'AI-powered cover letters',
        'Advanced analytics dashboard',
        'Priority job alerts',
        'Client CRM tools',
        'Revenue projections',
        'Tax estimator (all countries)',
        'Custom invoice branding',
        'Bulk proposal actions',
        'Competition heatmap'
      ]
    },
    proYearly: {
      id: 'prod_cortex_pro_yearly',
      priceId: 'price_cortex_pro_yearly',
      name: 'Pro Yearly',
      amount: 14900,
      currency: 'usd',
      interval: 'year',
      displayPrice: '$149/yr',
      savings: '$79/yr saved vs monthly',
      features: [
        'Everything in Pro Monthly',
        '2 months free',
        'Early access to new features',
        'Priority support'
      ]
    },
    lifetime: {
      id: 'prod_cortex_lifetime',
      priceId: 'price_cortex_lifetime',
      name: 'Lifetime Deal',
      amount: 29900,
      currency: 'usd',
      interval: null,
      displayPrice: '$299 one-time',
      features: [
        'All Pro features forever',
        'No recurring payments',
        'Founding member badge',
        'Priority feature requests'
      ]
    }
  };

  var FREE_FEATURES = [
    '5 proposals per month',
    'Basic job search',
    'Simple earnings tracker',
    'Single currency support'
  ];

  /**
   * Get product config by key
   * @param {string} key - proMonthly | proYearly | lifetime
   * @returns {Object|null}
   */
  var getProduct = function (key) {
    return PRODUCTS[key] || null;
  };

  /**
   * Get price ID for a product
   * @param {string} key
   * @returns {string|null}
   */
  var getPriceId = function (key) {
    var product = PRODUCTS[key];
    return product ? product.priceId : null;
  };

  /**
   * Get all products as array
   * @returns {Array}
   */
  var getAllProducts = function () {
    return Object.keys(PRODUCTS).map(function (key) {
      return Object.assign({}, PRODUCTS[key], { key: key });
    });
  };

  /**
   * Calculate monthly equivalent for comparison
   * @param {string} key
   * @returns {number} cents per month
   */
  var getMonthlyEquivalent = function (key) {
    var product = PRODUCTS[key];
    if (!product) return 0;
    if (product.interval === 'month') return product.amount;
    if (product.interval === 'year') return Math.round(product.amount / 12);
    return 0; // lifetime has no monthly equivalent
  };

  /**
   * Format amount from cents to display string
   * @param {number} cents
   * @returns {string}
   */
  var formatAmount = function (cents) {
    return '$' + (Math.round(cents) / 100).toFixed(2);
  };

  window.CortexFreelancer.StripeProducts = {
    PRODUCTS: PRODUCTS,
    FREE_FEATURES: FREE_FEATURES,
    getProduct: getProduct,
    getPriceId: getPriceId,
    getAllProducts: getAllProducts,
    getMonthlyEquivalent: getMonthlyEquivalent,
    formatAmount: formatAmount
  };
})();
