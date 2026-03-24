/**
 * [CF-173] Stripe Webhook Handler (Client-Side Subscription State)
 * Handles subscription state updates on the client side by syncing with
 * the server webhook results. Manages local Pro status based on
 * checkout.session.completed, customer.subscription.updated/deleted events.
 * Exposed on window.CortexFreelancer.StripeWebhook
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_subscription';
  var STATUS_ENDPOINT = '/api/checkout-status';
  var SUBSCRIPTION_ENDPOINT = '/api/subscription';
  var POLL_INTERVAL = 5000;
  var MAX_POLLS = 12;

  function loadSubscription() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || getDefault(); }
    catch (e) { return getDefault(); }
  }

  function saveSubscription(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) {}
  }

  function getDefault() {
    return {
      isPro: false,
      plan: null,
      expiresAt: null,
      customerId: null,
      subscriptionId: null,
      lastChecked: null
    };
  }

  // ── Event handlers ──

  var eventHandlers = {
    'checkout.session.completed': function (session) {
      var sub = loadSubscription();
      sub.isPro = true;
      sub.plan = session.plan || session.metadata?.plan || 'pro_monthly';
      sub.customerId = session.customer || null;
      sub.subscriptionId = session.subscription || null;
      sub.lastChecked = Date.now();

      // Compute expiration
      var expires = new Date();
      if (sub.plan === 'pro_annual') {
        expires.setFullYear(expires.getFullYear() + 1);
      } else {
        expires.setMonth(expires.getMonth() + 1);
      }
      sub.expiresAt = expires.toISOString();

      saveSubscription(sub);
      dispatchChange(sub);
      return sub;
    },

    'customer.subscription.updated': function (subscription) {
      var sub = loadSubscription();
      var status = subscription.status;

      if (status === 'active' || status === 'trialing') {
        sub.isPro = true;
        if (subscription.current_period_end) {
          sub.expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
        }
      } else if (status === 'past_due' || status === 'unpaid') {
        sub.isPro = true; // grace period
      } else {
        sub.isPro = false;
      }

      sub.subscriptionId = subscription.id || sub.subscriptionId;
      sub.lastChecked = Date.now();
      saveSubscription(sub);
      dispatchChange(sub);
      return sub;
    },

    'customer.subscription.deleted': function () {
      var sub = loadSubscription();
      sub.isPro = false;
      sub.plan = null;
      sub.expiresAt = null;
      sub.subscriptionId = null;
      sub.lastChecked = Date.now();
      saveSubscription(sub);
      dispatchChange(sub);
      return sub;
    }
  };

  function dispatchChange(sub) {
    try {
      var event = new CustomEvent('cortex:subscription-changed', { detail: sub });
      window.dispatchEvent(event);
    } catch (e) {}
  }

  /**
   * Process a webhook-style event on the client side.
   * @param {string} eventType - e.g. 'checkout.session.completed'
   * @param {object} data - Event payload
   */
  function handleEvent(eventType, data) {
    var handler = eventHandlers[eventType];
    if (handler) return handler(data || {});
    return null;
  }

  /**
   * Poll server for checkout completion after redirect.
   * @param {string} sessionId - Stripe checkout session ID
   * @param {function} callback - Called with { success, isPro, plan }
   */
  function pollCheckoutStatus(sessionId, callback) {
    if (!sessionId) {
      if (callback) callback({ success: false, error: 'No session ID' });
      return;
    }

    var attempts = 0;

    function check() {
      attempts++;
      fetch(STATUS_ENDPOINT + '?session_id=' + encodeURIComponent(sessionId))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success && data.status === 'paid') {
            handleEvent('checkout.session.completed', {
              plan: data.plan,
              customer: data.customerId,
              subscription: data.subscriptionId
            });
            if (callback) callback({ success: true, isPro: true, plan: data.plan });
          } else if (attempts < MAX_POLLS) {
            setTimeout(check, POLL_INTERVAL);
          } else {
            if (callback) callback({ success: false, error: 'Checkout verification timed out' });
          }
        })
        .catch(function () {
          if (attempts < MAX_POLLS) {
            setTimeout(check, POLL_INTERVAL);
          } else {
            if (callback) callback({ success: false, error: 'Network error during verification' });
          }
        });
    }

    check();
  }

  /**
   * Sync subscription status with server.
   * @param {string} uid - User ID
   * @param {function} [callback]
   */
  function syncStatus(uid, callback) {
    if (!uid) {
      if (callback) callback(loadSubscription());
      return;
    }

    fetch(SUBSCRIPTION_ENDPOINT + '?uid=' + encodeURIComponent(uid))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.isPro !== undefined) {
          var sub = loadSubscription();
          sub.isPro = !!data.isPro;
          sub.plan = data.plan || sub.plan;
          sub.expiresAt = data.expiresAt || sub.expiresAt;
          sub.lastChecked = Date.now();
          saveSubscription(sub);
          dispatchChange(sub);
          if (callback) callback(sub);
        } else {
          if (callback) callback(loadSubscription());
        }
      })
      .catch(function () {
        if (callback) callback(loadSubscription());
      });
  }

  /**
   * Get current subscription state from localStorage.
   */
  function getStatus() {
    return loadSubscription();
  }

  /**
   * Check if user currently has Pro access.
   */
  function isPro() {
    var sub = loadSubscription();
    if (!sub.isPro) return false;
    if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
      sub.isPro = false;
      saveSubscription(sub);
      return false;
    }
    return true;
  }

  /**
   * Clear local subscription state.
   */
  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    dispatchChange(getDefault());
  }

  window.CortexFreelancer.StripeWebhook = {
    handleEvent: handleEvent,
    pollCheckoutStatus: pollCheckoutStatus,
    syncStatus: syncStatus,
    getStatus: getStatus,
    isPro: isPro,
    clear: clear
  };
})();
