/**
 * [UW-003] Cortex Freelancer — Earnings Analytics Dashboard
 * Renders earnings insights from profile data.
 * Exposed as window.CortexEarningsAnalytics
 */
(function () {
  'use strict';

  /* ───────── helpers ───────── */

  function fmt(n, decimals) {
    if (n == null || isNaN(n)) return '—';
    decimals = decimals != null ? decimals : 0;
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Number(n).toFixed(decimals);
  }

  function monthsSince(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d)) return null;
    var now = new Date();
    var months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    return Math.max(months, 1);
  }

  function categorize(title) {
    if (!title) return 'Other';
    var t = title.toLowerCase();
    var cats = [
      [/\b(react|angular|vue|next|nuxt|frontend|front.end|html|css|tailwind|ui\/ux|figma)\b/, 'Frontend / UI'],
      [/\b(node|express|django|flask|laravel|rails|backend|back.end|api|rest|graphql|server)\b/, 'Backend / API'],
      [/\b(full.?stack|mern|mean|lamp)\b/, 'Full-Stack'],
      [/\b(mobile|ios|android|react.native|flutter|swift|kotlin)\b/, 'Mobile'],
      [/\b(data|machine.learning|ml|ai|nlp|deep.learning|tensor|python|analytics|scraping)\b/, 'Data / AI'],
      [/\b(devops|aws|gcp|azure|cloud|docker|k8s|kubernetes|ci.?cd|infra)\b/, 'DevOps / Cloud'],
      [/\b(design|graphic|logo|brand|illustration|photoshop|illustrator)\b/, 'Design'],
      [/\b(wordpress|shopify|wix|cms|seo|content|writing|copy)\b/, 'Content / CMS'],
      [/\b(blockchain|web3|solidity|smart.contract|crypto|nft)\b/, 'Blockchain'],
    ];
    for (var i = 0; i < cats.length; i++) {
      if (cats[i][0].test(t)) return cats[i][1];
    }
    return 'Other';
  }

  /* ───────── calculations ───────── */

  function compute(data) {
    var totalEarnings = Number(data.totalEarnings) || 0;
    var totalJobs = Number(data.totalJobs) || 0;
    var totalHours = Number(data.totalHours) || 0;
    var hourlyRate = Number(data.hourlyRate) || 0;
    var history = Array.isArray(data.workHistory) ? data.workHistory : [];

    var avgProject = totalJobs > 0 ? totalEarnings / totalJobs : null;
    var effectiveRate = totalHours > 0 ? totalEarnings / totalHours : null;
    var months = monthsSince(data.memberSince);
    var estMonthly = months ? totalEarnings / months : null;
    var estYearly = estMonthly != null ? estMonthly * 12 : null;

    // hourly vs fixed
    var hourlyCount = 0;
    var fixedCount = 0;
    history.forEach(function (j) {
      if (j.type === 'hourly' || j.type === 'Hourly') hourlyCount++;
      else fixedCount++;
    });

    // earnings by category
    var catMap = {};
    history.forEach(function (j) {
      var cat = categorize(j.title || j.name || '');
      var earned = Number(j.earnings || j.amount || j.totalEarned || 0);
      catMap[cat] = (catMap[cat] || 0) + earned;
    });

    // top category
    var topCat = null;
    var topVal = 0;
    Object.keys(catMap).forEach(function (k) {
      if (catMap[k] > topVal) { topVal = catMap[k]; topCat = k; }
    });

    // rate suggestion (+20%)
    var suggestedRate = effectiveRate != null ? Math.ceil(effectiveRate * 1.2) : null;
    var projectedYearly = suggestedRate && totalHours && months
      ? (totalHours / months) * 12 * suggestedRate
      : null;

    return {
      totalEarnings: totalEarnings,
      totalJobs: totalJobs,
      totalHours: totalHours,
      hourlyRate: hourlyRate,
      avgProject: avgProject,
      effectiveRate: effectiveRate,
      estMonthly: estMonthly,
      estYearly: estYearly,
      hourlyCount: hourlyCount,
      fixedCount: fixedCount,
      categories: catMap,
      topCategory: topCat,
      suggestedRate: suggestedRate,
      projectedYearly: projectedYearly,
      hasData: totalEarnings > 0 || totalJobs > 0,
      hasHistory: history.length > 0,
    };
  }

  /* ───────── styles ───────── */

  var CSS = [
    '.cea-root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e4e4e7;background:#18181b;border-radius:12px;padding:24px;max-width:720px}',
    '.cea-header{font-size:20px;font-weight:700;margin-bottom:20px}',
    '.cea-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}',
    '.cea-card{background:#27272a;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:4px}',
    '.cea-card-label{font-size:12px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.5px}',
    '.cea-card-value{font-size:22px;font-weight:700;color:#f4f4f5}',
    '.cea-card-sub{font-size:12px;color:#71717a}',
    '.cea-section{margin-bottom:20px}',
    '.cea-section-title{font-size:14px;font-weight:600;color:#a1a1aa;margin-bottom:10px}',
    '.cea-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
    '.cea-bar-label{width:110px;font-size:12px;color:#d4d4d8;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.cea-bar-track{flex:1;height:20px;background:#3f3f46;border-radius:4px;overflow:hidden}',
    '.cea-bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#6366f1,#818cf8);transition:width .4s ease}',
    '.cea-bar-val{width:60px;font-size:12px;color:#a1a1aa}',
    '.cea-insight{background:#27272a;border-left:3px solid #6366f1;border-radius:8px;padding:14px 16px;margin-bottom:10px;font-size:13px;line-height:1.5;color:#d4d4d8}',
    '.cea-insight strong{color:#f4f4f5}',
    '.cea-empty{text-align:center;padding:32px 16px;color:#71717a;font-size:14px}',
    '.cea-highlight{color:#818cf8;font-weight:600}',
    '.cea-compare-up{color:#34d399}',
    '.cea-compare-down{color:#f87171}',
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('cea-styles')) return;
    var s = document.createElement('style');
    s.id = 'cea-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ───────── rendering ───────── */

  function h(tag, cls, html) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  }

  function statCard(label, value, sub) {
    var card = h('div', 'cea-card');
    card.appendChild(h('span', 'cea-card-label', label));
    card.appendChild(h('span', 'cea-card-value', value));
    if (sub) card.appendChild(h('span', 'cea-card-sub', sub));
    return card;
  }

  function renderBarChart(categories) {
    var keys = Object.keys(categories).sort(function (a, b) { return categories[b] - categories[a]; });
    if (!keys.length) return null;
    var max = categories[keys[0]] || 1;

    var section = h('div', 'cea-section');
    section.appendChild(h('div', 'cea-section-title', '📊 Earnings by Category'));

    keys.forEach(function (k) {
      var pct = Math.max((categories[k] / max) * 100, 2);
      var row = h('div', 'cea-bar-row');
      row.appendChild(h('span', 'cea-bar-label', k));
      var track = h('div', 'cea-bar-track');
      var fill = h('div', 'cea-bar-fill');
      fill.style.width = pct + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(h('span', 'cea-bar-val', fmt(categories[k])));
      section.appendChild(row);
    });

    return section;
  }

  function renderEarningsAnalytics(profileData, container) {
    injectStyles();

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) {
      console.error('[CortexEarningsAnalytics] Container not found');
      return;
    }

    var root = h('div', 'cea-root');
    root.appendChild(h('div', 'cea-header', '💰 Earnings Insights'));

    var c = compute(profileData || {});

    if (!c.hasData) {
      root.appendChild(h('div', 'cea-empty', '📭 Not enough data to show earnings insights.<br>Complete some jobs to unlock analytics.'));
      container.appendChild(root);
      return;
    }

    // stat cards
    var grid = h('div', 'cea-grid');
    grid.appendChild(statCard('Total Earned', fmt(c.totalEarnings), c.totalJobs + ' job' + (c.totalJobs !== 1 ? 's' : '')));
    grid.appendChild(statCard('Avg Project', c.avgProject != null ? fmt(c.avgProject) : '—'));
    grid.appendChild(statCard('Effective $/hr', c.effectiveRate != null ? fmt(c.effectiveRate, 2) : '—', c.totalHours ? c.totalHours.toLocaleString() + ' hrs tracked' : 'No hours data'));
    grid.appendChild(statCard('Est. Monthly', c.estMonthly != null ? fmt(c.estMonthly) : '—', c.estMonthly != null ? 'based on tenure' : 'Need memberSince'));
    root.appendChild(grid);

    // bar chart
    if (c.hasHistory) {
      var chart = renderBarChart(c.categories);
      if (chart) root.appendChild(chart);
    }

    // earnings potential
    if (c.estYearly != null) {
      var potentialHTML = '🚀 <strong>Earnings Potential</strong><br>';
      potentialHTML += 'At your current pace, you\'ll earn <span class="cea-highlight">' + fmt(c.estYearly) + '</span> this year.';
      if (c.suggestedRate && c.projectedYearly) {
        potentialHTML += ' Raising your rate to <span class="cea-highlight">' + fmt(c.suggestedRate) + '/hr</span> would project <span class="cea-highlight">' + fmt(c.projectedYearly) + '</span>.';
      }
      root.appendChild(h('div', 'cea-insight', potentialHTML));
    }

    // rate comparison
    if (c.effectiveRate != null && c.hourlyRate > 0) {
      var diff = c.effectiveRate - c.hourlyRate;
      var dir = diff >= 0 ? 'higher' : 'lower';
      var cls = diff >= 0 ? 'cea-compare-up' : 'cea-compare-down';
      var compHTML = '📈 Your effective rate (<strong>' + fmt(c.effectiveRate, 2) + '/hr</strong>) is ';
      compHTML += '<span class="' + cls + '">' + dir + '</span>';
      compHTML += ' than your listed rate (<strong>' + fmt(c.hourlyRate, 2) + '/hr</strong>)';
      if (Math.abs(diff) > 0.01) {
        compHTML += ' by ' + fmt(Math.abs(diff), 2);
      }
      root.appendChild(h('div', 'cea-insight', compHTML));
    }

    // hourly vs fixed
    if (c.hasHistory && (c.hourlyCount + c.fixedCount) > 0) {
      var total = c.hourlyCount + c.fixedCount;
      var hPct = Math.round((c.hourlyCount / total) * 100);
      var fPct = 100 - hPct;
      var mixHTML = '⚖️ Job mix: <strong>' + hPct + '% hourly</strong> / <strong>' + fPct + '% fixed-price</strong>';
      if (c.topCategory) {
        mixHTML += ' · Top category: <span class="cea-highlight">' + c.topCategory + '</span>';
      }
      root.appendChild(h('div', 'cea-insight', mixHTML));
    }

    container.appendChild(root);
  }

  /* ───────── public API ───────── */

  window.CortexEarningsAnalytics = {
    render: renderEarningsAnalytics,
    compute: compute,
  };

})();
