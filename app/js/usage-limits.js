/**
 * Cortex Freelancer — Usage-Based Soft Limits for Free Tier
 * [CF-185] Track daily usage (proposals generated, AI queries) and show limit warning at 80%.
 *
 * Features:
 *   - Per-day usage tracking with localStorage persistence
 *   - Configurable limits per resource type
 *   - 80% threshold warning notification
 *   - Hard limit enforcement with upgrade prompt
 *   - Auto-resets at midnight (UTC)
 *   - Integration with FeatureGate and SubscriptionStore
 *   - init() / render() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_usage_limits';
  var WARNING_THRESHOLD = 0.8; // 80%

  var DEFAULT_LIMITS = {
    proposals: { max: 5, label: 'Proposals generated', icon: '📝' },
    ai_queries: { max: 10, label: 'AI queries', icon: '🤖' },
    exports: { max: 3, label: 'Exports', icon: '📤' },
    templates: { max: 2, label: 'Template saves', icon: '📋' }
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    limits: {},
    usage: {},
    today: '',
    containerId: 'cf-usage-limits',
    warningContainerId: 'cf-usage-warning',
    eventHandlers: {},
    warningsShown: {}
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStore() {
    return window.CortexFreelancer.SubscriptionStore || null;
  }

  function getFeatureGate() {
    return window.CortexFreelancer.FeatureGate || null;
  }

  function getUpgradeModal() {
    return window.CortexFreelancer.UpgradeModal || null;
  }

  function isPro() {
    var store = getStore();
    return store && store.isPro ? store.isPro() : false;
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function emit(event, data) {
    var handlers = state.eventHandlers[event] || [];
    handlers.forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[UsageLimits] handler error:', e); }
    });
  }

  function getTodayKey() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD in local-ish UTC
  }

  // ─── Persistence ──────────────────────────────────────────────────

  function loadUsage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      // Auto-reset if date has changed
      if (data._date !== getTodayKey()) return {};
      return data;
    } catch (e) { return {}; }
  }

  function saveUsage() {
    try {
      var data = Object.assign({}, state.usage, { _date: state.today });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  // ─── Usage Logic ──────────────────────────────────────────────────

  function getUsage(resource) {
    return state.usage[resource] || 0;
  }

  function getLimit(resource) {
    var limitDef = state.limits[resource];
    return limitDef ? limitDef.max : 0;
  }

  function getUsagePercent(resource) {
    var limit = getLimit(resource);
    if (limit <= 0) return 0;
    return Math.min(1, getUsage(resource) / limit);
  }

  function isAtWarning(resource) {
    return getUsagePercent(resource) >= WARNING_THRESHOLD && getUsagePercent(resource) < 1;
  }

  function isAtLimit(resource) {
    return getUsage(resource) >= getLimit(resource);
  }

  function increment(resource, amount) {
    // Pro users have unlimited usage
    if (isPro()) return { allowed: true, usage: 0, limit: 0 };

    if (!state.limits[resource]) {
      return { allowed: true, usage: 0, limit: 0 };
    }

    amount = amount || 1;
    var current = getUsage(resource);
    var limit = getLimit(resource);

    // Check hard limit
    if (current >= limit) {
      emit('limit_reached', { resource: resource, usage: current, limit: limit });
      showUpgradePrompt(resource);
      return { allowed: false, usage: current, limit: limit };
    }

    // Increment
    state.usage[resource] = current + amount;
    saveUsage();

    var newPercent = getUsagePercent(resource);

    // Check warning threshold
    if (newPercent >= WARNING_THRESHOLD && !state.warningsShown[resource]) {
      state.warningsShown[resource] = true;
      emit('warning', {
        resource: resource,
        usage: state.usage[resource],
        limit: limit,
        percent: Math.round(newPercent * 100)
      });
      renderWarning();
    }

    // Check if just hit limit
    if (state.usage[resource] >= limit) {
      emit('limit_reached', { resource: resource, usage: state.usage[resource], limit: limit });
    }

    renderUI();

    return { allowed: true, usage: state.usage[resource], limit: limit };
  }

  function canUse(resource) {
    if (isPro()) return true;
    if (!state.limits[resource]) return true;
    return getUsage(resource) < getLimit(resource);
  }

  function showUpgradePrompt(resource) {
    var modal = getUpgradeModal();
    var limitDef = state.limits[resource];
    var label = limitDef ? limitDef.label : resource;

    if (modal && modal.show) {
      modal.show({ feature: label + ' (daily limit reached)' });
      return;
    }
    alert('You\'ve reached today\'s limit for ' + label + '. Upgrade to Pro for unlimited access.');
  }

  // ─── UI Rendering ─────────────────────────────────────────────────

  function renderUI() {
    var container = document.getElementById(state.containerId);
    if (!container) return;

    if (isPro()) {
      container.innerHTML = '<div class="cf-ul-pro">' +
        '<span style="color:#059669;font-weight:600;">Pro — Unlimited usage</span></div>';
      return;
    }

    var html = '<div class="cf-ul-container">';
    html += '<h4 class="cf-ul-title">Daily Usage</h4>';

    var resources = Object.keys(state.limits);
    for (var i = 0; i < resources.length; i++) {
      var key = resources[i];
      var def = state.limits[key];
      var used = getUsage(key);
      var max = def.max;
      var pct = getUsagePercent(key);
      var barClass = 'cf-ul-bar-fill';

      if (pct >= 1) {
        barClass += ' cf-ul-bar-fill--limit';
      } else if (pct >= WARNING_THRESHOLD) {
        barClass += ' cf-ul-bar-fill--warning';
      }

      html += '<div class="cf-ul-row">';
      html += '<div class="cf-ul-row-header">';
      html += '<span class="cf-ul-row-label">' + esc(def.icon) + ' ' + esc(def.label) + '</span>';
      html += '<span class="cf-ul-row-count">' + used + ' / ' + max + '</span>';
      html += '</div>';
      html += '<div class="cf-ul-bar">';
      html += '<div class="' + barClass + '" style="width:' + Math.round(pct * 100) + '%"></div>';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function renderWarning() {
    var container = document.getElementById(state.warningContainerId);
    if (!container) return;

    if (isPro()) {
      container.innerHTML = '';
      return;
    }

    // Find resources at or above warning
    var warnings = [];
    var resources = Object.keys(state.limits);
    for (var i = 0; i < resources.length; i++) {
      var key = resources[i];
      var pct = getUsagePercent(key);
      if (pct >= WARNING_THRESHOLD) {
        var def = state.limits[key];
        warnings.push({
          resource: key,
          label: def.label,
          icon: def.icon,
          used: getUsage(key),
          max: def.max,
          percent: Math.round(pct * 100),
          atLimit: pct >= 1
        });
      }
    }

    if (warnings.length === 0) {
      container.innerHTML = '';
      return;
    }

    var html = '<div class="cf-ul-warning">';
    html += '<div class="cf-ul-warning-header">';
    html += '<span>⚠️</span> <strong>Usage limit warning</strong>';
    html += '</div>';
    html += '<ul class="cf-ul-warning-list">';

    for (var j = 0; j < warnings.length; j++) {
      var w = warnings[j];
      if (w.atLimit) {
        html += '<li><strong>' + esc(w.label) + '</strong>: limit reached (' + w.used + '/' + w.max + ')</li>';
      } else {
        html += '<li><strong>' + esc(w.label) + '</strong>: ' + w.percent + '% used (' + w.used + '/' + w.max + ')</li>';
      }
    }

    html += '</ul>';
    html += '<a href="/pricing" class="cf-ul-warning-cta">Upgrade to Pro for unlimited</a>';
    html += '</div>';

    container.innerHTML = html;
  }

  // ─── Public API ───────────────────────────────────────────────────

  var UsageLimits = {
    WARNING_THRESHOLD: WARNING_THRESHOLD,
    DEFAULT_LIMITS: DEFAULT_LIMITS,

    init: function (opts) {
      opts = opts || {};
      if (opts.containerId) state.containerId = opts.containerId;
      if (opts.warningContainerId) state.warningContainerId = opts.warningContainerId;

      // Merge custom limits with defaults
      state.limits = Object.assign({}, DEFAULT_LIMITS, opts.limits || {});

      // Set today and load usage
      state.today = getTodayKey();
      state.usage = loadUsage();
      state.warningsShown = {};

      renderUI();
      renderWarning();
    },

    render: renderUI,
    renderWarning: renderWarning,

    increment: increment,
    canUse: canUse,
    getUsage: getUsage,
    getLimit: getLimit,
    getUsagePercent: getUsagePercent,
    isAtWarning: isAtWarning,
    isAtLimit: isAtLimit,

    getRemainingUses: function (resource) {
      if (isPro()) return Infinity;
      return Math.max(0, getLimit(resource) - getUsage(resource));
    },

    getAllUsage: function () {
      var result = {};
      var resources = Object.keys(state.limits);
      for (var i = 0; i < resources.length; i++) {
        var key = resources[i];
        result[key] = {
          used: getUsage(key),
          max: getLimit(key),
          percent: Math.round(getUsagePercent(key) * 100),
          remaining: Math.max(0, getLimit(key) - getUsage(key)),
          atWarning: isAtWarning(key),
          atLimit: isAtLimit(key)
        };
      }
      return result;
    },

    reset: function (resource) {
      if (resource) {
        state.usage[resource] = 0;
        state.warningsShown[resource] = false;
      } else {
        state.usage = {};
        state.warningsShown = {};
      }
      saveUsage();
      renderUI();
      renderWarning();
      emit('reset', { resource: resource || 'all' });
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
      state.warningsShown = {};
      var c1 = document.getElementById(state.containerId);
      var c2 = document.getElementById(state.warningContainerId);
      if (c1) c1.innerHTML = '';
      if (c2) c2.innerHTML = '';
    }
  };

  window.CortexFreelancer.UsageLimits = UsageLimits;
})();
