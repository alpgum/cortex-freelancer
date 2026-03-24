/**
 * ConnectsSpendingRoi — Connects Spending ROI Calculator
 * Track Upwork connects spent per proposal, calculate cost per hire and ROI.
 * [CF-058]
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_connects_roi';
  var CONNECT_COST = 0.15;

  /* ── Helpers ── */

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function generateId() {
    return 'prop_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  function formatCurrency(val) {
    return '$' + val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatPercent(val) {
    return val.toFixed(1) + '%';
  }

  function monthKey(dateStr) {
    var d = new Date(dateStr);
    var m = d.getMonth() + 1;
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m;
  }

  function monthLabel(key) {
    var parts = key.split('-');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
  }

  /* ── Mock Data ── */

  function generateMockData() {
    var proposals = [
      {
        id: 'prop_m001', date: '2026-01-05', jobTitle: 'React Dashboard for SaaS Platform',
        category: 'Web Development', connects: 12, bidAmount: 2500,
        outcome: 'hired', earnings: 2500
      },
      {
        id: 'prop_m002', date: '2026-01-08', jobTitle: 'WordPress Site Migration',
        category: 'Web Development', connects: 6, bidAmount: 800,
        outcome: 'rejected', earnings: 0
      },
      {
        id: 'prop_m003', date: '2026-01-12', jobTitle: 'Logo Design for Tech Startup',
        category: 'Design', connects: 4, bidAmount: 350,
        outcome: 'rejected', earnings: 0
      },
      {
        id: 'prop_m004', date: '2026-01-18', jobTitle: 'Python Data Pipeline Automation',
        category: 'Data Science', connects: 16, bidAmount: 4200,
        outcome: 'hired', earnings: 4200
      },
      {
        id: 'prop_m005', date: '2026-01-22', jobTitle: 'Mobile App Bug Fixes (iOS)',
        category: 'Mobile Development', connects: 8, bidAmount: 600,
        outcome: 'withdrawn', earnings: 0
      },
      {
        id: 'prop_m006', date: '2026-01-29', jobTitle: 'E-commerce Shopify Customization',
        category: 'Web Development', connects: 10, bidAmount: 1500,
        outcome: 'rejected', earnings: 0
      },
      {
        id: 'prop_m007', date: '2026-02-03', jobTitle: 'Node.js REST API Development',
        category: 'Web Development', connects: 14, bidAmount: 3200,
        outcome: 'hired', earnings: 3200
      },
      {
        id: 'prop_m008', date: '2026-02-07', jobTitle: 'Brand Identity Package',
        category: 'Design', connects: 6, bidAmount: 900,
        outcome: 'rejected', earnings: 0
      },
      {
        id: 'prop_m009', date: '2026-02-11', jobTitle: 'Machine Learning Model Training',
        category: 'Data Science', connects: 16, bidAmount: 5500,
        outcome: 'hired', earnings: 5500
      },
      {
        id: 'prop_m010', date: '2026-02-15', jobTitle: 'Vue.js Frontend Refactor',
        category: 'Web Development', connects: 10, bidAmount: 1800,
        outcome: 'rejected', earnings: 0
      },
      {
        id: 'prop_m011', date: '2026-02-20', jobTitle: 'Technical Writing — API Docs',
        category: 'Writing', connects: 2, bidAmount: 400,
        outcome: 'hired', earnings: 400
      },
      {
        id: 'prop_m012', date: '2026-02-25', jobTitle: 'React Native Cross-platform App',
        category: 'Mobile Development', connects: 14, bidAmount: 4000,
        outcome: 'pending', earnings: 0
      },
      {
        id: 'prop_m013', date: '2026-03-02', jobTitle: 'PostgreSQL Database Optimization',
        category: 'Data Science', connects: 8, bidAmount: 1200,
        outcome: 'rejected', earnings: 0
      },
      {
        id: 'prop_m014', date: '2026-03-08', jobTitle: 'Full-Stack MERN Application',
        category: 'Web Development', connects: 16, bidAmount: 6000,
        outcome: 'hired', earnings: 6000
      },
      {
        id: 'prop_m015', date: '2026-03-12', jobTitle: 'UI/UX Redesign for Mobile App',
        category: 'Design', connects: 10, bidAmount: 2200,
        outcome: 'pending', earnings: 0
      },
      {
        id: 'prop_m016', date: '2026-03-17', jobTitle: 'AWS Lambda Serverless Migration',
        category: 'Web Development', connects: 12, bidAmount: 3500,
        outcome: 'pending', earnings: 0
      },
      {
        id: 'prop_m017', date: '2026-03-21', jobTitle: 'Content Writing for SaaS Blog',
        category: 'Writing', connects: 2, bidAmount: 250,
        outcome: 'rejected', earnings: 0
      }
    ];

    return { proposals: proposals };
  }

  /* ── Core Logic ── */

  function getStats(data) {
    var proposals = (data && data.proposals) || [];
    var totalConnects = 0;
    var totalEarnings = 0;
    var hires = 0;
    var pending = 0;
    var rejected = 0;
    var withdrawn = 0;

    for (var i = 0; i < proposals.length; i++) {
      var p = proposals[i];
      totalConnects += p.connects || 0;
      totalEarnings += p.earnings || 0;
      if (p.outcome === 'hired') hires++;
      else if (p.outcome === 'pending') pending++;
      else if (p.outcome === 'rejected') rejected++;
      else if (p.outcome === 'withdrawn') withdrawn++;
    }

    var totalCost = totalConnects * CONNECT_COST;
    var costPerHire = hires > 0 ? totalCost / hires : 0;
    var roi = totalCost > 0 ? ((totalEarnings - totalCost) / totalCost) * 100 : 0;

    return {
      totalProposals: proposals.length,
      totalConnects: totalConnects,
      totalCost: totalCost,
      totalEarnings: totalEarnings,
      hires: hires,
      pending: pending,
      rejected: rejected,
      withdrawn: withdrawn,
      costPerHire: costPerHire,
      roi: roi,
      avgConnectsPerProposal: proposals.length > 0 ? totalConnects / proposals.length : 0,
      hireRate: proposals.length > 0 ? (hires / proposals.length) * 100 : 0
    };
  }

  function getROIByCategory(data) {
    var proposals = (data && data.proposals) || [];
    var categories = {};

    for (var i = 0; i < proposals.length; i++) {
      var p = proposals[i];
      var cat = p.category || 'Uncategorized';
      if (!categories[cat]) {
        categories[cat] = {
          category: cat,
          proposals: 0,
          connects: 0,
          hires: 0,
          earnings: 0,
          cost: 0
        };
      }
      categories[cat].proposals++;
      categories[cat].connects += p.connects || 0;
      categories[cat].earnings += p.earnings || 0;
      if (p.outcome === 'hired') categories[cat].hires++;
    }

    var result = [];
    var keys = Object.keys(categories);
    for (var k = 0; k < keys.length; k++) {
      var c = categories[keys[k]];
      c.cost = c.connects * CONNECT_COST;
      c.roi = c.cost > 0 ? ((c.earnings - c.cost) / c.cost) * 100 : 0;
      c.costPerHire = c.hires > 0 ? c.cost / c.hires : 0;
      c.hireRate = c.proposals > 0 ? (c.hires / c.proposals) * 100 : 0;
      result.push(c);
    }

    result.sort(function (a, b) { return b.roi - a.roi; });
    return result;
  }

  function getMonthlyBreakdown(data) {
    var proposals = (data && data.proposals) || [];
    var months = {};

    for (var i = 0; i < proposals.length; i++) {
      var p = proposals[i];
      var mk = monthKey(p.date);
      if (!months[mk]) {
        months[mk] = {
          month: mk,
          proposals: 0,
          connects: 0,
          hires: 0,
          earnings: 0,
          cost: 0
        };
      }
      months[mk].proposals++;
      months[mk].connects += p.connects || 0;
      months[mk].earnings += p.earnings || 0;
      if (p.outcome === 'hired') months[mk].hires++;
    }

    var result = [];
    var keys = Object.keys(months).sort();
    for (var k = 0; k < keys.length; k++) {
      var m = months[keys[k]];
      m.cost = m.connects * CONNECT_COST;
      m.roi = m.cost > 0 ? ((m.earnings - m.cost) / m.cost) * 100 : 0;
      m.label = monthLabel(m.month);
      result.push(m);
    }

    return result;
  }

  function addProposal(data, proposal) {
    data = data || { proposals: [] };
    if (!data.proposals) data.proposals = [];

    var entry = {
      id: generateId(),
      date: proposal.date || new Date().toISOString().slice(0, 10),
      jobTitle: proposal.jobTitle || 'Untitled Job',
      category: proposal.category || 'Uncategorized',
      connects: parseInt(proposal.connects, 10) || 0,
      bidAmount: parseFloat(proposal.bidAmount) || 0,
      outcome: proposal.outcome || 'pending',
      earnings: parseFloat(proposal.earnings) || 0
    };

    data.proposals.push(entry);
    saveData(data);
    return data;
  }

  /* ── Render ── */

  function statusBadge(outcome) {
    var colors = {
      hired: { bg: '#d1fae5', text: '#065f46', label: 'Hired' },
      rejected: { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' },
      pending: { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
      withdrawn: { bg: '#e5e7eb', text: '#374151', label: 'Withdrawn' }
    };
    var c = colors[outcome] || colors.pending;
    return '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;' +
      'font-weight:600;background:' + c.bg + ';color:' + c.text + ';">' + c.label + '</span>';
  }

  function roiColor(roi) {
    if (roi >= 5000) return '#065f46';
    if (roi >= 1000) return '#047857';
    if (roi >= 0) return '#92400e';
    return '#991b1b';
  }

  function render(data) {
    data = data || loadData() || generateMockData();
    var stats = getStats(data);
    var categoryRoi = getROIByCategory(data);
    var monthly = getMonthlyBreakdown(data);
    var proposals = (data.proposals || []).slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    var html = '';

    /* ── Header ── */
    html += '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;' +
      'max-width:960px;margin:0 auto;padding:24px;">';
    html += '<h2 style="margin:0 0 4px 0;font-size:22px;color:#111827;">Connects Spending ROI Calculator</h2>';
    html += '<p style="margin:0 0 24px 0;font-size:14px;color:#6b7280;">Track connect spend efficiency and return on investment</p>';

    /* ── Summary Cards ── */
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:28px;">';

    var cards = [
      { label: 'Total Connects', value: stats.totalConnects, sub: formatPercent(stats.avgConnectsPerProposal) + ' avg/proposal', color: '#3b82f6' },
      { label: 'Total Cost', value: formatCurrency(stats.totalCost), sub: stats.totalProposals + ' proposals', color: '#8b5cf6' },
      { label: 'Hires', value: stats.hires, sub: formatPercent(stats.hireRate) + ' hire rate', color: '#10b981' },
      { label: 'Cost Per Hire', value: formatCurrency(stats.costPerHire), sub: stats.hires + ' of ' + stats.totalProposals + ' hired', color: '#f59e0b' },
      { label: 'ROI', value: formatPercent(stats.roi), sub: formatCurrency(stats.totalEarnings) + ' earned', color: roiColor(stats.roi) }
    ];

    for (var ci = 0; ci < cards.length; ci++) {
      var card = cards[ci];
      html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:18px;' +
        'box-shadow:0 1px 3px rgba(0,0,0,0.06);">';
      html += '<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">' + card.label + '</div>';
      html += '<div style="font-size:26px;font-weight:700;color:' + card.color + ';margin-bottom:4px;">' + card.value + '</div>';
      html += '<div style="font-size:12px;color:#9ca3af;">' + card.sub + '</div>';
      html += '</div>';
    }

    html += '</div>';

    /* ── Monthly Breakdown Table ── */
    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;' +
      'margin-bottom:28px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">';
    html += '<h3 style="margin:0 0 16px 0;font-size:16px;color:#111827;">Monthly Breakdown</h3>';
    html += '<div style="overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:2px solid #e5e7eb;">';
    var thStyle = 'padding:10px 12px;text-align:left;font-weight:600;color:#374151;white-space:nowrap;';
    html += '<th style="' + thStyle + '">Month</th>';
    html += '<th style="' + thStyle + 'text-align:center;">Proposals</th>';
    html += '<th style="' + thStyle + 'text-align:center;">Connects</th>';
    html += '<th style="' + thStyle + 'text-align:right;">Cost</th>';
    html += '<th style="' + thStyle + 'text-align:center;">Hires</th>';
    html += '<th style="' + thStyle + 'text-align:right;">Earnings</th>';
    html += '<th style="' + thStyle + 'text-align:right;">ROI</th>';
    html += '</tr></thead><tbody>';

    for (var mi = 0; mi < monthly.length; mi++) {
      var mo = monthly[mi];
      var rowBg = mi % 2 === 0 ? '#fff' : '#f9fafb';
      var tdStyle = 'padding:10px 12px;border-bottom:1px solid #f3f4f6;';
      html += '<tr style="background:' + rowBg + ';">';
      html += '<td style="' + tdStyle + 'font-weight:500;color:#111827;">' + mo.label + '</td>';
      html += '<td style="' + tdStyle + 'text-align:center;color:#6b7280;">' + mo.proposals + '</td>';
      html += '<td style="' + tdStyle + 'text-align:center;color:#6b7280;">' + mo.connects + '</td>';
      html += '<td style="' + tdStyle + 'text-align:right;color:#6b7280;">' + formatCurrency(mo.cost) + '</td>';
      html += '<td style="' + tdStyle + 'text-align:center;color:#6b7280;">' + mo.hires + '</td>';
      html += '<td style="' + tdStyle + 'text-align:right;font-weight:500;color:#059669;">' + formatCurrency(mo.earnings) + '</td>';
      html += '<td style="' + tdStyle + 'text-align:right;font-weight:600;color:' + roiColor(mo.roi) + ';">' + formatPercent(mo.roi) + '</td>';
      html += '</tr>';
    }

    html += '</tbody></table></div></div>';

    /* ── Category ROI Comparison ── */
    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;' +
      'margin-bottom:28px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">';
    html += '<h3 style="margin:0 0 16px 0;font-size:16px;color:#111827;">Category ROI Comparison</h3>';

    for (var cri = 0; cri < categoryRoi.length; cri++) {
      var cr = categoryRoi[cri];
      var barWidth = Math.min(100, Math.max(2, cr.roi / 100));
      var barColor = roiColor(cr.roi);

      html += '<div style="margin-bottom:16px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">';
      html += '<span style="font-size:14px;font-weight:500;color:#111827;">' + cr.category + '</span>';
      html += '<span style="font-size:13px;font-weight:600;color:' + barColor + ';">' + formatPercent(cr.roi) + ' ROI</span>';
      html += '</div>';
      html += '<div style="background:#f3f4f6;border-radius:6px;height:8px;overflow:hidden;">';
      html += '<div style="width:' + barWidth + '%;height:100%;background:' + barColor + ';border-radius:6px;' +
        'transition:width 0.3s ease;"></div>';
      html += '</div>';
      html += '<div style="display:flex;gap:16px;margin-top:4px;font-size:11px;color:#9ca3af;">';
      html += '<span>' + cr.proposals + ' proposals</span>';
      html += '<span>' + cr.hires + ' hires</span>';
      html += '<span>' + cr.connects + ' connects (' + formatCurrency(cr.cost) + ')</span>';
      html += '<span>' + formatCurrency(cr.earnings) + ' earned</span>';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';

    /* ── Recent Proposals List ── */
    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;' +
      'box-shadow:0 1px 3px rgba(0,0,0,0.06);">';
    html += '<h3 style="margin:0 0 16px 0;font-size:16px;color:#111827;">Recent Proposals</h3>';

    for (var pi = 0; pi < proposals.length; pi++) {
      var pr = proposals[pi];
      var borderLeft = pr.outcome === 'hired' ? '3px solid #10b981' :
                       pr.outcome === 'rejected' ? '3px solid #ef4444' :
                       pr.outcome === 'withdrawn' ? '3px solid #9ca3af' :
                       '3px solid #f59e0b';

      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;' +
        'border-left:' + borderLeft + ';background:#f9fafb;border-radius:6px;margin-bottom:10px;">';

      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:14px;font-weight:500;color:#111827;white-space:nowrap;overflow:hidden;' +
        'text-overflow:ellipsis;">' + pr.jobTitle + '</div>';
      html += '<div style="font-size:12px;color:#9ca3af;margin-top:2px;">';
      html += pr.date + ' &middot; ' + pr.category + ' &middot; ' + pr.connects + ' connects (' + formatCurrency(pr.connects * CONNECT_COST) + ')';
      html += '</div>';
      html += '</div>';

      html += '<div style="display:flex;align-items:center;gap:12px;flex-shrink:0;margin-left:16px;">';
      html += '<span style="font-size:14px;font-weight:500;color:#374151;">' + formatCurrency(pr.bidAmount) + '</span>';
      html += statusBadge(pr.outcome);
      if (pr.outcome === 'hired' && pr.earnings > 0) {
        html += '<span style="font-size:12px;font-weight:600;color:#059669;">+' + formatCurrency(pr.earnings) + '</span>';
      }
      html += '</div>';

      html += '</div>';
    }

    html += '</div>';

    /* ── Close wrapper ── */
    html += '</div>';

    return html;
  }

  /* ── Init ── */

  function init() {
    var data = loadData();
    if (!data) {
      data = generateMockData();
      saveData(data);
    }
    return data;
  }

  /* ── Public API ── */

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.connectsSpendingRoi = {
    init: init,
    render: render,
    addProposal: function (proposal) {
      var data = loadData() || { proposals: [] };
      return addProposal(data, proposal);
    },
    getStats: function () {
      var data = loadData() || generateMockData();
      return getStats(data);
    },
    getROIByCategory: function () {
      var data = loadData() || generateMockData();
      return getROIByCategory(data);
    },
    getMonthlyBreakdown: function () {
      var data = loadData() || generateMockData();
      return getMonthlyBreakdown(data);
    }
  };

})();
