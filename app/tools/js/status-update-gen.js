/**
 * [cf3-014] Status Update Generator
 * Auto-generate weekly project status updates by pulling project data
 * (hours logged, milestones completed, budget used) and formatting
 * into professional status emails.
 *
 * Sections: Completed This Week, In Progress, Blockers, Next Week Plan
 * Client-ready formatting with copy/export.
 *
 * Depends on: CortexProjectManager, CortexTimeEngine (optional), CortexClientCRM (optional)
 */
(function () {
  'use strict';

  /* ── Helpers ──────────────────────────────────────────────── */
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  var PM = null;   // CortexProjectManager
  var TE = null;   // CortexTimeEngine (optional)
  var CRM = null;  // CortexClientCRM (optional)

  var STORAGE_KEY = 'cortex_status_updates';
  var currentUpdate = null;

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { return []; }
  }
  function saveHistory(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) { }
  }

  /* ── Date helpers ────────────────────────────────────────── */
  function todayStr() { return new Date().toISOString().split('T')[0]; }

  function getWeekRange(offset) {
    offset = offset || 0;
    var now = new Date();
    var day = now.getDay();
    var start = new Date(now);
    start.setDate(now.getDate() - day + 1 + (offset * 7)); // Monday
    start.setHours(0, 0, 0, 0);
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start: start, end: end };
  }

  function fmtDate(d) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function fmtDateRange(start, end) {
    return fmtDate(start) + ' — ' + fmtDate(end);
  }

  /* ── Data aggregation ────────────────────────────────────── */
  function getProjectData(projectId) {
    if (!PM) return null;
    return PM.getProject(projectId);
  }

  function getActiveProjects() {
    if (!PM) return [];
    return PM.listProjects({ status: 'active' });
  }

  function getTimeForProject(projectId, weekRange) {
    if (!TE) return { hours: 0, entries: [] };
    var entries = TE.getEntries ? TE.getEntries() : [];
    var filtered = entries.filter(function (e) {
      if (e.projectId !== projectId && e.project !== projectId) return false;
      var d = new Date(e.startTime || e.date || e.createdAt);
      return d >= weekRange.start && d <= weekRange.end;
    });
    var totalMs = 0;
    filtered.forEach(function (e) {
      if (e.duration) totalMs += e.duration;
      else if (e.startTime && e.endTime) totalMs += new Date(e.endTime) - new Date(e.startTime);
      else if (e.hours) totalMs += e.hours * 3600000;
      else if (e.minutes) totalMs += e.minutes * 60000;
    });
    return { hours: Math.round((totalMs / 3600000) * 10) / 10, entries: filtered };
  }

  function getClientName(project) {
    if (project.clientName) return project.clientName;
    if (CRM && project.clientId) {
      var client = CRM.getClient ? CRM.getClient(project.clientId) : null;
      if (client) return client.name || client.company || '';
    }
    return '';
  }

  function calcBudgetUsed(project) {
    if (!project.budget || project.budget <= 0) return null;
    var used = project.totalBilled || 0;
    return { used: used, total: project.budget, pct: Math.round((used / project.budget) * 100) };
  }

  /* ── Generate status update ──────────────────────────────── */
  function generateUpdate() {
    var projectId = $('#su-project').value;
    if (!projectId) {
      showToast('Please select a project');
      return;
    }

    var project = getProjectData(projectId);
    if (!project) {
      showToast('Project not found');
      return;
    }

    var weekRange = getWeekRange(0);
    var timeData = getTimeForProject(projectId, weekRange);
    var budget = calcBudgetUsed(project);
    var client = getClientName(project);

    // Gather form inputs
    var completed = getListItems('completed-list');
    var inProgress = getListItems('progress-list');
    var blockers = getListItems('blockers-list');
    var nextWeek = getListItems('next-week-list');
    var notes = ($('#su-notes') || {}).value || '';

    currentUpdate = {
      id: 'su_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
      projectId: projectId,
      projectName: project.name,
      clientName: client,
      weekLabel: fmtDateRange(weekRange.start, weekRange.end),
      weekStart: weekRange.start.toISOString(),
      weekEnd: weekRange.end.toISOString(),
      hoursLogged: timeData.hours,
      budget: budget,
      completed: completed,
      inProgress: inProgress,
      blockers: blockers,
      nextWeek: nextWeek,
      notes: notes,
      createdAt: new Date().toISOString()
    };

    renderPreview(currentUpdate);
    enableExportButtons(true);
    showToast('Status update generated');
  }

  function getListItems(containerId) {
    var items = [];
    var rows = $$('#' + containerId + ' .dyn-row input');
    rows.forEach(function (input) {
      var val = input.value.trim();
      if (val) items.push(val);
    });
    return items;
  }

  /* ── Preview rendering ───────────────────────────────────── */
  function renderPreview(update) {
    var el = $('#preview-content');
    if (!el) return;

    var html = '';

    // Header
    html += '<div class="su-header">';
    html += '<h2 class="su-title">' + esc(update.projectName) + ' — Weekly Status</h2>';
    if (update.clientName) html += '<div class="su-meta">Client: <strong>' + esc(update.clientName) + '</strong></div>';
    html += '<div class="su-meta">Period: <strong>' + esc(update.weekLabel) + '</strong></div>';
    html += '</div>';

    // Metrics bar
    html += '<div class="su-metrics">';
    html += '<div class="su-metric"><span class="su-metric-val">' + update.hoursLogged + 'h</span><span class="su-metric-label">Hours Logged</span></div>';
    if (update.budget) {
      html += '<div class="su-metric"><span class="su-metric-val">' + update.budget.pct + '%</span><span class="su-metric-label">Budget Used</span></div>';
      html += '<div class="su-metric"><span class="su-metric-val">$' + update.budget.used.toLocaleString() + '</span><span class="su-metric-label">of $' + update.budget.total.toLocaleString() + '</span></div>';
    }
    html += '</div>';

    // Sections
    if (update.completed.length) {
      html += renderSection('Completed This Week', update.completed, 'green');
    }
    if (update.inProgress.length) {
      html += renderSection('In Progress', update.inProgress, 'orange');
    }
    if (update.blockers.length) {
      html += renderSection('Blockers', update.blockers, 'red');
    }
    if (update.nextWeek.length) {
      html += renderSection('Next Week Plan', update.nextWeek, 'blue');
    }
    if (update.notes) {
      html += '<div class="su-section">';
      html += '<h4 class="su-section-title" style="border-color:var(--text3)">Notes</h4>';
      html += '<p class="su-notes-text">' + esc(update.notes) + '</p>';
      html += '</div>';
    }

    el.innerHTML = html;
  }

  function renderSection(title, items, color) {
    var html = '<div class="su-section">';
    html += '<h4 class="su-section-title" style="border-color:var(--' + color + ')">' + esc(title) + '</h4>';
    html += '<ul class="su-list">';
    items.forEach(function (item) {
      html += '<li class="su-list-item"><span class="su-dot" style="background:var(--' + color + ')"></span>' + esc(item) + '</li>';
    });
    html += '</ul></div>';
    return html;
  }

  /* ── Export: Plain text email ─────────────────────────────── */
  function toPlainText(update) {
    if (!update) return '';
    var lines = [];
    lines.push(update.projectName + ' — Weekly Status Update');
    lines.push('='.repeat(50));
    if (update.clientName) lines.push('Client: ' + update.clientName);
    lines.push('Period: ' + update.weekLabel);
    lines.push('Hours Logged: ' + update.hoursLogged + 'h');
    if (update.budget) {
      lines.push('Budget: $' + update.budget.used.toLocaleString() + ' of $' + update.budget.total.toLocaleString() + ' (' + update.budget.pct + '% used)');
    }
    lines.push('');

    if (update.completed.length) {
      lines.push('COMPLETED THIS WEEK');
      lines.push('-'.repeat(30));
      update.completed.forEach(function (item) { lines.push('  * ' + item); });
      lines.push('');
    }
    if (update.inProgress.length) {
      lines.push('IN PROGRESS');
      lines.push('-'.repeat(30));
      update.inProgress.forEach(function (item) { lines.push('  * ' + item); });
      lines.push('');
    }
    if (update.blockers.length) {
      lines.push('BLOCKERS');
      lines.push('-'.repeat(30));
      update.blockers.forEach(function (item) { lines.push('  ! ' + item); });
      lines.push('');
    }
    if (update.nextWeek.length) {
      lines.push('NEXT WEEK PLAN');
      lines.push('-'.repeat(30));
      update.nextWeek.forEach(function (item) { lines.push('  > ' + item); });
      lines.push('');
    }
    if (update.notes) {
      lines.push('NOTES');
      lines.push('-'.repeat(30));
      lines.push(update.notes);
      lines.push('');
    }

    lines.push('---');
    lines.push('Generated by Cortex Freelancer');
    return lines.join('\n');
  }

  /* ── Export: Markdown ─────────────────────────────────────── */
  function toMarkdown(update) {
    if (!update) return '';
    var lines = [];
    lines.push('# ' + update.projectName + ' — Weekly Status');
    lines.push('');
    if (update.clientName) lines.push('**Client:** ' + update.clientName + '  ');
    lines.push('**Period:** ' + update.weekLabel + '  ');
    lines.push('**Hours Logged:** ' + update.hoursLogged + 'h  ');
    if (update.budget) {
      lines.push('**Budget:** $' + update.budget.used.toLocaleString() + ' / $' + update.budget.total.toLocaleString() + ' (' + update.budget.pct + '%)  ');
    }
    lines.push('');

    if (update.completed.length) {
      lines.push('## Completed This Week');
      update.completed.forEach(function (item) { lines.push('- ' + item); });
      lines.push('');
    }
    if (update.inProgress.length) {
      lines.push('## In Progress');
      update.inProgress.forEach(function (item) { lines.push('- ' + item); });
      lines.push('');
    }
    if (update.blockers.length) {
      lines.push('## Blockers');
      update.blockers.forEach(function (item) { lines.push('- ' + item); });
      lines.push('');
    }
    if (update.nextWeek.length) {
      lines.push('## Next Week Plan');
      update.nextWeek.forEach(function (item) { lines.push('- ' + item); });
      lines.push('');
    }
    if (update.notes) {
      lines.push('## Notes');
      lines.push(update.notes);
      lines.push('');
    }

    lines.push('---');
    lines.push('*Generated by Cortex Freelancer*');
    return lines.join('\n');
  }

  /* ── Export: HTML email ───────────────────────────────────── */
  function toHTML(update) {
    if (!update) return '';
    var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>';
    h += 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;line-height:1.6}';
    h += 'h1{font-size:20px;margin:0 0 4px}';
    h += '.meta{color:#666;font-size:13px;margin:2px 0}';
    h += '.metrics{display:flex;gap:16px;margin:16px 0;padding:12px;background:#f8f8f8;border-radius:8px}';
    h += '.metric{text-align:center;flex:1}.metric-val{font-size:20px;font-weight:700}.metric-label{font-size:11px;color:#888;text-transform:uppercase}';
    h += 'h2{font-size:14px;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;padding-bottom:4px}';
    h += '.sec-green h2{color:#16a34a;border-bottom:2px solid #16a34a}';
    h += '.sec-orange h2{color:#ea580c;border-bottom:2px solid #ea580c}';
    h += '.sec-red h2{color:#dc2626;border-bottom:2px solid #dc2626}';
    h += '.sec-blue h2{color:#2563eb;border-bottom:2px solid #2563eb}';
    h += 'ul{padding-left:20px;margin:0}li{margin:4px 0;font-size:14px}';
    h += '.footer{margin-top:24px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center}';
    h += '</style></head><body>';

    h += '<h1>' + esc(update.projectName) + ' — Weekly Status</h1>';
    if (update.clientName) h += '<div class="meta">Client: ' + esc(update.clientName) + '</div>';
    h += '<div class="meta">Period: ' + esc(update.weekLabel) + '</div>';

    h += '<div class="metrics">';
    h += '<div class="metric"><div class="metric-val">' + update.hoursLogged + 'h</div><div class="metric-label">Hours</div></div>';
    if (update.budget) {
      h += '<div class="metric"><div class="metric-val">' + update.budget.pct + '%</div><div class="metric-label">Budget Used</div></div>';
    }
    h += '</div>';

    if (update.completed.length) {
      h += '<div class="sec-green"><h2>Completed This Week</h2><ul>';
      update.completed.forEach(function (item) { h += '<li>' + esc(item) + '</li>'; });
      h += '</ul></div>';
    }
    if (update.inProgress.length) {
      h += '<div class="sec-orange"><h2>In Progress</h2><ul>';
      update.inProgress.forEach(function (item) { h += '<li>' + esc(item) + '</li>'; });
      h += '</ul></div>';
    }
    if (update.blockers.length) {
      h += '<div class="sec-red"><h2>Blockers</h2><ul>';
      update.blockers.forEach(function (item) { h += '<li>' + esc(item) + '</li>'; });
      h += '</ul></div>';
    }
    if (update.nextWeek.length) {
      h += '<div class="sec-blue"><h2>Next Week Plan</h2><ul>';
      update.nextWeek.forEach(function (item) { h += '<li>' + esc(item) + '</li>'; });
      h += '</ul></div>';
    }
    if (update.notes) {
      h += '<h2 style="color:#666;border-bottom:1px solid #ddd">Notes</h2>';
      h += '<p style="font-size:14px;color:#555">' + esc(update.notes) + '</p>';
    }

    h += '<div class="footer">Generated by Cortex Freelancer</div>';
    h += '</body></html>';
    return h;
  }

  /* ── Clipboard ───────────────────────────────────────────── */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
    return Promise.resolve();
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  /* ── Dynamic list management ─────────────────────────────── */
  function addRow(containerId) {
    var container = $('#' + containerId);
    if (!container) return;
    var row = document.createElement('div');
    row.className = 'dyn-row';
    row.innerHTML = '<input class="form-input" type="text" placeholder="Enter item...">' +
      '<button class="btn-del" type="button" onclick="this.parentElement.remove()">×</button>';
    container.appendChild(row);
    row.querySelector('input').focus();
  }

  function initList(containerId, addBtnId) {
    var btn = $('#' + addBtnId);
    if (btn) {
      btn.addEventListener('click', function () { addRow(containerId); });
    }
    // Start with one empty row
    addRow(containerId);
  }

  /* ── Save / Load history ─────────────────────────────────── */
  function saveUpdate() {
    if (!currentUpdate) {
      showToast('Generate an update first');
      return;
    }
    var history = loadHistory();
    // Replace if same project + same week
    var replaced = false;
    for (var i = 0; i < history.length; i++) {
      if (history[i].projectId === currentUpdate.projectId && history[i].weekStart === currentUpdate.weekStart) {
        history[i] = currentUpdate;
        replaced = true;
        break;
      }
    }
    if (!replaced) history.unshift(currentUpdate);
    // Keep last 50
    if (history.length > 50) history = history.slice(0, 50);
    saveHistory(history);
    renderHistoryList();
    showToast('Status update saved');
  }

  function loadSavedUpdate(id) {
    var history = loadHistory();
    for (var i = 0; i < history.length; i++) {
      if (history[i].id === id) {
        currentUpdate = history[i];
        renderPreview(currentUpdate);
        enableExportButtons(true);
        showToast('Loaded saved update');
        // Scroll to preview
        var preview = $('#preview-panel');
        if (preview) preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }

  function deleteSavedUpdate(id) {
    var history = loadHistory();
    history = history.filter(function (u) { return u.id !== id; });
    saveHistory(history);
    renderHistoryList();
    showToast('Update deleted');
  }

  function renderHistoryList() {
    var el = $('#history-list');
    if (!el) return;
    var history = loadHistory();
    if (!history.length) {
      el.innerHTML = '<div class="empty-msg">No saved updates yet.</div>';
      return;
    }
    var html = '';
    history.forEach(function (u) {
      html += '<div class="history-card" data-id="' + esc(u.id) + '">';
      html += '<div class="history-info">';
      html += '<strong>' + esc(u.projectName) + '</strong>';
      html += '<span class="history-date">' + esc(u.weekLabel) + '</span>';
      html += '</div>';
      html += '<div class="history-actions">';
      html += '<button class="btn-sm btn-secondary btn-load-update" data-id="' + esc(u.id) + '">Load</button>';
      html += '<button class="btn-sm btn-del-history" data-id="' + esc(u.id) + '">×</button>';
      html += '</div>';
      html += '</div>';
    });
    el.innerHTML = html;

    // Bind events
    el.querySelectorAll('.btn-load-update').forEach(function (btn) {
      btn.addEventListener('click', function () { loadSavedUpdate(this.dataset.id); });
    });
    el.querySelectorAll('.btn-del-history').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteSavedUpdate(this.dataset.id); });
    });
  }

  /* ── Populate project picker ─────────────────────────────── */
  function populateProjectPicker() {
    var sel = $('#su-project');
    if (!sel || !PM) return;
    var projects = PM.listProjects({});
    sel.innerHTML = '<option value="">— Select a project —</option>';
    projects.forEach(function (p) {
      var label = p.name + (p.clientName ? ' (' + p.clientName + ')' : '');
      var badge = p.status === 'active' ? ' [Active]' : p.status === 'completed' ? ' [Completed]' : '';
      sel.innerHTML += '<option value="' + esc(p.id) + '">' + esc(label + badge) + '</option>';
    });
  }

  /* ── UI helpers ──────────────────────────────────────────── */
  function showToast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function enableExportButtons(enabled) {
    $$('.btn-export').forEach(function (btn) { btn.disabled = !enabled; });
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    PM = window.CortexProjectManager;
    TE = window.CortexTimeEngine || null;
    CRM = window.CortexClientCRM || null;

    if (!PM) {
      console.warn('[status-update-gen] CortexProjectManager not loaded');
    }

    populateProjectPicker();

    // Dynamic lists
    initList('completed-list', 'btn-add-completed');
    initList('progress-list', 'btn-add-progress');
    initList('blockers-list', 'btn-add-blockers');
    initList('next-week-list', 'btn-add-next');

    // Generate button
    var genBtn = $('#btn-generate-update');
    if (genBtn) genBtn.addEventListener('click', generateUpdate);

    // Save button
    var saveBtn = $('#btn-save-update');
    if (saveBtn) saveBtn.addEventListener('click', saveUpdate);

    // Export buttons
    var copyTextBtn = $('#btn-copy-text');
    if (copyTextBtn) copyTextBtn.addEventListener('click', function () {
      copyToClipboard(toPlainText(currentUpdate)).then(function () { showToast('Copied as plain text'); });
    });

    var copyMdBtn = $('#btn-copy-md');
    if (copyMdBtn) copyMdBtn.addEventListener('click', function () {
      copyToClipboard(toMarkdown(currentUpdate)).then(function () { showToast('Copied as Markdown'); });
    });

    var copyHtmlBtn = $('#btn-copy-html');
    if (copyHtmlBtn) copyHtmlBtn.addEventListener('click', function () {
      copyToClipboard(toHTML(currentUpdate)).then(function () { showToast('Copied as HTML email'); });
    });

    enableExportButtons(false);
    renderHistoryList();
  }

  /* ── Boot ─────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.StatusUpdateGen = {
    generate: generateUpdate,
    toPlainText: toPlainText,
    toMarkdown: toMarkdown,
    toHTML: toHTML,
    getHistory: loadHistory,
    version: '1.0.0'
  };
})();
