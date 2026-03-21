/**
 * Checkout Abandonment Tracking & Recovery
 * Tracks when users start but don't complete checkout,
 * shows a "Still thinking?" banner with discount on next visit.
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'cortex_checkout_abandoned';
  var DISMISSED_KEY = 'cortex_recovery_dismissed';
  var DISCOUNT_CODE = 'COMEBACK10';
  var BANNER_DELAY_MS = 2000;

  // Track checkout start
  function trackCheckoutStart(plan) {
    try {
      var data = {
        plan: plan,
        startedAt: new Date().toISOString(),
        page: window.location.pathname
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  // Clear abandonment on successful checkout
  function clearAbandonment() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DISMISSED_KEY);
    } catch (e) { /* storage unavailable */ }
  }

  // Check if user abandoned checkout
  function getAbandonment() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      var started = new Date(data.startedAt);
      var now = new Date();
      var hoursSince = (now - started) / (1000 * 60 * 60);
      // Only show if abandoned between 1 hour and 30 days ago
      if (hoursSince < 1 || hoursSince > 720) return null;
      return data;
    } catch (e) { return null; }
  }

  // Show recovery banner
  function showRecoveryBanner(abandonment) {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    var banner = document.createElement('div');
    banner.id = 'checkout-recovery-banner';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:150;background:linear-gradient(135deg,#1a1a1a,#111);border-top:1px solid rgba(255,136,68,.3);padding:1rem 2rem;display:flex;align-items:center;justify-content:center;gap:1rem;flex-wrap:wrap;animation:slideUp .4s ease;box-shadow:0 -4px 20px rgba(0,0,0,.5)';

    var style = document.createElement('style');
    style.textContent = '@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}';
    document.head.appendChild(style);

    var text = document.createElement('span');
    text.style.cssText = 'color:#f0f0f0;font-size:.95rem;font-weight:500';
    text.textContent = 'Still thinking? Use code ';

    var code = document.createElement('strong');
    code.style.cssText = 'color:#ff8844;font-weight:800';
    code.textContent = DISCOUNT_CODE;

    var suffix = document.createTextNode(' for 10% off Pro.');
    text.appendChild(code);
    text.appendChild(suffix);

    var ctaBtn = document.createElement('a');
    ctaBtn.href = '/pricing';
    ctaBtn.style.cssText = 'background:linear-gradient(135deg,#ff8844,#ff6622);color:#000;padding:.55rem 1.4rem;border-radius:100px;font-weight:700;font-size:.85rem;text-decoration:none;white-space:nowrap;transition:all .2s';
    ctaBtn.textContent = 'Claim Discount \u2192';
    ctaBtn.addEventListener('click', function() {
      try { localStorage.setItem('cortex_coupon', DISCOUNT_CODE); } catch (e) {}
    });

    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:#666;font-size:1.2rem;cursor:pointer;padding:.25rem;line-height:1;margin-left:.5rem';
    closeBtn.textContent = '\u00d7';
    closeBtn.setAttribute('aria-label', 'Dismiss banner');
    closeBtn.addEventListener('click', function() {
      banner.remove();
      try { localStorage.setItem(DISMISSED_KEY, '1'); } catch (e) {}
    });

    banner.appendChild(text);
    banner.appendChild(ctaBtn);
    banner.appendChild(closeBtn);
    document.body.appendChild(banner);
  }

  // Hook into checkout flow
  var origPush = window.dataLayer && window.dataLayer.push;
  if (window.dataLayer) {
    var origPushFn = Array.prototype.push;
    window.dataLayer.push = function() {
      var args = arguments;
      for (var i = 0; i < args.length; i++) {
        if (args[i] && args[i].event === 'checkout_started' && args[i].plan_type) {
          trackCheckoutStart(args[i].plan_type);
        }
      }
      return origPushFn.apply(window.dataLayer, args);
    };
  }

  // Clear on checkout success page
  if (window.location.pathname.indexOf('checkout-success') !== -1) {
    clearAbandonment();
    return;
  }

  // Show banner on next visit if checkout was abandoned
  var abandonment = getAbandonment();
  if (abandonment) {
    // Don't show on checkout pages
    if (window.location.pathname.indexOf('checkout') !== -1) return;

    setTimeout(function() {
      showRecoveryBanner(abandonment);
    }, BANNER_DELAY_MS);
  }
})();
