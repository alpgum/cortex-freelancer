/**
 * Cortex Freelancer — Subscription Store (Firestore)
 * [CF-174] Stores and syncs subscription status in Firestore per user.
 *
 * Features:
 *   - Updates user document on Stripe webhook events
 *   - Stores plan, status, period_end, stripe_customer_id
 *   - Local cache with Firestore sync
 *   - Real-time listener for subscription changes
 *   - Offline fallback with localStorage
 *   - Event emitter for subscription state changes
 *   - init() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_subscription_store';
  var COLLECTION = 'users';
  var SUB_FIELD = 'subscription';

  var WEBHOOK_EVENTS = {
    CHECKOUT_COMPLETE: 'checkout.session.completed',
    SUB_CREATED: 'customer.subscription.created',
    SUB_UPDATED: 'customer.subscription.updated',
    SUB_DELETED: 'customer.subscription.deleted',
    INVOICE_PAID: 'invoice.paid',
    INVOICE_FAILED: 'invoice.payment_failed'
  };

  var STATUS = {
    ACTIVE: 'active',
    PAST_DUE: 'past_due',
    CANCELED: 'canceled',
    UNPAID: 'unpaid',
    TRIALING: 'trialing',
    INCOMPLETE: 'incomplete',
    FREE: 'free'
  };

  var PLANS = {
    FREE: 'free',
    PRO: 'pro'
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    userId: null,
    subscription: null,
    listeners: [],
    unsubFirestore: null,
    eventHandlers: {}
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocal(sub) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sub));
    } catch (e) { /* quota exceeded */ }
  }

  function emit(event, data) {
    var handlers = state.eventHandlers[event] || [];
    handlers.forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[SubscriptionStore] handler error:', e); }
    });
  }

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function getAuth() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      return firebase.auth();
    }
    return null;
  }

  function defaultSubscription() {
    return {
      plan: PLANS.FREE,
      status: STATUS.FREE,
      period_end: null,
      stripe_customer_id: null,
      updated_at: new Date().toISOString()
    };
  }

  // ─── Firestore Operations ─────────────────────────────────────────

  function getUserDocRef(userId) {
    var db = getFirestore();
    if (!db || !userId) return null;
    return db.collection(COLLECTION).doc(userId);
  }

  function fetchSubscription(userId) {
    var ref = getUserDocRef(userId);
    if (!ref) {
      var local = loadLocal();
      state.subscription = local || defaultSubscription();
      return Promise.resolve(state.subscription);
    }

    return ref.get().then(function (doc) {
      if (doc.exists && doc.data()[SUB_FIELD]) {
        state.subscription = doc.data()[SUB_FIELD];
      } else {
        state.subscription = defaultSubscription();
      }
      saveLocal(state.subscription);
      return state.subscription;
    }).catch(function () {
      var local = loadLocal();
      state.subscription = local || defaultSubscription();
      return state.subscription;
    });
  }

  function updateSubscription(userId, subData) {
    var ref = getUserDocRef(userId);
    var update = Object.assign({}, state.subscription || {}, subData, {
      updated_at: new Date().toISOString()
    });

    state.subscription = update;
    saveLocal(update);
    emit('change', update);

    if (!ref) return Promise.resolve(update);

    var payload = {};
    payload[SUB_FIELD] = update;

    return ref.set(payload, { merge: true }).then(function () {
      return update;
    }).catch(function (err) {
      console.error('[SubscriptionStore] Firestore write failed:', err);
      return update;
    });
  }

  function startRealtimeListener(userId) {
    stopRealtimeListener();
    var ref = getUserDocRef(userId);
    if (!ref) return;

    state.unsubFirestore = ref.onSnapshot(function (doc) {
      if (doc.exists && doc.data()[SUB_FIELD]) {
        var sub = doc.data()[SUB_FIELD];
        var changed = JSON.stringify(sub) !== JSON.stringify(state.subscription);
        state.subscription = sub;
        saveLocal(sub);
        if (changed) emit('change', sub);
      }
    }, function (err) {
      console.error('[SubscriptionStore] Listener error:', err);
    });
  }

  function stopRealtimeListener() {
    if (state.unsubFirestore) {
      state.unsubFirestore();
      state.unsubFirestore = null;
    }
  }

  // ─── Webhook Event Processing ─────────────────────────────────────

  function processWebhookEvent(eventType, eventData) {
    var userId = state.userId;
    if (!userId) return Promise.resolve(null);

    var subUpdate = {};

    switch (eventType) {
      case WEBHOOK_EVENTS.CHECKOUT_COMPLETE:
        subUpdate = {
          plan: PLANS.PRO,
          status: STATUS.ACTIVE,
          stripe_customer_id: eventData.customer || null,
          period_end: eventData.current_period_end || null
        };
        break;

      case WEBHOOK_EVENTS.SUB_CREATED:
      case WEBHOOK_EVENTS.SUB_UPDATED:
        subUpdate = {
          plan: eventData.plan || state.subscription.plan,
          status: eventData.status || STATUS.ACTIVE,
          stripe_customer_id: eventData.customer || state.subscription.stripe_customer_id,
          period_end: eventData.current_period_end || state.subscription.period_end
        };
        if (subUpdate.status === STATUS.CANCELED) {
          subUpdate.plan = PLANS.FREE;
        }
        break;

      case WEBHOOK_EVENTS.SUB_DELETED:
        subUpdate = {
          plan: PLANS.FREE,
          status: STATUS.CANCELED,
          period_end: null
        };
        break;

      case WEBHOOK_EVENTS.INVOICE_PAID:
        subUpdate = {
          status: STATUS.ACTIVE,
          period_end: eventData.current_period_end || state.subscription.period_end
        };
        break;

      case WEBHOOK_EVENTS.INVOICE_FAILED:
        subUpdate = {
          status: STATUS.PAST_DUE
        };
        break;

      default:
        return Promise.resolve(state.subscription);
    }

    emit('webhook', { type: eventType, data: eventData });
    return updateSubscription(userId, subUpdate);
  }

  // ─── Query Helpers ────────────────────────────────────────────────

  function isActive() {
    if (!state.subscription) return false;
    var s = state.subscription.status;
    return s === STATUS.ACTIVE || s === STATUS.TRIALING;
  }

  function isPro() {
    return isActive() && state.subscription.plan === PLANS.PRO;
  }

  function isFree() {
    return !isPro();
  }

  function isExpired() {
    if (!state.subscription || !state.subscription.period_end) return false;
    return new Date(state.subscription.period_end) < new Date();
  }

  function getPlan() {
    return state.subscription ? state.subscription.plan : PLANS.FREE;
  }

  function getStatus() {
    return state.subscription ? state.subscription.status : STATUS.FREE;
  }

  // ─── Public API ───────────────────────────────────────────────────

  var SubscriptionStore = {
    WEBHOOK_EVENTS: WEBHOOK_EVENTS,
    STATUS: STATUS,
    PLANS: PLANS,

    init: function (opts) {
      opts = opts || {};
      var auth = getAuth();

      if (opts.userId) {
        state.userId = opts.userId;
      } else if (auth && auth.currentUser) {
        state.userId = auth.currentUser.uid;
      }

      if (!state.userId) {
        state.subscription = defaultSubscription();
        return Promise.resolve(state.subscription);
      }

      return fetchSubscription(state.userId).then(function (sub) {
        if (opts.realtime !== false) {
          startRealtimeListener(state.userId);
        }
        return sub;
      });
    },

    getSubscription: function () {
      return state.subscription || defaultSubscription();
    },

    update: function (subData) {
      return updateSubscription(state.userId, subData);
    },

    processWebhook: processWebhookEvent,

    isActive: isActive,
    isPro: isPro,
    isFree: isFree,
    isExpired: isExpired,
    getPlan: getPlan,
    getStatus: getStatus,

    on: function (event, handler) {
      if (!state.eventHandlers[event]) state.eventHandlers[event] = [];
      state.eventHandlers[event].push(handler);
    },

    off: function (event, handler) {
      if (!state.eventHandlers[event]) return;
      state.eventHandlers[event] = state.eventHandlers[event].filter(function (h) {
        return h !== handler;
      });
    },

    destroy: function () {
      stopRealtimeListener();
      state.eventHandlers = {};
      state.subscription = null;
      state.userId = null;
    }
  };

  window.CortexFreelancer.SubscriptionStore = SubscriptionStore;
})();
