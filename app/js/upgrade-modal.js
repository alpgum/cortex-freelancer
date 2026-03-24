/**
 * Cortex Freelancer — Upgrade Prompt Modal
 * [CF-178] Side-by-side Free vs Pro comparison modal with upgrade CTA.
 *
 * Features:
 *   - Full-screen modal overlay
 *   - Side-by-side plan comparison
 *   - Feature matrix grouped by category
 *   - Highlights triggering feature
 *   - Stripe checkout integration
 *   - Keyboard dismissible (Escape)
 *   - init()/show()/hide() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var MODAL_ID = 'cf-upgrade-modal';
  var STRIPE_CHECKOUT_URL = '/api/stripe/checkout';

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    visible: false,
    feature: null,
    onUpgrade: null
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getMatrix() {
    return window.CortexFreelancer.PlanMatrix || null;
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function injectStyles() {
    if (document.getElementById('cf-upgrade-modal-styles')) return;
    var s = document.createElement('style');
    s.id = 'cf-upgrade-modal-styles';
    s.textContent = [
      '#' + MODAL_ID + '-overlay {',
      '  position:fixed; top:0; left:0; width:100%; height:100%;',
      '  background:rgba(0,0,0,0.5); z-index:99999;',
      '  display:flex; align-items:center; justify-content:center;',
      '  animation: cfFadeIn 0.2s ease;',
      '}',
      '@keyframes cfFadeIn { from{opacity:0} to{opacity:1} }',
      '#' + MODAL_ID + ' {',
      '  background:#fff; border-radius:16px; max-width:720px; width:90%;',
      '  max-height:85vh; overflow-y:auto; box-shadow:0 25px 50px rgba(0,0,0,0.25);',
      '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      '}',
      '.cfum-header {',
      '  padding:28px 32px 20px; text-align:center; border-bottom:1px solid #f3f4f6;',
      '}',
      '.cfum-header h2 { margin:0 0 6px; font-size:22px; color:#111827; }',
      '.cfum-header p { margin:0; font-size:14px; color:#6b7280; }',
      '.cfum-plans { display:grid; grid-template-columns:1fr 1fr; gap:0; }',
      '.cfum-plan {',
      '  padding:24px; border-bottom:1px solid #f3f4f6;',
      '}',
      '.cfum-plan:nth-child(even) { background:#faf5ff; }',
      '.cfum-plan-title {',
      '  font-size:18px; font-weight:700; margin:0 0 4px;',
      '}',
      '.cfum-plan-price { font-size:28px; font-weight:800; color:#111827; }',
      '.cfum-plan-price span { font-size:14px; font-weight:400; color:#9ca3af; }',
      '.cfum-cat-title {',
      '  grid-column:1/-1; padding:12px 24px 6px;',
      '  font-size:11px; font-weight:700; text-transform:uppercase;',
      '  letter-spacing:0.05em; color:#7c3aed; background:#faf5ff;',
      '}',
      '.cfum-row { display:contents; }',
      '.cfum-cell {',
      '  padding:10px 24px; font-size:13px; color:#374151;',
      '  border-bottom:1px solid #f9fafb; display:flex; align-items:center; gap:6px;',
      '}',
      '.cfum-cell:nth-child(even) { background:#faf5ff; }',
      '.cfum-fname { font-weight:500; }',
      '.cfum-highlight { background:#fef3c7 !important; }',
      '.cfum-check { color:#059669; }',
      '.cfum-x { color:#d1d5db; }',
      '.cfum-footer { padding:24px 32px; text-align:center; }',
      '.cfum-cta {',
      '  display:inline-block; padding:12px 40px; background:#7c3aed; color:#fff;',
      '  border:none; border-radius:8px; font-size:15px; font-weight:600;',
      '  cursor:pointer; transition:background 0.15s;',
      '}',
      '.cfum-cta:hover { background:#6d28d9; }',
      '.cfum-close {',
      '  position:absolute; top:16px; right:16px; background:none; border:none;',
      '  font-size:20px; cursor:pointer; color:#9ca3af; line-height:1;',
      '}',
      '.cfum-close:hover { color:#374151; }',
      '.cfum-skip { display:block; margin-top:12px; font-size:13px; color:#9ca3af; cursor:pointer; background:none; border:none; }',
      '@media(max-width:600px) {',
      '  .cfum-plans { grid-template-columns:1fr; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ─── Build Modal ──────────────────────────────────────────────────

  function buildFeatureRows() {
    var matrix = getMatrix();
    if (!matrix) return '<p style="padding:16px;color:#9ca3af;">Plan matrix not available.</p>';

    var data = matrix.getComparisonData();
    var html = '';

    data.forEach(function (cat) {
      html += '<div class="cfum-cat-title">' + esc(cat.name) + '</div>';
      cat.features.forEach(function (f) {
        var isHL = state.feature && f.id === state.feature;
        var hlClass = isHL ? ' cfum-highlight' : '';
        var checkIcon = '<span class="cfum-check">&#10003;</span>';
        var xIcon = '<span class="cfum-x">&#10007;</span>';

        var freeVal = f.proOnly ? xIcon + ' ' + esc(f.free) : checkIcon + ' ' + esc(f.free);
        var proVal = checkIcon + ' ' + esc(f.pro);

        html += '<div class="cfum-row">';
        html += '<div class="cfum-cell' + hlClass + '"><span class="cfum-fname">' + esc(f.name) + '</span></div>';
        html += '<div class="cfum-cell' + hlClass + '">' + proVal + '</div>';
        html += '</div>';

        // On mobile it becomes single column so also show free
        html += '<!-- free: ' + esc(f.free) + ' -->';
      });
    });

    return html;
  }

  function buildModal() {
    var matrix = getMatrix();
    var pricing = matrix ? matrix.getPricing() : { free: { price: 0 }, pro: { price: 19, period: '/month' } };

    var featureLabel = state.feature ? ' to use <strong>' + esc(state.feature.replace(/_/g, ' ')) + '</strong>' : '';

    var html = [
      '<div id="' + MODAL_ID + '-overlay">',
      '  <div id="' + MODAL_ID + '" style="position:relative;">',
      '    <button class="cfum-close" data-action="close">&times;</button>',
      '    <div class="cfum-header">',
      '      <h2>Upgrade to Pro</h2>',
      '      <p>Unlock all features' + featureLabel + '</p>',
      '    </div>',
      '    <div class="cfum-plans">',
      '      <div class="cfum-plan" style="text-align:center;">',
      '        <p class="cfum-plan-title" style="color:#6b7280;">Free</p>',
      '        <p class="cfum-plan-price">$0</p>',
      '      </div>',
      '      <div class="cfum-plan" style="text-align:center;">',
      '        <p class="cfum-plan-title" style="color:#7c3aed;">Pro</p>',
      '        <p class="cfum-plan-price">$' + pricing.pro.price + '<span>' + (pricing.pro.period || '/month') + '</span></p>',
      '      </div>',
      '    </div>',
      '    <div style="display:grid; grid-template-columns:1fr 1fr;">',
      buildFeatureRows(),
      '    </div>',
      '    <div class="cfum-footer">',
      '      <button class="cfum-cta" data-action="upgrade">Upgrade to Pro</button>',
      '      <button class="cfum-skip" data-action="close">Maybe later</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    return html;
  }

  // ─── Show / Hide ──────────────────────────────────────────────────

  function show(opts) {
    opts = opts || {};
    state.feature = opts.feature || null;
    state.visible = true;

    injectStyles();

    // Remove existing
    var existing = document.getElementById(MODAL_ID + '-overlay');
    if (existing) existing.remove();

    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildModal();
    document.body.appendChild(wrapper.firstElementChild);

    // Event delegation
    var overlay = document.getElementById(MODAL_ID + '-overlay');
    overlay.addEventListener('click', function (e) {
      var action = e.target.getAttribute('data-action');
      if (action === 'close') {
        hide();
      } else if (action === 'upgrade') {
        handleUpgrade();
      } else if (e.target === overlay) {
        hide();
      }
    });

    // Escape key
    document.addEventListener('keydown', onKeydown);
  }

  function hide() {
    state.visible = false;
    var overlay = document.getElementById(MODAL_ID + '-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') hide();
  }

  function handleUpgrade() {
    if (typeof state.onUpgrade === 'function') {
      state.onUpgrade();
      return;
    }

    // Default: redirect to Stripe checkout
    var cta = document.querySelector('.cfum-cta');
    if (cta) {
      cta.textContent = 'Redirecting...';
      cta.disabled = true;
    }

    fetch(STRIPE_CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro' })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.url) {
          window.location.href = data.url;
        }
      })
      .catch(function () {
        if (cta) {
          cta.textContent = 'Upgrade to Pro';
          cta.disabled = false;
        }
      });
  }

  // ─── Public API ───────────────────────────────────────────────────

  var UpgradeModal = {
    init: function (opts) {
      opts = opts || {};
      if (opts.onUpgrade) state.onUpgrade = opts.onUpgrade;
      if (opts.checkoutUrl) STRIPE_CHECKOUT_URL = opts.checkoutUrl;
      injectStyles();
    },

    show: show,
    hide: hide,

    isVisible: function () { return state.visible; }
  };

  window.CortexFreelancer.UpgradeModal = UpgradeModal;
})();
