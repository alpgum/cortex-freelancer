/**
 * [CF-197] Revenue Notification System
 * Client-side component for revenue event display. Show new subscription
 * notifications on HQ dashboard in real-time via SSE/polling.
 * Exposed as window.CortexFreelancer.RevenueNotifications
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var SSE_ENDPOINT = '/api/revenue/events';
  var POLL_ENDPOINT = '/api/revenue/recent';
  var STORAGE_KEY = 'cortex_revenue_notifications';
  var POLL_INTERVAL_MS = 30 * 1000; // 30s fallback
  var TOAST_DURATION_MS = 6000;
  var MAX_STORED = 50;

  var _eventSource = null;
  var _pollTimer = null;
  var _toastQueue = [];
  var _isShowing = false;

  /* ══════════════════════════════════════════════
   * HELPERS
   * ══════════════════════════════════════════════ */
  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function formatCurrency(cents, currency) {
    currency = (currency || 'USD').toUpperCase();
    var symbols = { USD: '$', EUR: '€', GBP: '£' };
    var symbol = symbols[currency] || currency + ' ';
    return symbol + (cents / 100).toFixed(2);
  }

  function timeAgo(ts) {
    var diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function loadNotifications() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { return []; }
  }

  function saveNotifications(list) {
    if (list.length > MAX_STORED) list = list.slice(-MAX_STORED);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * EVENT TYPES
   * ══════════════════════════════════════════════ */
  var EVENT_TYPES = {
    new_subscription:    { icon: '🎉', label: 'New Subscription',    color: '#22c55e' },
    upgrade:             { icon: '⬆️', label: 'Plan Upgrade',        color: '#3b82f6' },
    renewal:             { icon: '🔄', label: 'Renewal',             color: '#8b5cf6' },
    lifetime_purchase:   { icon: '🚀', label: 'Lifetime Deal',       color: '#f59e0b' },
    cancellation:        { icon: '❌', label: 'Cancellation',         color: '#ef4444' },
    refund:              { icon: '↩️', label: 'Refund',               color: '#6b7280' },
    trial_conversion:    { icon: '✨', label: 'Trial → Paid',        color: '#10b981' }
  };

  function getEventMeta(type) {
    return EVENT_TYPES[type] || { icon: '💰', label: 'Revenue Event', color: '#6b7280' };
  }

  /* ══════════════════════════════════════════════
   * PROCESS INCOMING EVENT
   * ══════════════════════════════════════════════ */
  function processEvent(event) {
    var notification = {
      id: event.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: event.type || 'new_subscription',
      amount_cents: event.amount_cents || 0,
      currency: event.currency || 'USD',
      plan: event.plan || '',
      customer_name: event.customer_name || 'A customer',
      customer_email: event.customer_email || '',
      timestamp: event.timestamp || new Date().toISOString(),
      mrr_delta_cents: event.mrr_delta_cents || 0
    };

    // Store
    var list = loadNotifications();
    list.push(notification);
    saveNotifications(list);

    // Queue toast
    _toastQueue.push(notification);
    _processToastQueue();

    // Dispatch for other modules
    try {
      window.dispatchEvent(new CustomEvent('cortex:revenue_event', { detail: notification }));
    } catch (_) {}

    return notification;
  }

  /* ══════════════════════════════════════════════
   * TOAST NOTIFICATIONS
   * ══════════════════════════════════════════════ */
  function _processToastQueue() {
    if (_isShowing || _toastQueue.length === 0) return;
    _isShowing = true;

    var notif = _toastQueue.shift();
    _showToast(notif, function () {
      _isShowing = false;
      // Small delay between toasts
      setTimeout(function () { _processToastQueue(); }, 400);
    });
  }

  function _showToast(notif, onDone) {
    var meta = getEventMeta(notif.type);

    var toast = document.createElement('div');
    toast.className = 'cf-revenue-toast';
    toast.style.borderLeftColor = meta.color;

    var amountStr = notif.amount_cents > 0 ? formatCurrency(notif.amount_cents, notif.currency) : '';

    toast.innerHTML =
      '<div class="cf-toast-icon">' + meta.icon + '</div>' +
      '<div class="cf-toast-body">' +
        '<div class="cf-toast-title">' + escHtml(meta.label) +
          (amountStr ? ' <strong>' + escHtml(amountStr) + '</strong>' : '') +
        '</div>' +
        '<div class="cf-toast-detail">' + escHtml(notif.customer_name) +
          (notif.plan ? ' — ' + escHtml(notif.plan) : '') +
        '</div>' +
      '</div>' +
      '<button class="cf-toast-close">✕</button>';

    // Ensure container exists
    var container = document.getElementById('cf-revenue-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cf-revenue-toast-container';
      container.className = 'cf-revenue-toast-container';
      document.body.appendChild(container);
    }

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(function () {
      toast.classList.add('cf-toast-visible');
    });

    // Close button
    var closeBtn = toast.querySelector('.cf-toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        _removeToast(toast, onDone);
      });
    }

    // Auto-dismiss
    setTimeout(function () {
      _removeToast(toast, onDone);
    }, TOAST_DURATION_MS);
  }

  function _removeToast(toast, onDone) {
    if (!toast || !toast.parentNode) { if (onDone) onDone(); return; }
    toast.classList.remove('cf-toast-visible');
    toast.classList.add('cf-toast-exit');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      if (onDone) onDone();
    }, 300);
  }

  /* ══════════════════════════════════════════════
   * DASHBOARD FEED
   * ══════════════════════════════════════════════ */
  function renderFeed(container, opts) {
    opts = opts || {};
    var limit = opts.limit || 20;
    var list = loadNotifications().slice(-limit).reverse();

    if (list.length === 0) {
      container.innerHTML = '<div class="cf-revenue-empty"><p>No revenue events yet</p></div>';
      return;
    }

    var html = '<div class="cf-revenue-feed">';
    html += '<h3 class="cf-revenue-feed-title">💰 Revenue Activity</h3>';
    html += '<div class="cf-revenue-list">';

    list.forEach(function (notif) {
      var meta = getEventMeta(notif.type);
      var amount = notif.amount_cents > 0 ? formatCurrency(notif.amount_cents, notif.currency) : '';

      html += '<div class="cf-revenue-item" style="border-left-color:' + meta.color + '">';
      html += '<span class="cf-revenue-icon">' + meta.icon + '</span>';
      html += '<div class="cf-revenue-info">';
      html += '<div class="cf-revenue-label">' + escHtml(meta.label);
      if (amount) html += ' <strong>' + escHtml(amount) + '</strong>';
      html += '</div>';
      html += '<div class="cf-revenue-detail">' + escHtml(notif.customer_name);
      if (notif.plan) html += ' — ' + escHtml(notif.plan);
      html += '</div>';
      html += '</div>';
      html += '<span class="cf-revenue-time">' + escHtml(timeAgo(notif.timestamp)) + '</span>';
      html += '</div>';
    });

    html += '</div></div>';
    container.innerHTML = html;
  }

  /* ══════════════════════════════════════════════
   * REAL-TIME: SSE with polling fallback
   * ══════════════════════════════════════════════ */
  function connect() {
    // Try SSE first
    if (typeof EventSource !== 'undefined') {
      try {
        _eventSource = new EventSource(SSE_ENDPOINT);

        _eventSource.addEventListener('revenue', function (e) {
          try {
            var data = JSON.parse(e.data);
            processEvent(data);
          } catch (_) {}
        });

        _eventSource.onerror = function () {
          // Fallback to polling
          disconnect();
          _startPolling();
        };

        return;
      } catch (_) {}
    }

    // Fallback: polling
    _startPolling();
  }

  function _startPolling() {
    if (_pollTimer) return;

    var lastSeen = '';
    _pollTimer = setInterval(function () {
      fetch(POLL_ENDPOINT + (lastSeen ? '?after=' + encodeURIComponent(lastSeen) : ''))
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) {
          if (!data || !data.events) return;
          data.events.forEach(function (evt) {
            processEvent(evt);
            if (evt.id) lastSeen = evt.id;
          });
        })
        .catch(function () {});
    }, POLL_INTERVAL_MS);
  }

  function disconnect() {
    if (_eventSource) { _eventSource.close(); _eventSource = null; }
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  /* ══════════════════════════════════════════════
   * SUMMARY STATS
   * ══════════════════════════════════════════════ */
  function getTodayStats() {
    var today = new Date().toISOString().slice(0, 10);
    var list = loadNotifications().filter(function (n) {
      return n.timestamp && n.timestamp.slice(0, 10) === today;
    });

    var revenue = 0;
    var newSubs = 0;
    var cancellations = 0;

    list.forEach(function (n) {
      if (n.type !== 'cancellation' && n.type !== 'refund') {
        revenue += n.amount_cents || 0;
      }
      if (n.type === 'refund') revenue -= (n.amount_cents || 0);
      if (n.type === 'new_subscription' || n.type === 'trial_conversion') newSubs++;
      if (n.type === 'cancellation') cancellations++;
    });

    return {
      total_events: list.length,
      revenue_cents: revenue,
      new_subscriptions: newSubs,
      cancellations: cancellations,
      date: today
    };
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.RevenueNotifications = {
    connect: connect,
    disconnect: disconnect,
    processEvent: processEvent,
    renderFeed: renderFeed,
    getTodayStats: getTodayStats,
    getNotifications: loadNotifications,
    EVENT_TYPES: EVENT_TYPES
  };
})();
