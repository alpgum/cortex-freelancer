/**
 * [CF-162] Revision Tracker
 * Track revision requests per project, enforce revision limits from contract,
 * alert on scope creep.
 * Exposed on window.CortexFreelancer.RevisionTracker
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_revision_tracker';

  // ── Data helpers ──

  function loadProjects() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveProjects(projects) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); }
    catch (e) { /* storage full */ }
  }

  function generateId() {
    return 'rev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function fmtDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Scope creep detection ──

  function analyzeProject(project) {
    var total = project.revisions ? project.revisions.length : 0;
    var limit = project.revisionLimit || 3;
    var pct = Math.round((total / limit) * 100);
    var status = 'ok';
    var message = total + ' of ' + limit + ' revisions used';

    if (total >= limit) {
      status = 'exceeded';
      message = 'Revision limit exceeded! ' + total + '/' + limit + ' — additional revisions should be billed separately.';
    } else if (pct >= 75) {
      status = 'warning';
      message = 'Approaching limit: ' + total + '/' + limit + ' revisions used (' + pct + '%).';
    }

    // Scope creep indicators
    var scopeCreepFlags = [];
    if (project.revisions && project.revisions.length >= 2) {
      var recent = project.revisions.slice(-3);
      var hasNewFeatures = recent.some(function (r) { return r.type === 'new_feature'; });
      var hasDesignChanges = recent.filter(function (r) { return r.type === 'design_change'; }).length >= 2;
      var avgWordsLast = 0;
      recent.forEach(function (r) { avgWordsLast += (r.description || '').split(/\s+/).length; });
      avgWordsLast = avgWordsLast / recent.length;

      if (hasNewFeatures) scopeCreepFlags.push('New features requested as "revisions"');
      if (hasDesignChanges) scopeCreepFlags.push('Multiple design direction changes');
      if (avgWordsLast > 50) scopeCreepFlags.push('Revision descriptions are getting longer — increasing complexity');
    }

    return {
      total: total,
      limit: limit,
      percentage: pct,
      status: status,
      message: message,
      scopeCreepFlags: scopeCreepFlags
    };
  }

  // ── Render ──

  var styles = '\
    .rt-wrap{font-family:Inter,-apple-system,sans-serif;color:var(--text,#e0e0e0);max-width:900px;margin:0 auto;padding:1.5rem 1rem}\
    .rt-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem}\
    .rt-header h2{margin:0;font-size:1.4rem;color:var(--text-bright,#fff)}\
    .rt-btn{background:var(--orange,#ff8844);color:#000;border:none;padding:.55rem 1.1rem;border-radius:var(--radius-sm,8px);cursor:pointer;font-size:.85rem;font-weight:600;transition:opacity .2s}\
    .rt-btn:hover{opacity:.85}\
    .rt-btn-sm{padding:.35rem .75rem;font-size:.78rem}\
    .rt-btn-outline{background:transparent;border:1px solid var(--border,#222);color:var(--text,#e0e0e0)}\
    .rt-btn-outline:hover{border-color:var(--orange,#ff8844);color:var(--orange,#ff8844)}\
    .rt-btn-danger{background:var(--red,#ff4444);color:#fff}\
    .rt-card{background:var(--bg-card,#111);border:1px solid var(--border,#222);border-radius:var(--radius,12px);padding:1.2rem;margin-bottom:1rem;transition:border-color .2s}\
    .rt-card:hover{border-color:var(--orange,#ff8844)}\
    .rt-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.75rem}\
    .rt-card-head h3{margin:0;font-size:1rem;color:var(--text-bright,#fff)}\
    .rt-badge{padding:.2rem .6rem;border-radius:20px;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px}\
    .rt-badge-ok{background:rgba(0,255,136,.12);color:var(--green,#00ff88)}\
    .rt-badge-warning{background:rgba(255,136,68,.12);color:var(--orange,#ff8844)}\
    .rt-badge-exceeded{background:rgba(255,68,68,.15);color:var(--red,#ff4444)}\
    .rt-progress{height:6px;background:var(--border,#222);border-radius:3px;margin:.6rem 0;overflow:hidden}\
    .rt-progress-fill{height:100%;border-radius:3px;transition:width .4s}\
    .rt-meta{font-size:.78rem;color:var(--text-dim,#888);margin-bottom:.5rem}\
    .rt-revisions{margin-top:.75rem}\
    .rt-rev-item{display:flex;gap:.75rem;padding:.5rem 0;border-top:1px solid var(--border,#222);font-size:.82rem}\
    .rt-rev-num{min-width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:var(--bg,#0a0a0a);border:1px solid var(--border,#222);border-radius:50%;font-size:.7rem;font-weight:600;color:var(--text-dim,#888);flex-shrink:0}\
    .rt-rev-detail{flex:1}\
    .rt-rev-type{display:inline-block;padding:.1rem .45rem;border-radius:4px;font-size:.68rem;background:rgba(255,255,255,.05);color:var(--text-dim,#888);margin-left:.4rem}\
    .rt-rev-date{font-size:.72rem;color:var(--text-dim,#888)}\
    .rt-scope-alert{background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.2);border-radius:var(--radius-sm,8px);padding:.75rem 1rem;margin-top:.75rem}\
    .rt-scope-alert h4{margin:0 0 .4rem;color:var(--red,#ff4444);font-size:.82rem}\
    .rt-scope-alert li{font-size:.78rem;color:var(--text,#e0e0e0);margin:.25rem 0}\
    .rt-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem}\
    .rt-modal{background:var(--bg-card,#111);border:1px solid var(--border,#222);border-radius:var(--radius,12px);padding:1.5rem;width:100%;max-width:480px;max-height:90vh;overflow-y:auto}\
    .rt-modal h3{margin:0 0 1rem;color:var(--text-bright,#fff);font-size:1.1rem}\
    .rt-field{margin-bottom:.85rem}\
    .rt-field label{display:block;font-size:.78rem;color:var(--text-dim,#888);margin-bottom:.3rem}\
    .rt-field input,.rt-field select,.rt-field textarea{width:100%;padding:.5rem .65rem;background:var(--bg,#0a0a0a);border:1px solid var(--border,#222);border-radius:var(--radius-sm,8px);color:var(--text,#e0e0e0);font-size:.85rem;font-family:inherit;box-sizing:border-box}\
    .rt-field textarea{min-height:60px;resize:vertical}\
    .rt-actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem}\
    .rt-empty{text-align:center;padding:3rem 1rem;color:var(--text-dim,#888)}\
    .rt-empty p{margin:.5rem 0;font-size:.9rem}\
    @media(max-width:600px){.rt-header{flex-direction:column;align-items:stretch}.rt-card-head{flex-direction:column}}\
  ';

  function injectStyles() {
    if (document.getElementById('rt-styles')) return;
    var s = document.createElement('style');
    s.id = 'rt-styles';
    s.textContent = styles;
    document.head.appendChild(s);
  }

  function render(containerId) {
    injectStyles();
    var container = document.getElementById(containerId);
    if (!container) return;

    var projects = loadProjects();
    var html = '<div class="rt-wrap">';
    html += '<div class="rt-header"><h2>Revision Tracker</h2>';
    html += '<button class="rt-btn" id="rt-add-project">+ New Project</button></div>';

    if (!projects.length) {
      html += '<div class="rt-empty"><p>No projects tracked yet.</p><p style="font-size:.8rem">Add a project to start tracking revisions and detect scope creep.</p></div>';
    } else {
      projects.forEach(function (proj, pi) {
        var analysis = analyzeProject(proj);
        var barColor = analysis.status === 'exceeded' ? 'var(--red,#ff4444)' : analysis.status === 'warning' ? 'var(--orange,#ff8844)' : 'var(--green,#00ff88)';
        var barWidth = Math.min(analysis.percentage, 100);

        html += '<div class="rt-card" data-project-index="' + pi + '">';
        html += '<div class="rt-card-head"><div><h3>' + escHtml(proj.name) + '</h3>';
        html += '<div class="rt-meta">' + escHtml(proj.client || 'No client') + ' &middot; ' + escHtml(analysis.message) + '</div></div>';
        html += '<span class="rt-badge rt-badge-' + analysis.status + '">' + analysis.status + '</span></div>';

        html += '<div class="rt-progress"><div class="rt-progress-fill" style="width:' + barWidth + '%;background:' + barColor + '"></div></div>';

        // Scope creep alerts
        if (analysis.scopeCreepFlags.length) {
          html += '<div class="rt-scope-alert"><h4>Scope Creep Alert</h4><ul>';
          analysis.scopeCreepFlags.forEach(function (flag) {
            html += '<li>' + escHtml(flag) + '</li>';
          });
          html += '</ul></div>';
        }

        // Revision list
        if (proj.revisions && proj.revisions.length) {
          html += '<div class="rt-revisions">';
          proj.revisions.forEach(function (rev, ri) {
            html += '<div class="rt-rev-item">';
            html += '<div class="rt-rev-num">' + (ri + 1) + '</div>';
            html += '<div class="rt-rev-detail"><div>' + escHtml(rev.description || 'No description');
            html += '<span class="rt-rev-type">' + escHtml(formatType(rev.type)) + '</span></div>';
            html += '<div class="rt-rev-date">' + fmtDate(rev.date) + '</div></div></div>';
          });
          html += '</div>';
        }

        html += '<div style="display:flex;gap:.4rem;margin-top:.75rem;flex-wrap:wrap">';
        html += '<button class="rt-btn rt-btn-sm rt-btn-outline rt-add-rev" data-pi="' + pi + '">+ Add Revision</button>';
        html += '<button class="rt-btn rt-btn-sm rt-btn-outline rt-edit-proj" data-pi="' + pi + '">Edit</button>';
        html += '<button class="rt-btn rt-btn-sm rt-btn-danger rt-del-proj" data-pi="' + pi + '">Delete</button>';
        html += '</div></div>';
      });
    }

    html += '</div>';
    container.innerHTML = html;
    bindEvents(container, containerId);
  }

  function formatType(type) {
    var map = {
      minor_tweak: 'Minor Tweak',
      design_change: 'Design Change',
      content_update: 'Content Update',
      bug_fix: 'Bug Fix',
      new_feature: 'New Feature',
      restructure: 'Restructure'
    };
    return map[type] || type || 'General';
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function showModal(html) {
    closeModal();
    var overlay = document.createElement('div');
    overlay.className = 'rt-modal-overlay';
    overlay.id = 'rt-modal-overlay';
    overlay.innerHTML = '<div class="rt-modal">' + html + '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    return overlay;
  }

  function closeModal() {
    var existing = document.getElementById('rt-modal-overlay');
    if (existing) existing.remove();
  }

  function projectFormHtml(proj) {
    proj = proj || {};
    return '<h3>' + (proj.name ? 'Edit' : 'New') + ' Project</h3>\
      <div class="rt-field"><label>Project Name *</label><input id="rt-f-name" value="' + escHtml(proj.name || '') + '"></div>\
      <div class="rt-field"><label>Client Name</label><input id="rt-f-client" value="' + escHtml(proj.client || '') + '"></div>\
      <div class="rt-field"><label>Revision Limit (from contract)</label><input type="number" id="rt-f-limit" min="1" max="99" value="' + (proj.revisionLimit || 3) + '"></div>\
      <div class="rt-field"><label>Budget ($)</label><input type="number" id="rt-f-budget" min="0" value="' + (proj.budget || '') + '"></div>\
      <div class="rt-field"><label>Notes</label><textarea id="rt-f-notes">' + escHtml(proj.notes || '') + '</textarea></div>\
      <div class="rt-actions"><button class="rt-btn rt-btn-outline" id="rt-cancel">Cancel</button><button class="rt-btn" id="rt-save-proj">Save</button></div>';
  }

  function revisionFormHtml() {
    return '<h3>Log Revision Request</h3>\
      <div class="rt-field"><label>Revision Type</label>\
        <select id="rt-r-type"><option value="minor_tweak">Minor Tweak</option><option value="design_change">Design Change</option>\
        <option value="content_update">Content Update</option><option value="bug_fix">Bug Fix</option>\
        <option value="new_feature">New Feature</option><option value="restructure">Restructure</option></select></div>\
      <div class="rt-field"><label>Description *</label><textarea id="rt-r-desc" placeholder="What did the client request?"></textarea></div>\
      <div class="rt-field"><label>Estimated Hours</label><input type="number" id="rt-r-hours" min="0" step="0.5" placeholder="0"></div>\
      <div class="rt-actions"><button class="rt-btn rt-btn-outline" id="rt-cancel">Cancel</button><button class="rt-btn" id="rt-save-rev">Save Revision</button></div>';
  }

  function bindEvents(container, containerId) {
    container.addEventListener('click', function (e) {
      var target = e.target;

      if (target.id === 'rt-add-project') {
        var overlay = showModal(projectFormHtml());
        overlay.querySelector('#rt-cancel').addEventListener('click', closeModal);
        overlay.querySelector('#rt-save-proj').addEventListener('click', function () {
          var name = document.getElementById('rt-f-name').value.trim();
          if (!name) return;
          var projects = loadProjects();
          projects.push({
            id: generateId(),
            name: name,
            client: document.getElementById('rt-f-client').value.trim(),
            revisionLimit: parseInt(document.getElementById('rt-f-limit').value) || 3,
            budget: parseFloat(document.getElementById('rt-f-budget').value) || 0,
            notes: document.getElementById('rt-f-notes').value.trim(),
            revisions: [],
            createdAt: Date.now()
          });
          saveProjects(projects);
          closeModal();
          render(containerId);
        });
      }

      if (target.classList.contains('rt-add-rev')) {
        var pi = parseInt(target.getAttribute('data-pi'));
        var overlay = showModal(revisionFormHtml());
        overlay.querySelector('#rt-cancel').addEventListener('click', closeModal);
        overlay.querySelector('#rt-save-rev').addEventListener('click', function () {
          var desc = document.getElementById('rt-r-desc').value.trim();
          if (!desc) return;
          var projects = loadProjects();
          if (!projects[pi]) return;
          if (!projects[pi].revisions) projects[pi].revisions = [];
          projects[pi].revisions.push({
            id: generateId(),
            type: document.getElementById('rt-r-type').value,
            description: desc,
            hours: parseFloat(document.getElementById('rt-r-hours').value) || 0,
            date: Date.now()
          });
          saveProjects(projects);
          closeModal();
          render(containerId);
        });
      }

      if (target.classList.contains('rt-edit-proj')) {
        var pi = parseInt(target.getAttribute('data-pi'));
        var projects = loadProjects();
        var proj = projects[pi];
        if (!proj) return;
        var overlay = showModal(projectFormHtml(proj));
        overlay.querySelector('#rt-cancel').addEventListener('click', closeModal);
        overlay.querySelector('#rt-save-proj').addEventListener('click', function () {
          var name = document.getElementById('rt-f-name').value.trim();
          if (!name) return;
          proj.name = name;
          proj.client = document.getElementById('rt-f-client').value.trim();
          proj.revisionLimit = parseInt(document.getElementById('rt-f-limit').value) || 3;
          proj.budget = parseFloat(document.getElementById('rt-f-budget').value) || 0;
          proj.notes = document.getElementById('rt-f-notes').value.trim();
          saveProjects(projects);
          closeModal();
          render(containerId);
        });
      }

      if (target.classList.contains('rt-del-proj')) {
        var pi = parseInt(target.getAttribute('data-pi'));
        if (!confirm('Delete this project and all revision history?')) return;
        var projects = loadProjects();
        projects.splice(pi, 1);
        saveProjects(projects);
        render(containerId);
      }
    });
  }

  // ── Public API ──

  var RevisionTracker = {
    init: function () { /* no-op, render sets up everything */ },
    render: render,
    getProjects: loadProjects,
    analyzeProject: analyzeProject,
    addProject: function (proj) {
      var projects = loadProjects();
      proj.id = proj.id || generateId();
      proj.revisions = proj.revisions || [];
      proj.createdAt = proj.createdAt || Date.now();
      projects.push(proj);
      saveProjects(projects);
      return proj;
    },
    addRevision: function (projectId, revision) {
      var projects = loadProjects();
      for (var i = 0; i < projects.length; i++) {
        if (projects[i].id === projectId) {
          revision.id = revision.id || generateId();
          revision.date = revision.date || Date.now();
          projects[i].revisions.push(revision);
          saveProjects(projects);
          return analyzeProject(projects[i]);
        }
      }
      return null;
    }
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.RevisionTracker = RevisionTracker;
})();
