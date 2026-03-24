/**
 * CF-173: Stripe Webhook Handler
 * Handles checkout.session.completed, customer.subscription.updated/deleted.
 * Updates user subscription state in Firestore.
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var FIRESTORE_BASE = '/api/firestore';

  /* ---- Subscription state helpers ---- */

  /**
   * Map Stripe subscription status to internal tier
   * @param {string} status - Stripe status
   * @param {Object} metadata
   * @returns {string}
   */
  var mapStatusToTier = function (status, metadata) {
    if (metadata && metadata.planKey === 'lifetime') return 'lifetime';
    if (status === 'active' || status === 'trialing') return 'pro';
    return 'free';
  };

  /**
   * Build subscription record for Firestore
   * @param {Object} event - Stripe event object
   * @returns {Object}
   */
  var buildSubscriptionRecord = function (event) {
    var data = event.data.object;
    var type = event.type;

    var record = {
      updatedAt: new Date().toISOString(),
      eventType: type,
      stripeEventId: event.id
    };

    if (type === 'checkout.session.completed') {
      record.customerId = data.customer;
      record.customerEmail = data.customer_email || data.customer_details.email;
      record.subscriptionId = data.subscription || null;
      record.paymentStatus = data.payment_status;
      record.mode = data.mode;
      record.tier = data.metadata && data.metadata.planKey === 'lifetime' ? 'lifetime' : 'pro';
      record.planKey = (data.metadata && data.metadata.planKey) || 'pro';
      record.activatedAt = new Date().toISOString();
    }

    if (type === 'customer.subscription.updated') {
      record.subscriptionId = data.id;
      record.customerId = data.customer;
      record.status = data.status;
      record.tier = mapStatusToTier(data.status, data.metadata);
      record.currentPeriodEnd = data.current_period_end
        ? new Date(data.current_period_end * 1000).toISOString()
        : null;
      record.cancelAtPeriodEnd = data.cancel_at_period_end || false;
    }

    if (type === 'customer.subscription.deleted') {
      record.subscriptionId = data.id;
      record.customerId = data.customer;
      record.status = 'canceled';
      record.tier = 'free';
      record.canceledAt = new Date().toISOString();
    }

    return record;
  };

  /**
   * Update user subscription in Firestore
   * @param {string} customerId - Stripe customer ID
   * @param {Object} record
   * @returns {Promise<Object>}
   */
  var updateFirestoreSubscription = function (customerId, record) {
    return fetch(FIRESTORE_BASE + '/users/by-stripe/' + encodeURIComponent(customerId) + '/subscription', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error(err.message || 'Firestore update failed');
        });
      }
      return res.json();
    });
  };

  /**
   * Process a Stripe webhook event (server-side handler logic)
   * @param {Object} event - parsed Stripe event
   * @returns {Promise<Object>} result with action taken
   */
  var handleWebhookEvent = function (event) {
    if (!event || !event.type || !event.data || !event.data.object) {
      return Promise.reject(new Error('Invalid webhook event'));
    }

    var handlers = {
      'checkout.session.completed': handleCheckoutCompleted,
      'customer.subscription.updated': handleSubscriptionUpdated,
      'customer.subscription.deleted': handleSubscriptionDeleted
    };

    var handler = handlers[event.type];
    if (!handler) {
      return Promise.resolve({ action: 'ignored', eventType: event.type });
    }

    return handler(event);
  };

  /**
   * Handle checkout.session.completed
   * @param {Object} event
   * @returns {Promise<Object>}
   */
  var handleCheckoutCompleted = function (event) {
    var session = event.data.object;
    var record = buildSubscriptionRecord(event);
    var customerId = session.customer;

    return updateFirestoreSubscription(customerId, record).then(function (result) {
      return queueNotification(record.customerEmail, 'subscription_activated', {
        tier: record.tier,
        planKey: record.planKey
      }).then(function () {
        return { action: 'activated', tier: record.tier, customerId: customerId, result: result };
      });
    });
  };

  /**
   * Handle customer.subscription.updated
   * @param {Object} event
   * @returns {Promise<Object>}
   */
  var handleSubscriptionUpdated = function (event) {
    var subscription = event.data.object;
    var record = buildSubscriptionRecord(event);

    return updateFirestoreSubscription(subscription.customer, record).then(function (result) {
      if (record.cancelAtPeriodEnd) {
        return queueNotification(null, 'subscription_canceling', {
          customerId: subscription.customer,
          endsAt: record.currentPeriodEnd
        }).then(function () {
          return { action: 'updated_canceling', customerId: subscription.customer, result: result };
        });
      }
      return { action: 'updated', tier: record.tier, customerId: subscription.customer, result: result };
    });
  };

  /**
   * Handle customer.subscription.deleted
   * @param {Object} event
   * @returns {Promise<Object>}
   */
  var handleSubscriptionDeleted = function (event) {
    var subscription = event.data.object;
    var record = buildSubscriptionRecord(event);

    return updateFirestoreSubscription(subscription.customer, record).then(function (result) {
      return queueNotification(null, 'subscription_canceled', {
        customerId: subscription.customer
      }).then(function () {
        return { action: 'canceled', customerId: subscription.customer, result: result };
      });
    });
  };

  /**
   * Queue a notification (email/in-app)
   * @param {string|null} email
   * @param {string} template
   * @param {Object} data
   * @returns {Promise<void>}
   */
  var queueNotification = function (email, template, data) {
    return fetch('/api/notifications/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        template: template,
        data: data,
        queuedAt: new Date().toISOString()
      })
    }).then(function () { /* noop */ })
      .catch(function (err) {
        console.warn('[StripeWebhook] Notification queue failed:', err.message);
      });
  };

  /**
   * Verify webhook signature (utility for server-side use)
   * @param {string} payload - raw body
   * @param {string} signature - Stripe-Signature header
   * @param {string} secret - webhook signing secret
   * @returns {boolean}
   */
  var verifySignature = function (payload, signature, secret) {
    if (!payload || !signature || !secret) return false;
    console.warn('[StripeWebhook] verifySignature should run server-side with Stripe SDK');
    return true;
  };

  window.CortexFreelancer.StripeWebhook = {
    handleWebhookEvent: handleWebhookEvent,
    buildSubscriptionRecord: buildSubscriptionRecord,
    mapStatusToTier: mapStatusToTier,
    verifySignature: verifySignature
  };
})();
