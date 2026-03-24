/**
 * [CF-196] Checkout Abandonment Recovery
 * Track incomplete checkouts in localStorage, trigger follow-up reminder
 * after 1 hour, show "Complete your upgrade" banner on return.
 * Exposed as window.CortexFreelancer.CheckoutRecovery
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_checkout_abandoned';
  var DISMISSED_KEY = 'cortex_checkout_dismissed';
  var REMINDER_DELAY_MS = 60 * 60 * 1000; // 1 hour
  var BANNER_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  var CHECK_INTERVAL_MS = 30 * 1000; // 30s poll

  var _reminderTimer = null;
  var _checkTimer = null;

  /* ══════════════════════════════════════════════
   * HELPERS
   * ══════════════════════════════════════════════ */
  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function loadAbandoned() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch (_) { return null; }
  }

  function saveAbandoned(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function clearAbandoned() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function isDismissed() {
    try {
      var ts = localStorage.getItem(DISMISSED_KEY);
      if (!ts) return false;
      return (Date.now() - parseInt(ts, 10)) < BANNER_EXPIRY_MS;
    } catch (_) { return false; }
  }

  function setDismissed() {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * TRACK CHECKOUT START
   * ══════════════════════════════════════════════ */
  function trackCheckoutStarted(opts) {
    opts = opts || {};
    var data = {
      plan: opts.plan || 'pro_monthly',
      email: opts.email || '',
      started_at: new Date().toISOString(),
      started_ts: Date.now(),
      price_label: opts.price_label || '',
      completed: false
    };
    saveAbandoned(data);

    // Set reminder timer
    _scheduleReminder(data);

    return data;
  }

  /* ══════════════════════════════════════════════
   * MARK COMPLETED
   * ══════════════════════════════════════════════ */
  function trackCheckoutCompleted() {
    clearAbandoned();
    _clearTimers();
    removeBanner();
  }

  /* ══════════════════════════════════════════════
   * REMINDER SCHEDULING
   * ══════════════════════════════════════════════ */
  function _scheduleReminder(data) {
    _clearTimers();

    var elapsed = Date.now() - data.started_ts;
    var remaining = REMINDER_DELAY_MS - elapsed;

    if (remaining <= 0) {
      // Already past 1 hour
      _triggerReminder(data);
    } else {
      _reminderTimer = setTimeout(function () {
        _triggerReminder(data);
      }, remaining);
    }
  }

  function _triggerReminder(data) {
    if (isDismissed()) return;

    var existing = loadAbandoned();
    if (!existing || existing.completed) return;

    // Show banner
    showRecoveryBanner({
      plan: data.plan,
      price_label: data.price_label
    });

    // Dispatch custom event for other modules to hook into
    try {
      window.dispatchEvent(new CustomEvent('cortex:checkout_abandoned', {
        detail: {
          plan: data.plan,
          email: data.email,
          abandoned_at: new Date().toISOString(),
          started_at: data.started_at
        }
      }));
    } catch (_) {}
  }

  function _clearTimers() {
    if (_reminderTimer) { clearTimeout(_reminderTimer); _reminderTimer = null; }
    if (_checkTimer) { clearInterval(_checkTimer); _checkTimer = null; }
  }

  /* ══════════════════════════════════════════════
   * RECOVERY BANNER
   * ══════════════════════════════════════════════ */
  function showRecoveryBanner(opts) {
    opts = opts || {};
    if (isDismissed()) return;

    // Remove existing banner
    removeBanner();

    var plan = opts.plan || 'pro_monthly';
    var priceLabel = opts.price_label || (plan === 'pro_annual' ? '$15/mo (billed annually)' : '$19/mo');

    var banner = document.createElement('div');
    banner.id = 'cf-checkout-recovery-banner';
    banner.className = 'cf-recovery-banner';
    banner.innerHTML =
      '<div class="cf-recovery-content">' +
        '<span class="cf-recovery-icon">⚡</span>' +
        '<div class="cf-recovery-text">' +
          '<strong>Complete your upgrade</strong>' +
          '<span>You were upgrading to Pro (' + escHtml(priceLabel) + '). Pick up where you left off.</span>' +
        '</div>' +
        '<div class="cf-recovery-actions">' +
          '<button class="cf-btn cf-btn-primary cf-recovery-continue" id="cf-recovery-continue">Continue Checkout</button>' +
          '<button class="cf-btn cf-btn-ghost cf-recovery-dismiss" id="cf-recovery-dismiss">✕</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(function () {
      banner.classList.add('cf-recovery-visible');
    });

    var continueBtn = document.getElementById('cf-recovery-continue');
    var dismissBtn = document.getElementById('cf-recovery-dismiss');

    if (continueBtn) {
      continueBtn.addEventListener('click', function () {
        removeBanner();
        window.location.hash = '#/checkout?plan=' + encodeURIComponent(plan) + '&recovery=1';
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        setDismissed();
        removeBanner();
      });
    }
  }

  function removeBanner() {
    var el = document.getElementById('cf-checkout-recovery-banner');
    if (el && el.parentNode) {
      el.classList.remove('cf-recovery-visible');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }
  }

  /* ══════════════════════════════════════════════
   * INIT — check on page load
   * ══════════════════════════════════════════════ */
  function init() {
    var abandoned = loadAbandoned();
    if (!abandoned || abandoned.completed) return;

    var age = Date.now() - abandoned.started_ts;

    // Expired after 7 days
    if (age > BANNER_EXPIRY_MS) {
      clearAbandoned();
      return;
    }

    // Past the reminder threshold
    if (age >= REMINDER_DELAY_MS) {
      _triggerReminder(abandoned);
    } else {
      _scheduleReminder(abandoned);
    }
  }

  /* ══════════════════════════════════════════════
   * ANALYTICS
   * ══════════════════════════════════════════════ */
  function getAbandonmentStats() {
    var abandoned = loadAbandoned();
    if (!abandoned) return null;

    return {
      plan: abandoned.plan,
      started_at: abandoned.started_at,
      hours_ago: Math.round((Date.now() - abandoned.started_ts) / 3600000 * 10) / 10,
      is_dismissed: isDismissed(),
      completed: abandoned.completed || false
    };
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.CheckoutRecovery = {
    init: init,
    trackCheckoutStarted: trackCheckoutStarted,
    trackCheckoutCompleted: trackCheckoutCompleted,
    showRecoveryBanner: showRecoveryBanner,
    removeBanner: removeBanner,
    getAbandonmentStats: getAbandonmentStats,
    REMINDER_DELAY_MS: REMINDER_DELAY_MS
  };

  // Auto-init on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
