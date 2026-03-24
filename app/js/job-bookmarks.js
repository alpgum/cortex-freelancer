/**
 * [CF-022] Job Bookmarks — Save/bookmark jobs to a personal queue
 *
 * IIFE exposing window.CortexJobBookmarks
 * Data stored in localStorage key 'cortex_saved_jobs'
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_saved_jobs';

  // ─── Helpers ──────────────────────────────────────────────────────
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  // ─── Storage ──────────────────────────────────────────────────────
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('[CF-022] Failed to load saved jobs:', e);
      return [];
    }
  }

  function save(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('[CF-022] Failed to save jobs:', e);
    }
  }

  // ─── Core API ─────────────────────────────────────────────────────

  /** Add a job to saved list */
  function saveJob(job) {
    if (!job || !job.id) {
      job = job || {};
      job.id = job.id || generateId();
    }
    var entries = load();
    // Don't duplicate
    if (entries.some(function (e) { return e.id === job.id; })) return entries;

    entries.push({
      id: job.id,
      title: job.title || 'Untitled Job',
      url: job.url || '#',
      budget: job.budget || '',
      skills: job.skills || [],
      savedAt: new Date().toISOString(),
      notes: job.notes || '',
      priority: job.priority || 'medium',
      deadline: job.deadline || '',
      applied: job.applied || false,
    });
    save(entries);
    notifyChange();
    return entries;
  }

  /** Remove a job by id */
  function removeJob(id) {
    var entries = load().filter(function (e) { return e.id !== id; });
    save(entries);
    notifyChange();
    return entries;
  }

  /** Update a saved job */
  function updateJob(id, updates) {
    var entries = load();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) {
        for (var key in updates) {
          if (updates.hasOwnProperty(key) && key !== 'id') {
            entries[i][key] = updates[key];
          }
        }
        break;
      }
    }
    save(entries);
    notifyChange();
    return entries;
  }

  /** Get saved jobs sorted */
  function getSavedJobs(sortBy) {
    var entries = load();
    var priorityOrder = { high: 0, medium: 1, low: 2 };

    switch (sortBy) {
      case 'deadline':
        entries.sort(function (a, b) {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline) - new Date(b.deadline);
        });
        break;
      case 'priority':
        entries.sort(function (a, b) {
          return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
        });
        break;
      case 'newest':
      default:
        entries.sort(function (a, b) {
          return new Date(b.savedAt) - new Date(a.savedAt);
        });
        break;
    }
    return entries;
  }

  /** Check if a job is already saved */
  function isJobSaved(id) {
    return load().some(function (e) { return e.id === id; });
  }

  // ─── Change notification (for re-renders) ─────────────────────────
  function notifyChange() {
    try {
      window.dispatchEvent(new CustomEvent('cortex-bookmarks-changed'));
    } catch (e) { /* old browsers */ }
  }

  // ─── Render: Bookmark button for a job card ───────────────────────
  function renderSaveButton(job) {
    var saved = isJobSaved(job.id);
    return '<button class="jb-save-btn ' + (saved ? 'jb-saved' : '') + '" ' +
      'data-job-id="' + escapeHtml(job.id) + '" ' +
      'data-job-title="' + escapeHtml(job.title || '') + '" ' +
      'data-job-url="' + escapeHtml(job.url || '') + '" ' +
      'data-job-budget="' + escapeHtml(job.budget || '') + '" ' +
      'data-job-skills="' + escapeHtml(JSON.stringify(job.skills || [])) + '" ' +
      'title="' + (saved ? 'Remove from saved' : 'Save job') + '" ' +
      'aria-label="' + (saved ? 'Remove from saved' : 'Save job') + '">' +
      (saved ? '🔖' : '🏷️') +
      '</button>';
  }

  // ─── Delegate: bookmark button clicks ─────────────────────────────
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.jb-save-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    var jobId = btn.getAttribute('data-job-id');
    if (isJobSaved(jobId)) {
      removeJob(jobId);
      btn.classList.remove('jb-saved');
      btn.innerHTML = '🏷️';
      btn.title = 'Save job';
    } else {
      var skills = [];
      try { skills = JSON.parse(btn.getAttribute('data-job-skills') || '[]'); } catch (ex) {}
      saveJob({
        id: jobId,
        title: btn.getAttribute('data-job-title') || '',
        url: btn.getAttribute('data-job-url') || '',
        budget: btn.getAttribute('data-job-budget') || '',
        skills: skills,
      });
      btn.classList.add('jb-saved');
      btn.innerHTML = '🔖';
      btn.title = 'Remove from saved';
    }
  });

  // ─── Render: Saved Jobs Panel ─────────────────────────────────────
  var currentFilter = 'all';
  var currentSort = 'newest';

  function renderSavedJobsPanel(container) {
    if (!container) return;

    var jobs = getSavedJobs(currentSort);
    var filtered = filterJobs(jobs, currentFilter);

    var h = '';

    // ── Inject styles (once) ──
    if (!document.getElementById('jb-panel-styles')) {
      h += '<style id="jb-panel-styles">' + getPanelCSS() + '</style>';
    }

    // ── Header ──
    h += '<div class="jb-panel">';
    h += '<div class="jb-panel-header">';
    h += '<h3 class="jb-panel-title">📌 Saved Jobs <span class="jb-count">' + jobs.length + '</span></h3>';
    h += '</div>';

    // ── Toolbar: Filters + Sort ──
    h += '<div class="jb-toolbar">';
    h += '<div class="jb-filters">';
    var filters = [
      { key: 'all', label: 'All' },
      { key: 'high', label: 'High Priority' },
      { key: 'applied', label: 'Applied' },
      { key: 'not-applied', label: 'Not Applied' },
    ];
    filters.forEach(function (f) {
      h += '<button class="jb-filter-btn ' + (currentFilter === f.key ? 'jb-active' : '') + '" data-filter="' + f.key + '">' + f.label + '</button>';
    });
    h += '</div>';

    h += '<div class="jb-sort">';
    h += '<label class="jb-sort-label">Sort:</label>';
    h += '<select class="jb-sort-select" data-jb-sort>';
    var sorts = [
      { key: 'newest', label: 'Newest' },
      { key: 'deadline', label: 'Deadline' },
      { key: 'priority', label: 'Priority' },
    ];
    sorts.forEach(function (s) {
      h += '<option value="' + s.key + '" ' + (currentSort === s.key ? 'selected' : '') + '>' + s.label + '</option>';
    });
    h += '</select>';
    h += '</div>';
    h += '</div>';

    // ── Job Cards or Empty State ──
    if (filtered.length === 0) {
      h += '<div class="jb-empty">';
      if (jobs.length === 0) {
        h += '<p>No saved jobs yet. Click the bookmark icon on any job match.</p>';
      } else {
        h += '<p>No jobs match the current filter.</p>';
      }
      h += '</div>';
    } else {
      h += '<div class="jb-cards">';
      filtered.forEach(function (job) {
        h += renderSavedJobCard(job);
      });
      h += '</div>';
    }

    h += '</div>';

    container.innerHTML = h;

    // Wire up panel interactions
    wirePanel(container);
  }

  function filterJobs(jobs, filter) {
    switch (filter) {
      case 'high': return jobs.filter(function (j) { return j.priority === 'high'; });
      case 'applied': return jobs.filter(function (j) { return j.applied; });
      case 'not-applied': return jobs.filter(function (j) { return !j.applied; });
      default: return jobs;
    }
  }

  function renderSavedJobCard(job) {
    var priorityColors = { high: '#ff4444', medium: '#ffaa00', low: '#666' };
    var priorityLabels = { high: 'HIGH', medium: 'MED', low: 'LOW' };

    var h = '<div class="jb-card" data-job-id="' + escapeHtml(job.id) + '">';

    // Top row: title + priority badge
    h += '<div class="jb-card-top">';
    h += '<a href="' + escapeHtml(job.url) + '" target="_blank" rel="noopener" class="jb-card-title">' + escapeHtml(job.title) + '</a>';
    h += '<span class="jb-priority-badge" style="background:' + (priorityColors[job.priority] || '#666') + '">' + (priorityLabels[job.priority] || 'MED') + '</span>';
    h += '</div>';

    // Budget
    if (job.budget) {
      h += '<div class="jb-card-budget">' + escapeHtml(job.budget) + '</div>';
    }

    // Notes (editable)
    h += '<div class="jb-card-notes">';
    h += '<textarea class="jb-notes-input" data-job-id="' + escapeHtml(job.id) + '" placeholder="Add notes…" rows="2">' + escapeHtml(job.notes) + '</textarea>';
    h += '</div>';

    // Deadline
    h += '<div class="jb-card-deadline">';
    h += '<label class="jb-deadline-label">Deadline:</label>';
    h += '<input type="date" class="jb-deadline-input" data-job-id="' + escapeHtml(job.id) + '" value="' + escapeHtml(job.deadline || '') + '">';
    h += '</div>';

    // Priority selector
    h += '<div class="jb-card-priority-row">';
    h += '<label class="jb-priority-label">Priority:</label>';
    h += '<select class="jb-priority-select" data-job-id="' + escapeHtml(job.id) + '">';
    ['high', 'medium', 'low'].forEach(function (p) {
      h += '<option value="' + p + '" ' + (job.priority === p ? 'selected' : '') + '>' + p.charAt(0).toUpperCase() + p.slice(1) + '</option>';
    });
    h += '</select>';
    h += '</div>';

    // Footer: Applied toggle + Remove
    h += '<div class="jb-card-actions">';
    h += '<button class="jb-applied-btn ' + (job.applied ? 'jb-applied-active' : '') + '" data-job-id="' + escapeHtml(job.id) + '">' +
      (job.applied ? '✅ Applied' : '📝 Mark Applied') + '</button>';
    h += '<button class="jb-remove-btn" data-job-id="' + escapeHtml(job.id) + '">🗑️ Remove</button>';
    h += '</div>';

    h += '</div>';
    return h;
  }

  function wirePanel(container) {
    // Filter buttons
    container.querySelectorAll('.jb-filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentFilter = btn.getAttribute('data-filter');
        renderSavedJobsPanel(container);
      });
    });

    // Sort select
    var sortSel = container.querySelector('[data-jb-sort]');
    if (sortSel) {
      sortSel.addEventListener('change', function () {
        currentSort = sortSel.value;
        renderSavedJobsPanel(container);
      });
    }

    // Notes (debounced save)
    var notesTimers = {};
    container.querySelectorAll('.jb-notes-input').forEach(function (ta) {
      ta.addEventListener('input', function () {
        var id = ta.getAttribute('data-job-id');
        clearTimeout(notesTimers[id]);
        notesTimers[id] = setTimeout(function () {
          updateJob(id, { notes: ta.value });
        }, 500);
      });
    });

    // Deadline
    container.querySelectorAll('.jb-deadline-input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        updateJob(inp.getAttribute('data-job-id'), { deadline: inp.value });
      });
    });

    // Priority select
    container.querySelectorAll('.jb-priority-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        updateJob(sel.getAttribute('data-job-id'), { priority: sel.value });
        renderSavedJobsPanel(container);
      });
    });

    // Applied toggle
    container.querySelectorAll('.jb-applied-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-job-id');
        var entries = load();
        var job = entries.find(function (e) { return e.id === id; });
        if (job) {
          updateJob(id, { applied: !job.applied });
          renderSavedJobsPanel(container);
        }
      });
    });

    // Remove
    container.querySelectorAll('.jb-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        removeJob(btn.getAttribute('data-job-id'));
        renderSavedJobsPanel(container);
      });
    });
  }

  // ─── CSS ──────────────────────────────────────────────────────────
  function getPanelCSS() {
    return '' +
      /* Save button (inline in job cards) */
      '.jb-save-btn{background:none;border:none;cursor:pointer;font-size:1.2rem;padding:4px 6px;border-radius:6px;transition:all .2s;opacity:.7}' +
      '.jb-save-btn:hover{opacity:1;transform:scale(1.15)}' +
      '.jb-save-btn.jb-saved{opacity:1}' +

      /* Panel container */
      '.jb-panel{background:#1a1a2e;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px;margin-top:20px}' +
      '.jb-panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}' +
      '.jb-panel-title{color:#fff;font-size:1.25rem;font-weight:700;margin:0;display:flex;align-items:center;gap:8px}' +
      '.jb-count{background:rgba(0,255,136,.15);color:#00ff88;font-size:.8rem;padding:2px 10px;border-radius:20px;font-weight:600}' +

      /* Toolbar */
      '.jb-toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:16px}' +
      '.jb-filters{display:flex;gap:6px;flex-wrap:wrap}' +
      '.jb-filter-btn{background:rgba(255,255,255,.06);color:#aaa;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 14px;font-size:.8rem;cursor:pointer;transition:all .2s}' +
      '.jb-filter-btn:hover{background:rgba(255,255,255,.1);color:#fff}' +
      '.jb-filter-btn.jb-active{background:rgba(0,255,136,.15);color:#00ff88;border-color:rgba(0,255,136,.3)}' +
      '.jb-sort{display:flex;align-items:center;gap:6px}' +
      '.jb-sort-label{color:#888;font-size:.8rem}' +
      '.jb-sort-select{background:#16213e;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 10px;font-size:.8rem;cursor:pointer}' +

      /* Cards grid */
      '.jb-cards{display:flex;flex-direction:column;gap:12px}' +
      '.jb-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;transition:border-color .2s}' +
      '.jb-card:hover{border-color:rgba(255,255,255,.18)}' +
      '.jb-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}' +
      '.jb-card-title{color:#e0e0ff;text-decoration:none;font-weight:600;font-size:.95rem;line-height:1.3}' +
      '.jb-card-title:hover{color:#00ff88}' +
      '.jb-priority-badge{font-size:.65rem;font-weight:700;padding:2px 8px;border-radius:6px;color:#fff;white-space:nowrap;flex-shrink:0}' +
      '.jb-card-budget{color:#00ff88;font-size:.85rem;font-weight:600;margin-bottom:8px}' +

      /* Notes */
      '.jb-card-notes{margin-bottom:8px}' +
      '.jb-notes-input{width:100%;background:rgba(255,255,255,.04);color:#ccc;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 10px;font-size:.8rem;resize:vertical;font-family:inherit;box-sizing:border-box}' +
      '.jb-notes-input:focus{outline:none;border-color:rgba(0,255,136,.3)}' +

      /* Deadline */
      '.jb-card-deadline{display:flex;align-items:center;gap:8px;margin-bottom:8px}' +
      '.jb-deadline-label{color:#888;font-size:.8rem}' +
      '.jb-deadline-input{background:#16213e;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:4px 8px;font-size:.8rem}' +

      /* Priority row */
      '.jb-card-priority-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}' +
      '.jb-priority-label{color:#888;font-size:.8rem}' +
      '.jb-priority-select{background:#16213e;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:4px 8px;font-size:.8rem}' +

      /* Actions */
      '.jb-card-actions{display:flex;gap:8px;align-items:center}' +
      '.jb-applied-btn,.jb-remove-btn{background:rgba(255,255,255,.06);color:#aaa;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:6px 12px;font-size:.8rem;cursor:pointer;transition:all .2s}' +
      '.jb-applied-btn:hover{background:rgba(0,255,136,.1);color:#00ff88;border-color:rgba(0,255,136,.2)}' +
      '.jb-applied-btn.jb-applied-active{background:rgba(0,255,136,.15);color:#00ff88;border-color:rgba(0,255,136,.3)}' +
      '.jb-remove-btn:hover{background:rgba(255,68,68,.1);color:#ff4444;border-color:rgba(255,68,68,.2)}' +

      /* Empty state */
      '.jb-empty{text-align:center;padding:32px 16px;color:#666;font-size:.9rem}' +

      /* Responsive */
      '@media(max-width:500px){.jb-toolbar{flex-direction:column;align-items:stretch}.jb-filters{justify-content:center}}';
  }

  // Inject global bookmark button styles immediately
  (function injectBtnStyles() {
    if (document.getElementById('jb-btn-styles')) return;
    var s = document.createElement('style');
    s.id = 'jb-btn-styles';
    s.textContent =
      '.jb-save-btn{background:none;border:none;cursor:pointer;font-size:1.2rem;padding:4px 6px;border-radius:6px;transition:all .2s;opacity:.7}' +
      '.jb-save-btn:hover{opacity:1;transform:scale(1.15)}' +
      '.jb-save-btn.jb-saved{opacity:1}';
    document.head.appendChild(s);
  })();

  // ─── Public API ───────────────────────────────────────────────────
  window.CortexJobBookmarks = {
    saveJob: saveJob,
    removeJob: removeJob,
    updateJob: updateJob,
    getSavedJobs: getSavedJobs,
    isJobSaved: isJobSaved,
    renderSaveButton: renderSaveButton,
    renderSavedJobsPanel: renderSavedJobsPanel,
  };

})();
