/**
 * [CF-038] Proposal Submission Tracker with Status Updates
 * Track all submitted proposals: sent, viewed, shortlisted, hired, rejected
 * with timestamps and pipeline visualization.
 * Exposed on window.CortexFreelancer.proposalSubmissionTracker
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_proposal_submissions';

  var STATUSES = ['sent', 'viewed', 'shortlisted', 'hired', 'rejected'];

  var STATUS_COLORS = {
    sent: '#6366f1',
    viewed: '#3b82f6',
    shortlisted: '#f59e0b',
    hired: '#10b981',
    rejected: '#ef4444'
  };

  var STATUS_ICONS = {
    sent: '&#9993;',
    viewed: '&#128065;',
    shortlisted: '&#11088;',
    hired: '&#9989;',
    rejected: '&#10060;'
  };

  /* ── Mock Data ── */

  function generateMockData() {
    var clients = [
      'Acme Corp', 'TechFlow Inc', 'DataVerse', 'CloudNine Solutions',
      'PixelForge', 'NovaTech', 'BlueShift Labs', 'Meridian Digital',
      'Apex Systems', 'VectorWave', 'Stratos AI', 'PrimeStack',
      'Quantum Edge', 'NexGen Media', 'CipherPoint'
    ];
    var projects = [
      'React Dashboard Rebuild', 'API Integration Suite', 'Mobile App MVP',
      'Data Pipeline Optimization', 'E-commerce Platform', 'CRM System Overhaul',
      'Analytics Dashboard', 'Payment Gateway Integration', 'Cloud Migration',
      'DevOps Automation Pipeline', 'ML Model Deployment', 'SaaS Landing Page',
      'Inventory Management System', 'Real-time Chat Feature', 'Reporting Module'
    ];
    var platforms = ['Upwork', 'Freelancer.com', 'Toptal', 'Fiverr Pro', 'Direct'];

    var proposals = [];
    var now = Date.now();

    for (var i = 0; i < 25; i++) {
      var daysAgo = Math.floor(Math.random() * 60);
      var submittedAt = now - daysAgo * 86400000;
      var bidAmount = Math.floor(Math.random() * 8000) + 500;
      var status;
      var r = Math.random();
      if (r < 0.15) status = 'hired';
      else if (r < 0.35) status = 'shortlisted';
      else if (r < 0.55) status = 'viewed';
      else if (r < 0.75) status = 'rejected';
      else status = 'sent';

      var timeline = [{ status: 'sent', timestamp: submittedAt }];
      if (status !== 'sent') {
        timeline.push({ status: 'viewed', timestamp: submittedAt + Math.random() * 172800000 });
      }
      if (status === 'shortlisted' || status === 'hired') {
        timeline.push({ status: 'shortlisted', timestamp: submittedAt + 172800000 + Math.random() * 259200000 });
      }
      if (status === 'hired') {
        timeline.push({ status: 'hired', timestamp: submittedAt + 432000000 + Math.random() * 259200000 });
      }
      if (status === 'rejected') {
        timeline.push({ status: 'rejected', timestamp: submittedAt + 86400000 + Math.random() * 432000000 });
      }

      proposals.push({
        id: 'PRP-' + (1000 + i),
        client: clients[i % clients.length],
        project: projects[i % projects.length],
        platform: platforms[i % platforms.length],
        bidAmount: bidAmount,
        status: status,
        submittedAt: submittedAt,
        timeline: timeline,
        coverLetterWords: Math.floor(Math.random() * 300) + 100,
        responseTime: status !== 'sent' ? Math.floor(Math.random() * 120) + 1 : null
      });
    }

    return proposals.sort(function (a, b) { return b.submittedAt - a.submittedAt; });
  }

  /* ── Storage ── */

  function loadProposals() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    var data = generateMockData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  /* ── Helpers ── */

  function fmtCurrency(n) {
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  function fmtDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtTimeAgo(ts) {
    var diff = Date.now() - ts;
    var days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + 'd ago';
    if (days < 30) return Math.floor(days / 7) + 'w ago';
    return Math.floor(days / 30) + 'mo ago';
  }

  /* ── Analytics ── */

  function computeStats(proposals) {
    var total = proposals.length;
    var byCounts = { sent: 0, viewed: 0, shortlisted: 0, hired: 0, rejected: 0 };
    var totalBid = 0;
    var hiredBid = 0;
    var responseTimes = [];

    for (var i = 0; i < proposals.length; i++) {
      var p = proposals[i];
      byCounts[p.status]++;
      totalBid += p.bidAmount;
      if (p.status === 'hired') hiredBid += p.bidAmount;
      if (p.responseTime) responseTimes.push(p.responseTime);
    }

    var avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce(function (a, b) { return a + b; }, 0) / responseTimes.length)
      : 0;

    return {
      total: total,
      byCounts: byCounts,
      winRate: total > 0 ? ((byCounts.hired / total) * 100).toFixed(1) : '0',
      viewRate: total > 0 ? (((byCounts.viewed + byCounts.shortlisted + byCounts.hired) / total) * 100).toFixed(1) : '0',
      avgBid: total > 0 ? Math.round(totalBid / total) : 0,
      totalPipelineValue: totalBid,
      wonValue: hiredBid,
      avgResponseTime: avgResponseTime
    };
  }

  /* ── Rendering ── */

  function renderPipelineBar(stats) {
    var total = stats.total || 1;
    var html = '<div style="margin-bottom:24px;">';
    html += '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#94a3b8;">PROPOSAL PIPELINE</h3>';
    html += '<div style="display:flex;height:32px;border-radius:8px;overflow:hidden;background:#1e293b;">';

    for (var i = 0; i < STATUSES.length; i++) {
      var s = STATUSES[i];
      var count = stats.byCounts[s];
      var pct = (count / total) * 100;
      if (pct > 0) {
        html += '<div style="width:' + pct + '%;background:' + STATUS_COLORS[s] + ';display:flex;align-items:center;justify-content:center;'
          + 'font-size:11px;font-weight:600;color:#fff;min-width:' + (pct > 5 ? '0' : '24px') + ';" title="' + s + ': ' + count + '">';
        html += pct > 8 ? count : '';
        html += '</div>';
      }
    }

    html += '</div>';
    html += '<div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;">';
    for (var j = 0; j < STATUSES.length; j++) {
      var st = STATUSES[j];
      html += '<span style="display:flex;align-items:center;gap:4px;font-size:12px;color:#94a3b8;">'
        + '<span style="width:8px;height:8px;border-radius:50%;background:' + STATUS_COLORS[st] + ';"></span>'
        + st.charAt(0).toUpperCase() + st.slice(1) + ' (' + stats.byCounts[st] + ')</span>';
    }
    html += '</div></div>';
    return html;
  }

  function renderStatCards(stats) {
    var cards = [
      { label: 'Total Proposals', value: stats.total, sub: 'Last 60 days', color: '#6366f1' },
      { label: 'Win Rate', value: stats.winRate + '%', sub: stats.byCounts.hired + ' hired', color: '#10b981' },
      { label: 'View Rate', value: stats.viewRate + '%', sub: 'Proposals seen', color: '#3b82f6' },
      { label: 'Avg Bid', value: fmtCurrency(stats.avgBid), sub: fmtCurrency(stats.totalPipelineValue) + ' pipeline', color: '#f59e0b' },
      { label: 'Won Value', value: fmtCurrency(stats.wonValue), sub: 'Contracts won', color: '#10b981' },
      { label: 'Avg Response', value: stats.avgResponseTime + 'h', sub: 'Client response time', color: '#8b5cf6' }
    ];

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">';
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      html += '<div style="background:#1e293b;border-radius:10px;padding:16px;border-left:3px solid ' + c.color + ';">'
        + '<div style="font-size:12px;color:#64748b;margin-bottom:4px;">' + c.label + '</div>'
        + '<div style="font-size:22px;font-weight:700;color:#f1f5f9;">' + c.value + '</div>'
        + '<div style="font-size:11px;color:#475569;margin-top:2px;">' + c.sub + '</div>'
        + '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderTimeline(timeline) {
    var html = '<div style="display:flex;align-items:center;gap:4px;">';
    for (var i = 0; i < timeline.length; i++) {
      var t = timeline[i];
      html += '<div style="display:flex;align-items:center;gap:2px;" title="' + t.status + ': ' + fmtDate(t.timestamp) + '">'
        + '<span style="width:20px;height:20px;border-radius:50%;background:' + STATUS_COLORS[t.status]
        + ';display:flex;align-items:center;justify-content:center;font-size:10px;">'
        + STATUS_ICONS[t.status] + '</span>';
      if (i < timeline.length - 1) {
        html += '<span style="width:16px;height:2px;background:#334155;"></span>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderProposalTable(proposals, filter) {
    var filtered = filter === 'all' ? proposals : proposals.filter(function (p) { return p.status === filter; });

    var html = '<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;">';
    var filters = ['all'].concat(STATUSES);
    for (var f = 0; f < filters.length; f++) {
      var active = filters[f] === filter;
      html += '<button data-filter="' + filters[f] + '" style="padding:6px 14px;border-radius:6px;border:1px solid '
        + (active ? '#6366f1' : '#334155') + ';background:' + (active ? '#6366f1' : 'transparent')
        + ';color:' + (active ? '#fff' : '#94a3b8') + ';font-size:12px;cursor:pointer;">'
        + filters[f].charAt(0).toUpperCase() + filters[f].slice(1)
        + (filters[f] !== 'all' ? ' (' + proposals.filter(function (p) { return p.status === filters[f]; }).length + ')' : '')
        + '</button>';
    }
    html += '</div>';

    html += '<div style="overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:1px solid #334155;">'
      + '<th style="text-align:left;padding:10px 8px;color:#64748b;font-weight:500;">Project</th>'
      + '<th style="text-align:left;padding:10px 8px;color:#64748b;font-weight:500;">Client</th>'
      + '<th style="text-align:left;padding:10px 8px;color:#64748b;font-weight:500;">Platform</th>'
      + '<th style="text-align:right;padding:10px 8px;color:#64748b;font-weight:500;">Bid</th>'
      + '<th style="text-align:center;padding:10px 8px;color:#64748b;font-weight:500;">Status</th>'
      + '<th style="text-align:center;padding:10px 8px;color:#64748b;font-weight:500;">Timeline</th>'
      + '<th style="text-align:right;padding:10px 8px;color:#64748b;font-weight:500;">Submitted</th>'
      + '</tr></thead><tbody>';

    for (var i = 0; i < filtered.length; i++) {
      var p = filtered[i];
      html += '<tr style="border-bottom:1px solid #1e293b;' + (i % 2 === 0 ? 'background:#0f172a;' : '') + '">'
        + '<td style="padding:10px 8px;color:#e2e8f0;font-weight:500;">' + p.project + '</td>'
        + '<td style="padding:10px 8px;color:#94a3b8;">' + p.client + '</td>'
        + '<td style="padding:10px 8px;color:#94a3b8;">' + p.platform + '</td>'
        + '<td style="padding:10px 8px;color:#f1f5f9;text-align:right;font-weight:600;">$' + p.bidAmount.toLocaleString() + '</td>'
        + '<td style="padding:10px 8px;text-align:center;">'
        + '<span style="padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:'
        + STATUS_COLORS[p.status] + '22;color:' + STATUS_COLORS[p.status] + ';">'
        + p.status.charAt(0).toUpperCase() + p.status.slice(1) + '</span></td>'
        + '<td style="padding:10px 8px;text-align:center;">' + renderTimeline(p.timeline) + '</td>'
        + '<td style="padding:10px 8px;color:#64748b;text-align:right;">' + fmtTimeAgo(p.submittedAt) + '</td>'
        + '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
  }

  function render(containerId, filter) {
    filter = filter || 'all';
    var proposals = loadProposals();
    var stats = computeStats(proposals);

    var html = '<div style="background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px;font-family:system-ui,-apple-system,sans-serif;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">'
      + '<div><h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">Proposal Submission Tracker</h2>'
      + '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">Track and manage all your submitted proposals</p></div>'
      + '<div style="font-size:12px;color:#64748b;">Last updated: ' + fmtDate(Date.now()) + '</div></div>';

    html += renderStatCards(stats);
    html += renderPipelineBar(stats);
    html += renderProposalTable(proposals, filter);
    html += '</div>';

    var container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = html;
      var buttons = container.querySelectorAll('[data-filter]');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function () {
          render(containerId, this.getAttribute('data-filter'));
        });
      }
    }
    return html;
  }

  function init(containerId) {
    return render(containerId || 'proposal-submission-tracker');
  }

  /* ── Export ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.proposalSubmissionTracker = {
    init: init,
    render: render,
    loadProposals: loadProposals,
    computeStats: computeStats
  };
})();
