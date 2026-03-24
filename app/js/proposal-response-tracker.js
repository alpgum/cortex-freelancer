/**
 * [CF-040] Proposal Response Time Tracker
 * Measure time from submission to client response, show averages by category.
 * Stores timestamps, calculates stats, renders chart.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_proposal_response';
  var CSS_ID = 'cf-prt-styles';
  var _container = null;
  var _injected = false;

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function uid() { return 'prt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { proposals: [] }; }
    catch (e) { return { proposals: [] }; }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function formatDuration(ms) {
    if (!ms || ms <= 0) return '—';
    var hours = ms / 3600000;
    if (hours < 1) return Math.round(ms / 60000) + 'm';
    if (hours < 24) return Math.round(hours * 10) / 10 + 'h';
    var days = Math.round(hours / 24 * 10) / 10;
    return days + 'd';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  var CATEGORIES = ['Web Development', 'Mobile Apps', 'Data Science', 'UI/UX Design', 'DevOps', 'Writing', 'Marketing', 'Other'];

  function computeStats(proposals) {
    var byCategory = {};
    var allTimes = [];

    proposals.forEach(function (p) {
      if (!p.submittedAt || !p.respondedAt) return;
      var elapsed = new Date(p.respondedAt) - new Date(p.submittedAt);
      if (elapsed <= 0) return;

      allTimes.push(elapsed);
      var cat = p.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = { times: [], count: 0, responded: 0 };
      byCategory[cat].times.push(elapsed);
      byCategory[cat].responded++;
    });

    proposals.forEach(function (p) {
      var cat = p.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = { times: [], count: 0, responded: 0 };
      byCategory[cat].count++;
    });

    // Compute averages
    var categoryStats = Object.keys(byCategory).map(function (cat) {
      var times = byCategory[cat].times;
      var avg = times.length > 0 ? times.reduce(function (a, b) { return a + b; }, 0) / times.length : 0;
      var min = times.length > 0 ? Math.min.apply(null, times) : 0;
      var max = times.length > 0 ? Math.max.apply(null, times) : 0;
      return {
        category: cat,
        avgTime: avg,
        minTime: min,
        maxTime: max,
        totalSent: byCategory[cat].count,
        responded: byCategory[cat].responded,
        responseRate: byCategory[cat].count > 0 ? (byCategory[cat].responded / byCategory[cat].count * 100) : 0
      };
    });

    categoryStats.sort(function (a, b) { return a.avgTime - b.avgTime; });

    var overallAvg = allTimes.length > 0 ? allTimes.reduce(function (a, b) { return a + b; }, 0) / allTimes.length : 0;

    return {
      overall: { avgTime: overallAvg, totalSent: proposals.length, responded: allTimes.length },
      byCategory: categoryStats,
      maxAvg: categoryStats.length > 0 ? Math.max.apply(null, categoryStats.map(function (s) { return s.avgTime; })) : 0
    };
  }

  /* ── CSS ── */

  function injectCSS() {
    if (_injected) return;
    _injected = true;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.prt-panel{background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#1e1e1e);border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--text-primary,#e0e0e0);overflow:hidden}',
      '.prt-header{padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e);display:flex;align-items:center;justify-content:space-between}',
      '.prt-title{font-size:16px;font-weight:700}',
      '.prt-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e)}',
      '.prt-stat{text-align:center}',
      '.prt-stat-value{font-size:24px;font-weight:800;color:#7c3aed}',
      '.prt-stat-label{font-size:11px;color:var(--text-muted,#888);margin-top:2px}',
      '.prt-chart{padding:16px 20px}',
      '.prt-chart-title{font-size:12px;font-weight:600;color:var(--text-secondary,#ccc);margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}',
      '.prt-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
      '.prt-bar-label{width:120px;font-size:12px;color:var(--text-secondary,#ccc);text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.prt-bar-track{flex:1;height:24px;background:var(--bg-secondary,#111);border-radius:6px;overflow:hidden;position:relative}',
      '.prt-bar-fill{height:100%;border-radius:6px;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:600;color:#fff;white-space:nowrap;min-width:40px;transition:width .3s}',
      '.prt-bar-meta{width:80px;font-size:11px;color:var(--text-muted,#888);flex-shrink:0}',
      '.prt-list{padding:0 20px 16px}',
      '.prt-list-title{font-size:12px;font-weight:600;color:var(--text-secondary,#ccc);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;padding-top:8px;border-top:1px solid var(--border,#1e1e1e)}',
      '.prt-entry{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-secondary,#111);border:1px solid var(--border,#1e1e1e);border-radius:8px;margin-bottom:6px;font-size:12px}',
      '.prt-entry-info{flex:1;overflow:hidden}',
      '.prt-entry-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.prt-entry-meta{color:var(--text-muted,#888);font-size:11px;margin-top:2px}',
      '.prt-entry-time{font-weight:700;margin-left:12px;white-space:nowrap}',
      '.prt-entry-actions{display:flex;gap:4px;margin-left:8px}',
      '.prt-btn{border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;padding:6px 12px}',
      '.prt-btn-primary{background:#7c3aed;color:#fff}',
      '.prt-btn-primary:hover{background:#6d28d9}',
      '.prt-btn-sm{background:var(--bg-primary,#1a1a1a);color:var(--text-primary,#e0e0e0);border:1px solid var(--border,#333);padding:4px 8px;font-size:11px}',
      '.prt-btn-sm:hover{background:var(--border,#333)}',
      '.prt-btn-success{background:#22c55e;color:#fff}',
      '.prt-btn-success:hover{background:#16a34a}',
      '.prt-form{padding:16px 20px;border-top:1px solid var(--border,#1e1e1e)}',
      '.prt-form-title{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text-secondary,#ccc)}',
      '.prt-form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:12px}',
      '.prt-field label{display:block;font-size:11px;color:var(--text-muted,#888);margin-bottom:3px}',
      '.prt-field input,.prt-field select{width:100%;background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:13px;padding:5px 8px;box-sizing:border-box}',
      '.prt-empty{text-align:center;padding:30px 20px;color:var(--text-muted,#888);font-size:13px}',
      '.prt-pending{color:#f59e0b}',
      '.prt-responded{color:#22c55e}',
      '@media(max-width:600px){.prt-stats{grid-template-columns:1fr}.prt-bar-label{width:80px}.prt-form-grid{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Render ── */

  function render(container) {
    injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    _container = el;
    renderPanel(el);
  }

  function renderPanel(el) {
    var data = loadData();
    var stats = computeStats(data.proposals);

    var h = '<div class="prt-panel">';

    // Header
    h += '<div class="prt-header"><span class="prt-title">Response Time Tracker</span>';
    h += '<button class="prt-btn prt-btn-primary" id="prt-new">+ Log Proposal</button></div>';

    // Overall stats
    h += '<div class="prt-stats">';
    h += '<div class="prt-stat"><div class="prt-stat-value">' + formatDuration(stats.overall.avgTime) + '</div><div class="prt-stat-label">Avg Response Time</div></div>';
    h += '<div class="prt-stat"><div class="prt-stat-value">' + stats.overall.totalSent + '</div><div class="prt-stat-label">Proposals Sent</div></div>';
    var responseRate = stats.overall.totalSent > 0 ? Math.round(stats.overall.responded / stats.overall.totalSent * 100) : 0;
    h += '<div class="prt-stat"><div class="prt-stat-value">' + responseRate + '%</div><div class="prt-stat-label">Response Rate</div></div>';
    h += '</div>';

    // Category chart
    if (stats.byCategory.length > 0) {
      h += '<div class="prt-chart"><div class="prt-chart-title">Average Response Time by Category</div>';
      stats.byCategory.forEach(function (cat) {
        var pct = stats.maxAvg > 0 ? Math.max(5, (cat.avgTime / stats.maxAvg) * 100) : 0;
        var color = cat.avgTime < 86400000 ? '#22c55e' : cat.avgTime < 259200000 ? '#f59e0b' : '#ef4444';
        h += '<div class="prt-bar-row">';
        h += '<span class="prt-bar-label">' + esc(cat.category) + '</span>';
        h += '<div class="prt-bar-track"><div class="prt-bar-fill" style="width:' + pct + '%;background:' + color + '">' + formatDuration(cat.avgTime) + '</div></div>';
        h += '<span class="prt-bar-meta">' + cat.responded + '/' + cat.totalSent + ' (' + Math.round(cat.responseRate) + '%)</span>';
        h += '</div>';
      });
      h += '</div>';
    }

    // Recent proposals list
    h += '<div class="prt-list"><div class="prt-list-title">Recent Proposals</div>';
    if (data.proposals.length === 0) {
      h += '<div class="prt-empty">No proposals tracked yet. Log your first one to start tracking response times.</div>';
    } else {
      var sorted = data.proposals.slice().sort(function (a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); });
      sorted.slice(0, 15).forEach(function (p) {
        var elapsed = p.respondedAt ? new Date(p.respondedAt) - new Date(p.submittedAt) : null;
        var isPending = !p.respondedAt;
        h += '<div class="prt-entry">';
        h += '<div class="prt-entry-info"><div class="prt-entry-name">' + esc(p.title) + '</div>';
        h += '<div class="prt-entry-meta">' + esc(p.category) + ' &middot; Sent ' + formatDate(p.submittedAt);
        if (p.respondedAt) h += ' &middot; Replied ' + formatDate(p.respondedAt);
        h += '</div></div>';
        if (isPending) {
          h += '<span class="prt-entry-time prt-pending">Pending</span>';
          h += '<div class="prt-entry-actions"><button class="prt-btn prt-btn-success prt-btn-sm" data-respond="' + esc(p.id) + '">Got Response</button>';
          h += '<button class="prt-btn prt-btn-sm" data-delete="' + esc(p.id) + '">&#10005;</button></div>';
        } else {
          h += '<span class="prt-entry-time prt-responded">' + formatDuration(elapsed) + '</span>';
          h += '<div class="prt-entry-actions"><button class="prt-btn prt-btn-sm" data-delete="' + esc(p.id) + '">&#10005;</button></div>';
        }
        h += '</div>';
      });
    }
    h += '</div>';

    // Add form (hidden by default)
    h += '<div class="prt-form" id="prt-form" style="display:none">';
    h += '<div class="prt-form-title">Log New Proposal</div>';
    h += '<div class="prt-form-grid">';
    h += '<div class="prt-field"><label>Proposal Title</label><input id="prt-title" placeholder="e.g. React dashboard for Acme"></div>';
    h += '<div class="prt-field"><label>Category</label><select id="prt-category">';
    CATEGORIES.forEach(function (c) { h += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
    h += '</select></div>';
    h += '<div class="prt-field"><label>Client Name</label><input id="prt-client" placeholder="e.g. Acme Corp"></div>';
    h += '</div>';
    h += '<button class="prt-btn prt-btn-primary" id="prt-submit">Log Proposal</button>';
    h += '</div>';

    h += '</div>';
    el.innerHTML = h;

    bindEvents(el);
  }

  function bindEvents(el) {
    // Toggle form
    var newBtn = el.querySelector('#prt-new');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        var form = el.querySelector('#prt-form');
        if (form) form.style.display = form.style.display === 'none' ? '' : 'none';
      });
    }

    // Submit new proposal
    var submitBtn = el.querySelector('#prt-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var title = (el.querySelector('#prt-title').value || '').trim();
        if (!title) return;
        var data = loadData();
        data.proposals.push({
          id: uid(),
          title: title,
          category: el.querySelector('#prt-category').value,
          client: (el.querySelector('#prt-client').value || '').trim(),
          submittedAt: new Date().toISOString(),
          respondedAt: null
        });
        saveData(data);
        renderPanel(el);
      });
    }

    // Mark as responded
    el.querySelectorAll('[data-respond]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-respond');
        var data = loadData();
        var p = data.proposals.find(function (pr) { return pr.id === id; });
        if (p) {
          p.respondedAt = new Date().toISOString();
          saveData(data);
          renderPanel(el);
        }
      });
    });

    // Delete
    el.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-delete');
        var data = loadData();
        data.proposals = data.proposals.filter(function (p) { return p.id !== id; });
        saveData(data);
        renderPanel(el);
      });
    });
  }

  function logProposal(title, category, client) {
    var data = loadData();
    var entry = {
      id: uid(),
      title: title,
      category: category || 'Other',
      client: client || '',
      submittedAt: new Date().toISOString(),
      respondedAt: null
    };
    data.proposals.push(entry);
    saveData(data);
    return entry;
  }

  function markResponded(proposalId) {
    var data = loadData();
    var p = data.proposals.find(function (pr) { return pr.id === proposalId; });
    if (p) {
      p.respondedAt = new Date().toISOString();
      saveData(data);
    }
    return p || null;
  }

  function getStats() {
    return computeStats(loadData().proposals);
  }

  function init(containerId) {
    if (containerId) render(containerId);
    return getStats();
  }

  function destroy() {
    if (_container) { _container.innerHTML = ''; _container = null; }
    var s = document.getElementById(CSS_ID);
    if (s) s.parentNode.removeChild(s);
    _injected = false;
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProposalResponseTracker = {
    init: init,
    render: render,
    destroy: destroy,
    logProposal: logProposal,
    markResponded: markResponded,
    getStats: getStats
  };
})();
