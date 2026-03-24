/**
 * CF-172: Stripe Checkout Session Creation
 * Wires checkout flow with correct price IDs, success/cancel URLs, and email prefill.
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var API_BASE = '/api/stripe';

  /**
   * Build success and cancel URLs with session context
   * @param {string} planKey
   * @returns {Object} { successUrl, cancelUrl }
   */
  var buildRedirectUrls = function (planKey) {
    var origin = window.location.origin;
    return {
      successUrl: origin + '/dashboard?checkout=success&plan=' + encodeURIComponent(planKey) + '&session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: origin + '/pricing?checkout=cancelled&plan=' + encodeURIComponent(planKey)
    };
  };

  /**
   * Get current user email for prefill
   * @returns {string|null}
   */
  var getCurrentUserEmail = function () {
    try {
      var auth = window.CortexFreelancer.AuthDataSync;
      if (auth && typeof auth.getCurrentUser === 'function') {
        var user = auth.getCurrentUser();
        return user ? user.email : null;
      }
      var stored = window.CortexFreelancer.StorageManager;
      if (stored && typeof stored.safeGet === 'function') {
        var data = stored.safeGet('cortex_user');
        if (data) {
          var parsed = typeof data === 'string' ? JSON.parse(data) : data;
          return parsed.email || null;
        }
      }
    } catch (e) {
      console.warn('[StripeCheckout] Could not retrieve user email:', e.message);
    }
    return null;
  };

  /**
   * Create a Stripe Checkout session
   * @param {Object} options
   * @param {string} options.planKey - proMonthly | proYearly | lifetime
   * @param {string} [options.customerEmail] - prefill email
   * @param {string} [options.couponId] - optional coupon
   * @param {Object} [options.metadata] - additional metadata
   * @returns {Promise<Object>} session data with url
   */
  var createCheckoutSession = function (options) {
    var products = window.CortexFreelancer.StripeProducts;
    if (!products) {
      return Promise.reject(new Error('StripeProducts module not loaded'));
    }

    var product = products.getProduct(options.planKey);
    if (!product) {
      return Promise.reject(new Error('Invalid plan: ' + options.planKey));
    }

    var urls = buildRedirectUrls(options.planKey);
    var email = options.customerEmail || getCurrentUserEmail();

    var payload = {
      priceId: product.priceId,
      mode: product.interval ? 'subscription' : 'payment',
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
      metadata: Object.assign({
        planKey: options.planKey,
        productName: product.name
      }, options.metadata || {})
    };

    if (email) {
      payload.customerEmail = email;
    }
    if (options.couponId) {
      payload.discounts = [{ coupon: options.couponId }];
    }

    return fetch(API_BASE + '/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error(err.message || 'Checkout session creation failed');
        });
      }
      return res.json();
    });
  };

  /**
   * Redirect user to Stripe Checkout
   * @param {Object} options - same as createCheckoutSession
   * @returns {Promise<void>}
   */
  var redirectToCheckout = function (options) {
    return createCheckoutSession(options).then(function (session) {
      if (session.url) {
        // Track checkout initiation before redirect
        trackCheckoutStart(options.planKey, session.id);
        window.location.href = session.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    });
  };

  /**
   * Track checkout start for abandonment recovery
   * @param {string} planKey
   * @param {string} sessionId
   */
  var trackCheckoutStart = function (planKey, sessionId) {
    try {
      var storage = window.CortexFreelancer.StorageManager;
      var data = {
        planKey: planKey,
        sessionId: sessionId,
        startedAt: new Date().toISOString(),
        completed: false
      };
      if (storage && typeof storage.safeSet === 'function') {
        storage.safeSet('cortex_checkout_pending', JSON.stringify(data));
      } else {
        localStorage.setItem('cortex_checkout_pending', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('[StripeCheckout] Could not track checkout start:', e.message);
    }
  };

  /**
   * Handle post-checkout success (call from success page)
   * @param {string} sessionId
   * @returns {Promise<Object>}
   */
  var verifyCheckoutSession = function (sessionId) {
    return fetch(API_BASE + '/verify-session?session_id=' + encodeURIComponent(sessionId)).then(function (res) {
      if (!res.ok) throw new Error('Session verification failed');
      return res.json();
    }).then(function (data) {
      // Clear pending checkout
      try {
        localStorage.removeItem('cortex_checkout_pending');
      } catch (e) { /* noop */ }
      return data;
    });
  };

  /**
   * Open customer portal for managing subscription
   * @returns {Promise<void>}
   */
  var openCustomerPortal = function () {
    return fetch(API_BASE + '/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('Portal session creation failed');
      return res.json();
    }).then(function (session) {
      if (session.url) {
        window.location.href = session.url;
      }
    });
  };

  window.CortexFreelancer.StripeCheckout = {
    createCheckoutSession: createCheckoutSession,
    redirectToCheckout: redirectToCheckout,
    verifyCheckoutSession: verifyCheckoutSession,
    openCustomerPortal: openCustomerPortal,
    buildRedirectUrls: buildRedirectUrls
  };
})();
