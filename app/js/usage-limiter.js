/**
 * Cortex Freelancer — Usage-Based Soft Limits for Free Tier
 * [CF-185] Tracks daily usage, shows warnings at 80%, blocks at 100% with upgrade CTA.
 *
 * Features:
 *   - Track daily usage for proposals generated, AI queries
 *   - Configurable limits per feature
 *   - Warning UI at 80% threshold
 *   - Hard block at 100% with upgrade CTA
 *   - Usage meter/progress bar
 *   - Daily reset at midnight
 *   - init() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_usage_limits';
  var WARNING_THRESHOLD = 0.8; // 80%
  var BLOCK_THRESHOLD = 1.0;   // 100%

  var DAILY_LIMITS = {
    proposals: {
      name: 'Proposals Generated',
      freeLimit: 3,
      proLimit: -1, // unlimited
      icon: '📝',
      upgradeText: 'Send unlimited proposals with Pro'
    },
    ai_queries: {
      name: 'AI Queries',
      freeLimit: 10,
      proLimit: -1,
      icon: '🤖',
      upgradeText: 'Unlimited AI assistance with Pro'
    },
    profile_scores: {
      name: 'Profile Scores',
      freeLimit: 3,
      proLimit: -1,
      icon: '📊',
      upgradeText: 'Unlimited profile scoring with Pro'
    },
    exports: {
      name: 'Data Exports',
      freeLimit: 1,
      proLimit: -1,
      icon: '📤',
      upgradeText: 'Unlimited exports with Pro'
    }
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    usage: {},
    date: null,
    warningContainerId: 'cf-usage-warning',
    eventHandlers: {}
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStore() {
    return window.CortexFreelancer.SubscriptionStore || null;
  }

  function isPro() {
    var store = getStore();
    return store && store.isPro && store.isPro();
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function emit(event, data) {
    var handlers = state.eventHandlers[event] || [];
    handlers.forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[UsageLimiter] handler error:', e); }
    });
  }

  function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadUsage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      // Reset if date changed
      if (data._date !== getTodayKey()) {
        return {};
      }
      return data;
    } catch (e) { return {}; }
  }

  function saveUsage() {
    try {
      var data = Object.assign({}, state.usage, { _date: getTodayKey() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  // ─── Usage Logic ──────────────────────────────────────────────────

  function getUsageCount(featureId) {
    return state.usage[featureId] || 0;
  }

  function getLimit(featureId) {
    if (isPro()) return -1; // unlimited
    var config = DAILY_LIMITS[featureId];
    return config ? config.freeLimit : 0;
  }

  function getUsageRatio(featureId) {
    var limit = getLimit(featureId);
    if (limit === -1) return 0; // unlimited
    if (limit === 0) return 1; // no access
    return getUsageCount(featureId) / limit;
  }

  function getRemainingUses(featureId) {
    var limit = getLimit(featureId);
    if (limit === -1) return Infinity;
    return Math.max(0, limit - getUsageCount(featureId));
  }

  function isAtWarning(featureId) {
    var ratio = getUsageRatio(featureId);
    return ratio >= WARNING_THRESHOLD && ratio < BLOCK_THRESHOLD;
  }

  function isBlocked(featureId) {
    var ratio = getUsageRatio(featureId);
    return ratio >= BLOCK_THRESHOLD;
  }

  /**
   * Track a usage event. Returns true if allowed, false if blocked.
   */
  function trackUsage(featureId) {
    // Pro users are never blocked
    if (isPro()) {
      state.usage[featureId] = (state.usage[featureId] || 0) + 1;
      saveUsage();
      return true;
    }

    var limit = getLimit(featureId);
    if (limit === 0) {
      emit('blocked', { featureId: featureId, reason: 'pro_only' });
      showBlockedUI(featureId);
      return false;
    }

    var current = getUsageCount(featureId);

    if (current >= limit) {
      emit('blocked', { featureId: featureId, reason: 'limit_reached' });
      showBlockedUI(featureId);
      return false;
    }

    state.usage[featureId] = current + 1;
    saveUsage();

    // Check if now at warning threshold
    if (isAtWarning(featureId)) {
      var remaining = getRemainingUses(featureId);
      emit('warning', { featureId: featureId, remaining: remaining });
      showWarningUI(featureId);
    }

    emit('tracked', { featureId: featureId, count: state.usage[featureId] });
    return true;
  }

  /**
   * Check if a feature can be used (peek without tracking).
   */
  function canUse(featureId) {
    if (isPro()) return true;
    var limit = getLimit(featureId);
    if (limit === -1) return true;
    if (limit === 0) return false;
    return getUsageCount(featureId) < limit;
  }

  // ─── UI Rendering ─────────────────────────────────────────────────

  function showWarningUI(featureId) {
    var container = document.getElementById(state.warningContainerId);
    if (!container) return;

    var config = DAILY_LIMITS[featureId];
    if (!config) return;

    var remaining = getRemainingUses(featureId);
    var limit = getLimit(featureId);
    var used = getUsageCount(featureId);
    var pct = Math.round((used / limit) * 100);

    var html = '<div class="cf-ul-warning" data-feature="' + esc(featureId) + '">';
    html += '<div class="cf-ul-warning-header">';
    html += '<span>' + config.icon + '</span> ';
    html += '<span>You\'ve used <strong>' + used + '/' + limit + '</strong> ' + esc(config.name) + ' today</span>';
    html += '<button class="cf-ul-dismiss" data-action="dismiss-warning">&times;</button>';
    html += '</div>';
    html += '<div class="cf-ul-meter">';
    html += '<div class="cf-ul-meter-fill cf-ul-meter--warning" style="width:' + pct + '%"></div>';
    html += '</div>';
    html += '<p class="cf-ul-remaining">' + remaining + ' remaining today. ';
    html += '<a href="/pricing" class="cf-ul-upgrade-link">' + esc(config.upgradeText) + ' →</a></p>';
    html += '</div>';

    container.innerHTML = html;
    bindWarningEvents(container);
  }

  function showBlockedUI(featureId) {
    var container = document.getElementById(state.warningContainerId);
    if (!container) return;

    var config = DAILY_LIMITS[featureId];
    if (!config) return;

    var limit = getLimit(featureId);

    var html = '<div class="cf-ul-blocked" data-feature="' + esc(featureId) + '">';
    html += '<div class="cf-ul-blocked-header">';
    html += '<span>' + config.icon + '</span> ';
    html += '<strong>Daily limit reached</strong>';
    html += '</div>';
    if (limit > 0) {
      html += '<p>You\'ve used all <strong>' + limit + '</strong> ' + esc(config.name) + ' for today.</p>';
    } else {
      html += '<p>' + esc(config.name) + ' is a Pro feature.</p>';
    }
    html += '<p>Limits reset at midnight, or upgrade for unlimited access.</p>';
    html += '<div class="cf-ul-blocked-actions">';
    html += '<a href="/pricing" class="cf-ul-btn cf-ul-btn--primary">Upgrade to Pro</a>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  }

  function renderUsageMeter(featureId, targetId) {
    var container = document.getElementById(targetId);
    if (!container) return;

    if (isPro()) {
      container.innerHTML = '<div class="cf-ul-meter-inline"><span class="cf-ul-pro-badge">Pro — Unlimited</span></div>';
      return;
    }

    var config = DAILY_LIMITS[featureId];
    if (!config) return;

    var limit = getLimit(featureId);
    var used = getUsageCount(featureId);
    var pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
    var meterClass = pct >= 100 ? 'cf-ul-meter--blocked' : (pct >= 80 ? 'cf-ul-meter--warning' : 'cf-ul-meter--ok');

    var html = '<div class="cf-ul-meter-inline">';
    html += '<span class="cf-ul-meter-label">' + used + '/' + limit + ' ' + esc(config.name) + '</span>';
    html += '<div class="cf-ul-meter">';
    html += '<div class="cf-ul-meter-fill ' + meterClass + '" style="width:' + pct + '%"></div>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  }

  function bindWarningEvents(container) {
    var dismissBtn = container.querySelector('[data-action="dismiss-warning"]');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        container.innerHTML = '';
      });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  var UsageLimiter = {
    DAILY_LIMITS: DAILY_LIMITS,
    WARNING_THRESHOLD: WARNING_THRESHOLD,

    init: function (opts) {
      opts = opts || {};
      if (opts.warningContainerId) state.warningContainerId = opts.warningContainerId;

      // Load today's usage
      state.usage = loadUsage();
      state.date = getTodayKey();
    },

    trackUsage: trackUsage,
    canUse: canUse,
    getUsageCount: getUsageCount,
    getLimit: getLimit,
    getRemainingUses: getRemainingUses,
    getUsageRatio: getUsageRatio,
    isAtWarning: isAtWarning,
    isBlocked: isBlocked,
    renderUsageMeter: renderUsageMeter,

    getUsageSummary: function () {
      var summary = {};
      Object.keys(DAILY_LIMITS).forEach(function (id) {
        summary[id] = {
          name: DAILY_LIMITS[id].name,
          used: getUsageCount(id),
          limit: getLimit(id),
          remaining: getRemainingUses(id),
          ratio: getUsageRatio(id),
          warning: isAtWarning(id),
          blocked: isBlocked(id)
        };
      });
      return summary;
    },

    resetUsage: function () {
      state.usage = {};
      saveUsage();
      emit('reset', null);
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
      state.usage = {};
      var container = document.getElementById(state.warningContainerId);
      if (container) container.innerHTML = '';
    }
  };

  window.CortexFreelancer.UsageLimiter = UsageLimiter;
})();
