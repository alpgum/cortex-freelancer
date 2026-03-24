/**
 * [CF-038] Proposal Submission Tracker with Status Updates
 * Track submitted proposals, update statuses, filter, sort, and export.
 * Statuses: sent, viewed, shortlisted, hired, rejected.
 *
 * window.CortexFreelancer.ProposalTracker
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_proposal_tracker';
  var CSS_INJECTED = false;

  var STATUSES = ['sent', 'viewed', 'shortlisted', 'hired', 'rejected'];
  var STATUS_COLORS = {
    sent: '#3b82f6',
    viewed: '#f59e0b',
    shortlisted: '#8b5cf6',
    hired: '#22c55e',
    rejected: '#ef4444'
  };

  var COLUMNS = [
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'clientName', label: 'Client' },
    { key: 'category', label: 'Category' },
    { key: 'budget', label: 'Budget' },
    { key: 'status', label: 'Status' },
    { key: 'submittedAt', label: 'Submitted' },
    { key: '_lastUpdated', label: 'Last Updated' }
  ];

  var _proposals = [];
  var _initialized = false;
  var _sortColumn = 'submittedAt';
  var _sortAsc = false;
  var _activeFilter = 'all';
  var _containerEl = null;

  // ─── Helpers ──────────────────────────────────────────────────────

  function _genId() {
    return 'ptr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  function _deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }

  function _escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_proposals)); } catch (e) { /* ignore */ }
  }

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) _proposals = JSON.parse(raw) || [];
    } catch (e) { _proposals = []; }
  }

  function _findIndex(id) {
    for (var i = 0; i < _proposals.length; i++) {
      if (_proposals[i].id === id) return i;
    }
    return -1;
  }

  function _formatDate(iso) {
    if (!iso) return '\u2014';
    try {
      var d = new Date(iso);
      var month = ('0' + (d.getMonth() + 1)).slice(-2);
      var day = ('0' + d.getDate()).slice(-2);
      var year = d.getFullYear();
      var hours = ('0' + d.getHours()).slice(-2);
      var mins = ('0' + d.getMinutes()).slice(-2);
      return year + '-' + month + '-' + day + ' ' + hours + ':' + mins;
    } catch (e) { return String(iso); }
  }

  function _getLastUpdated(proposal) {
    if (!proposal || !proposal.statusHistory || !proposal.statusHistory.length) {
      return proposal ? proposal.submittedAt : null;
    }
    return proposal.statusHistory[proposal.statusHistory.length - 1].timestamp;
  }

  // ─── Init ─────────────────────────────────────────────────────────

  /**
   * Initialize the proposal tracker. Loads stored proposals from localStorage.
   */
  function init() {
    if (_initialized) return;
    _initialized = true;
    _load();
  }

  // ─── CRUD Operations ──────────────────────────────────────────────

  /**
   * Add a new proposal to the tracker.
   * @param {Object} data - Proposal data.
   * @param {string} [data.jobId] - External job identifier.
   * @param {string} data.jobTitle - Title of the job posting.
   * @param {string} [data.clientName] - Name of the client.
   * @param {string} [data.category] - Job category.
   * @param {number|string} [data.budget] - Project budget.
   * @param {string} [data.submittedAt] - ISO date string; defaults to now.
   * @param {string} [data.notes] - Free-form notes.
   * @returns {Object|null} The created proposal entry, or null on invalid input.
   */
  function addProposal(data) {
    if (!_initialized) init();
    if (!data || !data.jobTitle) return null;

    var now = new Date().toISOString();
    var proposal = {
      id: _genId(),
      jobId: data.jobId || null,
      jobTitle: data.jobTitle,
      clientName: data.clientName || 'Unknown Client',
      category: data.category || 'General',
      budget: data.budget || null,
      status: 'sent',
      submittedAt: data.submittedAt || now,
      statusHistory: [{ status: 'sent', timestamp: now }],
      notes: data.notes || ''
    };

    _proposals.push(proposal);
    _persist();
    return _deepClone(proposal);
  }

  /**
   * Update the status of an existing proposal.
   * @param {string} id - The proposal ID.
   * @param {string} status - New status (sent, viewed, shortlisted, hired, rejected).
   * @returns {Object|null} The updated proposal, or null if not found or invalid status.
   */
  function updateStatus(id, status) {
    if (!_initialized) init();
    if (STATUSES.indexOf(status) === -1) return null;

    var idx = _findIndex(id);
    if (idx === -1) return null;

    _proposals[idx].status = status;
    _proposals[idx].statusHistory.push({
      status: status,
      timestamp: new Date().toISOString()
    });

    _persist();
    return _deepClone(_proposals[idx]);
  }

  /**
   * Remove a proposal from the tracker.
   * @param {string} id - The proposal ID.
   * @returns {boolean} True if removed, false if not found.
   */
  function removeProposal(id) {
    if (!_initialized) init();
    var idx = _findIndex(id);
    if (idx === -1) return false;
    _proposals.splice(idx, 1);
    _persist();
    return true;
  }

  /**
   * Get all tracked proposals.
   * @returns {Array} Array of proposal objects (deep cloned).
   */
  function getProposals() {
    if (!_initialized) init();
    return _deepClone(_proposals);
  }

  /**
   * Get proposals filtered by status.
   * @param {string} status - The status to filter by.
   * @returns {Array} Array of matching proposal objects.
   */
  function getProposalsByStatus(status) {
    if (!_initialized) init();
    return _deepClone(_proposals.filter(function (p) {
      return p.status === status;
    }));
  }

  // ─── Sorting ──────────────────────────────────────────────────────

  function _sortProposals(proposals, column, asc) {
    return proposals.slice().sort(function (a, b) {
      var valA, valB;

      if (column === '_lastUpdated') {
        valA = _getLastUpdated(a) || '';
        valB = _getLastUpdated(b) || '';
      } else {
        valA = a[column] || '';
        valB = b[column] || '';
      }

      if (column === 'budget') {
        valA = parseFloat(String(valA).replace(/[^0-9.-]/g, '')) || 0;
        valB = parseFloat(String(valB).replace(/[^0-9.-]/g, '')) || 0;
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return asc ? -1 : 1;
      if (valA > valB) return asc ? 1 : -1;
      return 0;
    });
  }

  // ─── Export CSV ───────────────────────────────────────────────────

  /**
   * Export all tracked proposals as a CSV string and trigger a file download.
   * @returns {string} The generated CSV content.
   */
  function exportCSV() {
    if (!_initialized) init();

    var headers = ['ID', 'Job ID', 'Job Title', 'Client', 'Category', 'Budget', 'Status', 'Submitted', 'Last Updated', 'Notes'];
    var rows = [headers.join(',')];

    for (var i = 0; i < _proposals.length; i++) {
      var p = _proposals[i];
      var row = [
        _csvEscape(p.id),
        _csvEscape(p.jobId || ''),
        _csvEscape(p.jobTitle),
        _csvEscape(p.clientName),
        _csvEscape(p.category),
        _csvEscape(String(p.budget || '')),
        _csvEscape(p.status),
        _csvEscape(p.submittedAt || ''),
        _csvEscape(_getLastUpdated(p) || ''),
        _csvEscape(p.notes || '')
      ];
      rows.push(row.join(','));
    }

    var csv = rows.join('\n');

    try {
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'proposals_' + new Date().toISOString().slice(0, 10) + '.csv';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) { /* ignore in non-browser environments */ }

    return csv;
  }

  function _csvEscape(value) {
    var str = String(value).replace(/"/g, '""');
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      return '"' + str + '"';
    }
    return str;
  }

  // ─── Render ───────────────────────────────────────────────────────

  /**
   * Render the proposal tracker UI into the specified container.
   * @param {HTMLElement|string} container - A DOM element or element ID string.
   */
  function render(container) {
    _injectCSS();
    if (!_initialized) init();

    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    _containerEl = el;

    _renderFull();
  }

  function _renderFull() {
    if (!_containerEl) return;

    var filtered = _activeFilter === 'all'
      ? _proposals.slice()
      : _proposals.filter(function (p) { return p.status === _activeFilter; });

    var sorted = _sortProposals(filtered, _sortColumn, _sortAsc);

    var h = '<div class="ptr-panel">';

    // Header
    h += '<div class="ptr-header">';
    h += '<div class="ptr-header-left">';
    h += '<span class="ptr-title">Proposal Tracker</span>';
    h += '<span class="ptr-badge">' + _proposals.length + ' total</span>';
    h += '</div>';
    h += '<div class="ptr-header-right">';
    h += '<button class="ptr-btn ptr-btn-secondary ptr-btn-export">Export CSV</button>';
    h += '</div>';
    h += '</div>';

    // Status filter tabs
    h += '<div class="ptr-tabs">';
    h += '<button class="ptr-tab' + (_activeFilter === 'all' ? ' ptr-tab-active' : '') + '" data-filter="all">All (' + _proposals.length + ')</button>';
    for (var s = 0; s < STATUSES.length; s++) {
      var st = STATUSES[s];
      var count = 0;
      for (var ci = 0; ci < _proposals.length; ci++) { if (_proposals[ci].status === st) count++; }
      var active = _activeFilter === st ? ' ptr-tab-active' : '';
      h += '<button class="ptr-tab' + active + '" data-filter="' + st + '">' + st.charAt(0).toUpperCase() + st.slice(1) + ' (' + count + ')</button>';
    }
    h += '</div>';

    // Table
    if (sorted.length === 0) {
      h += '<div class="ptr-empty">No proposals found.' + (_activeFilter !== 'all' ? ' Try a different filter.' : ' Add your first proposal to get started.') + '</div>';
    } else {
      h += '<div class="ptr-table-wrap"><table class="ptr-table">';
      h += '<thead><tr>';
      for (var col = 0; col < COLUMNS.length; col++) {
        var c = COLUMNS[col];
        var sortIndicator = '';
        if (_sortColumn === c.key) sortIndicator = _sortAsc ? ' \u25B2' : ' \u25BC';
        h += '<th class="ptr-th" data-sort="' + c.key + '">' + _escapeHtml(c.label) + sortIndicator + '</th>';
      }
      h += '<th class="ptr-th ptr-th-actions">Actions</th>';
      h += '</tr></thead>';

      h += '<tbody>';
      for (var r = 0; r < sorted.length; r++) {
        var p = sorted[r];
        var statusColor = STATUS_COLORS[p.status] || '#888';
        h += '<tr class="ptr-row" data-id="' + _escapeHtml(p.id) + '">';
        h += '<td class="ptr-td ptr-td-title">' + _escapeHtml(p.jobTitle) + '</td>';
        h += '<td class="ptr-td">' + _escapeHtml(p.clientName) + '</td>';
        h += '<td class="ptr-td">' + _escapeHtml(p.category) + '</td>';
        h += '<td class="ptr-td">' + _escapeHtml(p.budget != null ? '$' + p.budget : '\u2014') + '</td>';
        h += '<td class="ptr-td"><span class="ptr-status-badge" style="background:' + statusColor + '20;color:' + statusColor + ';border:1px solid ' + statusColor + '44;">' + _escapeHtml(p.status) + '</span></td>';
        h += '<td class="ptr-td ptr-td-date">' + _escapeHtml(_formatDate(p.submittedAt)) + '</td>';
        h += '<td class="ptr-td ptr-td-date">' + _escapeHtml(_formatDate(_getLastUpdated(p))) + '</td>';
        h += '<td class="ptr-td ptr-td-actions">';
        h += '<select class="ptr-status-select" data-id="' + _escapeHtml(p.id) + '">';
        for (var o = 0; o < STATUSES.length; o++) {
          var sel = STATUSES[o] === p.status ? ' selected' : '';
          h += '<option value="' + STATUSES[o] + '"' + sel + '>' + STATUSES[o].charAt(0).toUpperCase() + STATUSES[o].slice(1) + '</option>';
        }
        h += '</select>';
        h += '<button class="ptr-btn-icon ptr-btn-remove" data-id="' + _escapeHtml(p.id) + '" title="Remove">\u2715</button>';
        h += '</td></tr>';
      }
      h += '</tbody></table></div>';
    }

    h += '</div>';

    _containerEl.innerHTML = h;
    _bindEvents();
  }

  function _bindEvents() {
    if (!_containerEl) return;

    // Sort by column header click
    var ths = _containerEl.querySelectorAll('.ptr-th[data-sort]');
    for (var i = 0; i < ths.length; i++) {
      ths[i].addEventListener('click', function () {
        var col = this.getAttribute('data-sort');
        if (_sortColumn === col) {
          _sortAsc = !_sortAsc;
        } else {
          _sortColumn = col;
          _sortAsc = true;
        }
        _renderFull();
      });
    }

    // Filter tabs
    var tabs = _containerEl.querySelectorAll('.ptr-tab');
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].addEventListener('click', function () {
        _activeFilter = this.getAttribute('data-filter');
        _renderFull();
      });
    }

    // Status dropdown change
    var selects = _containerEl.querySelectorAll('.ptr-status-select');
    for (var s = 0; s < selects.length; s++) {
      selects[s].addEventListener('change', function () {
        var id = this.getAttribute('data-id');
        var newStatus = this.value;
        updateStatus(id, newStatus);
        _renderFull();
      });
    }

    // Remove buttons
    var removeBtns = _containerEl.querySelectorAll('.ptr-btn-remove');
    for (var r = 0; r < removeBtns.length; r++) {
      removeBtns[r].addEventListener('click', function (e) {
        e.stopPropagation();
        var id = this.getAttribute('data-id');
        removeProposal(id);
        _renderFull();
      });
    }

    // Export CSV button
    var exportBtn = _containerEl.querySelector('.ptr-btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        exportCSV();
        this.textContent = 'Exported!';
        var btn = this;
        setTimeout(function () { btn.textContent = 'Export CSV'; }, 2000);
      });
    }
  }

  // ─── Destroy ──────────────────────────────────────────────────────

  /**
   * Destroy the tracker UI and reset internal view state.
   */
  function destroy() {
    if (_containerEl) {
      _containerEl.innerHTML = '';
      _containerEl = null;
    }
    _activeFilter = 'all';
    _sortColumn = 'submittedAt';
    _sortAsc = false;
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.ptr-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;color:#e0e0e0}',
      '.ptr-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #222;background:#151515}',
      '.ptr-header-left{display:flex;align-items:center;gap:10px}',
      '.ptr-header-right{display:flex;align-items:center;gap:8px}',
      '.ptr-title{font-size:16px;font-weight:700;color:#e0e0e0}',
      '.ptr-badge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px}',
      '.ptr-tabs{display:flex;gap:6px;padding:12px 20px;flex-wrap:wrap;border-bottom:1px solid #222}',
      '.ptr-tab{background:#222;color:#aaa;border:1px solid #333;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}',
      '.ptr-tab:hover{background:#2a2a2a;color:#fff}',
      '.ptr-tab-active{background:#7c3aed33;color:#a78bfa;border-color:#7c3aed}',
      '.ptr-table-wrap{overflow-x:auto}',
      '.ptr-table{width:100%;border-collapse:collapse}',
      '.ptr-th{padding:10px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:1px solid #222;cursor:pointer;user-select:none;white-space:nowrap;background:#151515}',
      '.ptr-th:hover{color:#a78bfa}',
      '.ptr-th-actions{cursor:default;text-align:center}',
      '.ptr-th-actions:hover{color:#888}',
      '.ptr-row{border-bottom:1px solid #1a1a1a;transition:background .15s}',
      '.ptr-row:hover{background:#1a1a2a}',
      '.ptr-td{padding:10px 16px;font-size:13px;color:#ccc;white-space:nowrap}',
      '.ptr-td-title{color:#e0e0e0;font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis}',
      '.ptr-td-date{font-size:12px;color:#888}',
      '.ptr-td-actions{display:flex;align-items:center;gap:6px;justify-content:center}',
      '.ptr-status-badge{display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;text-transform:capitalize}',
      '.ptr-status-select{background:#1a1a1a;color:#e0e0e0;border:1px solid #333;border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;outline:none}',
      '.ptr-status-select:focus{border-color:#7c3aed}',
      '.ptr-btn{border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}',
      '.ptr-btn-primary{background:#7c3aed;color:#fff}',
      '.ptr-btn-primary:hover{background:#6d28d9}',
      '.ptr-btn-secondary{background:#222;color:#aaa;border:1px solid #333}',
      '.ptr-btn-secondary:hover{background:#2a2a2a;color:#fff}',
      '.ptr-btn-icon{background:none;border:none;color:#666;cursor:pointer;font-size:14px;padding:4px 6px;border-radius:4px;transition:all .15s}',
      '.ptr-btn-icon:hover{color:#ef4444;background:#2e1a1a}',
      '.ptr-empty{padding:40px 20px;text-align:center;color:#666;font-size:14px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Public API ───────────────────────────────────────────────────

  CF.ProposalTracker = {
    /** Initialize the proposal tracker. */
    init: init,
    /** Render the tracker UI into a container. */
    render: render,
    /** Destroy the tracker UI and clear references. */
    destroy: destroy,
    /** Add a new proposal entry. */
    addProposal: addProposal,
    /** Update the status of a proposal by ID. */
    updateStatus: updateStatus,
    /** Remove a proposal by ID. */
    removeProposal: removeProposal,
    /** Get all tracked proposals. */
    getProposals: getProposals,
    /** Get proposals filtered by status. */
    getProposalsByStatus: getProposalsByStatus,
    /** Export proposals as CSV with file download. */
    exportCSV: exportCSV,
    /** Module version. */
    version: '1.0.0'
  };

})();
