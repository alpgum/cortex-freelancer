/**
 * [CF-192] Downgrade Flow with Data Retention
 * When downgrading to Free, keep all data but restrict feature access
 * with clear messaging about what they lose and what stays.
 * Exposed as window.CortexFreelancer.DowngradeFlow
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var API_ENDPOINT = '/api/subscription/downgrade';
  var STORAGE_KEY = 'cortex_downgrade_state';

  /* ══════════════════════════════════════════════
   * PLAN FEATURE MAP
   * ══════════════════════════════════════════════ */
  var PRO_FEATURES = {
    advanced_analytics:  { label: 'Advanced Analytics',       retained: false, description: 'Detailed earnings charts, trend analysis, and forecasting' },
    bulk_proposals:      { label: 'Bulk Proposals',           retained: false, description: 'Send proposals to multiple clients at once' },
    priority_support:    { label: 'Priority Support',         retained: false, description: '24h response time from our team' },
    custom_branding:     { label: 'Custom Branding',          retained: false, description: 'White-label invoices and proposals' },
    crm_integrations:    { label: 'CRM Integrations',         retained: false, description: 'Connect with external CRM tools' },
    unlimited_clients:   { label: 'Unlimited Clients',        retained: false, description: 'Manage unlimited client records' },
    ai_bio_rewriter:     { label: 'AI Bio Rewriter',          retained: false, description: 'AI-powered profile optimization' },
    contract_templates:  { label: 'Contract Templates',       retained: false, description: 'Professional contract library' }
  };

  var DATA_RETAINED = [
    { key: 'clients',    label: 'Client Records',    icon: '👥', description: 'All your client data stays safe' },
    { key: 'invoices',   label: 'Invoice History',   icon: '📄', description: 'Past invoices remain accessible' },
    { key: 'proposals',  label: 'Saved Proposals',   icon: '📝', description: 'Your proposals are preserved' },
    { key: 'earnings',   label: 'Earnings History',  icon: '💰', description: 'Full earnings log retained' },
    { key: 'files',      label: 'Uploaded Files',    icon: '📁', description: 'All files stay in your account' },
    { key: 'profile',    label: 'Profile & Settings', icon: '⚙️', description: 'Your profile is unchanged' }
  ];

  var FREE_LIMITS = {
    clients: 5,
    proposals_per_month: 10,
    storage_mb: 100
  };

  /* ══════════════════════════════════════════════
   * HELPERS
   * ══════════════════════════════════════════════ */
  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (_) { return {}; }
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * DOWNGRADE IMPACT SUMMARY
   * ══════════════════════════════════════════════ */
  function buildImpactSummary(currentUsage) {
    var losing = [];
    var keeping = [];

    Object.keys(PRO_FEATURES).forEach(function (key) {
      losing.push({
        key: key,
        label: PRO_FEATURES[key].label,
        description: PRO_FEATURES[key].description
      });
    });

    DATA_RETAINED.forEach(function (item) {
      keeping.push({
        key: item.key,
        label: item.label,
        icon: item.icon,
        description: item.description,
        count: currentUsage && currentUsage[item.key] ? currentUsage[item.key] : null
      });
    });

    var warnings = [];
    if (currentUsage) {
      if (currentUsage.clients > FREE_LIMITS.clients) {
        warnings.push('You have ' + currentUsage.clients + ' clients. On Free, only ' + FREE_LIMITS.clients + ' can be active. The rest will be archived (not deleted).');
      }
      if (currentUsage.storage_mb > FREE_LIMITS.storage_mb) {
        warnings.push('You\'re using ' + currentUsage.storage_mb + 'MB of storage. Free plan allows ' + FREE_LIMITS.storage_mb + 'MB. Excess files will be read-only.');
      }
    }

    return { losing: losing, keeping: keeping, warnings: warnings, limits: FREE_LIMITS };
  }

  /* ══════════════════════════════════════════════
   * DOWNGRADE CONFIRMATION UI
   * ══════════════════════════════════════════════ */
  function renderDowngradeModal(container, opts) {
    opts = opts || {};
    var currentUsage = opts.currentUsage || {};
    var onConfirm = opts.onConfirm || function () {};
    var onCancel = opts.onCancel || function () {};

    var impact = buildImpactSummary(currentUsage);

    var html = '<div class="cf-downgrade-overlay" id="cf-downgrade-overlay">';
    html += '<div class="cf-downgrade-modal">';
    html += '<div class="cf-downgrade-header">';
    html += '<h2>Downgrade to Free Plan</h2>';
    html += '<p class="cf-downgrade-subtitle">Your data is safe — here\'s what changes</p>';
    html += '</div>';

    // Data retention section
    html += '<div class="cf-downgrade-section">';
    html += '<h3 class="cf-section-title cf-keep-title">✅ Your Data Stays Safe</h3>';
    html += '<div class="cf-retention-grid">';
    impact.keeping.forEach(function (item) {
      html += '<div class="cf-retention-item">';
      html += '<span class="cf-retention-icon">' + item.icon + '</span>';
      html += '<div class="cf-retention-info">';
      html += '<strong>' + escHtml(item.label) + '</strong>';
      if (item.count !== null) {
        html += ' <span class="cf-retention-count">(' + item.count + ')</span>';
      }
      html += '<p>' + escHtml(item.description) + '</p>';
      html += '</div></div>';
    });
    html += '</div></div>';

    // Features losing section
    html += '<div class="cf-downgrade-section">';
    html += '<h3 class="cf-section-title cf-lose-title">🔒 Features You\'ll Lose Access To</h3>';
    html += '<ul class="cf-lose-list">';
    impact.losing.forEach(function (feat) {
      html += '<li class="cf-lose-item">';
      html += '<span class="cf-lose-icon">✕</span>';
      html += '<div><strong>' + escHtml(feat.label) + '</strong>';
      html += '<p>' + escHtml(feat.description) + '</p></div>';
      html += '</li>';
    });
    html += '</ul></div>';

    // Warnings
    if (impact.warnings.length > 0) {
      html += '<div class="cf-downgrade-warnings">';
      html += '<h3 class="cf-section-title cf-warn-title">⚠️ Important Notes</h3>';
      impact.warnings.forEach(function (w) {
        html += '<div class="cf-warning-item">' + escHtml(w) + '</div>';
      });
      html += '</div>';
    }

    // Free limits info
    html += '<div class="cf-downgrade-limits">';
    html += '<h4>Free Plan Limits</h4>';
    html += '<p>' + FREE_LIMITS.clients + ' active clients · ' + FREE_LIMITS.proposals_per_month + ' proposals/month · ' + FREE_LIMITS.storage_mb + 'MB storage</p>';
    html += '</div>';

    // Actions
    html += '<div class="cf-downgrade-actions">';
    html += '<button class="cf-btn cf-btn-secondary" id="cf-downgrade-cancel">Keep Pro Plan</button>';
    html += '<button class="cf-btn cf-btn-danger" id="cf-downgrade-confirm">Confirm Downgrade</button>';
    html += '</div>';

    // Re-upgrade note
    html += '<p class="cf-downgrade-note">You can upgrade back anytime. All your data will be waiting.</p>';

    html += '</div></div>';

    container.innerHTML = html;

    var cancelBtn = document.getElementById('cf-downgrade-cancel');
    var confirmBtn = document.getElementById('cf-downgrade-confirm');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        container.innerHTML = '';
        onCancel();
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing…';
        onConfirm();
      });
    }
  }

  /* ══════════════════════════════════════════════
   * API CALL
   * ══════════════════════════════════════════════ */
  function executeDowngrade(opts) {
    opts = opts || {};
    var uid = opts.uid || '';
    var reason = opts.reason || '';

    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: uid,
        action: 'downgrade_to_free',
        reason: reason,
        retain_data: true,
        timestamp: new Date().toISOString()
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('Downgrade request failed: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      saveState({
        downgraded_at: new Date().toISOString(),
        previous_plan: 'pro',
        current_plan: 'free',
        data_retained: true
      });
      return { success: true, data: data };
    })
    .catch(function (err) {
      return { success: false, error: err.message };
    });
  }

  /* ══════════════════════════════════════════════
   * FEATURE GATE CHECK
   * ══════════════════════════════════════════════ */
  function isFeatureAvailable(featureKey, currentPlan) {
    if (currentPlan === 'pro' || currentPlan === 'lifetime') return true;
    return !PRO_FEATURES[featureKey];
  }

  function showFeatureGate(container, featureKey) {
    var feat = PRO_FEATURES[featureKey];
    if (!feat) return;

    var html = '<div class="cf-feature-gate">';
    html += '<div class="cf-gate-icon">🔒</div>';
    html += '<h3>' + escHtml(feat.label) + '</h3>';
    html += '<p>' + escHtml(feat.description) + '</p>';
    html += '<p class="cf-gate-msg">This feature requires a Pro plan.</p>';
    html += '<button class="cf-btn cf-btn-primary cf-gate-upgrade">Upgrade to Pro</button>';
    html += '</div>';

    container.innerHTML = html;

    var upgradeBtn = container.querySelector('.cf-gate-upgrade');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', function () {
        window.location.hash = '#/pricing';
      });
    }
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.DowngradeFlow = {
    buildImpactSummary: buildImpactSummary,
    renderDowngradeModal: renderDowngradeModal,
    executeDowngrade: executeDowngrade,
    isFeatureAvailable: isFeatureAvailable,
    showFeatureGate: showFeatureGate,
    PRO_FEATURES: PRO_FEATURES,
    DATA_RETAINED: DATA_RETAINED,
    FREE_LIMITS: FREE_LIMITS
  };
})();
