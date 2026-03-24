/**
 * CF-196: Checkout Abandonment Recovery
 * Tracks incomplete checkouts, queues follow-up emails after 1 hour,
 * provides direct checkout links, and shows recovery stats.
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_checkout_pending';
  var ABANDONMENT_LOG_KEY = 'cortex_abandonment_log';
  var FOLLOW_UP_DELAY_MS = 3600000; // 1 hour
  var API_BASE = '/api/checkout-recovery';

  /**
   * Record a checkout start event
   * @param {Object} data
   * @param {string} data.planKey
   * @param {string} data.sessionId
   * @param {string} [data.email]
   */
  var recordCheckoutStart = function (data) {
    var record = {
      planKey: data.planKey,
      sessionId: data.sessionId,
      email: data.email || null,
      startedAt: new Date().toISOString(),
      completed: false,
      followUpQueued: false
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (e) {
      console.warn('[CheckoutAbandonment] Could not save checkout record:', e.message);
    }

    // Also send to server for server-side tracking
    fetch(API_BASE + '/track-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(function (err) {
      console.warn('[CheckoutAbandonment] Server tracking failed:', err.message);
    });
  };

  /**
   * Mark a checkout as completed (clears abandonment tracking)
   * @param {string} sessionId
   */
  var markCheckoutCompleted = function (sessionId) {
    try {
      var pending = localStorage.getItem(STORAGE_KEY);
      if (pending) {
        var record = JSON.parse(pending);
        if (record.sessionId === sessionId) {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) { /* noop */ }

    // Log as recovered if it was previously abandoned
    logRecoveryEvent(sessionId, 'completed');

    fetch(API_BASE + '/track-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, completedAt: new Date().toISOString() })
    }).catch(function () { /* noop */ });
  };

  /**
   * Check for abandoned checkouts and queue follow-up if needed
   * Called on page load or periodically
   */
  var checkForAbandonment = function () {
    try {
      var pending = localStorage.getItem(STORAGE_KEY);
      if (!pending) return;

      var record = JSON.parse(pending);
      if (record.completed || record.followUpQueued) return;

      var elapsed = Date.now() - new Date(record.startedAt).getTime();
      if (elapsed >= FOLLOW_UP_DELAY_MS) {
        queueFollowUpEmail(record);
      }
    } catch (e) {
      console.warn('[CheckoutAbandonment] Check failed:', e.message);
    }
  };

  /**
   * Queue a follow-up recovery email
   * @param {Object} record - checkout record
   * @returns {Promise<void>}
   */
  var queueFollowUpEmail = function (record) {
    var products = window.CortexFreelancer.StripeProducts;
    var product = products ? products.getProduct(record.planKey) : null;

    var payload = {
      email: record.email,
      sessionId: record.sessionId,
      planKey: record.planKey,
      planName: product ? product.name : record.planKey,
      abandonedAt: record.startedAt,
      recoveryLink: buildRecoveryLink(record.planKey),
      template: 'checkout_abandonment'
    };

    return fetch(API_BASE + '/queue-followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('Follow-up queue failed');
      // Mark as queued locally
      record.followUpQueued = true;
      record.followUpQueuedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      logAbandonmentEvent(record);
    }).catch(function (err) {
      console.warn('[CheckoutAbandonment] Follow-up queue failed:', err.message);
    });
  };

  /**
   * Build a direct recovery checkout link
   * @param {string} planKey
   * @returns {string}
   */
  var buildRecoveryLink = function (planKey) {
    return window.location.origin + '/pricing?recover=true&plan=' + encodeURIComponent(planKey);
  };

  /**
   * Log an abandonment event for stats
   * @param {Object} record
   */
  var logAbandonmentEvent = function (record) {
    try {
      var logRaw = localStorage.getItem(ABANDONMENT_LOG_KEY);
      var log = logRaw ? JSON.parse(logRaw) : [];
      log.push({
        sessionId: record.sessionId,
        planKey: record.planKey,
        abandonedAt: record.startedAt,
        followUpSentAt: new Date().toISOString(),
        recovered: false
      });
      // Keep last 50 entries
      if (log.length > 50) log = log.slice(-50);
      localStorage.setItem(ABANDONMENT_LOG_KEY, JSON.stringify(log));
    } catch (e) { /* noop */ }
  };

  /**
   * Log a recovery event
   * @param {string} sessionId
   * @param {string} type - completed | clicked_recovery
   */
  var logRecoveryEvent = function (sessionId, type) {
    try {
      var logRaw = localStorage.getItem(ABANDONMENT_LOG_KEY);
      if (!logRaw) return;
      var log = JSON.parse(logRaw);
      for (var i = 0; i < log.length; i++) {
        if (log[i].sessionId === sessionId) {
          log[i].recovered = true;
          log[i].recoveredAt = new Date().toISOString();
          log[i].recoveryType = type;
          break;
        }
      }
      localStorage.setItem(ABANDONMENT_LOG_KEY, JSON.stringify(log));
    } catch (e) { /* noop */ }
  };

  /**
   * Fetch recovery stats from server
   * @param {Object} [options]
   * @param {number} [options.days] - lookback period (default 30)
   * @returns {Promise<Object>}
   */
  var fetchRecoveryStats = function (options) {
    var days = (options && options.days) || 30;
    return fetch(API_BASE + '/stats?days=' + days).then(function (res) {
      if (!res.ok) throw new Error('Failed to fetch recovery stats');
      return res.json();
    });
  };

  /**
   * Get local abandonment stats
   * @returns {Object}
   */
  var getLocalStats = function () {
    try {
      var logRaw = localStorage.getItem(ABANDONMENT_LOG_KEY);
      if (!logRaw) return { total: 0, recovered: 0, rate: 0 };
      var log = JSON.parse(logRaw);
      var recovered = log.filter(function (e) { return e.recovered; }).length;
      return {
        total: log.length,
        recovered: recovered,
        rate: log.length > 0 ? Math.round((recovered / log.length) * 100) : 0
      };
    } catch (e) {
      return { total: 0, recovered: 0, rate: 0 };
    }
  };

  /**
   * Render recovery stats into a container
   * @param {string|Element} container
   */
  var renderRecoveryStats = function (container) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    fetchRecoveryStats().then(function (stats) {
      var recoveryRate = stats.totalAbandoned > 0
        ? Math.round((stats.totalRecovered / stats.totalAbandoned) * 100)
        : 0;

      el.innerHTML =
        '<div class="cortex-recovery-stats">' +
          '<h3>Checkout Recovery (Last 30 days)</h3>' +
          '<div class="cortex-stats-grid">' +
            '<div class="cortex-stat">' +
              '<span class="cortex-stat-value">' + (stats.totalAbandoned || 0) + '</span>' +
              '<span class="cortex-stat-label">Abandoned</span>' +
            '</div>' +
            '<div class="cortex-stat">' +
              '<span class="cortex-stat-value">' + (stats.followUpsSent || 0) + '</span>' +
              '<span class="cortex-stat-label">Follow-ups Sent</span>' +
            '</div>' +
            '<div class="cortex-stat">' +
              '<span class="cortex-stat-value">' + (stats.totalRecovered || 0) + '</span>' +
              '<span class="cortex-stat-label">Recovered</span>' +
            '</div>' +
            '<div class="cortex-stat">' +
              '<span class="cortex-stat-value">' + recoveryRate + '%</span>' +
              '<span class="cortex-stat-label">Recovery Rate</span>' +
            '</div>' +
          '</div>' +
          (stats.revenueRecovered
            ? '<p class="cortex-recovery-revenue">Revenue recovered: <strong>$' +
              (stats.revenueRecovered / 100).toFixed(2) + '</strong></p>'
            : '') +
        '</div>';
    }).catch(function () {
      // Fall back to local stats
      var local = getLocalStats();
      el.innerHTML =
        '<div class="cortex-recovery-stats">' +
          '<h3>Checkout Recovery</h3>' +
          '<p>' + local.total + ' abandoned, ' + local.recovered + ' recovered (' + local.rate + '%)</p>' +
        '</div>';
    });
  };

  /**
   * Handle recovery link landing (check URL params on page load)
   */
  var handleRecoveryLanding = function () {
    var params = new URLSearchParams(window.location.search);
    if (params.get('recover') !== 'true') return;

    var planKey = params.get('plan');
    if (!planKey) return;

    // Log the recovery click
    var pending = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) pending = JSON.parse(raw);
    } catch (e) { /* noop */ }

    if (pending && pending.sessionId) {
      logRecoveryEvent(pending.sessionId, 'clicked_recovery');
    }

    // Auto-redirect to checkout after short delay
    setTimeout(function () {
      var checkout = window.CortexFreelancer.StripeCheckout;
      if (checkout) {
        checkout.redirectToCheckout({ planKey: planKey });
      }
    }, 500);
  };

  /* ---- Auto-init ---- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      checkForAbandonment();
      handleRecoveryLanding();
    });
  } else {
    checkForAbandonment();
    handleRecoveryLanding();
  }

  window.CortexFreelancer.CheckoutAbandonment = {
    recordCheckoutStart: recordCheckoutStart,
    markCheckoutCompleted: markCheckoutCompleted,
    checkForAbandonment: checkForAbandonment,
    buildRecoveryLink: buildRecoveryLink,
    fetchRecoveryStats: fetchRecoveryStats,
    getLocalStats: getLocalStats,
    renderRecoveryStats: renderRecoveryStats,
    handleRecoveryLanding: handleRecoveryLanding
  };
})();
