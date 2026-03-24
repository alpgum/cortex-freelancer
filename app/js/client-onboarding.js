/**
 * [CF-161] Client Onboarding Checklist Tool
 * Interactive checklist for onboarding new clients: contract,
 * payment setup, communication channels, and kickoff.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_client_onboarding';
  var CSS_ID = 'cf-co-styles';
  var _container = null;
  var _injected = false;

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }

  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { clients: [] }; }
    catch (e) { return { clients: [] }; }
  }

  function saveData(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
  }

  var DEFAULT_PHASES = [
    { name: 'Pre-Contract', items: [
      { label: 'Initial meeting completed', done: false, dueDate: '', notes: '' },
      { label: 'Scope discussion finalized', done: false, dueDate: '', notes: '' },
      { label: 'Proposal sent', done: false, dueDate: '', notes: '' },
      { label: 'NDA signed', done: false, dueDate: '', notes: '' }
    ]},
    { name: 'Contract & Legal', items: [
      { label: 'Contract drafted', done: false, dueDate: '', notes: '' },
      { label: 'Contract reviewed by client', done: false, dueDate: '', notes: '' },
      { label: 'Contract signed by both parties', done: false, dueDate: '', notes: '' },
      { label: 'Terms and conditions agreed', done: false, dueDate: '', notes: '' }
    ]},
    { name: 'Payment Setup', items: [
      { label: 'Payment method confirmed', done: false, dueDate: '', notes: '' },
      { label: 'Deposit/retainer received', done: false, dueDate: '', notes: '' },
      { label: 'Invoicing schedule set', done: false, dueDate: '', notes: '' },
      { label: 'Billing contact identified', done: false, dueDate: '', notes: '' }
    ]},
    { name: 'Communication', items: [
      { label: 'Primary contact identified', done: false, dueDate: '', notes: '' },
      { label: 'Communication channel set', done: false, dueDate: '', notes: '' },
      { label: 'Meeting cadence agreed', done: false, dueDate: '', notes: '' },
      { label: 'Timezone noted', done: false, dueDate: '', notes: '' }
    ]},
    { name: 'Project Kickoff', items: [
      { label: 'Kickoff meeting scheduled', done: false, dueDate: '', notes: '' },
      { label: 'Project plan shared', done: false, dueDate: '', notes: '' },
      { label: 'Access/credentials exchanged', done: false, dueDate: '', notes: '' },
      { label: 'First milestone defined', done: false, dueDate: '', notes: '' }
    ]}
  ];

  function createDefaultPhases() {
    return JSON.parse(JSON.stringify(DEFAULT_PHASES));
  }

  function computeProgress(client) {
    var total = 0, done = 0;
    (client.phases || []).forEach(function (phase) {
      (phase.items || []).forEach(function (item) {
        total++;
        if (item.done) done++;
      });
    });
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  function phaseProgress(phase) {
    var total = phase.items.length;
    var done = phase.items.filter(function (i) { return i.done; }).length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  function statusColor(pct) {
    if (pct >= 100) return '#22c55e';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  }

  /* ── CSS ── */

  function injectCSS() {
    if (_injected) return;
    _injected = true;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.co-panel{background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#1e1e1e);border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--text-primary,#e0e0e0);overflow:hidden}',
      '.co-header{padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}',
      '.co-title{font-size:16px;font-weight:700}',
      '.co-btn{border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;padding:8px 16px}',
      '.co-btn-primary{background:#7c3aed;color:#fff}',
      '.co-btn-primary:hover{background:#6d28d9}',
      '.co-btn-secondary{background:var(--bg-secondary,#222);color:var(--text-primary,#e0e0e0);border:1px solid var(--border,#333)}',
      '.co-btn-secondary:hover{background:var(--border,#333)}',
      '.co-btn-sm{padding:4px 10px;font-size:11px}',
      '.co-btn-danger{background:#dc262622;color:#ef4444;border:1px solid #dc262644}',
      '.co-clients{padding:16px 20px}',
      '.co-client-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}',
      '.co-client-card{background:var(--bg-secondary,#111);border:1px solid var(--border,#1e1e1e);border-radius:10px;padding:14px 16px;cursor:pointer;transition:border-color .2s}',
      '.co-client-card:hover,.co-client-card.active{border-color:#7c3aed}',
      '.co-client-name{font-size:14px;font-weight:600;margin-bottom:6px}',
      '.co-client-bar{height:4px;background:var(--bg-primary,#1a1a1a);border-radius:2px;overflow:hidden;margin-bottom:6px}',
      '.co-client-fill{height:100%;border-radius:2px;transition:width .3s}',
      '.co-client-meta{font-size:11px;color:var(--text-muted,#888)}',
      '.co-detail{padding:16px 20px;border-top:1px solid var(--border,#1e1e1e)}',
      '.co-detail-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px}',
      '.co-detail-name{font-size:18px;font-weight:700}',
      '.co-phase{background:var(--bg-secondary,#111);border:1px solid var(--border,#1e1e1e);border-radius:10px;margin-bottom:12px;overflow:hidden}',
      '.co-phase-header{padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none}',
      '.co-phase-name{font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px}',
      '.co-phase-pct{font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px}',
      '.co-phase-body{padding:0 16px 12px}',
      '.co-item{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border,#1a1a1a)}',
      '.co-item:last-child{border-bottom:none}',
      '.co-checkbox{width:18px;height:18px;border:2px solid var(--border,#333);border-radius:4px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:1px;background:transparent;color:transparent;font-size:12px;transition:all .2s}',
      '.co-checkbox.checked{background:#7c3aed;border-color:#7c3aed;color:#fff}',
      '.co-item-content{flex:1;min-width:0}',
      '.co-item-label{font-size:13px;line-height:1.4}',
      '.co-item-label.done{text-decoration:line-through;color:var(--text-muted,#666)}',
      '.co-item-meta{display:flex;gap:8px;margin-top:4px;font-size:11px;color:var(--text-muted,#888);flex-wrap:wrap;align-items:center}',
      '.co-item-meta input{background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#222);border-radius:4px;color:var(--text-primary,#e0e0e0);font-size:11px;padding:2px 6px}',
      '.co-item-note{width:120px}',
      '.co-add-item{display:flex;gap:6px;margin-top:8px}',
      '.co-add-item input{flex:1;background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:12px;padding:6px 8px}',
      '.co-new-client{padding:16px 20px;border-top:1px solid var(--border,#1e1e1e)}',
      '.co-new-client input{background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:13px;padding:8px 10px;margin-right:8px;width:200px}',
      '.co-export{margin-top:12px}',
      '.co-empty{padding:40px 20px;text-align:center;color:var(--text-muted,#555);font-size:13px}',
      '@media(max-width:600px){.co-client-list{grid-template-columns:1fr}.co-new-client input{width:100%;margin-bottom:8px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Render ── */

  function render(container) {
    injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    _container = el;

    var data = loadData();
    var state = { selectedClient: data.clients.length > 0 ? data.clients[0].id : null, expandedPhases: {} };

    renderUI(el, data, state);
  }

  function renderUI(el, data, state) {
    var h = '<div class="co-panel">';

    // Header
    h += '<div class="co-header"><span class="co-title">Client Onboarding</span>';
    h += '<span style="font-size:12px;color:var(--text-muted,#888)">' + data.clients.length + ' client' + (data.clients.length !== 1 ? 's' : '') + '</span></div>';

    // Client list
    h += '<div class="co-clients"><div class="co-client-list">';
    data.clients.forEach(function (client) {
      var pct = computeProgress(client);
      var color = statusColor(pct);
      h += '<div class="co-client-card' + (state.selectedClient === client.id ? ' active' : '') + '" data-client="' + client.id + '">';
      h += '<div class="co-client-name">' + esc(client.name) + '</div>';
      h += '<div class="co-client-bar"><div class="co-client-fill" style="width:' + pct + '%;background:' + color + '"></div></div>';
      h += '<div class="co-client-meta">' + pct + '% complete';
      if (client.type) h += ' &middot; ' + esc(client.type);
      h += '</div></div>';
    });
    h += '</div></div>';

    // Add new client
    h += '<div class="co-new-client">';
    h += '<input type="text" id="co-new-name" placeholder="New client name...">';
    h += '<button class="co-btn co-btn-primary" id="co-add-client">Add Client</button></div>';

    // Selected client detail
    var selected = data.clients.find(function (c) { return c.id === state.selectedClient; });
    if (selected) {
      var totalPct = computeProgress(selected);
      h += '<div class="co-detail">';
      h += '<div class="co-detail-header"><div>';
      h += '<div class="co-detail-name">' + esc(selected.name) + '</div>';
      h += '<div style="font-size:12px;color:var(--text-muted,#888);margin-top:2px">' + totalPct + '% complete</div>';
      h += '</div><div style="display:flex;gap:6px">';
      h += '<button class="co-btn co-btn-secondary co-btn-sm" id="co-export">Export</button>';
      h += '<button class="co-btn co-btn-danger co-btn-sm" id="co-delete-client">Delete</button>';
      h += '</div></div>';

      // Phases
      (selected.phases || []).forEach(function (phase, pi) {
        var pPct = phaseProgress(phase);
        var pColor = statusColor(pPct);
        var expanded = state.expandedPhases[pi] !== false;

        h += '<div class="co-phase">';
        h += '<div class="co-phase-header" data-phase="' + pi + '">';
        h += '<span class="co-phase-name"><span>' + (expanded ? '&#9660;' : '&#9654;') + '</span> ' + esc(phase.name) + '</span>';
        h += '<span class="co-phase-pct" style="background:' + pColor + '22;color:' + pColor + '">' + pPct + '%</span>';
        h += '</div>';

        if (expanded) {
          h += '<div class="co-phase-body">';
          phase.items.forEach(function (item, ii) {
            h += '<div class="co-item">';
            h += '<div class="co-checkbox' + (item.done ? ' checked' : '') + '" data-phase="' + pi + '" data-item="' + ii + '">' + (item.done ? '&#10003;' : '') + '</div>';
            h += '<div class="co-item-content">';
            h += '<div class="co-item-label' + (item.done ? ' done' : '') + '">' + esc(item.label) + '</div>';
            h += '<div class="co-item-meta">';
            h += '<input type="date" class="co-due-date" data-phase="' + pi + '" data-item="' + ii + '" value="' + (item.dueDate || '') + '" title="Due date">';
            h += '<input type="text" class="co-item-note" data-phase="' + pi + '" data-item="' + ii + '" value="' + esc(item.notes || '') + '" placeholder="Notes...">';
            h += '</div></div></div>';
          });

          // Add custom item
          h += '<div class="co-add-item">';
          h += '<input type="text" id="co-add-item-' + pi + '" placeholder="Add custom item...">';
          h += '<button class="co-btn co-btn-secondary co-btn-sm" data-add-phase="' + pi + '">Add</button>';
          h += '</div></div>';
        }
        h += '</div>';
      });

      h += '</div>';
    } else if (data.clients.length === 0) {
      h += '<div class="co-empty">Add your first client to get started with the onboarding checklist.</div>';
    }

    h += '</div>';
    el.innerHTML = h;

    // Events — add client
    var addBtn = el.querySelector('#co-add-client');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var input = document.getElementById('co-new-name');
        var name = input ? input.value.trim() : '';
        if (!name) return;
        var client = { id: uid(), name: name, type: '', phases: createDefaultPhases(), createdAt: new Date().toISOString() };
        data.clients.push(client);
        state.selectedClient = client.id;
        saveData(data);
        renderUI(el, data, state);
      });
    }

    // Select client
    el.querySelectorAll('.co-client-card').forEach(function (card) {
      card.addEventListener('click', function () {
        state.selectedClient = card.getAttribute('data-client');
        state.expandedPhases = {};
        renderUI(el, data, state);
      });
    });

    // Toggle phase
    el.querySelectorAll('.co-phase-header').forEach(function (header) {
      header.addEventListener('click', function () {
        var pi = parseInt(header.getAttribute('data-phase'), 10);
        state.expandedPhases[pi] = state.expandedPhases[pi] === false;
        renderUI(el, data, state);
      });
    });

    // Toggle checkbox
    el.querySelectorAll('.co-checkbox').forEach(function (cb) {
      cb.addEventListener('click', function (e) {
        e.stopPropagation();
        var pi = parseInt(cb.getAttribute('data-phase'), 10);
        var ii = parseInt(cb.getAttribute('data-item'), 10);
        var client = data.clients.find(function (c) { return c.id === state.selectedClient; });
        if (client) {
          client.phases[pi].items[ii].done = !client.phases[pi].items[ii].done;
          saveData(data);
          renderUI(el, data, state);
        }
      });
    });

    // Due dates
    el.querySelectorAll('.co-due-date').forEach(function (input) {
      input.addEventListener('change', function () {
        var pi = parseInt(input.getAttribute('data-phase'), 10);
        var ii = parseInt(input.getAttribute('data-item'), 10);
        var client = data.clients.find(function (c) { return c.id === state.selectedClient; });
        if (client) {
          client.phases[pi].items[ii].dueDate = input.value;
          saveData(data);
        }
      });
    });

    // Notes
    el.querySelectorAll('.co-item-note').forEach(function (input) {
      input.addEventListener('change', function () {
        var pi = parseInt(input.getAttribute('data-phase'), 10);
        var ii = parseInt(input.getAttribute('data-item'), 10);
        var client = data.clients.find(function (c) { return c.id === state.selectedClient; });
        if (client) {
          client.phases[pi].items[ii].notes = input.value;
          saveData(data);
        }
      });
    });

    // Add custom items
    el.querySelectorAll('[data-add-phase]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pi = parseInt(btn.getAttribute('data-add-phase'), 10);
        var input = document.getElementById('co-add-item-' + pi);
        var label = input ? input.value.trim() : '';
        if (!label) return;
        var client = data.clients.find(function (c) { return c.id === state.selectedClient; });
        if (client) {
          client.phases[pi].items.push({ label: label, done: false, dueDate: '', notes: '' });
          saveData(data);
          renderUI(el, data, state);
        }
      });
    });

    // Delete client
    var delBtn = el.querySelector('#co-delete-client');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        data.clients = data.clients.filter(function (c) { return c.id !== state.selectedClient; });
        state.selectedClient = data.clients.length > 0 ? data.clients[0].id : null;
        saveData(data);
        renderUI(el, data, state);
      });
    }

    // Export
    var exportBtn = el.querySelector('#co-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var client = data.clients.find(function (c) { return c.id === state.selectedClient; });
        if (!client) return;
        var text = 'CLIENT ONBOARDING CHECKLIST\n';
        text += 'Client: ' + client.name + '\n';
        text += 'Progress: ' + computeProgress(client) + '%\n';
        text += '=' .repeat(40) + '\n\n';
        client.phases.forEach(function (phase) {
          text += phase.name.toUpperCase() + ' (' + phaseProgress(phase) + '%)\n';
          text += '-'.repeat(30) + '\n';
          phase.items.forEach(function (item) {
            text += (item.done ? '[x] ' : '[ ] ') + item.label;
            if (item.dueDate) text += ' (due: ' + item.dueDate + ')';
            if (item.notes) text += ' — ' + item.notes;
            text += '\n';
          });
          text += '\n';
        });
        var blob = new Blob([text], { type: 'text/plain' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = client.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-onboarding.txt';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }
  }

  function init(containerId) {
    var data = loadData();
    if (containerId) render(containerId);
    return data;
  }

  function destroy() {
    if (_container) { _container.innerHTML = ''; _container = null; }
    var s = document.getElementById(CSS_ID);
    if (s) s.parentNode.removeChild(s);
    _injected = false;
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ClientOnboarding = {
    init: init,
    render: render,
    destroy: destroy,
    computeProgress: computeProgress
  };
})();
