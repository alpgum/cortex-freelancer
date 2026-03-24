/**
 * Cortex Freelancer — Trial Manager
 * [CF-183] 7-day Pro trial with status tracking, banner display, and day-5 reminder.
 *
 * Features:
 *   - Start/track 7-day Pro trial
 *   - Persist trial start/end dates
 *   - Trial status banner in dashboard
 *   - Day-5 reminder notification
 *   - Integration with SubscriptionStore
 *   - init() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_trial';
  var TRIAL_DAYS = 7;
  var REMINDER_DAY = 5;
  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  var TRIAL_STATUS = {
    NOT_STARTED: 'not_started',
    ACTIVE: 'active',
    EXPIRING_SOON: 'expiring_soon',
    EXPIRED: 'expired',
    CONVERTED: 'converted'
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    trial: null,
    bannerId: 'cf-trial-banner',
    reminderShown: false,
    eventHandlers: {}
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStore() {
    return window.CortexFreelancer.SubscriptionStore || null;
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function emit(event, data) {
    var handlers = state.eventHandlers[event] || [];
    handlers.forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[TrialManager] handler error:', e); }
    });
  }

  function loadTrial() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveTrial(trial) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trial));
    } catch (e) { /* ignore */ }
  }

  function now() {
    return Date.now();
  }

  // ─── Trial Logic ──────────────────────────────────────────────────

  function createTrial() {
    var startMs = now();
    var endMs = startMs + (TRIAL_DAYS * MS_PER_DAY);

    var trial = {
      startDate: new Date(startMs).toISOString(),
      endDate: new Date(endMs).toISOString(),
      startMs: startMs,
      endMs: endMs,
      status: TRIAL_STATUS.ACTIVE,
      reminderSent: false,
      convertedAt: null
    };

    state.trial = trial;
    saveTrial(trial);

    // Sync with SubscriptionStore
    var store = getStore();
    if (store && store.update) {
      store.update({
        plan: 'pro',
        status: 'trialing',
        period_end: trial.endDate
      });
    }

    emit('started', trial);
    return trial;
  }

  function getTrialStatus() {
    var trial = state.trial;
    if (!trial) return TRIAL_STATUS.NOT_STARTED;

    // Check if converted to paid
    var store = getStore();
    if (store && store.isPro && store.isPro()) {
      var sub = store.getSubscription();
      if (sub && sub.status === 'active') {
        trial.status = TRIAL_STATUS.CONVERTED;
        saveTrial(trial);
        return TRIAL_STATUS.CONVERTED;
      }
    }

    var remaining = trial.endMs - now();

    if (remaining <= 0) {
      trial.status = TRIAL_STATUS.EXPIRED;
      saveTrial(trial);
      return TRIAL_STATUS.EXPIRED;
    }

    var daysLeft = Math.ceil(remaining / MS_PER_DAY);

    if (daysLeft <= (TRIAL_DAYS - REMINDER_DAY)) {
      trial.status = TRIAL_STATUS.EXPIRING_SOON;
      saveTrial(trial);
      return TRIAL_STATUS.EXPIRING_SOON;
    }

    trial.status = TRIAL_STATUS.ACTIVE;
    saveTrial(trial);
    return TRIAL_STATUS.ACTIVE;
  }

  function getDaysRemaining() {
    if (!state.trial) return 0;
    var remaining = state.trial.endMs - now();
    return Math.max(0, Math.ceil(remaining / MS_PER_DAY));
  }

  function getHoursRemaining() {
    if (!state.trial) return 0;
    var remaining = state.trial.endMs - now();
    return Math.max(0, Math.ceil(remaining / (60 * 60 * 1000)));
  }

  function isTrialActive() {
    var status = getTrialStatus();
    return status === TRIAL_STATUS.ACTIVE || status === TRIAL_STATUS.EXPIRING_SOON;
  }

  function checkReminder() {
    if (!state.trial || state.trial.reminderSent) return false;

    var daysLeft = getDaysRemaining();
    if (daysLeft <= (TRIAL_DAYS - REMINDER_DAY)) {
      state.trial.reminderSent = true;
      saveTrial(state.trial);
      emit('reminder', { daysLeft: daysLeft });
      return true;
    }
    return false;
  }

  // ─── UI Rendering ─────────────────────────────────────────────────

  function renderBanner() {
    var container = document.getElementById(state.bannerId);
    if (!container) return;

    var status = getTrialStatus();
    var html = '';

    switch (status) {
      case TRIAL_STATUS.ACTIVE:
        var days = getDaysRemaining();
        html = '<div class="cf-trial-banner cf-trial-banner--active">';
        html += '<span class="cf-trial-icon">🎉</span> ';
        html += '<span class="cf-trial-text">You\'re on a free Pro trial — ';
        html += '<strong>' + days + ' day' + (days !== 1 ? 's' : '') + ' left</strong></span>';
        html += '<a href="/pricing" class="cf-trial-cta">Upgrade Now</a>';
        html += '</div>';
        break;

      case TRIAL_STATUS.EXPIRING_SOON:
        var daysLeft = getDaysRemaining();
        html = '<div class="cf-trial-banner cf-trial-banner--warning">';
        html += '<span class="cf-trial-icon">⚠️</span> ';
        html += '<span class="cf-trial-text">Your Pro trial ends in ';
        html += '<strong>' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + '</strong>';
        html += ' — upgrade to keep all features</span>';
        html += '<a href="/pricing" class="cf-trial-cta cf-trial-cta--urgent">Upgrade Now</a>';
        html += '</div>';
        break;

      case TRIAL_STATUS.EXPIRED:
        html = '<div class="cf-trial-banner cf-trial-banner--expired">';
        html += '<span class="cf-trial-icon">😢</span> ';
        html += '<span class="cf-trial-text">Your Pro trial has ended. ';
        html += 'Upgrade to continue using Pro features.</span>';
        html += '<a href="/pricing" class="cf-trial-cta cf-trial-cta--urgent">Upgrade to Pro</a>';
        html += '</div>';
        break;

      case TRIAL_STATUS.CONVERTED:
        // No banner needed for converted users
        break;

      case TRIAL_STATUS.NOT_STARTED:
      default:
        // No banner for users who haven't started trial
        break;
    }

    container.innerHTML = html;
  }

  // ─── Public API ───────────────────────────────────────────────────

  var TrialManager = {
    TRIAL_STATUS: TRIAL_STATUS,
    TRIAL_DAYS: TRIAL_DAYS,

    init: function (opts) {
      opts = opts || {};
      if (opts.bannerId) state.bannerId = opts.bannerId;

      // Load existing trial
      state.trial = loadTrial();

      // Render banner
      renderBanner();

      // Check if reminder is due
      if (state.trial) {
        checkReminder();
      }
    },

    startTrial: function () {
      if (state.trial && getTrialStatus() !== TRIAL_STATUS.EXPIRED) {
        return state.trial; // Already in trial
      }
      return createTrial();
    },

    getStatus: getTrialStatus,
    getDaysRemaining: getDaysRemaining,
    getHoursRemaining: getHoursRemaining,
    isActive: isTrialActive,
    renderBanner: renderBanner,

    getTrial: function () {
      return state.trial ? Object.assign({}, state.trial) : null;
    },

    markConverted: function () {
      if (!state.trial) return;
      state.trial.status = TRIAL_STATUS.CONVERTED;
      state.trial.convertedAt = new Date().toISOString();
      saveTrial(state.trial);
      renderBanner();
      emit('converted', state.trial);
    },

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
      state.eventHandlers = {};
      state.trial = null;
      var container = document.getElementById(state.bannerId);
      if (container) container.innerHTML = '';
    }
  };

  window.CortexFreelancer.TrialManager = TrialManager;
})();
