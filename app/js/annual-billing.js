/**
 * Cortex Freelancer — Annual Billing Discount
 * [CF-182] Shows "Save 35%" badge on annual plan, calculates monthly equivalent.
 *
 * Features:
 *   - Integrates with plan-matrix.js and stripe-config.js
 *   - "Save 35%" badge on annual option
 *   - Monthly equivalent calculation and display
 *   - Toggle between monthly/annual billing
 *   - Savings breakdown
 *   - init() / render() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_billing_interval';
  var MONTHLY_PRICE_CENTS = 1900;  // $19/mo
  var ANNUAL_PRICE_CENTS = 14900;  // $149/yr

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    interval: 'monthly', // 'monthly' | 'annual'
    containerId: 'cf-billing-toggle',
    eventHandlers: {}
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStripeConfig() {
    return window.CortexFreelancer.StripeConfig || null;
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function emit(event, data) {
    var handlers = state.eventHandlers[event] || [];
    handlers.forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[AnnualBilling] handler error:', e); }
    });
  }

  function loadInterval() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'annual' || saved === 'monthly') return saved;
    } catch (e) { /* ignore */ }
    return 'monthly';
  }

  function saveInterval(interval) {
    try {
      localStorage.setItem(STORAGE_KEY, interval);
    } catch (e) { /* ignore */ }
  }

  // ─── Calculations ─────────────────────────────────────────────────

  function getMonthlyPrice() {
    var config = getStripeConfig();
    if (config) {
      var monthly = config.getPrice('pro_monthly');
      if (monthly) return monthly.amount;
    }
    return MONTHLY_PRICE_CENTS;
  }

  function getAnnualPrice() {
    var config = getStripeConfig();
    if (config) {
      var annual = config.getPrice('pro_annual');
      if (annual) return annual.amount;
    }
    return ANNUAL_PRICE_CENTS;
  }

  function getMonthlyEquivalent() {
    return Math.round(getAnnualPrice() / 12);
  }

  function getAnnualSavings() {
    var monthlyTotal = getMonthlyPrice() * 12;
    return monthlyTotal - getAnnualPrice();
  }

  function getSavingsPercent() {
    var monthlyTotal = getMonthlyPrice() * 12;
    if (monthlyTotal === 0) return 0;
    return Math.round((getAnnualSavings() / monthlyTotal) * 100);
  }

  function formatCents(cents) {
    var config = getStripeConfig();
    if (config && config.formatAmount) return config.formatAmount(cents, 'usd');
    return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
  }

  // ─── UI Rendering ─────────────────────────────────────────────────

  function renderUI() {
    var container = document.getElementById(state.containerId);
    if (!container) return;

    var savingsPct = getSavingsPercent();
    var monthlyEq = getMonthlyEquivalent();
    var savings = getAnnualSavings();
    var isAnnual = state.interval === 'annual';

    var html = '<div class="cf-ab-toggle">';

    // Toggle switch
    html += '<div class="cf-ab-switch-row">';
    html += '<span class="cf-ab-label ' + (!isAnnual ? 'cf-ab-label--active' : '') + '">Monthly</span>';
    html += '<button class="cf-ab-switch ' + (isAnnual ? 'cf-ab-switch--on' : '') + '" ';
    html += 'data-action="toggle-interval" role="switch" aria-checked="' + isAnnual + '">';
    html += '<span class="cf-ab-switch-knob"></span>';
    html += '</button>';
    html += '<span class="cf-ab-label ' + (isAnnual ? 'cf-ab-label--active' : '') + '">';
    html += 'Annual';
    if (savingsPct > 0) {
      html += ' <span class="cf-ab-badge">Save ' + savingsPct + '%</span>';
    }
    html += '</span>';
    html += '</div>';

    // Price display
    html += '<div class="cf-ab-price-display">';
    if (isAnnual) {
      html += '<div class="cf-ab-price-main">';
      html += '<span class="cf-ab-price-amount">' + formatCents(getAnnualPrice()) + '</span>';
      html += '<span class="cf-ab-price-period">/year</span>';
      html += '</div>';
      html += '<div class="cf-ab-price-detail">';
      html += 'That\'s just <strong>' + formatCents(monthlyEq) + '/mo</strong>';
      html += ' — save <strong>' + formatCents(savings) + '/year</strong> vs monthly';
      html += '</div>';
    } else {
      html += '<div class="cf-ab-price-main">';
      html += '<span class="cf-ab-price-amount">' + formatCents(getMonthlyPrice()) + '</span>';
      html += '<span class="cf-ab-price-period">/month</span>';
      html += '</div>';
      html += '<div class="cf-ab-price-detail">';
      html += 'Switch to annual and save ' + formatCents(savings) + '/year';
      html += '</div>';
    }
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
    bindEvents(container);
  }

  function bindEvents(container) {
    var toggle = container.querySelector('[data-action="toggle-interval"]');
    if (toggle) {
      toggle.addEventListener('click', function () {
        state.interval = state.interval === 'annual' ? 'monthly' : 'annual';
        saveInterval(state.interval);
        renderUI();
        emit('change', {
          interval: state.interval,
          priceId: state.interval === 'annual' ? 'pro_annual' : 'pro_monthly'
        });
      });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  var AnnualBilling = {
    init: function (opts) {
      opts = opts || {};
      if (opts.containerId) state.containerId = opts.containerId;
      state.interval = loadInterval();
      renderUI();
    },

    render: renderUI,

    getInterval: function () {
      return state.interval;
    },

    setInterval: function (interval) {
      if (interval !== 'monthly' && interval !== 'annual') return;
      state.interval = interval;
      saveInterval(interval);
      renderUI();
      emit('change', {
        interval: state.interval,
        priceId: state.interval === 'annual' ? 'pro_annual' : 'pro_monthly'
      });
    },

    getPriceId: function () {
      return state.interval === 'annual' ? 'pro_annual' : 'pro_monthly';
    },

    getMonthlyEquivalent: getMonthlyEquivalent,
    getAnnualSavings: getAnnualSavings,
    getSavingsPercent: getSavingsPercent,

    isAnnual: function () {
      return state.interval === 'annual';
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
      var container = document.getElementById(state.containerId);
      if (container) container.innerHTML = '';
    }
  };

  window.CortexFreelancer.AnnualBilling = AnnualBilling;
})();
