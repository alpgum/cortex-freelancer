/**
 * CF-217: User Dashboard — Overview of All Activity
 * Dashboard cards showing profile score, recent proposals, earnings
 * summary, tool usage stats, upcoming tasks, quick actions.
 * Responsive grid layout.
 *
 * @namespace window.CortexFreelancer.UserDashboard
 */
(function () {
  'use strict';

  var STYLE_ID = 'cortex-user-dashboard-styles';
  var CONTAINER_ID = 'cortex-user-dashboard';

  // ─── Helpers ───────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function formatCurrency(amount) {
    return '$' + (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function timeAgo(ts) {
    if (!ts) return '';
    var diff = Date.now() - new Date(ts).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  // ─── CSS ───────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '#' + CONTAINER_ID + ' {' +
        'max-width: 1100px; margin: 0 auto; padding: 24px;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
        'color: #e0e0e0;' +
      '}' +
      '.dash-header { margin-bottom: 24px; }' +
      '.dash-header h1 { font-size: 24px; margin: 0; color: #00ff88; }' +
      '.dash-header .dash-greeting { color: #888; font-size: 14px; margin-top: 4px; }' +
      /* Grid */
      '.dash-grid {' +
        'display: grid; grid-template-columns: repeat(3, 1fr);' +
        'gap: 16px;' +
      '}' +
      '@media (max-width: 900px) { .dash-grid { grid-template-columns: repeat(2, 1fr); } }' +
      '@media (max-width: 600px) { .dash-grid { grid-template-columns: 1fr; } }' +
      /* Card */
      '.dash-card {' +
        'background: #1e1e2e; border: 1px solid #2d2d44; border-radius: 12px;' +
        'padding: 20px; transition: border-color 0.2s;' +
      '}' +
      '.dash-card:hover { border-color: rgba(0,255,136,0.3); }' +
      '.dash-card-title {' +
        'font-size: 12px; font-weight: 600; text-transform: uppercase;' +
        'letter-spacing: 0.5px; color: #888; margin: 0 0 12px;' +
      '}' +
      '.dash-card-value {' +
        'font-size: 32px; font-weight: 700; color: #00ff88; margin: 0 0 4px;' +
      '}' +
      '.dash-card-sub { font-size: 13px; color: #636e72; }' +
      /* Profile score ring */
      '.dash-score-ring { position: relative; width: 80px; height: 80px; margin: 0 auto 12px; }' +
      '.dash-score-ring svg { width: 80px; height: 80px; transform: rotate(-90deg); }' +
      '.dash-score-ring .ring-bg { fill: none; stroke: #2d2d44; stroke-width: 6; }' +
      '.dash-score-ring .ring-fill { fill: none; stroke: #00ff88; stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 0.6s ease; }' +
      '.dash-score-value {' +
        'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;' +
        'font-size: 20px; font-weight: 700; color: #e0e0e0;' +
      '}' +
      /* Proposals list */
      '.dash-proposal-item {' +
        'display: flex; justify-content: space-between; align-items: center;' +
        'padding: 8px 0; border-bottom: 1px solid #2d2d44;' +
      '}' +
      '.dash-proposal-item:last-child { border-bottom: none; }' +
      '.dash-proposal-name { font-size: 14px; color: #e0e0e0; }' +
      '.dash-proposal-status {' +
        'font-size: 12px; padding: 2px 8px; border-radius: 10px; font-weight: 600;' +
      '}' +
      '.dash-proposal-status.sent { background: rgba(0,184,148,0.15); color: #00b894; }' +
      '.dash-proposal-status.draft { background: rgba(99,110,114,0.2); color: #b2bec3; }' +
      '.dash-proposal-status.accepted { background: rgba(0,255,136,0.15); color: #00ff88; }' +
      '.dash-proposal-status.declined { background: rgba(214,48,49,0.15); color: #d63031; }' +
      /* Tool usage bars */
      '.dash-tool-item { margin-bottom: 10px; }' +
      '.dash-tool-item:last-child { margin-bottom: 0; }' +
      '.dash-tool-label { display: flex; justify-content: space-between; font-size: 13px; color: #b2bec3; margin-bottom: 4px; }' +
      '.dash-tool-bar { height: 6px; background: #2d2d44; border-radius: 3px; overflow: hidden; }' +
      '.dash-tool-bar-fill { height: 100%; background: #00ff88; border-radius: 3px; transition: width 0.4s; }' +
      /* Task list */
      '.dash-task-item {' +
        'display: flex; align-items: center; gap: 8px; padding: 6px 0;' +
        'font-size: 14px; color: #b2bec3;' +
      '}' +
      '.dash-task-dot {' +
        'width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;' +
      '}' +
      '.dash-task-dot.urgent { background: #d63031; }' +
      '.dash-task-dot.normal { background: #fdcb6e; }' +
      '.dash-task-dot.low { background: #636e72; }' +
      /* Quick actions */
      '.dash-actions { display: flex; flex-wrap: wrap; gap: 8px; }' +
      '.dash-action-btn {' +
        'background: rgba(0,255,136,0.1); color: #00ff88; border: 1px solid rgba(0,255,136,0.2);' +
        'padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;' +
        'cursor: pointer; font-family: inherit; transition: all 0.2s;' +
      '}' +
      '.dash-action-btn:hover { background: rgba(0,255,136,0.2); border-color: #00ff88; }';
    document.head.appendChild(s);
  }

  // ─── Data ──────────────────────────────────────────────

  function getDashboardData() {
    // Pull from other modules if available, else use demo data
    var ns = window.CortexFreelancer || {};

    var profileScore = 72;
    if (ns.ProfileOptimizer && typeof ns.ProfileOptimizer.getScore === 'function') {
      profileScore = ns.ProfileOptimizer.getScore() || profileScore;
    }

    var earnings = { total: 14850, thisMonth: 3200, pending: 1800 };
    if (ns.EarningsDashboard && typeof ns.EarningsDashboard.getSummary === 'function') {
      earnings = ns.EarningsDashboard.getSummary() || earnings;
    }

    var proposals = [
      { name: 'Website Redesign — Acme Corp', status: 'accepted', time: Date.now() - 86400000 },
      { name: 'Mobile App MVP — StartupX', status: 'sent', time: Date.now() - 172800000 },
      { name: 'Brand Identity — Bloom Co', status: 'draft', time: Date.now() - 259200000 },
      { name: 'API Integration — DataFlow', status: 'declined', time: Date.now() - 432000000 }
    ];

    var toolUsage = [
      { name: 'Proposal Writer', count: 24 },
      { name: 'Invoice Generator', count: 18 },
      { name: 'Rate Calculator', count: 15 },
      { name: 'Contract Review', count: 9 }
    ];

    var tasks = [
      { text: 'Send revised proposal to Acme Corp', priority: 'urgent' },
      { text: 'Follow up on StartupX contract', priority: 'normal' },
      { text: 'Update portfolio with recent work', priority: 'low' },
      { text: 'Review tax documents for Q1', priority: 'normal' }
    ];

    return {
      profileScore: profileScore,
      earnings: earnings,
      proposals: proposals,
      toolUsage: toolUsage,
      tasks: tasks
    };
  }

  // ─── Render ────────────────────────────────────────────

  function renderProfileCard(score) {
    var circumference = 2 * Math.PI * 34;
    var offset = circumference - (score / 100) * circumference;
    return '<div class="dash-card">' +
      '<div class="dash-card-title">Profile Score</div>' +
      '<div class="dash-score-ring">' +
        '<svg viewBox="0 0 80 80">' +
          '<circle class="ring-bg" cx="40" cy="40" r="34"/>' +
          '<circle class="ring-fill" cx="40" cy="40" r="34" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"/>' +
        '</svg>' +
        '<div class="dash-score-value">' + score + '</div>' +
      '</div>' +
      '<div class="dash-card-sub" style="text-align:center">' + (score >= 80 ? 'Great profile!' : 'Room to improve') + '</div>' +
    '</div>';
  }

  function renderEarningsCard(earnings) {
    return '<div class="dash-card">' +
      '<div class="dash-card-title">Earnings</div>' +
      '<div class="dash-card-value">' + formatCurrency(earnings.total) + '</div>' +
      '<div class="dash-card-sub">This month: ' + formatCurrency(earnings.thisMonth) + ' &middot; Pending: ' + formatCurrency(earnings.pending) + '</div>' +
    '</div>';
  }

  function renderProposalsCard(proposals) {
    var items = '';
    for (var i = 0; i < proposals.length; i++) {
      var p = proposals[i];
      items +=
        '<div class="dash-proposal-item">' +
          '<div>' +
            '<div class="dash-proposal-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="dash-card-sub">' + timeAgo(p.time) + '</div>' +
          '</div>' +
          '<span class="dash-proposal-status ' + escapeHtml(p.status) + '">' + escapeHtml(p.status) + '</span>' +
        '</div>';
    }
    return '<div class="dash-card">' +
      '<div class="dash-card-title">Recent Proposals</div>' +
      items +
    '</div>';
  }

  function renderToolUsageCard(tools) {
    var maxCount = 0;
    for (var i = 0; i < tools.length; i++) {
      if (tools[i].count > maxCount) maxCount = tools[i].count;
    }
    var items = '';
    for (var j = 0; j < tools.length; j++) {
      var t = tools[j];
      var pct = maxCount > 0 ? (t.count / maxCount) * 100 : 0;
      items +=
        '<div class="dash-tool-item">' +
          '<div class="dash-tool-label"><span>' + escapeHtml(t.name) + '</span><span>' + t.count + '</span></div>' +
          '<div class="dash-tool-bar"><div class="dash-tool-bar-fill" style="width:' + pct + '%"></div></div>' +
        '</div>';
    }
    return '<div class="dash-card">' +
      '<div class="dash-card-title">Tool Usage</div>' +
      items +
    '</div>';
  }

  function renderTasksCard(tasks) {
    var items = '';
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      items +=
        '<div class="dash-task-item">' +
          '<span class="dash-task-dot ' + escapeHtml(t.priority) + '"></span>' +
          '<span>' + escapeHtml(t.text) + '</span>' +
        '</div>';
    }
    return '<div class="dash-card">' +
      '<div class="dash-card-title">Upcoming Tasks</div>' +
      items +
    '</div>';
  }

  function renderQuickActions() {
    return '<div class="dash-card">' +
      '<div class="dash-card-title">Quick Actions</div>' +
      '<div class="dash-actions">' +
        '<button class="dash-action-btn" data-action="proposal">New Proposal</button>' +
        '<button class="dash-action-btn" data-action="invoice">Create Invoice</button>' +
        '<button class="dash-action-btn" data-action="rate">Check Rate</button>' +
        '<button class="dash-action-btn" data-action="contract">Review Contract</button>' +
      '</div>' +
    '</div>';
  }

  function render() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    var data = getDashboardData();
    var userName = '';
    try {
      var user = JSON.parse(localStorage.getItem('cortex_user') || '{}');
      userName = user.name || user.displayName || '';
    } catch (e) { /* ignore */ }

    var greeting = 'Welcome back' + (userName ? ', ' + escapeHtml(userName.split(' ')[0]) : '');

    container.innerHTML =
      '<div class="dash-header">' +
        '<h1>Dashboard</h1>' +
        '<p class="dash-greeting">' + greeting + '</p>' +
      '</div>' +
      '<div class="dash-grid">' +
        renderProfileCard(data.profileScore) +
        renderEarningsCard(data.earnings) +
        renderProposalsCard(data.proposals) +
        renderToolUsageCard(data.toolUsage) +
        renderTasksCard(data.tasks) +
        renderQuickActions() +
      '</div>';

    bindEvents(container);
  }

  // ─── Events ────────────────────────────────────────────

  function bindEvents(container) {
    var btns = container.querySelectorAll('.dash-action-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        var ns = window.CortexFreelancer || {};
        switch (action) {
          case 'proposal':
            if (ns.ProposalWriter && ns.ProposalWriter.init) ns.ProposalWriter.init();
            break;
          case 'invoice':
            if (ns.InvoiceGenerator && ns.InvoiceGenerator.init) ns.InvoiceGenerator.init();
            break;
          case 'rate':
            if (ns.HourlyRateCalc && ns.HourlyRateCalc.init) ns.HourlyRateCalc.init();
            break;
          case 'contract':
            if (ns.ContractReview && ns.ContractReview.init) ns.ContractReview.init();
            break;
        }
      });
    }
  }

  // ─── Init / Destroy ────────────────────────────────────

  function init(containerId) {
    injectStyles();
    var target = containerId || CONTAINER_ID;
    var container = document.getElementById(target);
    if (!container) {
      container = document.createElement('div');
      container.id = target;
      document.body.appendChild(container);
    }
    render();
    console.log('[UserDashboard] Module initialized');
  }

  function destroy() {
    var container = document.getElementById(CONTAINER_ID);
    if (container) container.innerHTML = '';
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.UserDashboard = {
    init: init,
    destroy: destroy,
    render: render,
    getDashboardData: getDashboardData
  };
})();
