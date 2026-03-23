/**
 * CortexRankingSimulator - Upwork Search Ranking Simulator
 * Simulates how Upwork ranks freelancers in search results
 * [UX-003]
 */
(function () {
  'use strict';

  /* ── Ranking Factor Definitions ── */
  const FACTORS = [
    {
      key: 'jss',
      label: 'Job Success Score',
      weight: 0.25,
      icon: '⭐',
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      score: function (v) {
        if (v >= 95) return 100;
        if (v >= 90) return 85;
        if (v >= 80) return 60;
        if (v >= 70) return 40;
        return Math.max(0, v * 0.4);
      },
      tier: function (v) {
        if (v >= 90) return 'Top Rated';
        if (v >= 80) return 'Good';
        if (v >= 70) return 'Average';
        return 'Below Average';
      }
    },
    {
      key: 'responseTime',
      label: 'Response Time',
      weight: 0.15,
      icon: '⚡',
      min: 0,
      max: 48,
      step: 0.5,
      unit: 'h',
      score: function (v) {
        if (v <= 1) return 100;
        if (v <= 2) return 90;
        if (v <= 4) return 70;
        if (v <= 8) return 50;
        if (v <= 24) return 30;
        return 10;
      },
      tier: function (v) {
        if (v <= 2) return 'Excellent';
        if (v <= 4) return 'Good';
        if (v <= 12) return 'Average';
        return 'Slow';
      },
      invert: true // lower is better for display
    },
    {
      key: 'earnings',
      label: 'Total Earnings',
      weight: 0.15,
      icon: '💰',
      min: 0,
      max: 500000,
      step: 5000,
      unit: '$',
      score: function (v) {
        if (v >= 100000) return 100;
        if (v >= 50000) return 80;
        if (v >= 10000) return 60;
        if (v >= 1000) return 35;
        return Math.max(5, v / 50);
      },
      tier: function (v) {
        if (v >= 100000) return 'Top Earner';
        if (v >= 50000) return 'Established';
        if (v >= 10000) return 'Growing';
        return 'New';
      },
      format: function (v) {
        if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
        return '$' + v;
      }
    },
    {
      key: 'activity',
      label: 'Recent Activity',
      weight: 0.15,
      icon: '🔥',
      min: 0,
      max: 90,
      step: 1,
      unit: ' days ago',
      score: function (v) {
        if (v <= 7) return 100;
        if (v <= 14) return 85;
        if (v <= 30) return 65;
        if (v <= 60) return 35;
        return 10;
      },
      tier: function (v) {
        if (v <= 30) return 'Active';
        if (v <= 60) return 'Moderate';
        return 'Inactive';
      },
      invert: true
    },
    {
      key: 'profileCompleteness',
      label: 'Profile Completeness',
      weight: 0.10,
      icon: '📋',
      min: 0,
      max: 100,
      step: 5,
      unit: '%',
      score: function (v) {
        if (v >= 95) return 100;
        if (v >= 80) return 75;
        if (v >= 60) return 50;
        return Math.max(5, v * 0.6);
      },
      tier: function (v) {
        if (v >= 90) return 'Complete';
        if (v >= 70) return 'Good';
        return 'Incomplete';
      }
    },
    {
      key: 'rateCompetitiveness',
      label: 'Rate Competitiveness',
      weight: 0.10,
      icon: '💲',
      min: 0,
      max: 100,
      step: 5,
      unit: '%',
      score: function (v) {
        // v = 0-100 representing how competitive the rate is within market range
        if (v >= 80) return 95;
        if (v >= 60) return 80;
        if (v >= 40) return 60;
        if (v >= 20) return 35;
        return 15;
      },
      tier: function (v) {
        if (v >= 70) return 'Competitive';
        if (v >= 40) return 'Average';
        return 'Out of Range';
      }
    },
    {
      key: 'skillsRelevance',
      label: 'Skills Relevance',
      weight: 0.10,
      icon: '🎯',
      min: 0,
      max: 100,
      step: 5,
      unit: '%',
      score: function (v) {
        return Math.min(100, Math.max(0, v));
      },
      tier: function (v) {
        if (v >= 80) return 'Highly Relevant';
        if (v >= 50) return 'Moderate';
        return 'Low Match';
      }
    }
  ];

  /* ── Core Ranking Engine ── */

  function computeFactorScores(profileData) {
    return FACTORS.map(function (f) {
      var raw = profileData[f.key] != null ? profileData[f.key] : 0;
      var normalized = f.score(raw);
      var weighted = normalized * f.weight;
      return {
        key: f.key,
        label: f.label,
        icon: f.icon,
        weight: f.weight,
        rawValue: raw,
        normalizedScore: Math.round(normalized),
        weightedScore: Math.round(weighted * 10) / 10,
        tier: f.tier(raw),
        unit: f.unit,
        formatted: f.format ? f.format(raw) : raw + (f.unit || '')
      };
    });
  }

  function computeTotalScore(factors) {
    var total = 0;
    for (var i = 0; i < factors.length; i++) {
      total += factors[i].weightedScore;
    }
    return Math.round(total);
  }

  function scoreToRank(score) {
    // Map 0-100 score → rank 1-100 (higher score = lower/better rank)
    if (score >= 95) return 1;
    if (score >= 90) return Math.round(2 + (95 - score));
    return Math.max(1, Math.min(100, Math.round(101 - score)));
  }

  function generateImprovements(profileData, factors) {
    var improvements = [];

    // For each factor, simulate a reasonable improvement
    var simulations = [
      { key: 'jss', bump: 4, desc: 'JSS' },
      { key: 'responseTime', bump: -2, desc: 'response time', lower: true },
      { key: 'earnings', bump: 10000, desc: 'earnings' },
      { key: 'activity', bump: -15, desc: 'last job recency', lower: true },
      { key: 'profileCompleteness', bump: 15, desc: 'profile completeness' },
      { key: 'rateCompetitiveness', bump: 20, desc: 'rate competitiveness' },
      { key: 'skillsRelevance', bump: 15, desc: 'skills relevance' }
    ];

    var currentScore = computeTotalScore(factors);
    var currentRank = scoreToRank(currentScore);

    for (var i = 0; i < simulations.length; i++) {
      var sim = simulations[i];
      var factor = null;
      for (var j = 0; j < FACTORS.length; j++) {
        if (FACTORS[j].key === sim.key) { factor = FACTORS[j]; break; }
      }
      if (!factor) continue;

      var currentVal = profileData[sim.key] != null ? profileData[sim.key] : 0;
      var newVal = currentVal + sim.bump;

      // Clamp
      newVal = Math.max(factor.min, Math.min(factor.max, newVal));
      if (newVal === currentVal) continue;

      // Already maxed out score
      if (factor.score(currentVal) >= 95) continue;

      var modifiedProfile = {};
      for (var k in profileData) modifiedProfile[k] = profileData[k];
      modifiedProfile[sim.key] = newVal;

      var newFactors = computeFactorScores(modifiedProfile);
      var newScore = computeTotalScore(newFactors);
      var newRank = scoreToRank(newScore);
      var rankDelta = currentRank - newRank;

      if (rankDelta > 0) {
        var fromStr, toStr;
        if (factor.format) {
          fromStr = factor.format(currentVal);
          toStr = factor.format(newVal);
        } else if (sim.lower) {
          fromStr = currentVal + factor.unit;
          toStr = newVal + factor.unit;
        } else {
          fromStr = currentVal + factor.unit;
          toStr = newVal + factor.unit;
        }

        improvements.push({
          key: sim.key,
          icon: factor.icon,
          description: (sim.lower ? 'Reduce' : 'Raise') + ' ' + sim.desc + ' from ' + fromStr + ' → ' + toStr + ': rank improves ~' + rankDelta + ' position' + (rankDelta > 1 ? 's' : ''),
          rankDelta: rankDelta,
          priority: rankDelta * factor.weight
        });
      }
    }

    // Sort by impact
    improvements.sort(function (a, b) { return b.rankDelta - a.rankDelta; });
    return improvements;
  }

  /* ── Public API ── */

  function simulateRanking(profileData) {
    var factors = computeFactorScores(profileData);
    var totalScore = computeTotalScore(factors);
    var currentRank = scoreToRank(totalScore);
    var improvements = generateImprovements(profileData, factors);

    return {
      currentRank: currentRank,
      totalScore: totalScore,
      factors: factors,
      improvements: improvements
    };
  }

  /* ── CSS ── */

  var CSS_INJECTED = false;
  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.crs-wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#1a1a2e;color:#e0e0e0;border-radius:16px;padding:28px;max-width:720px}',
      '.crs-header{display:flex;align-items:center;gap:12px;margin-bottom:24px}',
      '.crs-header h2{margin:0;font-size:22px;color:#fff;font-weight:700}',
      '.crs-rank-badge{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-size:28px;font-weight:800;width:72px;height:72px;border-radius:50%;box-shadow:0 4px 20px rgba(102,126,234,.4);flex-shrink:0}',
      '.crs-rank-label{font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-top:4px;text-align:center}',
      '.crs-rank-section{display:flex;flex-direction:column;align-items:center;margin-bottom:28px}',
      '.crs-score-text{font-size:13px;color:#888;margin-top:6px}',
      /* Factor bars */
      '.crs-factors{display:flex;flex-direction:column;gap:14px;margin-bottom:28px}',
      '.crs-factor{display:grid;grid-template-columns:28px 1fr 52px;align-items:center;gap:10px}',
      '.crs-factor-icon{font-size:18px;text-align:center}',
      '.crs-factor-body{display:flex;flex-direction:column;gap:4px}',
      '.crs-factor-top{display:flex;justify-content:space-between;align-items:center}',
      '.crs-factor-name{font-size:13px;color:#ccc;font-weight:500}',
      '.crs-factor-tier{font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,.08);color:#aaa}',
      '.crs-bar-track{height:8px;background:#2a2a4a;border-radius:4px;overflow:hidden}',
      '.crs-bar-fill{height:100%;border-radius:4px;transition:width .4s ease}',
      '.crs-factor-score{font-size:14px;font-weight:700;text-align:right;color:#fff}',
      /* What-if sliders */
      '.crs-whatif{background:#16213e;border-radius:12px;padding:20px;margin-bottom:24px}',
      '.crs-whatif h3{margin:0 0 16px;font-size:16px;color:#fff;font-weight:600}',
      '.crs-slider-row{display:grid;grid-template-columns:28px 1fr 60px;align-items:center;gap:10px;margin-bottom:12px}',
      '.crs-slider-label{font-size:12px;color:#999}',
      '.crs-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;background:#2a2a4a;outline:none;cursor:pointer}',
      '.crs-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:#667eea;cursor:pointer;box-shadow:0 2px 8px rgba(102,126,234,.5)}',
      '.crs-slider::-moz-range-thumb{width:18px;height:18px;border:none;border-radius:50%;background:#667eea;cursor:pointer}',
      '.crs-slider-val{font-size:13px;color:#fff;text-align:right;font-weight:600;font-variant-numeric:tabular-nums}',
      '.crs-whatif-rank{display:flex;align-items:center;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)}',
      '.crs-whatif-rank-num{font-size:24px;font-weight:800;color:#667eea}',
      '.crs-whatif-delta{font-size:14px;font-weight:600;padding:3px 10px;border-radius:8px}',
      '.crs-delta-pos{background:rgba(72,187,120,.15);color:#48bb78}',
      '.crs-delta-neg{background:rgba(245,101,101,.15);color:#f56565}',
      '.crs-delta-zero{background:rgba(255,255,255,.05);color:#888}',
      /* Improvements */
      '.crs-improvements{background:#16213e;border-radius:12px;padding:20px}',
      '.crs-improvements h3{margin:0 0 14px;font-size:16px;color:#fff;font-weight:600}',
      '.crs-imp-item{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)}',
      '.crs-imp-item:last-child{border-bottom:none}',
      '.crs-imp-icon{font-size:16px;margin-top:1px}',
      '.crs-imp-text{font-size:13px;color:#ccc;line-height:1.5}',
      '.crs-imp-delta{font-size:12px;color:#48bb78;font-weight:600;white-space:nowrap;margin-left:auto}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ── Helpers ── */

  function barColor(score) {
    if (score >= 80) return '#48bb78';
    if (score >= 60) return '#ecc94b';
    if (score >= 40) return '#ed8936';
    return '#f56565';
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ── Renderer ── */

  function renderRankingSimulator(profileData, container) {
    injectCSS();

    var result = simulateRanking(profileData);
    var wrap = el('div', 'crs-wrap');

    // Header
    var header = el('div', 'crs-header');
    header.appendChild(el('span', null, '📊'));
    header.appendChild(el('h2', null, 'Search Ranking Simulator'));
    wrap.appendChild(header);

    // Rank badge
    var rankSection = el('div', 'crs-rank-section');
    rankSection.appendChild(el('div', 'crs-rank-badge', '#' + result.currentRank));
    rankSection.appendChild(el('div', 'crs-rank-label', 'Estimated Search Rank'));
    rankSection.appendChild(el('div', 'crs-score-text', 'Composite score: ' + result.totalScore + '/100'));
    wrap.appendChild(rankSection);

    // Factor bars
    var factorsDiv = el('div', 'crs-factors');
    for (var i = 0; i < result.factors.length; i++) {
      var f = result.factors[i];
      var row = el('div', 'crs-factor');

      row.appendChild(el('span', 'crs-factor-icon', f.icon));

      var body = el('div', 'crs-factor-body');
      var top = el('div', 'crs-factor-top');
      top.appendChild(el('span', 'crs-factor-name', f.label + ' <span style="color:#666;font-weight:400">(' + Math.round(f.weight * 100) + '%)</span>'));
      top.appendChild(el('span', 'crs-factor-tier', f.tier));
      body.appendChild(top);

      var track = el('div', 'crs-bar-track');
      var fill = el('div', 'crs-bar-fill');
      fill.style.width = f.normalizedScore + '%';
      fill.style.background = barColor(f.normalizedScore);
      track.appendChild(fill);
      body.appendChild(track);

      row.appendChild(body);
      row.appendChild(el('span', 'crs-factor-score', f.normalizedScore));

      factorsDiv.appendChild(row);
    }
    wrap.appendChild(factorsDiv);

    // What-if sliders
    var whatIf = el('div', 'crs-whatif');
    whatIf.appendChild(el('h3', null, '🔮 What If…'));

    var sliderState = {};
    for (var k in profileData) sliderState[k] = profileData[k];

    var whatIfRankNum = el('span', 'crs-whatif-rank-num', '#' + result.currentRank);
    var whatIfDelta = el('span', 'crs-whatif-delta crs-delta-zero', '±0');

    function updateWhatIf() {
      var sim = simulateRanking(sliderState);
      whatIfRankNum.textContent = '#' + sim.currentRank;
      var delta = result.currentRank - sim.currentRank;
      if (delta > 0) {
        whatIfDelta.className = 'crs-whatif-delta crs-delta-pos';
        whatIfDelta.textContent = '↑' + delta + ' position' + (delta > 1 ? 's' : '');
      } else if (delta < 0) {
        whatIfDelta.className = 'crs-whatif-delta crs-delta-neg';
        whatIfDelta.textContent = '↓' + Math.abs(delta) + ' position' + (Math.abs(delta) > 1 ? 's' : '');
      } else {
        whatIfDelta.className = 'crs-whatif-delta crs-delta-zero';
        whatIfDelta.textContent = '±0';
      }
    }

    FACTORS.forEach(function (fDef) {
      var row = el('div', 'crs-slider-row');
      row.appendChild(el('span', 'crs-factor-icon', fDef.icon));

      var slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'crs-slider';
      slider.min = fDef.min;
      slider.max = fDef.max;
      slider.step = fDef.step;
      slider.value = profileData[fDef.key] != null ? profileData[fDef.key] : 0;

      var valDisplay = el('span', 'crs-slider-val');
      function showVal(v) {
        if (fDef.format) return fDef.format(parseFloat(v));
        return v + fDef.unit;
      }
      valDisplay.textContent = showVal(slider.value);

      slider.addEventListener('input', function () {
        var v = parseFloat(this.value);
        sliderState[fDef.key] = v;
        valDisplay.textContent = showVal(v);
        updateWhatIf();
      });

      row.appendChild(slider);
      row.appendChild(valDisplay);
      whatIf.appendChild(row);
    });

    var rankRow = el('div', 'crs-whatif-rank');
    rankRow.appendChild(el('span', null, 'Projected rank:'));
    rankRow.appendChild(whatIfRankNum);
    rankRow.appendChild(whatIfDelta);
    whatIf.appendChild(rankRow);

    wrap.appendChild(whatIf);

    // Top improvements
    var impSection = el('div', 'crs-improvements');
    impSection.appendChild(el('h3', null, '🚀 Top Improvements'));

    var topImp = result.improvements.slice(0, 3);
    if (topImp.length === 0) {
      impSection.appendChild(el('div', 'crs-imp-text', 'Your profile is already well optimized!'));
    } else {
      for (var m = 0; m < topImp.length; m++) {
        var imp = topImp[m];
        var item = el('div', 'crs-imp-item');
        item.appendChild(el('span', 'crs-imp-icon', imp.icon));
        item.appendChild(el('span', 'crs-imp-text', imp.description));
        item.appendChild(el('span', 'crs-imp-delta', '+' + imp.rankDelta));
        impSection.appendChild(item);
      }
    }
    wrap.appendChild(impSection);

    // Mount
    container.innerHTML = '';
    container.appendChild(wrap);

    return result;
  }

  /* ── Export ── */
  window.CortexRankingSimulator = {
    simulateRanking: simulateRanking,
    renderRankingSimulator: renderRankingSimulator,
    FACTORS: FACTORS
  };

})();
