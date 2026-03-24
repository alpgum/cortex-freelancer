/**
 * CF-230: Pricing Comparison Table (Free vs Pro)
 * Clear feature comparison with checkmarks/X marks, responsive design,
 * highlighted recommended plan, monthly/annual toggle.
 *
 * @namespace window.CortexFreelancer.PricingComparison
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-pricing-comparison-styles';
  var CONTAINER_CLASS = 'cf-pricing-comparison';

  var PRICING = {
    monthly: { free: 0, pro: 19 },
    annual: { free: 0, pro: 12 }  // per month billed annually
  };

  var ANNUAL_TOTAL = 149;

  var FEATURES = [
    { name: 'Profile Analysis', free: true, pro: true },
    { name: 'Basic Rate Calculator', free: true, pro: true },
    { name: 'Competition Heatmap', free: true, pro: true },
    { name: 'Advanced AI Insights', free: false, pro: true },
    { name: 'Bio Rewriter', free: false, pro: true },
    { name: 'Proposal Generator', free: false, pro: true },
    { name: 'Client Scoring', free: false, pro: true },
    { name: 'Earnings Dashboard', free: false, pro: true },
    { name: 'Priority Support', free: false, pro: true },
    { name: 'Unlimited Analyses', free: false, pro: true }
  ];

  var state = {
    interval: 'monthly',
    containerId: null
  };

  // ─── Helpers ───────────────────────────────────────────

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ─── Styles ────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.' + CONTAINER_CLASS + ' { max-width: 800px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.cf-pricing-toggle { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 32px; }',
      '.cf-pricing-toggle span { font-size: 15px; color: #666; font-weight: 500; }',
      '.cf-pricing-toggle span.active { color: #1a1a2e; font-weight: 700; }',
      '.cf-pricing-switch { position: relative; width: 48px; height: 26px; cursor: pointer; }',
      '.cf-pricing-switch input { opacity: 0; width: 0; height: 0; }',
      '.cf-pricing-switch .slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 26px; transition: background 0.3s; }',
      '.cf-pricing-switch .slider:before { content: ""; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: transform 0.3s; }',
      '.cf-pricing-switch input:checked + .slider { background: #6c63ff; }',
      '.cf-pricing-switch input:checked + .slider:before { transform: translateX(22px); }',
      '.cf-pricing-save-badge { background: #27ae60; color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }',
      '.cf-pricing-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }',
      '.cf-pricing-card { border: 2px solid #e0e0e0; border-radius: 12px; padding: 32px 24px; text-align: center; position: relative; background: #fff; }',
      '.cf-pricing-card.recommended { border-color: #6c63ff; box-shadow: 0 4px 24px rgba(108,99,255,0.15); }',
      '.cf-pricing-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #6c63ff; color: #fff; font-size: 12px; padding: 4px 16px; border-radius: 12px; font-weight: 600; }',
      '.cf-pricing-card h3 { margin: 0 0 8px; font-size: 22px; color: #1a1a2e; }',
      '.cf-pricing-price { font-size: 40px; font-weight: 800; color: #1a1a2e; margin: 16px 0 4px; }',
      '.cf-pricing-price span { font-size: 16px; font-weight: 400; color: #999; }',
      '.cf-pricing-period { color: #999; font-size: 13px; margin-bottom: 24px; }',
      '.cf-pricing-features { list-style: none; padding: 0; margin: 0 0 24px; text-align: left; }',
      '.cf-pricing-features li { padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; display: flex; align-items: center; gap: 8px; }',
      '.cf-pricing-check { color: #27ae60; font-weight: 700; font-size: 16px; }',
      '.cf-pricing-x { color: #ccc; font-weight: 700; font-size: 16px; }',
      '.cf-pricing-cta { display: inline-block; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; cursor: pointer; border: none; }',
      '.cf-pricing-cta-free { background: #f0f0f0; color: #333; }',
      '.cf-pricing-cta-free:hover { background: #e0e0e0; }',
      '.cf-pricing-cta-pro { background: #6c63ff; color: #fff; }',
      '.cf-pricing-cta-pro:hover { background: #5a52d5; }',
      '@media (max-width: 600px) {',
      '  .cf-pricing-cards { grid-template-columns: 1fr; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Render ────────────────────────────────────────────

  function renderCard(plan, price, periodLabel, features, recommended) {
    var badge = recommended ? '<span class="cf-pricing-badge">Recommended</span>' : '';
    var cls = 'cf-pricing-card' + (recommended ? ' recommended' : '');
    var ctaCls = recommended ? 'cf-pricing-cta cf-pricing-cta-pro' : 'cf-pricing-cta cf-pricing-cta-free';
    var ctaText = recommended ? 'Get Pro' : 'Get Started';
    var priceStr = price === 0 ? '$0' : '$' + price;

    var featureRows = '';
    for (var i = 0; i < features.length; i++) {
      var f = features[i];
      var icon = f.included
        ? '<span class="cf-pricing-check">&#10003;</span>'
        : '<span class="cf-pricing-x">&#10005;</span>';
      featureRows += '<li>' + icon + ' ' + esc(f.name) + '</li>';
    }

    return [
      '<div class="' + cls + '">',
      badge,
      '<h3>' + esc(plan) + '</h3>',
      '<div class="cf-pricing-price">' + priceStr + '<span>/mo</span></div>',
      '<div class="cf-pricing-period">' + esc(periodLabel) + '</div>',
      '<ul class="cf-pricing-features">' + featureRows + '</ul>',
      '<button class="' + ctaCls + '" data-cta="primary" data-plan="' + plan.toLowerCase() + '">' + ctaText + '</button>',
      '</div>'
    ].join('');
  }

  function render() {
    var container = document.getElementById(state.containerId);
    if (!container) return;
    injectStyles();

    var isAnnual = state.interval === 'annual';
    var prices = isAnnual ? PRICING.annual : PRICING.monthly;
    var freePeriod = 'Free forever';
    var proPeriod = isAnnual ? 'Billed $' + ANNUAL_TOTAL + '/year' : 'Billed monthly';

    var freeFeatures = FEATURES.map(function (f) { return { name: f.name, included: f.free }; });
    var proFeatures = FEATURES.map(function (f) { return { name: f.name, included: f.pro }; });

    var saveBadge = isAnnual ? '' : '<span class="cf-pricing-save-badge">Save 35%</span>';

    container.innerHTML = [
      '<div class="' + CONTAINER_CLASS + '">',
      '  <div class="cf-pricing-toggle">',
      '    <span class="' + (!isAnnual ? 'active' : '') + '">Monthly</span>',
      '    <label class="cf-pricing-switch">',
      '      <input type="checkbox" ' + (isAnnual ? 'checked' : '') + ' />',
      '      <span class="slider"></span>',
      '    </label>',
      '    <span class="' + (isAnnual ? 'active' : '') + '">Annual</span>',
      '    ' + (isAnnual ? '<span class="cf-pricing-save-badge">Save 35%</span>' : ''),
      '  </div>',
      '  <div class="cf-pricing-cards">',
      renderCard('Free', prices.free, freePeriod, freeFeatures, false),
      renderCard('Pro', prices.pro, proPeriod, proFeatures, true),
      '  </div>',
      '</div>'
    ].join('\n');

    // Toggle handler
    var toggle = container.querySelector('.cf-pricing-switch input');
    if (toggle) {
      toggle.addEventListener('change', function () {
        state.interval = toggle.checked ? 'annual' : 'monthly';
        render();
      });
    }
  }

  // ─── Public API ────────────────────────────────────────

  function init(containerId) {
    state.containerId = containerId || 'cf-pricing-comparison';
    render();
  }

  function setInterval(interval) {
    if (interval === 'monthly' || interval === 'annual') {
      state.interval = interval;
      render();
    }
  }

  window.CortexFreelancer.PricingComparison = {
    init: init,
    render: render,
    setInterval: setInterval,
    FEATURES: FEATURES,
    PRICING: PRICING
  };
})();
