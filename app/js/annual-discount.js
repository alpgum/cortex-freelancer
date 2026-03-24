/**
 * Cortex Freelancer — Annual Billing Discount Badge
 * [CF-182] Show "Save 35%" badge on annual plan, calculate and display monthly equivalent.
 *
 * Features:
 *   - "Save 35%" badge rendered on annual plan cards
 *   - Monthly equivalent price display ($12.42/mo)
 *   - Savings breakdown (dollar + percent)
 *   - Integrates with StripeConfig and AnnualBilling
 *   - init() / render() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var MONTHLY_PRICE_CENTS = 1900;
  var ANNUAL_PRICE_CENTS = 14900;

  // ─── Helpers ──────────────────────────────────────────────────────

  function getStripeConfig() {
    return window.CortexFreelancer.StripeConfig || null;
  }

  function getAnnualBilling() {
    return window.CortexFreelancer.AnnualBilling || null;
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function getMonthlyPrice() {
    var config = getStripeConfig();
    if (config) {
      var p = config.getPrice('pro_monthly');
      if (p) return p.amount;
    }
    return MONTHLY_PRICE_CENTS;
  }

  function getAnnualPrice() {
    var config = getStripeConfig();
    if (config) {
      var p = config.getPrice('pro_annual');
      if (p) return p.amount;
    }
    return ANNUAL_PRICE_CENTS;
  }

  function formatCents(cents) {
    var config = getStripeConfig();
    if (config && config.formatAmount) return config.formatAmount(cents, 'usd');
    var dollars = (cents / 100).toFixed(2).replace(/\.00$/, '');
    return '$' + dollars;
  }

  // ─── Calculations ─────────────────────────────────────────────────

  function getMonthlyEquivalent() {
    return Math.round(getAnnualPrice() / 12);
  }

  function getAnnualSavings() {
    return (getMonthlyPrice() * 12) - getAnnualPrice();
  }

  function getSavingsPercent() {
    var monthlyTotal = getMonthlyPrice() * 12;
    if (monthlyTotal === 0) return 0;
    return Math.round((getAnnualSavings() / monthlyTotal) * 100);
  }

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    containerId: 'cf-annual-discount',
    eventHandlers: {}
  };

  function emit(event, data) {
    var handlers = state.eventHandlers[event] || [];
    handlers.forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[AnnualDiscount] handler error:', e); }
    });
  }

  // ─── UI Rendering ─────────────────────────────────────────────────

  function renderBadge(container) {
    if (!container) return '';
    var pct = getSavingsPercent();
    if (pct <= 0) return '';

    var badge = document.createElement('span');
    badge.className = 'cf-ad-badge';
    badge.textContent = 'Save ' + pct + '%';
    badge.style.cssText = 'display:inline-block;padding:3px 10px;font-size:12px;font-weight:700;' +
      'color:#059669;background:#d1fae5;border-radius:9999px;margin-left:8px;';
    container.appendChild(badge);
    return badge;
  }

  function renderUI() {
    var container = document.getElementById(state.containerId);
    if (!container) return;

    var pct = getSavingsPercent();
    var monthlyEq = getMonthlyEquivalent();
    var savings = getAnnualSavings();
    var annualPrice = getAnnualPrice();
    var monthlyPrice = getMonthlyPrice();

    var html = '<div class="cf-ad-container">';

    // Monthly option
    html += '<div class="cf-ad-option cf-ad-option--monthly">';
    html += '<div class="cf-ad-option-header">';
    html += '<strong>Monthly</strong>';
    html += '</div>';
    html += '<div class="cf-ad-option-price">';
    html += '<span class="cf-ad-amount">' + esc(formatCents(monthlyPrice)) + '</span>';
    html += '<span class="cf-ad-period">/month</span>';
    html += '</div>';
    html += '</div>';

    // Annual option
    html += '<div class="cf-ad-option cf-ad-option--annual cf-ad-option--recommended">';
    html += '<div class="cf-ad-option-header">';
    html += '<strong>Annual</strong>';
    if (pct > 0) {
      html += ' <span class="cf-ad-badge" style="display:inline-block;padding:3px 10px;font-size:12px;' +
        'font-weight:700;color:#059669;background:#d1fae5;border-radius:9999px;">Save ' + pct + '%</span>';
    }
    html += '</div>';
    html += '<div class="cf-ad-option-price">';
    html += '<span class="cf-ad-amount">' + esc(formatCents(annualPrice)) + '</span>';
    html += '<span class="cf-ad-period">/year</span>';
    html += '</div>';
    html += '<div class="cf-ad-equivalent">';
    html += 'Just <strong>' + esc(formatCents(monthlyEq)) + '/mo</strong>';
    html += ' &mdash; you save <strong>' + esc(formatCents(savings)) + '/year</strong>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Public API ───────────────────────────────────────────────────

  var AnnualDiscount = {
    init: function (opts) {
      opts = opts || {};
      if (opts.containerId) state.containerId = opts.containerId;
      renderUI();
    },

    render: renderUI,

    getSavingsPercent: getSavingsPercent,
    getMonthlyEquivalent: getMonthlyEquivalent,
    getAnnualSavings: getAnnualSavings,

    getSummary: function () {
      return {
        monthlyPrice: formatCents(getMonthlyPrice()),
        annualPrice: formatCents(getAnnualPrice()),
        monthlyEquivalent: formatCents(getMonthlyEquivalent()),
        savingsPerYear: formatCents(getAnnualSavings()),
        savingsPercent: getSavingsPercent()
      };
    },

    renderBadge: renderBadge,

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

  window.CortexFreelancer.AnnualDiscount = AnnualDiscount;
})();
