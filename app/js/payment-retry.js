/**
 * Cortex Freelancer — Payment Failed Retry Flow
 * [CF-186] Handles invoice.payment_failed state with in-app banner,
 * retry countdown, and email notification trigger.
 *
 * Features:
 *   - Detects payment_failed / past_due subscription states
 *   - Shows dismissable in-app banner with "Update Payment Method" CTA
 *   - Retry countdown (Stripe retries at 1, 3, 5, 7 days)
 *   - Triggers email notification via /api/send-email
 *   - Graceful degradation on missing SubscriptionStore
 *   - init() / destroy() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var BANNER_ID = 'cf-payment-retry-banner';
  var STORAGE_KEY = 'cf_payment_retry';
  var EMAIL_API = '/api/send-email';
  var PORTAL_API = '/api/billing-portal';

  // Stripe default retry schedule (days after first failure)
  var RETRY_SCHEDULE_DAYS = [1, 3, 5, 7];

  var SEVERITY = {
    WARNING: 'warning',   // first failure
    URGENT: 'urgent',     // 2+ failures
    CRITICAL: 'critical'  // final attempt
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    initialized: false,
    bannerEl: null,
    countdownInterval: null,
    failedAt: null,
    attemptCount: 0,
    nextRetryDate: null,
    dismissed: false,
    unsubscribe: null
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStore() {
    return window.CortexFreelancer.SubscriptionStore || null;
  }

  function getConfig() {
    return window.CortexFreelancer.StripeConfig || null;
  }

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveCache(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* quota */ }
  }

  function clearCache() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
  }

  function getSeverity(attemptCount) {
    if (attemptCount >= RETRY_SCHEDULE_DAYS.length) return SEVERITY.CRITICAL;
    if (attemptCount >= 2) return SEVERITY.URGENT;
    return SEVERITY.WARNING;
  }

  function computeNextRetry(failedAt, attemptCount) {
    if (!failedAt) return null;
    var idx = Math.min(attemptCount, RETRY_SCHEDULE_DAYS.length - 1);
    var daysUntil = RETRY_SCHEDULE_DAYS[idx];
    var next = new Date(failedAt);
    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  function formatCountdown(targetDate) {
    var now = Date.now();
    var diff = targetDate.getTime() - now;
    if (diff <= 0) return 'Retrying soon…';

    var hours = Math.floor(diff / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);

    if (hours >= 24) {
      var days = Math.floor(hours / 24);
      return days + 'd ' + (hours % 24) + 'h until next retry';
    }
    return hours + 'h ' + mins + 'm until next retry';
  }

  // ─── Banner UI ────────────────────────────────────────────────────

  function createBanner(severity) {
    removeBanner();

    var el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');

    var colors = {
      warning: { bg: '#FFF3CD', border: '#FFC107', text: '#856404', icon: '⚠️' },
      urgent: { bg: '#FFE0B2', border: '#FF9800', text: '#E65100', icon: '🔴' },
      critical: { bg: '#FFCDD2', border: '#F44336', text: '#B71C1C', icon: '🚨' }
    };
    var c = colors[severity] || colors.warning;

    el.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:10000',
      'padding:14px 20px', 'display:flex', 'align-items:center', 'gap:12px',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif', 'font-size:14px',
      'background:' + c.bg, 'border-bottom:2px solid ' + c.border,
      'color:' + c.text, 'box-shadow:0 2px 8px rgba(0,0,0,0.1)',
      'animation:cf-slide-down 0.3s ease-out'
    ].join(';');

    // Icon
    var icon = document.createElement('span');
    icon.textContent = c.icon;
    icon.style.fontSize = '18px';
    el.appendChild(icon);

    // Message
    var msg = document.createElement('span');
    msg.style.flex = '1';
    msg.innerHTML = '<strong>Payment failed.</strong> ';

    var countdownSpan = document.createElement('span');
    countdownSpan.className = 'cf-retry-countdown';
    msg.appendChild(countdownSpan);
    el.appendChild(msg);

    // Update Payment Method button
    var btn = document.createElement('button');
    btn.textContent = 'Update Payment Method';
    btn.style.cssText = [
      'background:' + c.border, 'color:#fff', 'border:none',
      'padding:8px 16px', 'border-radius:6px', 'cursor:pointer',
      'font-size:13px', 'font-weight:600', 'white-space:nowrap',
      'transition:opacity 0.2s'
    ].join(';');
    btn.onmouseover = function () { btn.style.opacity = '0.85'; };
    btn.onmouseout = function () { btn.style.opacity = '1'; };
    btn.onclick = openBillingPortal;
    el.appendChild(btn);

    // Dismiss button
    var dismiss = document.createElement('button');
    dismiss.textContent = '✕';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.style.cssText = [
      'background:none', 'border:none', 'cursor:pointer',
      'font-size:18px', 'color:' + c.text, 'padding:4px', 'opacity:0.6'
    ].join(';');
    dismiss.onmouseover = function () { dismiss.style.opacity = '1'; };
    dismiss.onmouseout = function () { dismiss.style.opacity = '0.6'; };
    dismiss.onclick = dismissBanner;
    el.appendChild(dismiss);

    // Inject animation keyframes
    if (!document.getElementById('cf-payment-retry-styles')) {
      var style = document.createElement('style');
      style.id = 'cf-payment-retry-styles';
      style.textContent = '@keyframes cf-slide-down{from{transform:translateY(-100%)}to{transform:translateY(0)}}';
      document.head.appendChild(style);
    }

    document.body.insertBefore(el, document.body.firstChild);
    state.bannerEl = el;

    return el;
  }

  function removeBanner() {
    if (state.bannerEl && state.bannerEl.parentNode) {
      state.bannerEl.parentNode.removeChild(state.bannerEl);
    }
    state.bannerEl = null;
    stopCountdown();
  }

  function dismissBanner() {
    state.dismissed = true;
    var cache = loadCache();
    cache.dismissed = true;
    cache.dismissedAt = Date.now();
    saveCache(cache);
    removeBanner();
  }

  // ─── Countdown ────────────────────────────────────────────────────

  function startCountdown(nextRetryDate) {
    stopCountdown();
    state.nextRetryDate = nextRetryDate;

    function tick() {
      if (!state.bannerEl) return;
      var span = state.bannerEl.querySelector('.cf-retry-countdown');
      if (span) {
        span.textContent = formatCountdown(nextRetryDate);
      }
    }

    tick();
    state.countdownInterval = setInterval(tick, 60000); // update every minute
  }

  function stopCountdown() {
    if (state.countdownInterval) {
      clearInterval(state.countdownInterval);
      state.countdownInterval = null;
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────

  function openBillingPortal() {
    var portal = window.CortexFreelancer.CustomerPortal;
    if (portal && typeof portal.openPortal === 'function') {
      portal.openPortal();
      return;
    }

    // Fallback: direct API call
    fetch(PORTAL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ return_url: window.location.href })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.url) window.location.href = data.url;
      })
      .catch(function (err) {
        console.error('[PaymentRetry] Portal error:', err);
      });
  }

  function triggerEmailNotification(userEmail, severity) {
    if (!userEmail) return Promise.resolve();

    var subjects = {
      warning: 'Action required: Your payment failed',
      urgent: 'Urgent: Update your payment method',
      critical: 'Final notice: Your subscription will be canceled'
    };

    return fetch(EMAIL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: userEmail,
        template: 'payment_failed',
        subject: subjects[severity] || subjects.warning,
        data: {
          severity: severity,
          attemptCount: state.attemptCount,
          nextRetryDate: state.nextRetryDate ? state.nextRetryDate.toISOString() : null,
          updateUrl: window.location.origin + '/billing'
        }
      })
    }).catch(function (err) {
      console.error('[PaymentRetry] Email notification error:', err);
    });
  }

  // ─── Core Logic ───────────────────────────────────────────────────

  function handleSubscriptionChange(sub) {
    if (!sub) return;

    var isPastDue = sub.status === 'past_due';
    var isUnpaid = sub.status === 'unpaid';
    var isIncomplete = sub.status === 'incomplete';

    if (!isPastDue && !isUnpaid && !isIncomplete) {
      // Payment recovered — clear state
      if (state.bannerEl) {
        removeBanner();
        clearCache();
        state.attemptCount = 0;
        state.failedAt = null;
        state.dismissed = false;
      }
      return;
    }

    // Payment failed state detected
    var cache = loadCache();

    // If dismissed within last 4 hours, don't re-show (unless severity escalated)
    if (cache.dismissed && cache.dismissedAt) {
      var hoursSinceDismiss = (Date.now() - cache.dismissedAt) / 3600000;
      if (hoursSinceDismiss < 4 && state.attemptCount === (cache.attemptCount || 0)) {
        return;
      }
    }

    state.failedAt = sub.failed_at || sub.current_period_start || new Date().toISOString();
    state.attemptCount = cache.attemptCount || 1;

    // Escalate attempt count on each detection
    if (cache.lastDetected && (Date.now() - cache.lastDetected) > 86400000) {
      state.attemptCount++;
    }

    var severity = getSeverity(state.attemptCount);
    var nextRetry = computeNextRetry(new Date(state.failedAt), state.attemptCount);

    // Save updated cache
    saveCache({
      attemptCount: state.attemptCount,
      failedAt: state.failedAt,
      lastDetected: Date.now(),
      dismissed: false
    });

    // Show banner
    state.dismissed = false;
    createBanner(severity);
    if (nextRetry) startCountdown(nextRetry);

    // Trigger email notification (fire-and-forget)
    var userEmail = sub.email || (getStore() && getStore().getUserEmail ? getStore().getUserEmail() : null);
    triggerEmailNotification(userEmail, severity);
  }

  // ─── Webhook Handler ─────────────────────────────────────────────

  function handleWebhookEvent(event) {
    if (!event || !event.type) return;

    if (event.type === 'invoice.payment_failed') {
      var invoice = event.data && event.data.object;
      if (invoice) {
        state.attemptCount = invoice.attempt_count || state.attemptCount + 1;
        state.failedAt = invoice.created ? new Date(invoice.created * 1000).toISOString() : new Date().toISOString();

        var severity = getSeverity(state.attemptCount);
        var nextRetry = computeNextRetry(new Date(state.failedAt), state.attemptCount);

        saveCache({
          attemptCount: state.attemptCount,
          failedAt: state.failedAt,
          lastDetected: Date.now(),
          dismissed: false
        });

        state.dismissed = false;
        createBanner(severity);
        if (nextRetry) startCountdown(nextRetry);
      }
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      removeBanner();
      clearCache();
      state.attemptCount = 0;
      state.failedAt = null;
      state.dismissed = false;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Check cached state on load
    var cache = loadCache();
    if (cache.attemptCount && cache.failedAt) {
      state.attemptCount = cache.attemptCount;
      state.failedAt = cache.failedAt;
    }

    // Listen to SubscriptionStore changes
    var store = getStore();
    if (store && typeof store.onStateChange === 'function') {
      state.unsubscribe = store.onStateChange(function (sub) {
        handleSubscriptionChange(sub);
      });
    }

    // Also check current subscription state immediately
    if (store && typeof store.getSubscription === 'function') {
      var sub = store.getSubscription();
      if (sub) handleSubscriptionChange(sub);
    }

    // Listen for webhook events via custom event
    window.addEventListener('cf:webhook', function (e) {
      handleWebhookEvent(e.detail);
    });

    console.log('[PaymentRetry] Initialized');
  }

  function destroy() {
    removeBanner();
    clearCache();
    if (state.unsubscribe) state.unsubscribe();
    state.initialized = false;
    state.attemptCount = 0;
    state.failedAt = null;
    state.dismissed = false;
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.PaymentRetry = {
    init: init,
    destroy: destroy,
    handleWebhookEvent: handleWebhookEvent,
    getSeverity: getSeverity,
    RETRY_SCHEDULE_DAYS: RETRY_SCHEDULE_DAYS
  };

})();
