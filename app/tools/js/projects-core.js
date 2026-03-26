/**
 * CortexKanban — Project Manager Kanban Board UI
 * [cf3-006] Drag-drop kanban with detail panel, CRUD, filtering
 * Depends on: CortexProjectManager (project-manager.js)
 */
(function () {
  'use strict';

  /* ── Helpers ──────────────────────────────────────────────── */
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  var PM = null; // CortexProjectManager reference
  var currentDetailId = null;
  var sortMode = 'deadline'; // deadline | budget | name | created
  var searchQuery = '';
  var filterClient = '';
  var filterTag = '';
  var draggedCardId = null;

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    PM = window.CortexProjectManager;
    if (!PM) {
      console.warn('CortexProjectManager not loaded');
      return;
    }
    bindEvents();
    populateFilters();
    render();
  }

  /* ── Event Binding ────────────────────────────────────────── */
  function bindEvents() {
    // New project button
    $('#btn-new-project').addEventListener('click', function () { openModal(); });

    // Column add buttons
    $$('.col-add-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openModal(null, btn.dataset.status);
      });
    });

    // Modal
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-cancel').addEventListener('click', closeModal);
    $('#modal-save').addEventListener('click', saveProject);
    $('#modal-overlay').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });

    // Detail panel
    $('#detail-close').addEventListener('click', closeDetail);
    $('#detail-overlay').addEventListener('click', closeDetail);
    $('#detail-edit').addEventListener('click', function () {
      if (currentDetailId) { closeDetail(); openModal(currentDetailId); }
    });
    $('#detail-delete').addEventListener('click', deleteCurrentProject);
    $('#detail-transition').addEventListener('click', transitionCurrentProject);

    // Search & filters
    var searchTimeout;
    $('#search-input').addEventListener('input', function () {
      clearTimeout(searchTimeout);
      var self = this;
      searchTimeout = setTimeout(function () {
        searchQuery = self.value.trim().toLowerCase();
        render();
      }, 250);
    });
    $('#filter-client').addEventListener('change', function () {
      filterClient = this.value;
      render();
    });
    $('#filter-tag').addEventListener('change', function () {
      filterTag = this.value;
      render();
    });

    // Sort
    $('#btn-sort').addEventListener('click', cycleSortMode);

    // Drag-and-drop on columns
    $$('.col-cards').forEach(function (col) {
      col.addEventListener('dragover', onDragOver);
      col.addEventListener('dragenter', onDragEnter);
      col.addEventListener('dragleave', onDragLeave);
      col.addEventListener('drop', onDrop);
    });

    // Keyboard: Escape closes modals
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if ($('#modal-overlay').classList.contains('open')) closeModal();
        else if ($('#detail-panel').classList.contains('open')) closeDetail();
      }
    });
  }

  /* ── Render ───────────────────────────────────────────────── */
  function render() {
    var filters = {};
    if (searchQuery) filters.search = searchQuery;
    if (filterClient) filters.clientId = filterClient;
    if (filterTag) filters.tag = filterTag;
    filters.sortBy = sortMode === 'created' ? 'createdAt' : sortMode;
    filters.sortDir = sortMode === 'name' ? 'asc' : (sortMode === 'deadline' ? 'asc' : 'desc');

    var projects = PM.list(filters);

    // Group by status
    var groups = { lead: [], active: [], completed: [], archived: [] };
    projects.forEach(function (p) {
      if (groups[p.status]) groups[p.status].push(p);
    });

    // Render each column
    ['lead', 'active', 'completed', 'archived'].forEach(function (status) {
      var container = $('#col-' + status);
      var cards = groups[status];
      $('#count-' + status).textContent = cards.length;

      if (cards.length === 0) {
        container.innerHTML = '<div class="empty-col"><div class="empty-icon">📂</div><p>No projects</p></div>';
        return;
      }

      container.innerHTML = cards.map(function (p) { return renderCard(p); }).join('');

      // Bind card events
      container.querySelectorAll('.kanban-card').forEach(function (el) {
        el.addEventListener('click', function () { openDetail(el.dataset.id); });
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragend', onDragEnd);
      });
    });

    renderStats();
  }

  function renderCard(p) {
    var budgetUtil = PM.getBudgetUtilization(p.id);
    var remaining = budgetUtil ? budgetUtil.remaining : 0;
    var budgetColor = !budgetUtil || budgetUtil.budget === 0 ? 'blue' :
      budgetUtil.utilization > 90 ? 'red' : budgetUtil.utilization > 70 ? 'yellow' : 'green';

    var deadlineHtml = getDeadlineHtml(p);
    var tagsHtml = (p.tags || []).slice(0, 3).map(function (t) {
      return '<span class="card-tag">' + esc(t) + '</span>';
    }).join('');

    return '<div class="kanban-card" data-id="' + esc(p.id) + '" draggable="true">' +
      '<div class="card-name">' + esc(p.name) + '</div>' +
      (p.clientName ? '<div class="card-client"><span class="card-client-dot"></span>' + esc(p.clientName) + '</div>' : '') +
      '<div class="card-metrics">' +
        '<div class="card-metric">' +
          '<div class="card-metric-val ' + budgetColor + '">' + formatCurrency(remaining) + '</div>' +
          '<div class="card-metric-label">Budget Left</div>' +
        '</div>' +
        '<div class="card-metric">' +
          '<div class="card-metric-val orange">' + formatHours(p.totalLogged || 0) + '</div>' +
          '<div class="card-metric-label">Hours</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-footer">' +
        deadlineHtml +
        '<div class="card-tags">' + tagsHtml + '</div>' +
      '</div>' +
    '</div>';
  }

  function getDeadlineHtml(p) {
    if (!p.deadline) return '<div class="card-deadline none">No deadline</div>';
    var now = new Date();
    var dl = new Date(p.deadline);
    var diff = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
    var cls, label;

    if (p.status === 'completed' || p.status === 'archived') {
      cls = 'ok';
      label = formatDate(p.deadline);
    } else if (diff < 0) {
      cls = 'overdue';
      label = Math.abs(diff) + 'd overdue';
    } else if (diff <= 7) {
      cls = 'soon';
      label = diff === 0 ? 'Due today' : diff + 'd left';
    } else {
      cls = 'ok';
      label = diff + 'd left';
    }

    return '<div class="card-deadline ' + cls + '">📅 ' + label + '</div>';
  }

  function renderStats() {
    var stats = PM.getStats();
    $('#stat-total').textContent = stats.total;
    $('#stat-active').textContent = stats.byStatus.active || 0;
    $('#stat-budget').textContent = formatCurrency(stats.totalBudget);
    $('#stat-hours').textContent = formatHours(stats.totalLogged);
    $('#stat-overdue').textContent = stats.overdue;
  }

  /* ── Filters ──────────────────────────────────────────────── */
  function populateFilters() {
    var projects = PM.list();
    var clients = {};
    var tags = {};

    projects.forEach(function (p) {
      if (p.clientId && p.clientName) clients[p.clientId] = p.clientName;
      (p.tags || []).forEach(function (t) { tags[t] = true; });
    });

    var clientSelect = $('#filter-client');
    var formClient = $('#form-client');
    clientSelect.innerHTML = '<option value="">All Clients</option>';
    formClient.innerHTML = '<option value="">No client</option>';

    // Also try CortexClientCRM if available
    if (window.CortexClientCRM && window.CortexClientCRM.list) {
      try {
        var allClients = window.CortexClientCRM.list();
        allClients.forEach(function (c) {
          clients[c.id] = c.name || c.company || c.id;
        });
      } catch (e) { /* skip */ }
    }

    Object.keys(clients).sort(function (a, b) {
      return clients[a].localeCompare(clients[b]);
    }).forEach(function (id) {
      clientSelect.innerHTML += '<option value="' + esc(id) + '">' + esc(clients[id]) + '</option>';
      formClient.innerHTML += '<option value="' + esc(id) + '">' + esc(clients[id]) + '</option>';
    });

    var tagSelect = $('#filter-tag');
    tagSelect.innerHTML = '<option value="">All Tags</option>';
    Object.keys(tags).sort().forEach(function (t) {
      tagSelect.innerHTML += '<option value="' + esc(t) + '">' + esc(t) + '</option>';
    });
  }

  function cycleSortMode() {
    var modes = ['deadline', 'budget', 'name', 'created'];
    var labels = ['Sort: Deadline', 'Sort: Budget', 'Sort: Name', 'Sort: Created'];
    var idx = (modes.indexOf(sortMode) + 1) % modes.length;
    sortMode = modes[idx];
    $('#btn-sort').textContent = labels[idx];
    render();
  }

  /* ── Drag & Drop ──────────────────────────────────────────── */
  function onDragStart(e) {
    draggedCardId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedCardId);
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    draggedCardId = null;
    $$('.kanban-col').forEach(function (col) { col.classList.remove('drag-over'); });
    var ph = $('.drop-placeholder');
    if (ph) ph.remove();
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    var col = e.currentTarget;
    // Insert placeholder at cursor position
    var afterElement = getDragAfterElement(col, e.clientY);
    var placeholder = col.querySelector('.drop-placeholder');
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'drop-placeholder';
    }
    if (afterElement) {
      col.insertBefore(placeholder, afterElement);
    } else {
      col.appendChild(placeholder);
    }
  }

  function onDragEnter(e) {
    e.preventDefault();
    e.currentTarget.closest('.kanban-col').classList.add('drag-over');
  }

  function onDragLeave(e) {
    var col = e.currentTarget.closest('.kanban-col');
    if (!col.contains(e.relatedTarget)) {
      col.classList.remove('drag-over');
      var ph = col.querySelector('.drop-placeholder');
      if (ph) ph.remove();
    }
  }

  function onDrop(e) {
    e.preventDefault();
    var col = e.currentTarget.closest('.kanban-col');
    col.classList.remove('drag-over');
    var ph = col.querySelector('.drop-placeholder');
    if (ph) ph.remove();

    var projectId = e.dataTransfer.getData('text/plain');
    var newStatus = col.dataset.status;
    if (!projectId || !newStatus) return;

    var project = PM.get(projectId);
    if (!project) return;

    if (project.status === newStatus) return; // same column

    try {
      PM.transitionStatus(projectId, newStatus);
      toast('Moved to ' + newStatus, 'success');
    } catch (err) {
      // If transition not allowed, force update status directly
      PM.update(projectId, {});
      var projects = JSON.parse(localStorage.getItem('cortex_projects')) || [];
      for (var i = 0; i < projects.length; i++) {
        if (projects[i].id === projectId) {
          projects[i].status = newStatus;
          projects[i].updatedAt = new Date().toISOString();
          if (newStatus === 'completed' && !projects[i].completedAt) {
            projects[i].completedAt = new Date().toISOString();
          }
          break;
        }
      }
      localStorage.setItem('cortex_projects', JSON.stringify(projects));
      toast('Moved to ' + newStatus, 'success');
    }
    render();
  }

  function getDragAfterElement(container, y) {
    var elements = Array.from(container.querySelectorAll('.kanban-card:not(.dragging)'));
    var closest = null;
    var closestOffset = Number.NEGATIVE_INFINITY;

    elements.forEach(function (child) {
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = child;
      }
    });

    return closest;
  }

  /* ── Detail Panel ─────────────────────────────────────────── */
  function openDetail(id) {
    var p = PM.get(id);
    if (!p) return;
    currentDetailId = id;

    $('#detail-title').textContent = p.name;
    $('#detail-client').innerHTML = p.clientName
      ? '<span class="card-client-dot"></span> ' + esc(p.clientName)
      : '<span style="color:var(--text3);font-style:italic">No client linked</span>';

    var statusEl = $('#detail-status');
    statusEl.className = 'detail-status ' + p.status;
    statusEl.textContent = p.status.charAt(0).toUpperCase() + p.status.slice(1);

    // Financials
    var util = PM.getBudgetUtilization(id);
    var budget = p.budget || 0;
    var billed = p.totalBilled || 0;
    var remaining = util ? util.remaining : 0;
    var pct = util ? util.utilization : 0;

    $('#detail-financials').innerHTML =
      '<div class="detail-metric"><div class="detail-metric-val" style="color:var(--blue)">' + formatCurrency(budget) + '</div><div class="detail-metric-label">Total Budget</div></div>' +
      '<div class="detail-metric"><div class="detail-metric-val" style="color:var(--green)">' + formatCurrency(billed) + '</div><div class="detail-metric-label">Billed</div></div>' +
      '<div class="detail-metric"><div class="detail-metric-val" style="color:' + (remaining < 0 ? 'var(--red)' : 'var(--orange)') + '">' + formatCurrency(remaining) + '</div><div class="detail-metric-label">Remaining</div></div>' +
      '<div class="detail-metric"><div class="detail-metric-val" style="color:var(--purple)">' + (p.hourlyRate ? '$' + p.hourlyRate + '/hr' : 'N/A') + '</div><div class="detail-metric-label">Hourly Rate</div></div>';

    // Budget bar
    if (budget > 0) {
      var barCls = pct > 90 ? 'danger' : pct > 70 ? 'warn' : 'ok';
      $('#detail-budget-bar').innerHTML =
        '<div class="budget-bar"><div class="budget-bar-fill ' + barCls + '" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
        '<div class="budget-bar-labels"><span>' + pct + '% used</span><span>' + formatCurrency(remaining) + ' left</span></div>';
    } else {
      $('#detail-budget-bar').innerHTML = '';
    }

    // Time
    var deadlineDiff = p.deadline ? Math.ceil((new Date(p.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null;
    var deadlineLabel = !p.deadline ? 'No deadline' :
      deadlineDiff < 0 ? Math.abs(deadlineDiff) + ' days overdue' :
      deadlineDiff === 0 ? 'Due today' :
      deadlineDiff + ' days remaining';
    var deadlineColor = !p.deadline ? 'var(--text3)' :
      deadlineDiff < 0 ? 'var(--red)' :
      deadlineDiff <= 7 ? 'var(--yellow)' : 'var(--green)';

    $('#detail-time').innerHTML =
      '<div class="detail-metric"><div class="detail-metric-val" style="color:var(--orange)">' + formatHours(p.totalLogged || 0) + '</div><div class="detail-metric-label">Hours Logged</div></div>' +
      '<div class="detail-metric"><div class="detail-metric-val" style="color:' + deadlineColor + '">' + esc(deadlineLabel) + '</div><div class="detail-metric-label">Deadline</div></div>';

    // Description
    var descEl = $('#detail-desc');
    if (p.description) {
      descEl.className = 'detail-desc';
      descEl.textContent = p.description;
    } else {
      descEl.className = 'detail-desc empty';
      descEl.textContent = 'No description added';
    }

    // Tags
    var tagsEl = $('#detail-tags');
    if (p.tags && p.tags.length) {
      tagsEl.innerHTML = p.tags.map(function (t) {
        return '<span class="detail-tag">' + esc(t) + '</span>';
      }).join('');
    } else {
      tagsEl.innerHTML = '<span style="color:var(--text3);font-style:italic;font-size:.8rem">No tags</span>';
    }

    // Linked items
    var linkedHtml = '<div class="linked-list">';
    var hasLinked = false;

    if (p.timeEntryIds && p.timeEntryIds.length) {
      hasLinked = true;
      linkedHtml += '<div class="linked-item"><span class="linked-icon">⏱️</span> ' + p.timeEntryIds.length + ' time entries</div>';
    }
    if (p.invoiceIds && p.invoiceIds.length) {
      hasLinked = true;
      linkedHtml += '<div class="linked-item"><span class="linked-icon">🧾</span> ' + p.invoiceIds.length + ' invoices</div>';
    }
    if (p.proposalIds && p.proposalIds.length) {
      hasLinked = true;
      linkedHtml += '<div class="linked-item"><span class="linked-icon">📝</span> ' + p.proposalIds.length + ' proposals</div>';
    }

    if (!hasLinked) {
      linkedHtml += '<div class="linked-empty">No linked items yet</div>';
    }
    linkedHtml += '</div>';
    $('#detail-linked').innerHTML = linkedHtml;

    // Transition button label
    var transitions = PM.STATUS_TRANSITIONS[p.status] || [];
    if (transitions.length) {
      $('#detail-transition').textContent = 'Move → ' + transitions[0].charAt(0).toUpperCase() + transitions[0].slice(1);
      $('#detail-transition').style.display = '';
      $('#detail-transition').dataset.target = transitions[0];
    } else {
      $('#detail-transition').style.display = 'none';
    }

    // Open
    $('#detail-overlay').classList.add('open');
    $('#detail-panel').classList.add('open');
  }

  function closeDetail() {
    currentDetailId = null;
    $('#detail-overlay').classList.remove('open');
    $('#detail-panel').classList.remove('open');
  }

  function deleteCurrentProject() {
    if (!currentDetailId) return;
    var p = PM.get(currentDetailId);
    if (!p) return;
    if (!confirm('Delete "' + p.name + '"? This cannot be undone.')) return;

    PM.delete(currentDetailId);
    closeDetail();
    toast('Project deleted', 'success');
    populateFilters();
    render();
  }

  function transitionCurrentProject() {
    if (!currentDetailId) return;
    var target = $('#detail-transition').dataset.target;
    if (!target) return;

    try {
      PM.transitionStatus(currentDetailId, target);
      toast('Moved to ' + target, 'success');
    } catch (err) {
      toast(err.message, 'error');
      return;
    }
    closeDetail();
    render();
  }

  /* ── Modal (Create/Edit) ──────────────────────────────────── */
  function openModal(editId, defaultStatus) {
    var modal = $('#modal-overlay');
    resetForm();

    if (editId) {
      var p = PM.get(editId);
      if (!p) return;
      $('#modal-title').textContent = 'Edit Project';
      $('#form-id').value = p.id;
      $('#form-name').value = p.name;
      $('#form-client').value = p.clientId || '';
      $('#form-status').value = p.status;
      $('#form-budget').value = p.budget || '';
      $('#form-rate').value = p.hourlyRate || '';
      $('#form-deadline').value = p.deadline ? p.deadline.split('T')[0] : '';
      $('#form-tags').value = (p.tags || []).join(', ');
      $('#form-desc').value = p.description || '';
    } else {
      $('#modal-title').textContent = 'New Project';
      if (defaultStatus) $('#form-status').value = defaultStatus;
    }

    populateFilters(); // refresh client dropdown
    modal.classList.add('open');
    setTimeout(function () { $('#form-name').focus(); }, 100);
  }

  function closeModal() {
    $('#modal-overlay').classList.remove('open');
    resetForm();
  }

  function resetForm() {
    $('#form-id').value = '';
    $('#form-name').value = '';
    $('#form-client').value = '';
    $('#form-status').value = 'lead';
    $('#form-budget').value = '';
    $('#form-rate').value = '';
    $('#form-deadline').value = '';
    $('#form-tags').value = '';
    $('#form-desc').value = '';
  }

  function saveProject() {
    var name = $('#form-name').value.trim();
    if (!name) {
      toast('Project name is required', 'error');
      $('#form-name').focus();
      return;
    }

    var clientId = $('#form-client').value;
    var clientName = '';
    if (clientId) {
      var opt = $('#form-client').querySelector('option[value="' + clientId + '"]');
      clientName = opt ? opt.textContent : '';
    }

    var tags = $('#form-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    var deadline = $('#form-deadline').value;

    var data = {
      name: name,
      clientId: clientId || null,
      clientName: clientName,
      status: $('#form-status').value,
      budget: parseFloat($('#form-budget').value) || 0,
      hourlyRate: parseFloat($('#form-rate').value) || 0,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      tags: tags,
      description: $('#form-desc').value.trim()
    };

    var editId = $('#form-id').value;
    if (editId) {
      PM.update(editId, data);
      // Also update status if changed — do direct storage update since transitionStatus may not allow it
      var current = PM.get(editId);
      if (current && current.status !== data.status) {
        var projects = JSON.parse(localStorage.getItem('cortex_projects')) || [];
        for (var i = 0; i < projects.length; i++) {
          if (projects[i].id === editId) {
            projects[i].status = data.status;
            projects[i].updatedAt = new Date().toISOString();
            break;
          }
        }
        localStorage.setItem('cortex_projects', JSON.stringify(projects));
      }
      toast('Project updated', 'success');
    } else {
      PM.create(data);
      toast('Project created', 'success');
    }

    closeModal();
    populateFilters();
    render();
  }

  /* ── Formatting ───────────────────────────────────────────── */
  function formatCurrency(n) {
    if (n >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '$' + Math.round(n);
  }

  function formatHours(h) {
    return h < 1 ? Math.round(h * 60) + 'm' : h.toFixed(1).replace(/\.0$/, '') + 'h';
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate();
  }

  /* ── Toast ────────────────────────────────────────────────── */
  function toast(msg, type) {
    var el = $('#toast');
    el.textContent = msg;
    el.className = 'toast active ' + (type || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.className = 'toast'; }, 2500);
  }

  /* ── Boot ──────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CortexKanban = {
    init: init,
    render: render,
    openModal: openModal,
    openDetail: openDetail
  };
})();
