/**
 * CF-213: Admin Panel for User Management
 * Admin-only page showing users table, subscription stats,
 * usage metrics, and impersonate user functionality.
 *
 * @namespace window.CortexFreelancer.AdminPanel
 */
(function () {
  'use strict';

  var STYLE_ID = 'cortex-admin-panel-styles';
  var CONTAINER_ID = 'cortex-admin-panel';
  var USERS_PER_PAGE = 20;

  var state = {
    users: [],
    filteredUsers: [],
    searchQuery: '',
    filterPlan: 'all',
    filterStatus: 'all',
    sortField: 'lastActive',
    sortAsc: false,
    currentPage: 1,
    stats: { total: 0, active: 0, free: 0, pro: 0, enterprise: 0, lifetime: 0 },
    loading: false,
    impersonating: null
  };

  // ─── Helpers ───────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function isAdmin() {
    var ns = window.CortexFreelancer || {};
    if (ns.Auth && typeof ns.Auth.getCurrentUser === 'function') {
      var user = ns.Auth.getCurrentUser();
      return user && user.role === 'admin';
    }
    try {
      var userData = JSON.parse(localStorage.getItem('cortex_user') || '{}');
      return userData.role === 'admin';
    } catch (e) {
      return false;
    }
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function timeAgo(ts) {
    if (!ts) return 'Never';
    var diff = Date.now() - new Date(ts).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return formatDate(ts);
  }

  // ─── CSS ───────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '#' + CONTAINER_ID + ' {' +
        'max-width: 1200px; margin: 0 auto; padding: 24px;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
        'color: #e0e0e0;' +
      '}' +
      '#' + CONTAINER_ID + ' h1 { font-size: 24px; margin: 0 0 24px; color: #00ff88; }' +
      '.admin-access-denied {' +
        'text-align: center; padding: 80px 24px; color: #d63031; font-size: 18px;' +
      '}' +
      /* Stats row */
      '.admin-stats-row {' +
        'display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));' +
        'gap: 16px; margin-bottom: 24px;' +
      '}' +
      '.admin-stat-card {' +
        'background: #1e1e2e; border-radius: 10px; padding: 16px;' +
        'border: 1px solid #2d2d44;' +
      '}' +
      '.admin-stat-card .stat-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }' +
      '.admin-stat-card .stat-value { font-size: 28px; font-weight: 700; color: #00ff88; margin-top: 4px; }' +
      '.admin-stat-card .stat-value.warn { color: #fdcb6e; }' +
      /* Filters */
      '.admin-filters {' +
        'display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center;' +
      '}' +
      '.admin-filters input, .admin-filters select {' +
        'background: #1e1e2e; border: 1px solid #2d2d44; color: #e0e0e0;' +
        'padding: 8px 12px; border-radius: 6px; font-size: 14px;' +
      '}' +
      '.admin-filters input { flex: 1; min-width: 200px; }' +
      '.admin-filters input:focus, .admin-filters select:focus { outline: none; border-color: #00ff88; }' +
      /* Table */
      '.admin-table-wrap { overflow-x: auto; }' +
      '.admin-table {' +
        'width: 100%; border-collapse: collapse; font-size: 14px;' +
      '}' +
      '.admin-table th {' +
        'text-align: left; padding: 10px 12px; background: #1e1e2e;' +
        'color: #888; font-weight: 600; cursor: pointer; user-select: none;' +
        'border-bottom: 2px solid #2d2d44; white-space: nowrap;' +
      '}' +
      '.admin-table th:hover { color: #00ff88; }' +
      '.admin-table th .sort-arrow { margin-left: 4px; font-size: 10px; }' +
      '.admin-table td {' +
        'padding: 10px 12px; border-bottom: 1px solid #2d2d44;' +
      '}' +
      '.admin-table tr:hover td { background: rgba(0,255,136,0.03); }' +
      '.admin-status { padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }' +
      '.admin-status.active { background: rgba(0,255,136,0.15); color: #00ff88; }' +
      '.admin-status.inactive { background: rgba(214,48,49,0.15); color: #d63031; }' +
      '.admin-status.suspended { background: rgba(253,203,110,0.15); color: #fdcb6e; }' +
      '.admin-plan-badge { padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }' +
      '.admin-plan-badge.free { background: rgba(99,110,114,0.2); color: #b2bec3; }' +
      '.admin-plan-badge.pro { background: rgba(0,255,136,0.15); color: #00ff88; }' +
      '.admin-plan-badge.enterprise { background: rgba(108,92,231,0.15); color: #a29bfe; }' +
      '.admin-plan-badge.lifetime { background: rgba(253,203,110,0.15); color: #fdcb6e; }' +
      '.admin-btn-impersonate {' +
        'background: transparent; border: 1px solid #636e72; color: #b2bec3;' +
        'padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;' +
        'transition: all 0.2s;' +
      '}' +
      '.admin-btn-impersonate:hover { border-color: #00ff88; color: #00ff88; }' +
      /* Pagination */
      '.admin-pagination {' +
        'display: flex; justify-content: space-between; align-items: center;' +
        'margin-top: 16px; font-size: 13px; color: #888;' +
      '}' +
      '.admin-pagination button {' +
        'background: #1e1e2e; border: 1px solid #2d2d44; color: #e0e0e0;' +
        'padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;' +
      '}' +
      '.admin-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }' +
      '.admin-pagination button:not(:disabled):hover { border-color: #00ff88; }' +
      /* Impersonate banner */
      '.admin-impersonate-banner {' +
        'position: fixed; top: 0; left: 0; right: 0; z-index: 10000;' +
        'background: #d63031; color: #fff; text-align: center;' +
        'padding: 8px 16px; font-size: 14px; font-weight: 600;' +
      '}' +
      '.admin-impersonate-banner button {' +
        'background: #fff; color: #d63031; border: none; padding: 4px 12px;' +
        'border-radius: 4px; margin-left: 12px; cursor: pointer; font-weight: 600;' +
      '}' +
      '.admin-loading { text-align: center; padding: 40px; color: #888; }';
    document.head.appendChild(s);
  }

  // ─── Data ──────────────────────────────────────────────

  function loadUsers() {
    try {
      var stored = JSON.parse(localStorage.getItem('cortex_admin_users') || '[]');
      if (stored.length) return stored;
    } catch (e) { /* ignore */ }

    // Demo data for development
    return [
      { id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', plan: 'pro', status: 'active', lastActive: Date.now() - 120000, toolUses: 87 },
      { id: 'u2', name: 'Bob Smith', email: 'bob@example.com', plan: 'free', status: 'active', lastActive: Date.now() - 3600000, toolUses: 12 },
      { id: 'u3', name: 'Carol Davis', email: 'carol@example.com', plan: 'enterprise', status: 'active', lastActive: Date.now() - 86400000, toolUses: 234 },
      { id: 'u4', name: 'Dave Wilson', email: 'dave@example.com', plan: 'pro', status: 'inactive', lastActive: Date.now() - 604800000, toolUses: 45 },
      { id: 'u5', name: 'Eve Martin', email: 'eve@example.com', plan: 'lifetime', status: 'active', lastActive: Date.now() - 7200000, toolUses: 156 },
      { id: 'u6', name: 'Frank Brown', email: 'frank@example.com', plan: 'free', status: 'suspended', lastActive: Date.now() - 2592000000, toolUses: 3 }
    ];
  }

  function computeStats(users) {
    var s = { total: users.length, active: 0, free: 0, pro: 0, enterprise: 0, lifetime: 0 };
    for (var i = 0; i < users.length; i++) {
      if (users[i].status === 'active') s.active++;
      if (s[users[i].plan] !== undefined) s[users[i].plan]++;
    }
    return s;
  }

  function applyFilters() {
    var q = state.searchQuery.toLowerCase();
    state.filteredUsers = state.users.filter(function (u) {
      if (state.filterPlan !== 'all' && u.plan !== state.filterPlan) return false;
      if (state.filterStatus !== 'all' && u.status !== state.filterStatus) return false;
      if (q && u.name.toLowerCase().indexOf(q) === -1 && u.email.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    // Sort
    state.filteredUsers.sort(function (a, b) {
      var aVal = a[state.sortField] || '';
      var bVal = b[state.sortField] || '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      var cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return state.sortAsc ? cmp : -cmp;
    });
    state.currentPage = 1;
  }

  // ─── Impersonate ───────────────────────────────────────

  function impersonateUser(userId) {
    var user = state.users.find(function (u) { return u.id === userId; });
    if (!user) return;
    state.impersonating = user;
    try {
      localStorage.setItem('cortex_impersonate', JSON.stringify({ id: user.id, name: user.name, email: user.email }));
    } catch (e) { /* ignore */ }
    render();
  }

  function stopImpersonation() {
    state.impersonating = null;
    try { localStorage.removeItem('cortex_impersonate'); } catch (e) { /* ignore */ }
    render();
  }

  // ─── Render ────────────────────────────────────────────

  function renderStatsRow() {
    var s = state.stats;
    return '<div class="admin-stats-row">' +
      '<div class="admin-stat-card"><div class="stat-label">Total Users</div><div class="stat-value">' + s.total + '</div></div>' +
      '<div class="admin-stat-card"><div class="stat-label">Active</div><div class="stat-value">' + s.active + '</div></div>' +
      '<div class="admin-stat-card"><div class="stat-label">Free</div><div class="stat-value warn">' + s.free + '</div></div>' +
      '<div class="admin-stat-card"><div class="stat-label">Pro</div><div class="stat-value">' + s.pro + '</div></div>' +
      '<div class="admin-stat-card"><div class="stat-label">Enterprise</div><div class="stat-value">' + s.enterprise + '</div></div>' +
      '<div class="admin-stat-card"><div class="stat-label">Lifetime</div><div class="stat-value">' + s.lifetime + '</div></div>' +
    '</div>';
  }

  function renderFilters() {
    return '<div class="admin-filters">' +
      '<input type="text" id="admin-search" placeholder="Search by name or email…" value="' + escapeHtml(state.searchQuery) + '">' +
      '<select id="admin-filter-plan">' +
        '<option value="all"' + (state.filterPlan === 'all' ? ' selected' : '') + '>All Plans</option>' +
        '<option value="free"' + (state.filterPlan === 'free' ? ' selected' : '') + '>Free</option>' +
        '<option value="pro"' + (state.filterPlan === 'pro' ? ' selected' : '') + '>Pro</option>' +
        '<option value="enterprise"' + (state.filterPlan === 'enterprise' ? ' selected' : '') + '>Enterprise</option>' +
        '<option value="lifetime"' + (state.filterPlan === 'lifetime' ? ' selected' : '') + '>Lifetime</option>' +
      '</select>' +
      '<select id="admin-filter-status">' +
        '<option value="all"' + (state.filterStatus === 'all' ? ' selected' : '') + '>All Status</option>' +
        '<option value="active"' + (state.filterStatus === 'active' ? ' selected' : '') + '>Active</option>' +
        '<option value="inactive"' + (state.filterStatus === 'inactive' ? ' selected' : '') + '>Inactive</option>' +
        '<option value="suspended"' + (state.filterStatus === 'suspended' ? ' selected' : '') + '>Suspended</option>' +
      '</select>' +
    '</div>';
  }

  function sortArrow(field) {
    if (state.sortField !== field) return '';
    return '<span class="sort-arrow">' + (state.sortAsc ? '\u25B2' : '\u25BC') + '</span>';
  }

  function renderTable() {
    var start = (state.currentPage - 1) * USERS_PER_PAGE;
    var page = state.filteredUsers.slice(start, start + USERS_PER_PAGE);
    var totalPages = Math.max(1, Math.ceil(state.filteredUsers.length / USERS_PER_PAGE));

    var rows = '';
    for (var i = 0; i < page.length; i++) {
      var u = page[i];
      rows +=
        '<tr>' +
          '<td>' + escapeHtml(u.name) + '</td>' +
          '<td>' + escapeHtml(u.email) + '</td>' +
          '<td><span class="admin-plan-badge ' + escapeHtml(u.plan) + '">' + escapeHtml(u.plan) + '</span></td>' +
          '<td><span class="admin-status ' + escapeHtml(u.status) + '">' + escapeHtml(u.status) + '</span></td>' +
          '<td>' + timeAgo(u.lastActive) + '</td>' +
          '<td>' + (u.toolUses || 0) + '</td>' +
          '<td><button class="admin-btn-impersonate" data-uid="' + escapeHtml(u.id) + '">Impersonate</button></td>' +
        '</tr>';
    }

    return '<div class="admin-table-wrap"><table class="admin-table">' +
      '<thead><tr>' +
        '<th data-sort="name">Name' + sortArrow('name') + '</th>' +
        '<th data-sort="email">Email' + sortArrow('email') + '</th>' +
        '<th data-sort="plan">Plan' + sortArrow('plan') + '</th>' +
        '<th data-sort="status">Status' + sortArrow('status') + '</th>' +
        '<th data-sort="lastActive">Last Active' + sortArrow('lastActive') + '</th>' +
        '<th data-sort="toolUses">Usage' + sortArrow('toolUses') + '</th>' +
        '<th>Actions</th>' +
      '</tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="7" style="text-align:center;color:#888;padding:24px;">No users found</td></tr>') + '</tbody>' +
    '</table></div>' +
    '<div class="admin-pagination">' +
      '<span>Showing ' + (state.filteredUsers.length ? start + 1 : 0) + '–' + Math.min(start + USERS_PER_PAGE, state.filteredUsers.length) + ' of ' + state.filteredUsers.length + '</span>' +
      '<div>' +
        '<button id="admin-prev" ' + (state.currentPage <= 1 ? 'disabled' : '') + '>Previous</button> ' +
        '<button id="admin-next" ' + (state.currentPage >= totalPages ? 'disabled' : '') + '>Next</button>' +
      '</div>' +
    '</div>';
  }

  function renderImpersonateBanner() {
    if (!state.impersonating) return '';
    return '<div class="admin-impersonate-banner">' +
      'Impersonating: ' + escapeHtml(state.impersonating.name) + ' (' + escapeHtml(state.impersonating.email) + ')' +
      '<button id="admin-stop-impersonate">Stop</button>' +
    '</div>';
  }

  function render() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    if (!isAdmin()) {
      container.innerHTML = '<div class="admin-access-denied">Access Denied — Admin role required.</div>';
      return;
    }

    container.innerHTML = renderImpersonateBanner() +
      '<h1>Admin Panel</h1>' +
      renderStatsRow() +
      renderFilters() +
      renderTable();

    bindEvents(container);
  }

  // ─── Events ────────────────────────────────────────────

  function bindEvents(container) {
    var searchInput = container.querySelector('#admin-search');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        state.searchQuery = e.target.value;
        applyFilters();
        render();
      });
    }

    var planSelect = container.querySelector('#admin-filter-plan');
    if (planSelect) {
      planSelect.addEventListener('change', function (e) {
        state.filterPlan = e.target.value;
        applyFilters();
        render();
      });
    }

    var statusSelect = container.querySelector('#admin-filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', function (e) {
        state.filterStatus = e.target.value;
        applyFilters();
        render();
      });
    }

    // Sort headers
    var ths = container.querySelectorAll('.admin-table th[data-sort]');
    for (var i = 0; i < ths.length; i++) {
      ths[i].addEventListener('click', function (e) {
        var field = this.getAttribute('data-sort');
        if (state.sortField === field) {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortField = field;
          state.sortAsc = true;
        }
        applyFilters();
        render();
      });
    }

    // Impersonate buttons
    var impBtns = container.querySelectorAll('.admin-btn-impersonate');
    for (var j = 0; j < impBtns.length; j++) {
      impBtns[j].addEventListener('click', function () {
        impersonateUser(this.getAttribute('data-uid'));
      });
    }

    var stopBtn = container.querySelector('#admin-stop-impersonate');
    if (stopBtn) stopBtn.addEventListener('click', stopImpersonation);

    var prevBtn = container.querySelector('#admin-prev');
    if (prevBtn) prevBtn.addEventListener('click', function () { state.currentPage--; render(); });

    var nextBtn = container.querySelector('#admin-next');
    if (nextBtn) nextBtn.addEventListener('click', function () { state.currentPage++; render(); });
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
    state.users = loadUsers();
    state.stats = computeStats(state.users);
    applyFilters();
    render();
    console.log('[AdminPanel] Module initialized');
  }

  function destroy() {
    var container = document.getElementById(CONTAINER_ID);
    if (container) container.innerHTML = '';
    stopImpersonation();
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.AdminPanel = {
    init: init,
    destroy: destroy,
    render: render,
    isAdmin: isAdmin,
    impersonateUser: impersonateUser,
    stopImpersonation: stopImpersonation,
    getStats: function () { return state.stats; }
  };
})();
