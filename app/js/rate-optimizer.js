/**
 * Cortex Rate Optimizer
 * Smart rate analysis and recommendations based on market benchmarks.
 * [UW-004]
 */
(function () {
  'use strict';

  let _benchmarks = null;

  // ── Helpers ──────────────────────────────────────────────────────────
  function parseRate(hourlyRate) {
    if (typeof hourlyRate === 'number') return hourlyRate;
    const m = String(hourlyRate).match(/([\d,.]+)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  }

  async function loadBenchmarks() {
    if (_benchmarks) return _benchmarks;
    const res = await fetch('/data/market-benchmarks.json');
    _benchmarks = await res.json();
    return _benchmarks;
  }

  function matchSkillsToCategories(skills, categories) {
    const matched = [];
    const lowerSkills = skills.map(s => s.toLowerCase());

    for (const [key, cat] of Object.entries(categories)) {
      const subcats = cat.subcategories.map(s => s.toLowerCase());
      const labelWords = cat.label.toLowerCase().split(/[\s/]+/);
      for (const skill of lowerSkills) {
        const hit = subcats.some(sc => sc.includes(skill) || skill.includes(sc)) ||
                    labelWords.some(w => skill.includes(w));
        if (hit) {
          matched.push({ key, ...cat });
          break;
        }
      }
    }
    return matched.length ? matched : [{ key: 'web-development', ...categories['web-development'] }];
  }

  function determineTier(totalEarnings, totalJobs) {
    const e = parseFloat(totalEarnings) || 0;
    const j = parseInt(totalJobs, 10) || 0;
    if (e >= 50000 || j >= 50) return 'senior';
    if (e >= 10000 || j >= 15) return 'mid';
    return 'junior';
  }

  function calcPercentile(rate, tierRates) {
    const { low, high } = tierRates;
    if (rate <= low) return Math.round((rate / low) * 25);
    if (rate >= high) return Math.min(99, 75 + Math.round(((rate - high) / high) * 25));
    const range = high - low;
    return Math.round(25 + ((rate - low) / range) * 50);
  }

  function riskLevel(rate, tierRates) {
    if (rate < tierRates.low) return { level: 'high', label: 'Under-pricing', color: '#ef4444', detail: 'You are significantly below market floor. Clients may question quality.' };
    if (rate < tierRates.mid * 0.8) return { level: 'medium', label: 'Below average', color: '#f59e0b', detail: 'Room to raise without losing competitiveness.' };
    if (rate <= tierRates.high * 1.1) return { level: 'low', label: 'Market rate', color: '#22c55e', detail: 'Well positioned within your tier.' };
    return { level: 'medium', label: 'Premium pricing', color: '#f59e0b', detail: 'Above typical range. Ensure portfolio backs it up.' };
  }

  function recommendedRates(rate, tierRates, demand) {
    const demandMult = { 'very-high': 1.15, high: 1.05, medium: 1.0, low: 0.95 }[demand] || 1;
    const conservative = Math.max(rate, tierRates.low) * demandMult;
    const optimal = tierRates.mid * demandMult;
    const aggressive = tierRates.high * 0.85 * demandMult;
    return {
      conservative: Math.round(conservative * 100) / 100,
      optimal: Math.round(optimal * 100) / 100,
      aggressive: Math.round(aggressive * 100) / 100,
    };
  }

  function projectedEarnings(rates, hoursPerWeek) {
    const weeks = 48; // realistic billable weeks
    const h = hoursPerWeek || 30;
    return {
      conservative: Math.round(rates.conservative * h * weeks),
      optimal: Math.round(rates.optimal * h * weeks),
      aggressive: Math.round(rates.aggressive * h * weeks),
    };
  }

  // ── Core API ─────────────────────────────────────────────────────────
  async function analyzeRate(profileData) {
    const bm = await loadBenchmarks();
    const rate = parseRate(profileData.hourlyRate);
    const skills = profileData.skills || [];
    const cats = matchSkillsToCategories(skills, bm.categories);
    const primary = cats[0];
    const tier = determineTier(profileData.totalEarnings, profileData.totalJobs);
    const tierRates = primary.rates[tier];
    const percentile = calcPercentile(rate, tierRates);
    const demand = primary.demand || 'medium';
    const rec = recommendedRates(rate, tierRates, demand);
    const proj = projectedEarnings(rec, 30);
    const risk = riskLevel(rate, tierRates);

    return {
      currentRate: rate,
      tier,
      percentile,
      primaryCategory: { key: primary.key, label: primary.label, demand },
      matchedCategories: cats.map(c => ({ key: c.key, label: c.label })),
      marketRange: tierRates,
      recommended: rec,
      projectedAnnual: proj,
      risk,
      skills,
      meta: { version: bm.version, source: bm.source },
    };
  }

  // ── CSS ──────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('cortex-rate-optimizer-css')) return;
    const style = document.createElement('style');
    style.id = 'cortex-rate-optimizer-css';
    style.textContent = `
      .cro-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e2e8f0;background:#0f172a;border-radius:12px;padding:24px;max-width:680px}
      .cro-root *{box-sizing:border-box}
      .cro-title{font-size:20px;font-weight:700;margin:0 0 4px;color:#f8fafc}
      .cro-subtitle{font-size:13px;color:#94a3b8;margin:0 0 20px}
      .cro-section{margin-bottom:22px}
      .cro-section-title{font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin:0 0 10px;display:flex;align-items:center;gap:6px}
      .cro-bar-wrap{margin-bottom:10px}
      .cro-bar-label{display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px}
      .cro-bar-label span:first-child{color:#cbd5e1}
      .cro-bar-label span:last-child{color:#f8fafc;font-weight:600}
      .cro-bar{height:8px;border-radius:4px;background:#1e293b;overflow:hidden;position:relative}
      .cro-bar-fill{height:100%;border-radius:4px;transition:width .6s ease}
      .cro-current .cro-bar-fill{background:linear-gradient(90deg,#6366f1,#818cf8)}
      .cro-market .cro-bar-fill{background:linear-gradient(90deg,#22c55e,#4ade80)}
      .cro-rec-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .cro-rec-card{background:#1e293b;border-radius:8px;padding:14px;text-align:center;border:1px solid #334155}
      .cro-rec-card.optimal{border-color:#22c55e;box-shadow:0 0 12px rgba(34,197,94,.15)}
      .cro-rec-card-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:6px}
      .cro-rec-card-rate{font-size:22px;font-weight:700;color:#f8fafc}
      .cro-rec-card-rate small{font-size:12px;font-weight:400;color:#94a3b8}
      .cro-table{width:100%;border-collapse:collapse;font-size:13px}
      .cro-table th{text-align:left;padding:8px 10px;color:#94a3b8;font-weight:600;border-bottom:1px solid #1e293b}
      .cro-table td{padding:8px 10px;border-bottom:1px solid #1e293b}
      .cro-table tr:last-child td{border-bottom:none}
      .cro-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600}
      .cro-risk-box{display:flex;align-items:flex-start;gap:12px;background:#1e293b;border-radius:8px;padding:14px;border-left:3px solid}
      .cro-risk-box .cro-risk-detail{font-size:13px;color:#cbd5e1;margin-top:4px}
      .cro-percentile{font-size:13px;color:#94a3b8;margin-top:6px}
      .cro-tier-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;background:#312e81;color:#a5b4fc;margin-left:8px}
      .cro-demand{font-size:12px;color:#94a3b8;margin-top:2px}
      .cro-demand strong{color:#e2e8f0}
    `;
    document.head.appendChild(style);
  }

  // ── Renderer ─────────────────────────────────────────────────────────
  function fmt(n) { return '$' + n.toLocaleString('en-US'); }

  async function renderRateOptimizer(profileData, containerId) {
    injectStyles();
    const el = document.getElementById(containerId);
    if (!el) { console.error('[CortexRateOptimizer] Container not found:', containerId); return; }
    el.innerHTML = '<div class="cro-root" style="opacity:.5">Analyzing rates…</div>';

    const a = await analyzeRate(profileData);
    const maxRate = Math.max(a.currentRate, a.marketRange.high, a.recommended.aggressive) * 1.1;

    const demandEmoji = { 'very-high': '🔥', high: '📈', medium: '➡️', low: '📉' };

    el.innerHTML = `
    <div class="cro-root">
      <div class="cro-title">💰 Rate Optimizer
        <span class="cro-tier-badge">${a.tier}</span>
      </div>
      <div class="cro-subtitle">${a.primaryCategory.label} · ${a.skills.join(', ') || 'General'}
        <div class="cro-demand">${demandEmoji[a.primaryCategory.demand] || ''} Demand: <strong>${a.primaryCategory.demand.replace('-', ' ')}</strong></div>
      </div>

      <!-- Current vs Market -->
      <div class="cro-section">
        <div class="cro-section-title">📊 Current vs Market</div>
        <div class="cro-bar-wrap cro-current">
          <div class="cro-bar-label"><span>Your Rate</span><span>${fmt(a.currentRate)}/hr</span></div>
          <div class="cro-bar"><div class="cro-bar-fill" style="width:${(a.currentRate / maxRate * 100).toFixed(1)}%"></div></div>
        </div>
        <div class="cro-bar-wrap cro-market">
          <div class="cro-bar-label"><span>Market Mid (${a.tier})</span><span>${fmt(a.marketRange.mid)}/hr</span></div>
          <div class="cro-bar"><div class="cro-bar-fill" style="width:${(a.marketRange.mid / maxRate * 100).toFixed(1)}%"></div></div>
        </div>
        <div class="cro-bar-wrap cro-market">
          <div class="cro-bar-label"><span>Market High (${a.tier})</span><span>${fmt(a.marketRange.high)}/hr</span></div>
          <div class="cro-bar"><div class="cro-bar-fill" style="width:${(a.marketRange.high / maxRate * 100).toFixed(1)}%"></div></div>
        </div>
        <div class="cro-percentile">You are at the <strong>${a.percentile}th</strong> percentile for ${a.tier}-level ${a.primaryCategory.label}.</div>
      </div>

      <!-- Recommended Rates -->
      <div class="cro-section">
        <div class="cro-section-title">🎯 Recommended Rates</div>
        <div class="cro-rec-cards">
          <div class="cro-rec-card">
            <div class="cro-rec-card-label">Conservative</div>
            <div class="cro-rec-card-rate">${fmt(a.recommended.conservative)}<small>/hr</small></div>
          </div>
          <div class="cro-rec-card optimal">
            <div class="cro-rec-card-label">✨ Optimal</div>
            <div class="cro-rec-card-rate">${fmt(a.recommended.optimal)}<small>/hr</small></div>
          </div>
          <div class="cro-rec-card">
            <div class="cro-rec-card-label">Aggressive</div>
            <div class="cro-rec-card-rate">${fmt(a.recommended.aggressive)}<small>/hr</small></div>
          </div>
        </div>
      </div>

      <!-- Projected Annual Earnings -->
      <div class="cro-section">
        <div class="cro-section-title">📅 Projected Annual Earnings <small style="font-weight:400;text-transform:none">(30 hrs/wk · 48 wks)</small></div>
        <table class="cro-table">
          <thead><tr><th>Strategy</th><th>Rate</th><th>Annual</th></tr></thead>
          <tbody>
            <tr><td>Current</td><td>${fmt(a.currentRate)}/hr</td><td>${fmt(a.currentRate * 30 * 48)}</td></tr>
            <tr><td>Conservative</td><td>${fmt(a.recommended.conservative)}/hr</td><td>${fmt(a.projectedAnnual.conservative)}</td></tr>
            <tr><td style="color:#22c55e;font-weight:600">Optimal</td><td style="color:#22c55e;font-weight:600">${fmt(a.recommended.optimal)}/hr</td><td style="color:#22c55e;font-weight:600">${fmt(a.projectedAnnual.optimal)}</td></tr>
            <tr><td>Aggressive</td><td>${fmt(a.recommended.aggressive)}/hr</td><td>${fmt(a.projectedAnnual.aggressive)}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Risk Assessment -->
      <div class="cro-section">
        <div class="cro-section-title">⚠️ Risk Assessment</div>
        <div class="cro-risk-box" style="border-left-color:${a.risk.color}">
          <div>
            <span class="cro-badge" style="background:${a.risk.color}20;color:${a.risk.color}">${a.risk.label}</span>
            <div class="cro-risk-detail">${a.risk.detail}</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Expose ───────────────────────────────────────────────────────────
  window.CortexRateOptimizer = {
    analyzeRate,
    renderRateOptimizer,
  };
})();
