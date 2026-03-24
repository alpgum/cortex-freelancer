/**
 * CF-234: Trust Badges — Security, Money-Back Guarantee
 *
 * Displays trust indicators: SSL secured, Stripe payments,
 * 30-day money-back guarantee. Renders badge row with icons and tooltips.
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  var BADGES = [
    {
      id: 'ssl-secured',
      icon: '🔒',
      label: 'SSL Secured',
      tooltip: 'All data is encrypted with 256-bit SSL/TLS encryption'
    },
    {
      id: 'stripe-payments',
      icon: '💳',
      label: 'Stripe Payments',
      tooltip: 'Payments processed securely by Stripe — PCI DSS Level 1 compliant'
    },
    {
      id: 'money-back',
      icon: '✅',
      label: '30-Day Money-Back',
      tooltip: 'Not satisfied? Get a full refund within 30 days, no questions asked'
    },
    {
      id: 'data-privacy',
      icon: '🛡️',
      label: 'Data Privacy',
      tooltip: 'Your data is never sold or shared with third parties'
    },
    {
      id: 'uptime',
      icon: '⚡',
      label: '99.9% Uptime',
      tooltip: 'Enterprise-grade infrastructure with 99.9% uptime SLA'
    }
  ];

  var CSS = '\n\
    .cf-trust-badges { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; padding: 24px 0; }\n\
    .cf-trust-badge { display: flex; align-items: center; gap: 8px; padding: 10px 16px;\n\
      background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px;\n\
      font-size: 14px; color: #495057; position: relative; cursor: default;\n\
      transition: box-shadow 0.2s, border-color 0.2s; }\n\
    .cf-trust-badge:hover { border-color: #4f46e5; box-shadow: 0 2px 8px rgba(79,70,229,0.1); }\n\
    .cf-trust-badge__icon { font-size: 20px; flex-shrink: 0; }\n\
    .cf-trust-badge__label { font-weight: 600; white-space: nowrap; }\n\
    .cf-trust-badge__tooltip { position: absolute; bottom: calc(100% + 8px); left: 50%;\n\
      transform: translateX(-50%); background: #1e1e2e; color: #fff; padding: 8px 12px;\n\
      border-radius: 6px; font-size: 12px; font-weight: 400; white-space: nowrap;\n\
      opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 10; }\n\
    .cf-trust-badge__tooltip::after { content: ""; position: absolute; top: 100%; left: 50%;\n\
      transform: translateX(-50%); border: 5px solid transparent; border-top-color: #1e1e2e; }\n\
    .cf-trust-badge:hover .cf-trust-badge__tooltip { opacity: 1; }\n\
  ';

  function injectStyles() {
    if (document.getElementById('cf-trust-badges-css')) return;
    var style = document.createElement('style');
    style.id = 'cf-trust-badges-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function createBadgeEl(badge) {
    var el = document.createElement('div');
    el.className = 'cf-trust-badge';
    el.setAttribute('data-badge', badge.id);
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', badge.label + ': ' + badge.tooltip);

    el.innerHTML =
      '<span class="cf-trust-badge__icon" aria-hidden="true">' + badge.icon + '</span>' +
      '<span class="cf-trust-badge__label">' + badge.label + '</span>' +
      '<span class="cf-trust-badge__tooltip" role="tooltip">' + badge.tooltip + '</span>';

    return el;
  }

  /**
   * Render trust badges into a container.
   * @param {string|HTMLElement} target - CSS selector or DOM element
   * @param {Object} [options]
   * @param {string[]} [options.only] - Show only these badge IDs
   * @param {string[]} [options.exclude] - Exclude these badge IDs
   */
  function render(target, options) {
    injectStyles();
    options = options || {};

    var container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) {
      console.warn('[TrustBadges] Target container not found:', target);
      return null;
    }

    var row = document.createElement('div');
    row.className = 'cf-trust-badges';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Trust and security badges');

    var badges = BADGES.filter(function (b) {
      if (options.only && options.only.indexOf(b.id) === -1) return false;
      if (options.exclude && options.exclude.indexOf(b.id) !== -1) return false;
      return true;
    });

    badges.forEach(function (badge) {
      row.appendChild(createBadgeEl(badge));
    });

    container.appendChild(row);
    return row;
  }

  /** Return available badge definitions */
  function getBadges() {
    return BADGES.map(function (b) { return Object.assign({}, b); });
  }

  // ── Public API ──────────────────────────────────────────────────────
  window.CortexFreelancer.TrustBadges = {
    render: render,
    getBadges: getBadges
  };
})();
