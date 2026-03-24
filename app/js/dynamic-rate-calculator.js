/**
 * CFX-052: Dynamic Rate Calculator — Client Module
 * Handles UI interaction, API calls, and result rendering
 * for the intelligent pricing analysis section.
 */
(function () {
  'use strict';

  var API_URL = '/api/dynamic-rate';
  var _state = { loading: false, result: null };

  // ── DOM Helpers ──────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }
  function fmt$(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function show(el) { if (el) el.classList.add('visible'); }
  function hide(el) { if (el) el.classList.remove('visible'); }

  // ── Collect Inputs ───────────────────────────────────────────────────

  function collectInputs() {
    return {
      // From existing calculator
      skill: $('rc-skill') ? $('rc-skill').value : 'web-development',
      experience: parseInt($('rc-exp') ? $('rc-exp').value : '4') || 4,
      country: $('rc-country') ? $('rc-country').value : 'turkey',
      currentRate: parseFloat($('rc-rate') ? $('rc-rate').value : '0') || 0,
      // Dynamic inputs
      complexity: $('drc-complexity') ? $('drc-complexity').value : 'moderate',
      clientType: $('drc-client-type') ? $('drc-client-type').value : 'startup',
      urgency: $('drc-urgency') ? $('drc-urgency').value : 'normal',
      projectDuration: $('drc-duration') ? $('drc-duration').value : 'medium',
      projectDescription: $('drc-description') ? $('drc-description').value.trim() : '',
      jobPostingText: $('drc-job-posting') ? $('drc-job-posting').value.trim() : '',
      techStack: collectTechStack()
    };
  }

  function collectTechStack() {
    var el = $('drc-tech-stack');
    if (!el || !el.value.trim()) return [];
    return el.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // ── API Call ─────────────────────────────────────────────────────────

  function analyze() {
    if (_state.loading) return;

    var input = collectInputs();
    var section = $('drc-results');
    var skeleton = $('drc-skeleton');
    var btn = $('drc-analyze-btn');

    if (btn) { btn.disabled = true; btn.textContent = 'Analyzing market...'; }
    if (skeleton) show(skeleton);
    if (section) hide(section);

    _state.loading = true;

    // GTM event
    if (window.dataLayer) {
      window.dataLayer.push({ 'event': 'tool_used', 'tool_name': 'dynamic-rate-calculator' });
    }

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        _state.loading = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Analyze & Price'; }
        if (skeleton) hide(skeleton);

        if (data.success && data.recommendedRate) {
          _state.result = data;
          renderResults(data, input);
        } else {
          showError(data.error ? data.error.message : 'Analysis failed. Try again.');
        }
      })
      .catch(function (err) {
        _state.loading = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Analyze & Price'; }
        if (skeleton) hide(skeleton);
        showError('Network error. Check your connection and try again.');
        console.error('[dynamic-rate]', err);
      });
  }

  function showError(msg) {
    var el = $('drc-error');
    if (el) {
      el.textContent = msg;
      show(el);
      setTimeout(function () { hide(el); }, 6000);
    }
  }

  // ── Render Results ───────────────────────────────────────────────────

  function renderResults(data, input) {
    var section = $('drc-results');
    if (!section) return;

    renderPricingCard(data);
    renderConfidenceBar(data.confidenceInterval, data.recommendedRate);
    renderProjectEstimate(data.projectEstimate, data.recommendedRate);
    renderClientAnalysis(data.clientBudgetAnalysis);
    renderNegotiationPlaybook(data.negotiationPlaybook);
    renderMarketInsights(data.marketInsights);
    renderUpsellOpportunities(data.upsellOpportunities);
    renderSourceBadge(data.source);

    show(section);

    // Scroll into view
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Publish to bridge
    if (window.CortexBridge) {
      CortexBridge.publish.dynamicRate({
        recommendedRate: data.recommendedRate,
        strategy: data.pricingStrategy,
        totalPrice: data.projectEstimate ? data.projectEstimate.totalPrice : 0,
        confidence: data.confidenceInterval ? data.confidenceInterval.confidence : 0,
        skill: input.skill,
        country: input.country
      });
    }
  }

  function renderPricingCard(data) {
    var el = $('drc-pricing-card');
    if (!el) return;

    var ci = data.confidenceInterval || {};
    var strategyLabels = {
      'value-based': 'Value-Based Pricing',
      'competitive': 'Competitive Pricing',
      'premium': 'Premium Pricing',
      'penetration': 'Market Penetration'
    };
    var strategyColors = {
      'value-based': 'var(--green)',
      'competitive': 'var(--orange)',
      'premium': '#00ffcc',
      'penetration': '#ffaa00'
    };

    var stratLabel = strategyLabels[data.pricingStrategy] || 'Competitive';
    var stratColor = strategyColors[data.pricingStrategy] || 'var(--orange)';

    el.innerHTML =
      '<div class="drc-rate-main">' +
        '<div class="drc-rate-label">Recommended Rate</div>' +
        '<div class="drc-rate-value">' + fmt$(data.recommendedRate) + '<span>/hr</span></div>' +
        '<div class="drc-rate-range">' + fmt$(ci.low || 0) + ' — ' + fmt$(ci.high || 0) + '/hr range</div>' +
      '</div>' +
      '<div class="drc-strategy-badge" style="border-color:' + stratColor + ';color:' + stratColor + '">' +
        stratLabel +
      '</div>' +
      '<div class="drc-strategy-rationale">' + (data.strategyRationale || '') + '</div>';
  }

  function renderConfidenceBar(ci, recRate) {
    var el = $('drc-confidence-bar');
    if (!el || !ci) return;

    var range = (ci.high || 100) - (ci.low || 0);
    var max = Math.round((ci.high || 100) * 1.3);
    var lowPct = ((ci.low || 0) / max) * 100;
    var rangePct = (range / max) * 100;
    var recPct = ((recRate || 0) / max) * 100;

    el.innerHTML =
      '<div class="drc-conf-track">' +
        '<div class="drc-conf-range" style="left:' + lowPct + '%;width:' + rangePct + '%"></div>' +
        '<div class="drc-conf-marker" style="left:' + recPct + '%"></div>' +
      '</div>' +
      '<div class="drc-conf-labels">' +
        '<span>' + fmt$(ci.low || 0) + '</span>' +
        '<span style="color:var(--green);font-weight:700">' + fmt$(recRate) + '</span>' +
        '<span>' + fmt$(ci.high || 0) + '</span>' +
      '</div>' +
      '<div class="drc-conf-level">' +
        '<span>Confidence: </span>' +
        '<strong style="color:' + (ci.confidence >= 80 ? 'var(--green)' : ci.confidence >= 60 ? 'var(--orange)' : '#ff6666') + '">' +
          (ci.confidence || 0) + '%' +
        '</strong>' +
      '</div>';
  }

  function renderProjectEstimate(est, rate) {
    var el = $('drc-project-estimate');
    if (!el || !est) return;

    var html =
      '<div class="drc-est-header">' +
        '<div class="drc-est-total">' +
          '<div class="drc-est-total-label">Project Estimate</div>' +
          '<div class="drc-est-total-value">' + fmt$(est.totalPrice) + '</div>' +
          '<div class="drc-est-total-hours">' + est.totalHours + ' hours @ ' + fmt$(rate) + '/hr</div>' +
        '</div>' +
      '</div>' +
      '<div class="drc-est-phases">';

    var breakdown = est.breakdown || [];
    for (var i = 0; i < breakdown.length; i++) {
      var phase = breakdown[i];
      var phasePct = Math.round((phase.hours / est.totalHours) * 100);
      html +=
        '<div class="drc-phase-row">' +
          '<div class="drc-phase-name">' + phase.phase + '</div>' +
          '<div class="drc-phase-bar-wrap">' +
            '<div class="drc-phase-bar" style="width:' + phasePct + '%"></div>' +
          '</div>' +
          '<div class="drc-phase-hours">' + phase.hours + 'h</div>' +
          '<div class="drc-phase-cost">' + fmt$(phase.hours * rate) + '</div>' +
        '</div>';
    }

    html += '</div>';
    el.innerHTML = html;
  }

  function renderClientAnalysis(analysis) {
    var el = $('drc-client-analysis');
    if (!el || !analysis) return;

    var budgetColors = { low: '#ff6666', medium: '#ffaa00', high: 'var(--green)', enterprise: '#00ffcc' };
    var budgetColor = budgetColors[analysis.estimatedBudget] || 'var(--text2)';

    var html =
      '<div class="drc-analysis-row">' +
        '<span class="drc-analysis-label">Estimated Budget</span>' +
        '<span class="drc-analysis-value" style="color:' + budgetColor + '">' +
          (analysis.estimatedBudget || 'medium').charAt(0).toUpperCase() + (analysis.estimatedBudget || 'medium').slice(1) +
        '</span>' +
      '</div>' +
      '<div class="drc-analysis-row">' +
        '<span class="drc-analysis-label">Premium Willingness</span>' +
        '<span class="drc-analysis-value">' +
          '<div class="drc-wtp-bar"><div class="drc-wtp-fill" style="width:' + (analysis.willingnessToPayPremium || 0) + '%"></div></div>' +
          '<span style="margin-left:.5rem;font-weight:700">' + (analysis.willingnessToPayPremium || 0) + '%</span>' +
        '</span>' +
      '</div>';

    var signals = analysis.signals || [];
    if (signals.length) {
      html += '<div class="drc-signals">';
      for (var i = 0; i < signals.length; i++) {
        html += '<div class="drc-signal-item">' + signals[i] + '</div>';
      }
      html += '</div>';
    }

    el.innerHTML = html;
  }

  function renderNegotiationPlaybook(playbook) {
    var el = $('drc-negotiation');
    if (!el || !playbook) return;

    var html =
      '<div class="drc-neg-rates">' +
        '<div class="drc-neg-rate-item">' +
          '<div class="drc-neg-rate-label">Opening Rate</div>' +
          '<div class="drc-neg-rate-value" style="color:#00ffcc">' + fmt$(playbook.openingRate) + '/hr</div>' +
        '</div>' +
        '<div class="drc-neg-rate-item">' +
          '<div class="drc-neg-rate-label">Walk-Away Minimum</div>' +
          '<div class="drc-neg-rate-value" style="color:#ff6666">' + fmt$(playbook.minimumRate) + '/hr</div>' +
        '</div>' +
      '</div>' +
      '<div class="drc-anchor">' +
        '<div class="drc-anchor-label">Anchor Statement <button class="drc-copy-btn" onclick="window._drcCopy(this)" data-text="' + escapeAttr(playbook.anchorStatement) + '">Copy</button></div>' +
        '<div class="drc-anchor-text">' + playbook.anchorStatement + '</div>' +
      '</div>';

    // Objection handlers
    var objections = playbook.objectionHandlers || [];
    if (objections.length) {
      html += '<div class="drc-objections">';
      for (var i = 0; i < objections.length; i++) {
        var obj = objections[i];
        html +=
          '<div class="drc-objection">' +
            '<div class="drc-objection-q">"' + obj.objection + '"</div>' +
            '<div class="drc-objection-a">' + obj.response +
              ' <button class="drc-copy-btn drc-copy-sm" onclick="window._drcCopy(this)" data-text="' + escapeAttr(obj.response) + '">Copy</button>' +
            '</div>' +
          '</div>';
      }
      html += '</div>';
    }

    // Walk-away signals
    var walkAway = playbook.walkAwaySignals || [];
    if (walkAway.length) {
      html += '<div class="drc-walkaway"><div class="drc-walkaway-title">Walk-Away Signals</div>';
      for (var i = 0; i < walkAway.length; i++) {
        html += '<div class="drc-walkaway-item">' + walkAway[i] + '</div>';
      }
      html += '</div>';
    }

    el.innerHTML = html;
  }

  function renderMarketInsights(insights) {
    var el = $('drc-market-insights');
    if (!el || !insights) return;

    var demandIcons = { hot: '\u{1F525}', growing: '\u2B50', stable: '\u2714\uFE0F', declining: '\u{1F4C9}' };
    var supplyIcons = { scarce: '\u{1F534}', balanced: '\u{1F7E1}', saturated: '\u{1F7E2}' };
    var trendIcons = { up: '\u2191', stable: '\u2192', down: '\u2193' };
    var trendColors = { up: 'var(--green)', stable: 'var(--text2)', down: '#ff6666' };

    var html =
      '<div class="drc-insights-grid">' +
        '<div class="drc-insight-item">' +
          '<div class="drc-insight-label">Demand</div>' +
          '<div class="drc-insight-value">' + (demandIcons[insights.demandLevel] || '') + ' ' + (insights.demandLevel || 'stable') + '</div>' +
        '</div>' +
        '<div class="drc-insight-item">' +
          '<div class="drc-insight-label">Supply</div>' +
          '<div class="drc-insight-value">' + (supplyIcons[insights.supplyLevel] || '') + ' ' + (insights.supplyLevel || 'balanced') + '</div>' +
        '</div>' +
        '<div class="drc-insight-item">' +
          '<div class="drc-insight-label">Trend</div>' +
          '<div class="drc-insight-value" style="color:' + (trendColors[insights.trendDirection] || 'var(--text2)') + '">' +
            (trendIcons[insights.trendDirection] || '') + ' ' + (insights.trendDirection || 'stable') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="drc-key-insight">' + (insights.keyInsight || '') + '</div>';

    el.innerHTML = html;
  }

  function renderUpsellOpportunities(upsells) {
    var el = $('drc-upsells');
    if (!el || !upsells || !upsells.length) { if (el) el.innerHTML = ''; return; }

    var html = '';
    for (var i = 0; i < upsells.length; i++) {
      html += '<div class="drc-upsell-item">' + upsells[i] + '</div>';
    }
    el.innerHTML = html;
  }

  function renderSourceBadge(source) {
    var el = $('drc-source');
    if (!el) return;
    el.textContent = source === 'ai' ? 'AI-Powered Analysis' : 'Market Engine Analysis';
    el.className = 'drc-source-badge ' + (source === 'ai' ? 'drc-source-ai' : 'drc-source-engine');
  }

  // ── Utilities ────────────────────────────────────────────────────────

  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
  }

  // Global copy function
  window._drcCopy = function (btn) {
    var text = btn.getAttribute('data-text');
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
      });
    } else {
      // Fallback
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
    }
  };

  // ── Export ───────────────────────────────────────────────────────────

  window.DynamicRateCalculator = {
    analyze: analyze,
    getState: function () { return _state; }
  };

  // Wire up the analyze button
  document.addEventListener('DOMContentLoaded', function () {
    var btn = $('drc-analyze-btn');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        analyze();
      });
    }
  });
})();
