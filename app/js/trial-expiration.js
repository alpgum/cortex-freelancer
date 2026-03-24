/**
 * Cortex Freelancer — Trial Expiration Flow
 * [CF-184] Countdown during trial, expiration warning UI, 3-day grace period before downgrade.
 *
 * Features:
 *   - Live countdown timer during trial
 *   - Expiration warning UI at configurable threshold
 *   - 3-day grace period after trial ends
 *   - Automatic downgrade after grace period
 *   - Integration with TrialManager and SubscriptionStore
 *   - init() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var GRACE_PERIOD_DAYS = 3;
  var WARNING_THRESHOLD_HOURS = 48; // Show warning when ≤48h left
  var COUNTDOWN_UPDATE_MS = 60000; // Update countdown every minute
  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var MS_PER_HOUR = 60 * 60 * 1000;
  var MS_PER_MINUTE = 60 * 1000;

  var EXPIRATION_STATE = {
    OK: 'ok',
    WARNING: 'warning',
    EXPIRED: 'expired',
    GRACE: 'grace',
    DOWNGRADED: 'downgraded'
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    countdownTimer: null,
    containerId: 'cf-trial-expiration',
    warningContainerId: 'cf-trial-warning',
    currentState: EXPIRATION_STATE.OK,
    eventHandlers: {}
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getTrialManager() {
    return window.CortexFreelancer.TrialManager || null;
  }

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
      try { fn(data); } catch (e) { console.error('[TrialExpiration] handler error:', e); }
    });
  }

  function now() {
    return Date.now();
  }

  // ─── Expiration Logic ─────────────────────────────────────────────

  function getTrialEndMs() {
    var tm = getTrialManager();
    if (!tm) return 0;
    var trial = tm.getTrial();
    return trial ? trial.endMs : 0;
  }

  function getGraceEndMs() {
    var endMs = getTrialEndMs();
    if (!endMs) return 0;
    return endMs + (GRACE_PERIOD_DAYS * MS_PER_DAY);
  }

  function getTimeRemaining() {
    var endMs = getTrialEndMs();
    if (!endMs) return null;

    var remaining = endMs - now();
    if (remaining <= 0) {
      var graceRemaining = getGraceEndMs() - now();
      return {
        total: remaining,
        graceTotal: graceRemaining,
        days: 0,
        hours: 0,
        minutes: 0,
        graceDays: Math.max(0, Math.ceil(graceRemaining / MS_PER_DAY)),
        graceHours: Math.max(0, Math.ceil(graceRemaining / MS_PER_HOUR)),
        expired: true,
        graceExpired: graceRemaining <= 0
      };
    }

    return {
      total: remaining,
      graceTotal: remaining + (GRACE_PERIOD_DAYS * MS_PER_DAY),
      days: Math.floor(remaining / MS_PER_DAY),
      hours: Math.floor((remaining % MS_PER_DAY) / MS_PER_HOUR),
      minutes: Math.floor((remaining % MS_PER_HOUR) / MS_PER_MINUTE),
      expired: false,
      graceExpired: false
    };
  }

  function evaluateState() {
    var tm = getTrialManager();
    if (!tm) return EXPIRATION_STATE.OK;

    var trial = tm.getTrial();
    if (!trial) return EXPIRATION_STATE.OK;

    var status = tm.getStatus();
    if (status === tm.TRIAL_STATUS.CONVERTED) return EXPIRATION_STATE.OK;

    var time = getTimeRemaining();
    if (!time) return EXPIRATION_STATE.OK;

    if (time.graceExpired) {
      return EXPIRATION_STATE.DOWNGRADED;
    }

    if (time.expired) {
      return EXPIRATION_STATE.GRACE;
    }

    if (time.total <= WARNING_THRESHOLD_HOURS * MS_PER_HOUR) {
      return EXPIRATION_STATE.WARNING;
    }

    return EXPIRATION_STATE.OK;
  }

  function handleDowngrade() {
    var store = getStore();
    if (store && store.update) {
      store.update({
        plan: 'free',
        status: 'canceled'
      });
    }
    emit('downgraded', null);
  }

  // ─── Countdown ─────────────────────────────────────────────────────

  function formatCountdown(time) {
    if (!time) return '';
    if (time.expired && !time.graceExpired) {
      return time.graceDays + 'd grace remaining';
    }
    if (time.days > 0) {
      return time.days + 'd ' + time.hours + 'h ' + time.minutes + 'm';
    }
    if (time.hours > 0) {
      return time.hours + 'h ' + time.minutes + 'm';
    }
    return time.minutes + 'm';
  }

  function startCountdown() {
    stopCountdown();
    tick(); // Immediate first tick
    state.countdownTimer = setInterval(tick, COUNTDOWN_UPDATE_MS);
  }

  function stopCountdown() {
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
  }

  function tick() {
    var prevState = state.currentState;
    state.currentState = evaluateState();

    renderCountdown();
    renderWarning();

    if (state.currentState !== prevState) {
      emit('stateChange', { previous: prevState, current: state.currentState });
    }

    if (state.currentState === EXPIRATION_STATE.DOWNGRADED) {
      handleDowngrade();
      stopCountdown();
    }
  }

  // ─── UI Rendering ─────────────────────────────────────────────────

  function renderCountdown() {
    var container = document.getElementById(state.containerId);
    if (!container) return;

    var time = getTimeRemaining();
    var expState = state.currentState;

    if (expState === EXPIRATION_STATE.OK && time && !time.expired) {
      // Show simple countdown
      container.innerHTML = '<div class="cf-te-countdown">' +
        '<span class="cf-te-countdown-label">Trial ends in</span> ' +
        '<span class="cf-te-countdown-time">' + esc(formatCountdown(time)) + '</span>' +
        '</div>';
      return;
    }

    if (expState === EXPIRATION_STATE.WARNING) {
      container.innerHTML = '<div class="cf-te-countdown cf-te-countdown--warning">' +
        '<span class="cf-te-countdown-label">⚡ Trial ending soon:</span> ' +
        '<span class="cf-te-countdown-time">' + esc(formatCountdown(time)) + '</span>' +
        '</div>';
      return;
    }

    if (expState === EXPIRATION_STATE.GRACE) {
      container.innerHTML = '<div class="cf-te-countdown cf-te-countdown--grace">' +
        '<span class="cf-te-countdown-label">⏳ Grace period:</span> ' +
        '<span class="cf-te-countdown-time">' + esc(formatCountdown(time)) + '</span>' +
        '</div>';
      return;
    }

    container.innerHTML = '';
  }

  function renderWarning() {
    var container = document.getElementById(state.warningContainerId);
    if (!container) return;

    var expState = state.currentState;
    var time = getTimeRemaining();
    var html = '';

    if (expState === EXPIRATION_STATE.WARNING) {
      html = '<div class="cf-te-warning cf-te-warning--urgent">';
      html += '<div class="cf-te-warning-header">';
      html += '<span class="cf-te-warning-icon">⚠️</span>';
      html += '<h4>Your trial is ending soon</h4>';
      html += '</div>';
      html += '<p>You have <strong>' + esc(formatCountdown(time)) + '</strong> left on your Pro trial. ';
      html += 'Upgrade now to keep all your Pro features.</p>';
      html += '<div class="cf-te-warning-actions">';
      html += '<a href="/pricing" class="cf-te-btn cf-te-btn--primary">Upgrade to Pro</a>';
      html += '<button class="cf-te-btn cf-te-btn--secondary" data-action="dismiss-warning">Remind me later</button>';
      html += '</div>';
      html += '</div>';
    } else if (expState === EXPIRATION_STATE.GRACE) {
      html = '<div class="cf-te-warning cf-te-warning--grace">';
      html += '<div class="cf-te-warning-header">';
      html += '<span class="cf-te-warning-icon">⏳</span>';
      html += '<h4>Trial expired — Grace period active</h4>';
      html += '</div>';
      html += '<p>Your trial has ended, but you still have <strong>' + (time ? time.graceDays : 0) + ' day(s)</strong> ';
      html += 'of grace period. After that, you\'ll be downgraded to the Free plan.</p>';
      html += '<div class="cf-te-warning-actions">';
      html += '<a href="/pricing" class="cf-te-btn cf-te-btn--primary">Upgrade Now</a>';
      html += '</div>';
      html += '</div>';
    } else if (expState === EXPIRATION_STATE.DOWNGRADED) {
      html = '<div class="cf-te-warning cf-te-warning--downgraded">';
      html += '<div class="cf-te-warning-header">';
      html += '<span class="cf-te-warning-icon">🔒</span>';
      html += '<h4>Downgraded to Free</h4>';
      html += '</div>';
      html += '<p>Your trial and grace period have ended. You\'re now on the Free plan. ';
      html += 'Upgrade anytime to unlock Pro features again.</p>';
      html += '<div class="cf-te-warning-actions">';
      html += '<a href="/pricing" class="cf-te-btn cf-te-btn--primary">Upgrade to Pro</a>';
      html += '</div>';
      html += '</div>';
    }

    container.innerHTML = html;
    bindWarningEvents(container);
  }

  function bindWarningEvents(container) {
    var dismissBtn = container.querySelector('[data-action="dismiss-warning"]');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        var warningEl = container.querySelector('.cf-te-warning');
        if (warningEl) warningEl.style.display = 'none';
        emit('dismissed', null);
      });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  var TrialExpiration = {
    EXPIRATION_STATE: EXPIRATION_STATE,
    GRACE_PERIOD_DAYS: GRACE_PERIOD_DAYS,

    init: function (opts) {
      opts = opts || {};
      if (opts.containerId) state.containerId = opts.containerId;
      if (opts.warningContainerId) state.warningContainerId = opts.warningContainerId;

      state.currentState = evaluateState();

      // Only start countdown if trial exists
      var tm = getTrialManager();
      if (tm && tm.getTrial()) {
        startCountdown();
      }
    },

    getState: function () {
      return state.currentState;
    },

    getTimeRemaining: getTimeRemaining,

    isInGracePeriod: function () {
      return state.currentState === EXPIRATION_STATE.GRACE;
    },

    isDowngraded: function () {
      return state.currentState === EXPIRATION_STATE.DOWNGRADED;
    },

    renderCountdown: renderCountdown,
    renderWarning: renderWarning,

    refresh: function () {
      state.currentState = evaluateState();
      renderCountdown();
      renderWarning();
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
      stopCountdown();
      state.eventHandlers = {};
      state.currentState = EXPIRATION_STATE.OK;
      var c1 = document.getElementById(state.containerId);
      var c2 = document.getElementById(state.warningContainerId);
      if (c1) c1.innerHTML = '';
      if (c2) c2.innerHTML = '';
    }
  };

  window.CortexFreelancer.TrialExpiration = TrialExpiration;
})();
