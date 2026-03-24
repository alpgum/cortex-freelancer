/**
 * CF-192: Downgrade Flow with Data Retention
 * Keeps all user data on downgrade to Free but restricts feature access
 * with clear messaging and visual indicators.
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ---- Feature restrictions for Free tier ---- */
  var FREE_LIMITS = {
    proposalsPerMonth: 5,
    savedSearches: 3,
    analyticsAccess: false,
    aiCoverLetters: false,
    bulkActions: false,
    taxEstimator: false,
    customBranding: false,
    competitionHeatmap: false,
    revenueProjections: false,
    priorityAlerts: false
  };

  var PRO_FEATURES = [
    { key: 'analyticsAccess', label: 'Advanced Analytics', icon: 'chart-bar' },
    { key: 'aiCoverLetters', label: 'AI Cover Letters', icon: 'sparkles' },
    { key: 'bulkActions', label: 'Bulk Proposal Actions', icon: 'layers' },
    { key: 'taxEstimator', label: 'Tax Estimator', icon: 'calculator' },
    { key: 'customBranding', label: 'Custom Invoice Branding', icon: 'palette' },
    { key: 'competitionHeatmap', label: 'Competition Heatmap', icon: 'map' },
    { key: 'revenueProjections', label: 'Revenue Projections', icon: 'trending-up' },
    { key: 'priorityAlerts', label: 'Priority Job Alerts', icon: 'bell' }
  ];

  /**
   * Check if a feature is accessible for the current tier
   * @param {string} featureKey
   * @param {string} tier - free | pro | lifetime
   * @returns {boolean}
   */
  var isFeatureAccessible = function (featureKey, tier) {
    if (tier === 'pro' || tier === 'lifetime') return true;
    var limit = FREE_LIMITS[featureKey];
    if (typeof limit === 'boolean') return limit;
    if (typeof limit === 'number') return true; // accessible but limited
    return true; // unknown features default to accessible
  };

  /**
   * Get usage limit for a feature on Free tier
   * @param {string} featureKey
   * @returns {number|null}
   */
  var getFreeLimit = function (featureKey) {
    var limit = FREE_LIMITS[featureKey];
    return typeof limit === 'number' ? limit : null;
  };

  /**
   * Process downgrade — restrict access but retain all data
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  var processDowngrade = function (userId) {
    return fetch('/api/firestore/users/' + encodeURIComponent(userId) + '/subscription', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: 'free',
        downgradedAt: new Date().toISOString(),
        dataRetained: true,
        previousTier: 'pro',
        featureRestrictions: FREE_LIMITS
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('Downgrade processing failed');
      return res.json();
    }).then(function (result) {
      showDowngradeConfirmation();
      applyFeatureRestrictions();
      return result;
    });
  };

  /**
   * Show downgrade confirmation with data retention message
   */
  var showDowngradeConfirmation = function () {
    var overlay = document.createElement('div');
    overlay.className = 'cortex-downgrade-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Downgrade confirmation');

    overlay.innerHTML =
      '<div class="cortex-downgrade-modal">' +
        '<div class="cortex-downgrade-header">' +
          '<h2>Plan Changed to Free</h2>' +
        '</div>' +
        '<div class="cortex-downgrade-body">' +
          '<div class="cortex-downgrade-data-badge">' +
            '<span class="cortex-icon-check"></span>' +
            '<strong>All your data is safe</strong>' +
          '</div>' +
          '<p>Your proposals, clients, earnings history, and all other data have been preserved. ' +
          'If you upgrade again, everything will be right where you left it.</p>' +
          '<h3>Features now restricted:</h3>' +
          '<ul class="cortex-downgrade-features">' +
            PRO_FEATURES.map(function (f) {
              return '<li><span class="cortex-icon-lock"></span> ' + f.label + '</li>';
            }).join('') +
          '</ul>' +
          '<p class="cortex-downgrade-limits">' +
            'Free plan includes ' + FREE_LIMITS.proposalsPerMonth + ' proposals/month and ' +
            FREE_LIMITS.savedSearches + ' saved searches.' +
          '</p>' +
        '</div>' +
        '<div class="cortex-downgrade-actions">' +
          '<button class="cortex-btn-secondary" data-action="dismiss">Got it</button>' +
          '<button class="cortex-btn-primary" data-action="resubscribe">Upgrade Back to Pro</button>' +
        '</div>' +
      '</div>';

    overlay.addEventListener('click', function (e) {
      var action = e.target.getAttribute('data-action');
      if (action === 'dismiss') {
        overlay.remove();
      } else if (action === 'resubscribe') {
        overlay.remove();
        var checkout = window.CortexFreelancer.StripeCheckout;
        if (checkout) {
          checkout.redirectToCheckout({ planKey: 'proMonthly' });
        }
      }
    });

    document.body.appendChild(overlay);
  };

  /**
   * Apply visual restriction indicators to locked features in the DOM
   */
  var applyFeatureRestrictions = function () {
    PRO_FEATURES.forEach(function (feature) {
      var elements = document.querySelectorAll('[data-feature="' + feature.key + '"]');
      elements.forEach(function (el) {
        el.classList.add('cortex-feature-locked');
        el.setAttribute('aria-disabled', 'true');

        // Add lock overlay if not already present
        if (!el.querySelector('.cortex-lock-badge')) {
          var badge = document.createElement('div');
          badge.className = 'cortex-lock-badge';
          badge.innerHTML = '<span class="cortex-icon-lock"></span> Pro Feature';
          badge.addEventListener('click', function (e) {
            e.stopPropagation();
            showUpgradePrompt(feature.label);
          });
          el.style.position = 'relative';
          el.appendChild(badge);
        }
      });
    });
  };

  /**
   * Show a contextual upgrade prompt for a locked feature
   * @param {string} featureName
   */
  var showUpgradePrompt = function (featureName) {
    var existing = document.querySelector('.cortex-upgrade-prompt');
    if (existing) existing.remove();

    var prompt = document.createElement('div');
    prompt.className = 'cortex-upgrade-prompt';
    prompt.setAttribute('role', 'alert');
    prompt.innerHTML =
      '<div class="cortex-upgrade-prompt-inner">' +
        '<p><strong>' + featureName + '</strong> requires a Pro plan.</p>' +
        '<p>Upgrade to unlock all features — your data is already waiting.</p>' +
        '<div class="cortex-upgrade-prompt-actions">' +
          '<button class="cortex-btn-secondary" data-action="dismiss">Not now</button>' +
          '<button class="cortex-btn-primary" data-action="upgrade">Upgrade to Pro</button>' +
        '</div>' +
      '</div>';

    prompt.addEventListener('click', function (e) {
      var action = e.target.getAttribute('data-action');
      if (action === 'dismiss') {
        prompt.remove();
      } else if (action === 'upgrade') {
        prompt.remove();
        var checkout = window.CortexFreelancer.StripeCheckout;
        if (checkout) {
          checkout.redirectToCheckout({ planKey: 'proMonthly' });
        }
      }
    });

    document.body.appendChild(prompt);
  };

  /**
   * Remove all restriction indicators (for re-upgrade)
   */
  var removeFeatureRestrictions = function () {
    var locked = document.querySelectorAll('.cortex-feature-locked');
    locked.forEach(function (el) {
      el.classList.remove('cortex-feature-locked');
      el.removeAttribute('aria-disabled');
      var badge = el.querySelector('.cortex-lock-badge');
      if (badge) badge.remove();
    });

    var prompts = document.querySelectorAll('.cortex-upgrade-prompt');
    prompts.forEach(function (p) { p.remove(); });
  };

  window.CortexFreelancer.SubscriptionDowngrade = {
    FREE_LIMITS: FREE_LIMITS,
    PRO_FEATURES: PRO_FEATURES,
    isFeatureAccessible: isFeatureAccessible,
    getFreeLimit: getFreeLimit,
    processDowngrade: processDowngrade,
    applyFeatureRestrictions: applyFeatureRestrictions,
    removeFeatureRestrictions: removeFeatureRestrictions,
    showUpgradePrompt: showUpgradePrompt
  };
})();
