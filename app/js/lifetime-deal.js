/**
 * [CF-195] Lifetime Deal for Early Adopters
 * One-time payment product ($299 lifetime) available for first 100 customers.
 * Show countdown of remaining spots and urgency messaging.
 * Exposed as window.CortexFreelancer.LifetimeDeal
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var API_ENDPOINT = '/api/lifetime-deal';
  var CHECKOUT_ENDPOINT = '/api/checkout';
  var STORAGE_KEY = 'cortex_lifetime_deal';

  var DEAL_CONFIG = {
    price_cents: 29900,
    currency: 'USD',
    total_spots: 100,
    product_name: 'Cortex Freelancer — Lifetime Pro',
    tagline: 'Pay once. Use forever.',
    features: [
      'All Pro features — forever',
      'No monthly or annual fees',
      'All future updates included',
      'Priority support for life',
      'Early adopter badge on profile'
    ]
  };

  /* ══════════════════════════════════════════════
   * HELPERS
   * ══════════════════════════════════════════════ */
  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function formatPrice(cents, currency) {
    currency = (currency || 'USD').toUpperCase();
    var symbols = { USD: '$', EUR: '€', GBP: '£' };
    var symbol = symbols[currency] || currency + ' ';
    return symbol + (cents / 100).toFixed(0);
  }

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (_) { return {}; }
  }

  function saveCache(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * SPOTS REMAINING
   * ══════════════════════════════════════════════ */
  function fetchSpotsRemaining() {
    var cached = loadCache();
    // Cache for 60 seconds to avoid hammering
    if (cached.spots_remaining !== undefined && cached.fetched_at) {
      var age = Date.now() - cached.fetched_at;
      if (age < 60000) {
        return Promise.resolve({
          remaining: cached.spots_remaining,
          total: DEAL_CONFIG.total_spots,
          available: cached.spots_remaining > 0,
          cached: true
        });
      }
    }

    return fetch(API_ENDPOINT + '/status')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch deal status');
        return res.json();
      })
      .then(function (data) {
        var remaining = typeof data.spots_remaining === 'number' ? data.spots_remaining : DEAL_CONFIG.total_spots;
        saveCache({ spots_remaining: remaining, fetched_at: Date.now() });
        return {
          remaining: remaining,
          total: DEAL_CONFIG.total_spots,
          available: remaining > 0,
          cached: false
        };
      })
      .catch(function () {
        // Fallback: show as available if we can't reach API
        return { remaining: null, total: DEAL_CONFIG.total_spots, available: true, cached: false };
      });
  }

  /* ══════════════════════════════════════════════
   * URGENCY MESSAGING
   * ══════════════════════════════════════════════ */
  function getUrgencyLevel(remaining) {
    if (remaining === null) return { level: 'unknown', message: 'Limited spots available', className: 'cf-urgency-low' };
    if (remaining <= 0) return { level: 'sold_out', message: 'All spots taken!', className: 'cf-urgency-gone' };
    if (remaining <= 5) return { level: 'critical', message: 'Only ' + remaining + ' spot' + (remaining === 1 ? '' : 's') + ' left!', className: 'cf-urgency-critical' };
    if (remaining <= 15) return { level: 'high', message: remaining + ' spots remaining — going fast', className: 'cf-urgency-high' };
    if (remaining <= 40) return { level: 'medium', message: remaining + ' of ' + DEAL_CONFIG.total_spots + ' spots left', className: 'cf-urgency-medium' };
    return { level: 'low', message: remaining + ' of ' + DEAL_CONFIG.total_spots + ' spots available', className: 'cf-urgency-low' };
  }

  /* ══════════════════════════════════════════════
   * PURCHASE FLOW
   * ══════════════════════════════════════════════ */
  function purchaseLifetimeDeal(opts) {
    opts = opts || {};
    if (!opts.email) return Promise.resolve({ success: false, error: 'Email required' });

    return fetch(CHECKOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: opts.email,
        uid: opts.uid || '',
        plan: 'lifetime',
        price_id: 'price_lifetime_299',
        mode: 'payment', // one-time, not subscription
        success_url: window.location.origin + '/welcome-lifetime',
        cancel_url: window.location.origin + '/pricing'
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('Checkout creation failed: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      if (data.url) {
        window.location.href = data.url;
        return { success: true, redirecting: true };
      }
      return { success: true, data: data };
    })
    .catch(function (err) {
      return { success: false, error: err.message };
    });
  }

  /* ══════════════════════════════════════════════
   * RENDER: LIFETIME DEAL CARD
   * ══════════════════════════════════════════════ */
  function renderDealCard(container, opts) {
    opts = opts || {};
    var onPurchase = opts.onPurchase || function () {};

    fetchSpotsRemaining().then(function (status) {
      var urgency = getUrgencyLevel(status.remaining);
      var soldOut = urgency.level === 'sold_out';
      var pct = status.remaining !== null ? Math.round(((DEAL_CONFIG.total_spots - status.remaining) / DEAL_CONFIG.total_spots) * 100) : 0;

      var html = '<div class="cf-ltd-card">';

      // Badge
      html += '<div class="cf-ltd-badge">🚀 Early Adopter Deal</div>';

      // Header
      html += '<div class="cf-ltd-header">';
      html += '<h2>' + escHtml(DEAL_CONFIG.product_name) + '</h2>';
      html += '<p class="cf-ltd-tagline">' + escHtml(DEAL_CONFIG.tagline) + '</p>';
      html += '</div>';

      // Price
      html += '<div class="cf-ltd-price">';
      html += '<span class="cf-ltd-amount">' + formatPrice(DEAL_CONFIG.price_cents, DEAL_CONFIG.currency) + '</span>';
      html += '<span class="cf-ltd-once">one-time payment</span>';
      html += '<p class="cf-ltd-compare">vs. $19/mo ($228/yr) on Pro plan</p>';
      html += '</div>';

      // Features
      html += '<ul class="cf-ltd-features">';
      DEAL_CONFIG.features.forEach(function (f) {
        html += '<li>✓ ' + escHtml(f) + '</li>';
      });
      html += '</ul>';

      // Progress bar
      html += '<div class="cf-ltd-progress">';
      html += '<div class="cf-ltd-bar"><div class="cf-ltd-bar-fill" style="width:' + pct + '%"></div></div>';
      html += '<div class="cf-ltd-urgency ' + urgency.className + '">' + escHtml(urgency.message) + '</div>';
      html += '</div>';

      // CTA
      if (soldOut) {
        html += '<button class="cf-btn cf-btn-disabled" disabled>Sold Out</button>';
        html += '<p class="cf-ltd-waitlist">Join the waitlist for future deals</p>';
      } else {
        html += '<button class="cf-btn cf-btn-primary cf-ltd-buy" id="cf-ltd-buy">Get Lifetime Access</button>';
      }

      html += '</div>';

      container.innerHTML = html;

      if (!soldOut) {
        var buyBtn = document.getElementById('cf-ltd-buy');
        if (buyBtn) {
          buyBtn.addEventListener('click', function () {
            buyBtn.disabled = true;
            buyBtn.textContent = 'Redirecting…';
            onPurchase();
          });
        }
      }
    });
  }

  /* ══════════════════════════════════════════════
   * RENDER: URGENCY BANNER (inline)
   * ══════════════════════════════════════════════ */
  function renderUrgencyBanner(container) {
    fetchSpotsRemaining().then(function (status) {
      if (!status.available || status.remaining === null) {
        container.innerHTML = '';
        return;
      }
      var urgency = getUrgencyLevel(status.remaining);
      if (urgency.level === 'low' || urgency.level === 'sold_out') {
        container.innerHTML = '';
        return;
      }

      var html = '<div class="cf-ltd-banner ' + urgency.className + '">';
      html += '<span>🔥 Lifetime Deal: ' + escHtml(urgency.message) + '</span>';
      html += '<a href="#/lifetime" class="cf-ltd-banner-link">Claim yours →</a>';
      html += '</div>';
      container.innerHTML = html;
    });
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.LifetimeDeal = {
    DEAL_CONFIG: DEAL_CONFIG,
    fetchSpotsRemaining: fetchSpotsRemaining,
    getUrgencyLevel: getUrgencyLevel,
    purchaseLifetimeDeal: purchaseLifetimeDeal,
    renderDealCard: renderDealCard,
    renderUrgencyBanner: renderUrgencyBanner
  };
})();
