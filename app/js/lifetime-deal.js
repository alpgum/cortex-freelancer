/**
 * CF-195: Lifetime Deal for Early Adopters
 * One-time $299 payment for first 100 customers with counter, urgency, and comparison.
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var MAX_SLOTS = 100;
  var STORAGE_KEY = 'cortex_lifetime_deal_cache';
  var CACHE_TTL_MS = 60000; // 1 minute cache

  /**
   * Fetch current lifetime deal availability from server
   * @returns {Promise<Object>} { sold, remaining, available }
   */
  var fetchAvailability = function () {
    // Check cache first
    try {
      var cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
          return Promise.resolve(parsed.data);
        }
      }
    } catch (e) { /* noop */ }

    return fetch('/api/lifetime-deal/availability').then(function (res) {
      if (!res.ok) throw new Error('Failed to fetch lifetime deal availability');
      return res.json();
    }).then(function (data) {
      var result = {
        sold: data.sold || 0,
        remaining: Math.max(0, MAX_SLOTS - (data.sold || 0)),
        available: (data.sold || 0) < MAX_SLOTS
      };
      // Cache the result
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          fetchedAt: Date.now(),
          data: result
        }));
      } catch (e) { /* noop */ }
      return result;
    });
  };

  /**
   * Build comparison data: lifetime vs monthly cost over time
   * @returns {Object} comparison breakdown
   */
  var buildComparison = function () {
    var products = window.CortexFreelancer.StripeProducts;
    var monthlyPrice = products ? products.getProduct('proMonthly').amount : 1900;
    var yearlyPrice = products ? products.getProduct('proYearly').amount : 14900;
    var lifetimePrice = products ? products.getProduct('lifetime').amount : 29900;

    var monthlyBreakeven = Math.ceil(lifetimePrice / monthlyPrice);
    var yearlyBreakeven = Math.ceil(lifetimePrice / yearlyPrice);

    return {
      lifetimePrice: lifetimePrice,
      monthlyPrice: monthlyPrice,
      yearlyPrice: yearlyPrice,
      monthlyBreakevenMonths: monthlyBreakeven,
      yearlyBreakevenYears: yearlyBreakeven,
      savingsYear1VsMonthly: (monthlyPrice * 12) - lifetimePrice,
      savingsYear2VsMonthly: (monthlyPrice * 24) - lifetimePrice,
      savingsYear3VsMonthly: (monthlyPrice * 36) - lifetimePrice
    };
  };

  /**
   * Render the lifetime deal card into a container
   * @param {string|Element} container - selector or element
   * @returns {Promise<void>}
   */
  var renderDealCard = function (container) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return Promise.resolve();

    return fetchAvailability().then(function (availability) {
      var comparison = buildComparison();
      var products = window.CortexFreelancer.StripeProducts;
      var formatAmount = products ? products.formatAmount : function (c) { return '$' + (c / 100).toFixed(2); };

      var urgencyClass = availability.remaining <= 10 ? 'cortex-urgency-high' :
                         availability.remaining <= 25 ? 'cortex-urgency-medium' : '';

      el.innerHTML =
        '<div class="cortex-lifetime-card ' + urgencyClass + '">' +
          '<div class="cortex-lifetime-badge">Early Adopter Offer</div>' +
          '<h2 class="cortex-lifetime-title">Lifetime Pro Access</h2>' +
          '<div class="cortex-lifetime-price">' +
            '<span class="cortex-price-amount">' + formatAmount(comparison.lifetimePrice) + '</span>' +
            '<span class="cortex-price-label">one-time payment</span>' +
          '</div>' +

          '<div class="cortex-lifetime-counter ' + urgencyClass + '">' +
            '<div class="cortex-counter-bar">' +
              '<div class="cortex-counter-fill" style="width:' + Math.round((availability.sold / MAX_SLOTS) * 100) + '%"></div>' +
            '</div>' +
            '<p><strong>' + availability.remaining + '</strong> of ' + MAX_SLOTS + ' spots remaining</p>' +
          '</div>' +

          '<div class="cortex-lifetime-comparison">' +
            '<h3>Why Lifetime?</h3>' +
            '<table class="cortex-comparison-table">' +
              '<thead><tr><th></th><th>Monthly</th><th>Yearly</th><th>Lifetime</th></tr></thead>' +
              '<tbody>' +
                '<tr><td>Year 1</td>' +
                  '<td>' + formatAmount(comparison.monthlyPrice * 12) + '</td>' +
                  '<td>' + formatAmount(comparison.yearlyPrice) + '</td>' +
                  '<td rowspan="3" class="cortex-lifetime-cell">' + formatAmount(comparison.lifetimePrice) + '<br><small>forever</small></td>' +
                '</tr>' +
                '<tr><td>Year 2</td>' +
                  '<td>' + formatAmount(comparison.monthlyPrice * 24) + '</td>' +
                  '<td>' + formatAmount(comparison.yearlyPrice * 2) + '</td>' +
                '</tr>' +
                '<tr><td>Year 3</td>' +
                  '<td>' + formatAmount(comparison.monthlyPrice * 36) + '</td>' +
                  '<td>' + formatAmount(comparison.yearlyPrice * 3) + '</td>' +
                '</tr>' +
              '</tbody>' +
            '</table>' +
            '<p class="cortex-breakeven">Pays for itself in just <strong>' +
              comparison.monthlyBreakevenMonths + ' months</strong> vs monthly billing.</p>' +
          '</div>' +

          '<ul class="cortex-lifetime-features">' +
            '<li>All Pro features — forever</li>' +
            '<li>No recurring payments</li>' +
            '<li>Founding member badge</li>' +
            '<li>Priority feature requests</li>' +
          '</ul>' +

          (availability.available
            ? '<button class="cortex-btn-primary cortex-lifetime-cta" data-action="purchase">Get Lifetime Access</button>'
            : '<div class="cortex-lifetime-sold-out">Sold Out</div>'
          ) +
        '</div>';

      // Bind purchase button
      var cta = el.querySelector('[data-action="purchase"]');
      if (cta) {
        cta.addEventListener('click', function () {
          purchaseLifetimeDeal();
        });
      }
    });
  };

  /**
   * Initiate lifetime deal purchase via Stripe Checkout
   * @returns {Promise<void>}
   */
  var purchaseLifetimeDeal = function () {
    return fetchAvailability().then(function (availability) {
      if (!availability.available) {
        showSoldOutMessage();
        return;
      }
      var checkout = window.CortexFreelancer.StripeCheckout;
      if (!checkout) throw new Error('StripeCheckout module not loaded');
      return checkout.redirectToCheckout({
        planKey: 'lifetime',
        metadata: { dealType: 'early_adopter_lifetime' }
      });
    });
  };

  /**
   * Show sold-out message when all slots taken
   */
  var showSoldOutMessage = function () {
    var existing = document.querySelector('.cortex-lifetime-soldout-msg');
    if (existing) existing.remove();

    var msg = document.createElement('div');
    msg.className = 'cortex-lifetime-soldout-msg';
    msg.setAttribute('role', 'alert');
    msg.innerHTML =
      '<div class="cortex-soldout-inner">' +
        '<p><strong>All lifetime spots have been claimed!</strong></p>' +
        '<p>You can still get Pro with our monthly or yearly plans.</p>' +
        '<button class="cortex-btn-primary" data-action="yearly">Get Pro Yearly — Save $79/yr</button>' +
      '</div>';

    msg.querySelector('[data-action="yearly"]').addEventListener('click', function () {
      msg.remove();
      var checkout = window.CortexFreelancer.StripeCheckout;
      if (checkout) checkout.redirectToCheckout({ planKey: 'proYearly' });
    });

    document.body.appendChild(msg);
  };

  window.CortexFreelancer.LifetimeDeal = {
    MAX_SLOTS: MAX_SLOTS,
    fetchAvailability: fetchAvailability,
    buildComparison: buildComparison,
    renderDealCard: renderDealCard,
    purchaseLifetimeDeal: purchaseLifetimeDeal
  };
})();
