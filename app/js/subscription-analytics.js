/**
 * [CF-199] Subscription Analytics Dashboard
 * Tracks trial→paid conversion, churn reasons, ARPU, LTV, expansion revenue.
 * Exposed on window.CortexFreelancer.SubscriptionAnalytics
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_sub_analytics';
  var CHURN_SURVEY_ID = 'cf-churn-survey-modal';

  // ── Default Data Shape ────────────────────────────────────────────────

  function defaultData() {
    return {
      trials: { started: 0, converted: 0, expired: 0 },
      churn: { total: 0, reasons: {} },
      revenue: {
        mrr: 0,
        subscriptions: 0,
        expansionRevenue: 0,
        totalCollected: 0
      },
      events: [] // { type, ts, meta }
    };
  }

  var data = defaultData();

  // ── Persistence ───────────────────────────────────────────────────────

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        data = Object.assign(defaultData(), parsed);
      }
    } catch (e) { console.warn('[SubAnalytics] Load failed:', e); }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function pushEvent(type, meta) {
    data.events.push({ type: type, ts: Date.now(), meta: meta || {} });
    if (data.events.length > 500) data.events = data.events.slice(-250);
    save();
  }

  // ── Metrics Calculation ───────────────────────────────────────────────

  function conversionRate() {
    if (data.trials.started === 0) return 0;
    return Math.round((data.trials.converted / data.trials.started) * 10000) / 100;
  }

  function churnRate() {
    var total = data.revenue.subscriptions + data.churn.total;
    if (total === 0) return 0;
    return Math.round((data.churn.total / total) * 10000) / 100;
  }

  function arpu() {
    if (data.revenue.subscriptions === 0) return 0;
    return Math.round(data.revenue.mrr / data.revenue.subscriptions);
  }

  function ltv() {
    var churn = churnRate();
    if (churn === 0) return arpu() * 24; // Cap at 24 months if no churn
    return Math.round(arpu() / (churn / 100));
  }

  function expansionRate() {
    if (data.revenue.mrr === 0) return 0;
    return Math.round((data.revenue.expansionRevenue / data.revenue.mrr) * 10000) / 100;
  }

  function getMetrics() {
    return {
      trials: Object.assign({}, data.trials),
      conversionRate: conversionRate(),
      churnRate: churnRate(),
      churnReasons: Object.assign({}, data.churn.reasons),
      arpu: arpu(),
      ltv: ltv(),
      mrr: data.revenue.mrr,
      subscriptions: data.revenue.subscriptions,
      expansionRevenue: data.revenue.expansionRevenue,
      expansionRate: expansionRate(),
      totalCollected: data.revenue.totalCollected
    };
  }

  // ── Event Tracking ────────────────────────────────────────────────────

  function trackTrialStart(meta) {
    data.trials.started++;
    pushEvent('trial_start', meta);
  }

  function trackTrialConverted(meta) {
    data.trials.converted++;
    pushEvent('trial_converted', meta);
  }

  function trackTrialExpired(meta) {
    data.trials.expired++;
    pushEvent('trial_expired', meta);
  }

  function trackSubscription(amountCents, meta) {
    data.revenue.subscriptions++;
    data.revenue.mrr += amountCents;
    data.revenue.totalCollected += amountCents;
    pushEvent('subscription', Object.assign({ amount: amountCents }, meta || {}));
  }

  function trackChurn(reason, meta) {
    data.churn.total++;
    data.churn.reasons[reason] = (data.churn.reasons[reason] || 0) + 1;
    pushEvent('churn', Object.assign({ reason: reason }, meta || {}));
  }

  function trackExpansion(amountCents, meta) {
    data.revenue.expansionRevenue += amountCents;
    data.revenue.mrr += amountCents;
    data.revenue.totalCollected += amountCents;
    pushEvent('expansion', Object.assign({ amount: amountCents }, meta || {}));
  }

  // ── Churn Survey ──────────────────────────────────────────────────────

  var CHURN_REASONS = [
    { id: 'too_expensive', label: 'Too expensive' },
    { id: 'not_using', label: "Didn't use it enough" },
    { id: 'missing_features', label: 'Missing features I need' },
    { id: 'switched_competitor', label: 'Switched to a competitor' },
    { id: 'project_ended', label: 'Project/contract ended' },
    { id: 'technical_issues', label: 'Technical issues' },
    { id: 'other', label: 'Other' }
  ];

  function showChurnSurvey(onComplete) {
    var existing = document.getElementById(CHURN_SURVEY_ID);
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = CHURN_SURVEY_ID;
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99998', 'background:rgba(0,0,0,0.5)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif'
    ].join(';');

    var modal = document.createElement('div');
    modal.style.cssText = [
      'background:#fff', 'border-radius:12px', 'padding:32px', 'max-width:420px',
      'width:90%', 'box-shadow:0 8px 30px rgba(0,0,0,0.12)'
    ].join(';');

    var title = document.createElement('h3');
    title.textContent = "We're sorry to see you go";
    title.style.cssText = 'margin:0 0 8px;font-size:18px;';

    var subtitle = document.createElement('p');
    subtitle.textContent = 'Help us improve — why are you cancelling?';
    subtitle.style.cssText = 'margin:0 0 20px;color:#666;font-size:14px;';

    modal.appendChild(title);
    modal.appendChild(subtitle);

    CHURN_REASONS.forEach(function (reason) {
      var btn = document.createElement('button');
      btn.textContent = reason.label;
      btn.style.cssText = [
        'display:block', 'width:100%', 'padding:10px 16px', 'margin-bottom:8px',
        'border:1px solid #e5e7eb', 'border-radius:8px', 'background:#fff',
        'text-align:left', 'font-size:14px', 'cursor:pointer',
        'transition:background 0.15s'
      ].join(';');
      btn.addEventListener('mouseenter', function () { btn.style.background = '#f9fafb'; });
      btn.addEventListener('mouseleave', function () { btn.style.background = '#fff'; });
      btn.addEventListener('click', function () {
        trackChurn(reason.id);
        overlay.remove();
        if (typeof onComplete === 'function') onComplete(reason.id);
      });
      modal.appendChild(btn);
    });

    var skip = document.createElement('button');
    skip.textContent = 'Skip';
    skip.style.cssText = [
      'display:block', 'width:100%', 'padding:8px', 'margin-top:8px',
      'border:none', 'background:none', 'color:#999', 'font-size:13px',
      'cursor:pointer'
    ].join(';');
    skip.addEventListener('click', function () {
      trackChurn('skipped_survey');
      overlay.remove();
      if (typeof onComplete === 'function') onComplete('skipped_survey');
    });
    modal.appendChild(skip);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // ── Dashboard Renderer ────────────────────────────────────────────────

  function renderDashboard(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[SubAnalytics] Container not found:', containerId);
      return;
    }

    var metrics = getMetrics();

    var cards = [
      { label: 'Trial → Paid', value: metrics.conversionRate + '%', sub: metrics.trials.converted + ' of ' + metrics.trials.started + ' trials' },
      { label: 'Churn Rate', value: metrics.churnRate + '%', sub: metrics.churnReasons ? Object.keys(metrics.churnReasons).length + ' reasons tracked' : '' },
      { label: 'ARPU', value: '$' + (metrics.arpu / 100).toFixed(2), sub: 'per active subscription' },
      { label: 'LTV', value: '$' + (metrics.ltv / 100).toFixed(2), sub: 'estimated lifetime value' },
      { label: 'MRR', value: '$' + (metrics.mrr / 100).toFixed(2), sub: metrics.subscriptions + ' active subscriptions' },
      { label: 'Expansion Revenue', value: '$' + (metrics.expansionRevenue / 100).toFixed(2), sub: metrics.expansionRate + '% of MRR' }
    ];

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">';
    cards.forEach(function (card) {
      html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">';
      html += '<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">' + card.label + '</div>';
      html += '<div style="font-size:28px;font-weight:700;color:#111;">' + card.value + '</div>';
      html += '<div style="font-size:12px;color:#9ca3af;margin-top:4px;">' + card.sub + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Churn reasons breakdown
    if (Object.keys(metrics.churnReasons).length > 0) {
      html += '<div style="margin-top:24px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">';
      html += '<h4 style="margin:0 0 12px;font-size:14px;color:#374151;">Churn Reasons</h4>';
      var sorted = Object.entries(metrics.churnReasons).sort(function (a, b) { return b[1] - a[1]; });
      sorted.forEach(function (entry) {
        var pct = data.churn.total > 0 ? Math.round((entry[1] / data.churn.total) * 100) : 0;
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
        html += '<div style="flex:1;font-size:13px;color:#374151;">' + entry[0].replace(/_/g, ' ') + '</div>';
        html += '<div style="width:120px;height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden;">';
        html += '<div style="width:' + pct + '%;height:100%;background:#6366f1;border-radius:3px;"></div></div>';
        html += '<div style="font-size:12px;color:#6b7280;width:40px;text-align:right;">' + pct + '%</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    load();
    console.info('[SubAnalytics] Initialized with', data.revenue.subscriptions, 'subscriptions');
  }

  function reset() {
    data = defaultData();
    save();
    console.info('[SubAnalytics] Data reset');
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.CortexFreelancer.SubscriptionAnalytics = {
    init: init,
    getMetrics: getMetrics,
    trackTrialStart: trackTrialStart,
    trackTrialConverted: trackTrialConverted,
    trackTrialExpired: trackTrialExpired,
    trackSubscription: trackSubscription,
    trackChurn: trackChurn,
    trackExpansion: trackExpansion,
    showChurnSurvey: showChurnSurvey,
    renderDashboard: renderDashboard,
    reset: reset
  };
})();
