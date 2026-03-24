/**
 * Cortex Freelancer — Revenue Notification System
 * [CF-197] In-app toast notifications for new subscription events.
 * Shows amount and plan name on revenue events.
 *
 * @namespace window.CortexFreelancer.RevenueNotification
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ──────────────────────────────────────────────────

  var TOAST_DURATION = 5000;
  var TOAST_CONTAINER_ID = 'cf-revenue-toast-container';
  var STORAGE_KEY = 'cf_revenue_notifications';
  var MAX_STORED = 50;

  // ─── State ──────────────────────────────────────────────────────

  var toastQueue = [];
  var isShowing = false;
  var listeners = [];

  // ─── Helpers ────────────────────────────────────────────────────

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  function formatCurrency(cents) {
    var dollars = (cents / 100).toFixed(2);
    return '$' + dollars;
  }

  function getContainer() {
    var container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = TOAST_CONTAINER_ID;
      container.style.cssText =
        'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
      document.body.appendChild(container);
    }
    return container;
  }

  function getStoredNotifications() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function storeNotification(notification) {
    var stored = getStoredNotifications();
    stored.unshift(notification);
    if (stored.length > MAX_STORED) {
      stored = stored.slice(0, MAX_STORED);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (e) {
      // storage full
    }
  }

  // ─── Toast Rendering ───────────────────────────────────────────

  function createToastElement(notification) {
    var el = document.createElement('div');
    el.className = 'cf-revenue-toast';
    el.style.cssText =
      'background:#1a7f5a;color:#fff;padding:14px 20px;border-radius:8px;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.15);pointer-events:auto;cursor:pointer;' +
      'opacity:0;transform:translateX(100%);transition:all 0.3s ease;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:360px;';

    var icon = notification.type === 'subscription_created' ? '🎉' : '💰';
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:20px;">' + icon + '</span>' +
      '<div>' +
      '<div style="font-weight:600;font-size:14px;">' + escapeHtml(notification.title) + '</div>' +
      '<div style="font-size:13px;opacity:0.9;margin-top:2px;">' + escapeHtml(notification.message) + '</div>' +
      '</div>' +
      '</div>';

    el.addEventListener('click', function () {
      dismissToast(el);
    });

    return el;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(notification) {
    var container = getContainer();
    var el = createToastElement(notification);
    container.appendChild(el);

    requestAnimationFrame(function () {
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    });

    setTimeout(function () {
      dismissToast(el);
    }, TOAST_DURATION);
  }

  function dismissToast(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    setTimeout(function () {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
      processQueue();
    }, 300);
  }

  function processQueue() {
    if (toastQueue.length === 0) {
      isShowing = false;
      return;
    }
    isShowing = true;
    var next = toastQueue.shift();
    showToast(next);
  }

  // ─── Event Handlers ────────────────────────────────────────────

  function buildNotification(event) {
    var type = event.type || 'payment_received';
    var amount = formatCurrency(event.amount || 0);
    var planName = event.planName || 'Unknown Plan';
    var title, message;

    switch (type) {
      case 'subscription_created':
        title = 'New Subscription!';
        message = planName + ' — ' + amount + '/mo';
        break;
      case 'subscription_renewed':
        title = 'Subscription Renewed';
        message = planName + ' — ' + amount;
        break;
      case 'payment_received':
        title = 'Payment Received';
        message = amount + ' from ' + (event.customerName || 'a client');
        break;
      case 'subscription_upgraded':
        title = 'Plan Upgraded!';
        message = 'Now on ' + planName + ' — ' + amount + '/mo';
        break;
      default:
        title = 'Revenue Update';
        message = amount + ' — ' + planName;
    }

    return {
      id: generateId(),
      type: type,
      title: title,
      message: message,
      amount: event.amount,
      planName: planName,
      timestamp: Date.now(),
      read: false
    };
  }

  function notifyListeners(notification) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](notification);
      } catch (e) {
        console.error('[RevenueNotification] Listener error:', e);
      }
    }
  }

  // ─── Public API ─────────────────────────────────────────────────

  window.CortexFreelancer.RevenueNotification = {
    /**
     * Trigger a revenue notification.
     * @param {{ type: string, amount: number, planName: string, customerName?: string }} event
     */
    notify: function (event) {
      var notification = buildNotification(event);
      storeNotification(notification);
      toastQueue.push(notification);
      notifyListeners(notification);
      if (!isShowing) {
        processQueue();
      }
    },

    /** Subscribe to notification events. Returns unsubscribe function. */
    onNotification: function (fn) {
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (l) { return l !== fn; });
      };
    },

    /** Get stored notification history. */
    getHistory: function () {
      return getStoredNotifications();
    },

    /** Clear notification history. */
    clearHistory: function () {
      localStorage.removeItem(STORAGE_KEY);
    },

    /** Set toast display duration in ms. */
    setDuration: function (ms) {
      TOAST_DURATION = ms;
    }
  };
})();
