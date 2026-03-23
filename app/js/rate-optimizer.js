/**
 * [UW-004] Cortex Rate Optimizer
 * Analyzes freelancer rates against market benchmarks and provides
 * actionable recommendations for rate optimization.
 */
(function () {
  'use strict';

  /* ─── Market Benchmarks (inlined from market-benchmarks.json) ─── */
  let _benchmarks = null;

  async function loadBenchmarks() {
    if (_benchmarks) return _benchmarks;
    try {
      const resp = await fetch('data/market-benchmarks.json');
      _benchmarks = await resp.json();
    } catch {
      // Fallback: use embedded minimal copy
      _benchmarks = window.__CORTEX_BENCHMARKS || null;
    }
    return _benchmarks;
  }

  /* ─── Skill → Category Matching ─── */

  function normalise(s) {
    return s.toLowerCase().replace(/[^a-z0-9+#]/g, '');
  }

  /**
   * Find the best-matching category for a list of skills.
   * Returns { categoryKey, category, matchedSkills[] }
   */
  function matchCategory(skills, categories) {
    let bestKey = null;
    let bestScore = 0;
    let bestMatched = [];

    const skillsNorm = skills.map(normalise);

    for (const [key, cat] of Object.entries(categories)) {
      const subs = (cat.subcategories || []).map(normalise);
      const labelTokens = normalise(cat.label);
      let score = 0;
      const matched = [];

      for (let i = 0; i < skillsNorm.length; i++) {
        const sk = skillsNorm[i];
        // Direct subcategory match
        if (subs.some(sub => sub.includes(sk) || sk.includes(sub))) {
          score += 3;
          matched.push(skills[i]);
        }
        // Label match
        else if (labelTokens.includes(sk) || sk.includes(labelTokens)) {
          score += 2;
          matched.push(skills[i]);
        }
        // Partial token overlap
        else if (subs.some(sub => {
          const tokens = sub.split(/[\/\s]/);
          return tokens.some(t => t.length > 2 && (sk.includes(t) || t.includes(sk)));
        })) {
          score += 1;
          matched.push(skills[i]);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
        bestMatched = matched;
      }
    }

    // Fallback: if nothing matched, pick "web-development" as the most common
    if (!bestKey) bestKey = 'web-development';

    return {
      categoryKey: bestKey,
      category: categories[bestKey],
      matchedSkills: bestMatched,
      confidence: Math.min(bestScore / (skills.length * 3), 1)
    };
  }

  /* ─── Tier Determination ─── */

  function determineTier(profile) {
    const { totalEarnings = 0, totalJobs = 0, totalHours = 0 } = profile;
    // Scoring system: each metric contributes to tier
    let points = 0;

    // Earnings thresholds
    if (totalEarnings >= 100000) points += 3;
    else if (totalEarnings >= 30000) points += 2;
    else if (totalEarnings >= 5000) points += 1;

    // Jobs thresholds
    if (totalJobs >= 50) points += 3;
    else if (totalJobs >= 20) points += 2;
    else if (totalJobs >= 5) points += 1;

    // Hours thresholds
    if (totalHours >= 2000) points += 3;
    else if (totalHours >= 500) points += 2;
    else if (totalHours >= 100) points += 1;

    if (points >= 7) return 'senior';
    if (points >= 4) return 'mid';
    return 'junior';
  }

  /* ─── Percentile Calculation ─── */

  /**
   * Estimate where currentRate falls within the full distribution
   * across all tiers for a category (junior-low → senior-high).
   */
  function calcPercentile(currentRate, rates) {
    // Build a rough CDF from the tier brackets
    const points = [
      { val: rates.junior.low, pct: 5 },
      { val: rates.junior.mid, pct: 15 },
      { val: rates.junior.high, pct: 25 },
      { val: rates.mid.low, pct: 35 },
      { val: rates.mid.mid, pct: 50 },
      { val: rates.mid.high, pct: 65 },
      { val: rates.senior.low, pct: 75 },
      { val: rates.senior.mid, pct: 85 },
      { val: rates.senior.high, pct: 95 }
    ];

    if (currentRate <= points[0].val) {
      return Math.max(1, Math.round((currentRate / points[0].val) * points[0].pct));
    }
    if (currentRate >= points[points.length - 1].val) {
      return Math.min(99, 95 + Math.round(((currentRate - points[points.length - 1].val) / points[points.length - 1].val) * 4));
    }

    // Linear interpolation between brackets
    for (let i = 0; i < points.length - 1; i++) {
      if (currentRate >= points[i].val && currentRate <= points[i + 1].val) {
        const range = points[i + 1].val - points[i].val;
        const pos = range > 0 ? (currentRate - points[i].val) / range : 0;
        return Math.round(points[i].pct + pos * (points[i + 1].pct - points[i].pct));
      }
    }

    return 50; // fallback
  }

  /* ─── JSS Multiplier ─── */

  function jssMultiplier(jss) {
    if (jss == null) return 1.0;
    if (jss >= 95) return 1.15;
    if (jss >= 90) return 1.10;
    if (jss >= 80) return 1.0;
    if (jss >= 70) return 0.9;
    return 0.8;
  }

  /* ─── Demand Multiplier ─── */

  function demandMultiplier(demand) {
    const map = { 'very-high': 1.15, 'high': 1.05, 'medium': 1.0, 'low': 0.9 };
    return map[demand] || 1.0;
  }

  /* ─── Core Analysis ─── */

  async function analyzeRate(profileData) {
    const benchmarks = await loadBenchmarks();
    if (!benchmarks) throw new Error('Market benchmarks not available');

    const {
      hourlyRate,
      skills = [],
      totalEarnings = 0,
      jobSuccess,
      totalJobs = 0,
      totalHours = 0
    } = profileData;

    // 1. Match category
    const match = matchCategory(skills, benchmarks.categories);
    const { category, categoryKey, matchedSkills, confidence } = match;

    // 2. Determine tier
    const tier = determineTier(profileData);
    const tierRates = category.rates[tier];

    // 3. Market percentile (across all tiers)
    const percentile = calcPercentile(hourlyRate, category.rates);

    // 4. Calculate recommended rates
    const jssMult = jssMultiplier(jobSuccess);
    const demMult = demandMultiplier(category.demand);

    // Optimal rate = tier median adjusted by JSS + demand
    const adjustedMedian = Math.round(tierRates.mid * jssMult * demMult);
    const adjustedHigh = Math.round(tierRates.high * jssMult * demMult);

    // Safe increase: 10-15% bump, capped at tier low
    const safeIncrease = Math.max(
      Math.round(hourlyRate * 1.15),
      Math.min(tierRates.low, Math.round(hourlyRate * 1.25))
    );

    // Optimal: adjusted median for tier
    const optimalRate = Math.max(adjustedMedian, safeIncrease + 5);

    // Ambitious: match one-tier-up median or adjusted high
    const ambitiousRate = tier === 'senior'
      ? adjustedHigh
      : Math.round(category.rates[tier === 'junior' ? 'mid' : 'senior'].mid * jssMult * demMult);

    // Ensure ordering: safe < optimal < ambitious
    const rec = {
      safe: Math.min(safeIncrease, optimalRate - 1),
      optimal: optimalRate,
      ambitious: Math.max(ambitiousRate, optimalRate + 10)
    };

    // If current rate already exceeds safe, adjust
    if (rec.safe <= hourlyRate) {
      rec.safe = Math.round(hourlyRate * 1.10);
    }
    if (rec.optimal <= rec.safe) {
      rec.optimal = rec.safe + Math.round((rec.ambitious - rec.safe) * 0.4);
    }

    // 5. Weekly hours estimate (from profile or default 30h/week)
    const weeksPerYear = 48; // accounting for time off
    const avgWeeklyHours = totalHours > 0 && totalJobs > 0
      ? Math.min(40, Math.max(10, totalHours / Math.max(totalJobs * 2, 1)))
      : 30;

    const annualHours = avgWeeklyHours * weeksPerYear;

    const projectedEarnings = {
      current: Math.round(hourlyRate * annualHours),
      safe: Math.round(rec.safe * annualHours),
      optimal: Math.round(rec.optimal * annualHours),
      ambitious: Math.round(rec.ambitious * annualHours * 0.8) // 20% volume reduction assumed
    };

    // 6. Volume impact estimate
    const rateJump = ((rec.optimal - hourlyRate) / hourlyRate) * 100;
    const volumeImpact = rateJump > 100 ? -30 : rateJump > 50 ? -20 : rateJump > 25 ? -10 : -5;
    const earningsChange = Math.round(
      ((rec.optimal * (1 + volumeImpact / 100) * annualHours) / (hourlyRate * annualHours) - 1) * 100
    );

    // 7. Generate explanations
    const tierLabel = { junior: 'entry-level', mid: 'mid-level', senior: 'senior/expert' }[tier];
    const catLabel = category.label;

    const explanation = hourlyRate < tierRates.low
      ? `You're charging $${hourlyRate}/hr — below the ${tierLabel} floor of $${tierRates.low}/hr for ${catLabel}. ` +
        `The market median for ${tierLabel} ${catLabel} freelancers is $${tierRates.mid}/hr, ` +
        `and top earners command $${tierRates.high}+/hr. ` +
        `You're leaving significant money on the table.`
      : hourlyRate < tierRates.mid
        ? `At $${hourlyRate}/hr you're in the lower range for ${tierLabel} ${catLabel} freelancers. ` +
          `The market median is $${tierRates.mid}/hr. With ${jobSuccess ? `a ${jobSuccess}% JSS` : 'solid reviews'}, ` +
          `you can confidently raise your rate.`
        : `At $${hourlyRate}/hr you're near or above the ${tierLabel} median of $${tierRates.mid}/hr for ${catLabel}. ` +
          `Consider positioning for the next tier or specialising to command premium rates up to $${adjustedHigh}/hr.`;

    const riskAssessment = `Raising to $${rec.optimal}/hr may reduce job volume by ~${Math.abs(volumeImpact)}% ` +
      `but ${earningsChange > 0 ? 'increase' : 'change'} total earnings by ${earningsChange > 0 ? '+' : ''}${earningsChange}%. ` +
      `${rec.optimal > hourlyRate * 2
        ? 'This is a significant jump — consider a gradual increase over 2-3 months.'
        : 'This is a reasonable step that most clients will accept.'}`;

    return {
      currentRate: hourlyRate,
      marketMedian: tierRates.mid,
      marketRange: { low: tierRates.low, high: tierRates.high },
      fullMarketRange: {
        low: category.rates.junior.low,
        high: category.rates.senior.high
      },
      percentile,
      tier,
      tierLabel,
      category: catLabel,
      categoryKey,
      matchedSkills,
      matchConfidence: confidence,
      demand: category.demand,
      recommendedRate: rec,
      projectedEarnings,
      annualHours: Math.round(annualHours),
      volumeImpact,
      explanation,
      riskAssessment,
      jssEffect: jobSuccess != null
        ? `Your ${jobSuccess}% JSS ${jobSuccess >= 90 ? 'boosts' : 'limits'} your rate ceiling by ${Math.round((jssMult - 1) * 100)}%.`
        : null,
      demandEffect: `${catLabel} demand is ${category.demand}, ${category.demand === 'very-high' || category.demand === 'high' ? 'supporting' : 'not significantly affecting'} premium rates.`
    };
  }

  /* ─── UI Renderer ─── */

  function renderRateOptimizer(profileData, container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) {
      console.error('CortexRateOptimizer: container not found');
      return;
    }

    // Inject styles
    injectStyles();

    container.innerHTML = `<div class="cro-loading">
      <div class="cro-spinner"></div>
      <span>Analyzing your rate against market data…</span>
    </div>`;

    analyzeRate(profileData).then(result => {
      container.innerHTML = buildUI(result, profileData);
      attachInteractivity(container, result, profileData);
    }).catch(err => {
      container.innerHTML = `<div class="cro-error">
        <span class="cro-error-icon">⚠️</span>
        <span>Failed to analyze rate: ${err.message}</span>
      </div>`;
    });
  }

  function buildUI(r, profile) {
    const fmtMoney = n => '$' + n.toLocaleString('en-US');
    const pctColor = r.percentile < 25 ? '#ef4444' : r.percentile < 50 ? '#f59e0b' : r.percentile < 75 ? '#22c55e' : '#3b82f6';

    return `
    <div class="cro-container">
      <!-- Header -->
      <div class="cro-header">
        <div class="cro-header-icon">📊</div>
        <div>
          <h2 class="cro-title">Rate Optimizer</h2>
          <p class="cro-subtitle">${r.category} · ${r.tierLabel} tier · ${r.demand} demand</p>
        </div>
        <div class="cro-percentile-badge" style="border-color: ${pctColor}; color: ${pctColor}">
          <span class="cro-pct-num">${r.percentile}</span>
          <span class="cro-pct-label">percentile</span>
        </div>
      </div>

      <!-- Bar Chart: Current vs Market -->
      <div class="cro-section">
        <h3 class="cro-section-title">Current vs Market Rates</h3>
        <div class="cro-bar-chart">
          ${buildBarRow('Your Rate', r.currentRate, r.fullMarketRange.high, '#8b5cf6')}
          ${buildBarRow('Market Low', r.marketRange.low, r.fullMarketRange.high, '#64748b')}
          ${buildBarRow('Market Median', r.marketMedian, r.fullMarketRange.high, '#22c55e')}
          ${buildBarRow('Market High', r.marketRange.high, r.fullMarketRange.high, '#3b82f6')}
          ${buildBarRow('Safe Target', r.recommendedRate.safe, r.fullMarketRange.high, '#f59e0b')}
          ${buildBarRow('Optimal Target', r.recommendedRate.optimal, r.fullMarketRange.high, '#10b981')}
          ${buildBarRow('Ambitious Target', r.recommendedRate.ambitious, r.fullMarketRange.high, '#ec4899')}
        </div>
      </div>

      <!-- Earnings Projection Slider -->
      <div class="cro-section">
        <h3 class="cro-section-title">Earnings Projection</h3>
        <div class="cro-slider-wrap">
          <div class="cro-slider-header">
            <span>Hourly Rate</span>
            <span class="cro-slider-value" id="cro-slider-val">${fmtMoney(r.currentRate)}/hr</span>
          </div>
          <input type="range" class="cro-slider" id="cro-rate-slider"
            min="${Math.max(1, Math.round(r.currentRate * 0.5))}"
            max="${Math.round(r.recommendedRate.ambitious * 1.3)}"
            value="${r.currentRate}" step="1">
          <div class="cro-slider-labels">
            <span>${fmtMoney(Math.max(1, Math.round(r.currentRate * 0.5)))}</span>
            <span>${fmtMoney(Math.round(r.recommendedRate.ambitious * 1.3))}</span>
          </div>
        </div>
        <div class="cro-earnings-grid" id="cro-earnings-grid">
          ${buildEarningsCard('Annual Earnings', r.projectedEarnings.current, null, '#8b5cf6')}
          ${buildEarningsCard('Weekly Earnings', Math.round(r.projectedEarnings.current / 48), null, '#6366f1')}
          ${buildEarningsCard('vs Current', 0, null, '#64748b', true)}
          ${buildEarningsCard('Est. Hours/Year', r.annualHours, null, '#0ea5e9', false, true)}
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="cro-section">
        <h3 class="cro-section-title">Recommended Actions</h3>
        <div class="cro-actions-grid">
          ${buildActionCard('🛡️ Safe Increase', r.recommendedRate.safe, r.currentRate, r.projectedEarnings.safe, r.projectedEarnings.current, 'Low risk, easy to justify', 'cro-action-safe')}
          ${buildActionCard('🎯 Optimal Rate', r.recommendedRate.optimal, r.currentRate, r.projectedEarnings.optimal, r.projectedEarnings.current, 'Best risk/reward balance', 'cro-action-optimal')}
          ${buildActionCard('🚀 Ambitious Target', r.recommendedRate.ambitious, r.currentRate, r.projectedEarnings.ambitious, r.projectedEarnings.current, 'Maximum earning potential', 'cro-action-ambitious')}
        </div>
      </div>

      <!-- Risk Assessment -->
      <div class="cro-section">
        <h3 class="cro-section-title">Risk Assessment</h3>
        <div class="cro-risk-card">
          <div class="cro-risk-content">
            <p class="cro-risk-text">${r.riskAssessment}</p>
            ${r.jssEffect ? `<p class="cro-risk-detail">💎 ${r.jssEffect}</p>` : ''}
            <p class="cro-risk-detail">📈 ${r.demandEffect}</p>
          </div>
        </div>
      </div>

      <!-- Explanation -->
      <div class="cro-section">
        <h3 class="cro-section-title">Analysis</h3>
        <div class="cro-explanation-card">
          <p>${r.explanation}</p>
          ${r.matchedSkills.length ? `<p class="cro-matched">Matched skills: <strong>${r.matchedSkills.join(', ')}</strong></p>` : ''}
        </div>
      </div>
    </div>`;
  }

  function buildBarRow(label, value, max, color) {
    const pct = Math.min(100, Math.max(2, (value / max) * 100));
    return `
      <div class="cro-bar-row">
        <span class="cro-bar-label">${label}</span>
        <div class="cro-bar-track">
          <div class="cro-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="cro-bar-value">$${value}</span>
      </div>`;
  }

  function buildEarningsCard(label, value, sub, color, isDiff, isPlain) {
    const fmtMoney = n => '$' + Math.abs(n).toLocaleString('en-US');
    return `
      <div class="cro-earn-card" data-type="${isDiff ? 'diff' : isPlain ? 'plain' : 'money'}">
        <span class="cro-earn-label">${label}</span>
        <span class="cro-earn-value" style="color:${color}">
          ${isPlain ? value.toLocaleString('en-US') : isDiff ? (value >= 0 ? '+' : '-') + fmtMoney(value) : fmtMoney(value)}
        </span>
      </div>`;
  }

  function buildActionCard(title, rate, currentRate, projected, currentProjected, desc, cls) {
    const fmtMoney = n => '$' + n.toLocaleString('en-US');
    const increase = Math.round(((rate - currentRate) / currentRate) * 100);
    const earningsIncrease = Math.round(((projected - currentProjected) / currentProjected) * 100);
    return `
      <div class="cro-action-card ${cls}">
        <div class="cro-action-header">
          <span class="cro-action-title">${title}</span>
          <span class="cro-action-rate">${fmtMoney(rate)}/hr</span>
        </div>
        <div class="cro-action-meta">
          <span>+${increase}% from current</span>
          <span>·</span>
          <span>${fmtMoney(projected)}/yr (+${earningsIncrease}%)</span>
        </div>
        <p class="cro-action-desc">${desc}</p>
      </div>`;
  }

  function attachInteractivity(container, result, profile) {
    const slider = container.querySelector('#cro-rate-slider');
    const sliderVal = container.querySelector('#cro-slider-val');
    const grid = container.querySelector('#cro-earnings-grid');

    if (!slider) return;

    slider.addEventListener('input', () => {
      const rate = parseInt(slider.value, 10);
      const fmtMoney = n => '$' + n.toLocaleString('en-US');
      const annual = rate * result.annualHours;
      const weekly = Math.round(annual / 48);
      const diff = annual - result.projectedEarnings.current;
      const diffPct = Math.round((diff / result.projectedEarnings.current) * 100);

      sliderVal.textContent = fmtMoney(rate) + '/hr';

      const diffColor = diff >= 0 ? '#22c55e' : '#ef4444';
      const diffPrefix = diff >= 0 ? '+' : '';

      grid.innerHTML = `
        ${buildEarningsCard('Annual Earnings', annual, null, '#8b5cf6')}
        ${buildEarningsCard('Weekly Earnings', weekly, null, '#6366f1')}
        <div class="cro-earn-card" data-type="diff">
          <span class="cro-earn-label">vs Current</span>
          <span class="cro-earn-value" style="color:${diffColor}">
            ${diffPrefix}${fmtMoney(diff)} (${diffPrefix}${diffPct}%)
          </span>
        </div>
        ${buildEarningsCard('Est. Hours/Year', result.annualHours, null, '#0ea5e9', false, true)}
      `;
    });
  }

  /* ─── Styles ─── */

  function injectStyles() {
    if (document.getElementById('cro-styles')) return;
    const style = document.createElement('style');
    style.id = 'cro-styles';
    style.textContent = `
      .cro-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e2e8f0;
        max-width: 720px;
        margin: 0 auto;
      }

      .cro-loading {
        display: flex; align-items: center; gap: 12px;
        padding: 24px; color: #94a3b8;
      }
      .cro-spinner {
        width: 20px; height: 20px; border: 2px solid #334155;
        border-top-color: #8b5cf6; border-radius: 50%;
        animation: cro-spin 0.8s linear infinite;
      }
      @keyframes cro-spin { to { transform: rotate(360deg); } }
      .cro-error {
        padding: 16px; background: #1e1215; border: 1px solid #7f1d1d;
        border-radius: 10px; color: #fca5a5; display: flex; gap: 8px;
      }

      .cro-header {
        display: flex; align-items: center; gap: 14px; padding: 16px 0;
        border-bottom: 1px solid #1e293b; margin-bottom: 20px;
      }
      .cro-header-icon { font-size: 28px; }
      .cro-title { font-size: 20px; font-weight: 700; margin: 0; color: #f1f5f9; }
      .cro-subtitle { font-size: 13px; color: #94a3b8; margin: 2px 0 0; }
      .cro-percentile-badge {
        margin-left: auto; text-align: center; border: 2px solid;
        border-radius: 12px; padding: 6px 14px; min-width: 60px;
      }
      .cro-pct-num { display: block; font-size: 22px; font-weight: 800; line-height: 1; }
      .cro-pct-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; }

      .cro-section { margin-bottom: 24px; }
      .cro-section-title {
        font-size: 14px; font-weight: 600; color: #94a3b8;
        text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px;
      }

      /* Bar Chart */
      .cro-bar-chart { display: flex; flex-direction: column; gap: 8px; }
      .cro-bar-row { display: flex; align-items: center; gap: 10px; }
      .cro-bar-label { width: 120px; font-size: 12px; color: #94a3b8; text-align: right; flex-shrink: 0; }
      .cro-bar-track { flex: 1; height: 22px; background: #1e293b; border-radius: 6px; overflow: hidden; }
      .cro-bar-fill { height: 100%; border-radius: 6px; transition: width 0.5s ease; min-width: 4px; }
      .cro-bar-value { width: 50px; font-size: 13px; font-weight: 600; color: #e2e8f0; }

      /* Slider */
      .cro-slider-wrap { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; }
      .cro-slider-header { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; color: #94a3b8; }
      .cro-slider-value { font-weight: 700; color: #8b5cf6; font-size: 16px; }
      .cro-slider {
        width: 100%; -webkit-appearance: none; appearance: none;
        height: 6px; border-radius: 3px; background: #334155; outline: none;
      }
      .cro-slider::-webkit-slider-thumb {
        -webkit-appearance: none; width: 20px; height: 20px;
        border-radius: 50%; background: #8b5cf6; cursor: pointer;
        box-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
      }
      .cro-slider::-moz-range-thumb {
        width: 20px; height: 20px; border-radius: 50%; background: #8b5cf6;
        cursor: pointer; border: none;
      }
      .cro-slider-labels { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 6px; }

      /* Earnings Grid */
      .cro-earnings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 14px; }
      .cro-earn-card {
        background: #0f172a; border: 1px solid #1e293b; border-radius: 10px;
        padding: 14px; text-align: center;
      }
      .cro-earn-label { display: block; font-size: 11px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
      .cro-earn-value { display: block; font-size: 18px; font-weight: 700; }

      /* Action Cards */
      .cro-actions-grid { display: flex; flex-direction: column; gap: 10px; }
      .cro-action-card {
        background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;
        padding: 16px; transition: border-color 0.2s;
      }
      .cro-action-card:hover { border-color: #334155; }
      .cro-action-safe { border-left: 3px solid #f59e0b; }
      .cro-action-optimal { border-left: 3px solid #10b981; }
      .cro-action-ambitious { border-left: 3px solid #ec4899; }
      .cro-action-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
      .cro-action-title { font-size: 14px; font-weight: 600; }
      .cro-action-rate { font-size: 18px; font-weight: 800; color: #f1f5f9; }
      .cro-action-meta { font-size: 12px; color: #64748b; display: flex; gap: 6px; flex-wrap: wrap; }
      .cro-action-desc { font-size: 12px; color: #94a3b8; margin: 8px 0 0; }

      /* Risk Card */
      .cro-risk-card {
        background: linear-gradient(135deg, #1a0f2e 0%, #0f172a 100%);
        border: 1px solid #2d1b69; border-radius: 12px; padding: 20px;
      }
      .cro-risk-text { font-size: 14px; line-height: 1.6; color: #e2e8f0; margin: 0 0 10px; }
      .cro-risk-detail { font-size: 13px; color: #a78bfa; margin: 6px 0 0; }

      /* Explanation */
      .cro-explanation-card {
        background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;
        padding: 18px; font-size: 14px; line-height: 1.6; color: #cbd5e1;
      }
      .cro-explanation-card p { margin: 0 0 8px; }
      .cro-matched { font-size: 12px; color: #64748b; margin-top: 10px !important; }

      @media (max-width: 500px) {
        .cro-bar-label { width: 80px; font-size: 11px; }
        .cro-earnings-grid { grid-template-columns: 1fr 1fr; }
        .cro-header { flex-wrap: wrap; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ─── Export ─── */

  window.CortexRateOptimizer = {
    analyzeRate,
    renderRateOptimizer,
    // Utilities exposed for testing
    _matchCategory: matchCategory,
    _determineTier: determineTier,
    _calcPercentile: calcPercentile
  };

})();
