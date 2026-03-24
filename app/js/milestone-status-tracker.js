/**
 * Cortex Freelancer — Milestone Payment Status Tracker
 * [CF-148] Tracks milestone payment statuses across active contracts.
 *
 * Features:
 *   - Add contracts with milestone details (client, total, milestone names/amounts/statuses)
 *   - Status tracking: funded, submitted, approved, released, overdue
 *   - Color-coded status badges
 *   - Summary of pending, released, and overdue totals
 *   - localStorage persistence (cortex_milestone_contracts)
 *   - GTM event tracking
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_milestone_contracts';

  var STATUS_CONFIG = {
    funded:    { label: 'Funded',    color: '#ff8844', bg: 'rgba(255,136,68,0.12)',  border: 'rgba(255,136,68,0.3)'  },
    submitted: { label: 'Submitted', color: '#ffcc00', bg: 'rgba(255,204,0,0.12)',   border: 'rgba(255,204,0,0.3)'   },
    approved:  { label: 'Approved',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)'  },
    released:  { label: 'Released',  color: '#00ff88', bg: 'rgba(0,255,136,0.12)',   border: 'rgba(0,255,136,0.3)'   },
    overdue:   { label: 'Overdue',   color: '#ff4466', bg: 'rgba(255,68,102,0.12)',  border: 'rgba(255,68,102,0.3)'  }
  };

  // ─── Data helpers ──────────────────────────────────────────────────

  function loadContracts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveContracts(contracts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
    } catch (e) { /* storage full */ }
  }

  function generateId() {
    return 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  function formatCurrency(amount) {
    return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pushEvent(action) {
    if (window.dataLayer) {
      window.dataLayer.push({ event: 'tool_used', tool_name: 'payment-checker', action: action });
    }
  }

  // ─── Compute summary ──────────────────────────────────────────────

  function computeSummary(contracts) {
    var pending = 0;
    var released = 0;
    var overdue = 0;

    contracts.forEach(function (c) {
      (c.milestones || []).forEach(function (m) {
        var amt = parseFloat(m.amount) || 0;
        if (m.status === 'released') {
          released += amt;
        } else if (m.status === 'overdue') {
          overdue += amt;
        } else {
          pending += amt;
        }
      });
    });

    return { pending: pending, released: released, overdue: overdue };
  }

  // ─── Build UI ──────────────────────────────────────────────────────

  function buildSection() {
    var section = document.createElement('section');
    section.id = 'milestoneTrackerSection';
    section.style.cssText = 'max-width:700px;margin:2.5rem auto;padding:0 1.5rem';

    section.innerHTML =
      '<div style="background:var(--bg2);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius);overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
        '<div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:1.25rem 1.5rem;color:#fff">' +
          '<h3 style="font-size:1rem;font-weight:800;margin:0">Milestone Tracker</h3>' +
          '<p style="font-size:.8rem;opacity:.85;margin:.25rem 0 0">Track payment milestones across your active contracts</p>' +
        '</div>' +
        '<div id="milestoneSummaryBar" style="padding:1rem 1.5rem;display:flex;gap:1rem;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.06)"></div>' +
        '<div id="milestoneContractsList" style="padding:1rem 1.5rem"></div>' +
        '<div style="padding:0 1.5rem 1.5rem">' +
          '<button id="milestoneAddContractBtn" style="width:100%;padding:.75rem;border:2px dashed rgba(255,255,255,.15);border-radius:var(--radius-sm);background:transparent;color:var(--text2);font-family:inherit;font-size:.88rem;font-weight:600;cursor:pointer;transition:all .2s">' +
            '+ Add Contract' +
          '</button>' +
        '</div>' +
        '<div id="milestoneFormContainer" style="display:none;padding:0 1.5rem 1.5rem"></div>' +
      '</div>';

    return section;
  }

  function renderSummary(contracts) {
    var bar = document.getElementById('milestoneSummaryBar');
    if (!bar) return;

    var s = computeSummary(contracts);

    bar.innerHTML =
      buildSummaryCard('Pending', s.pending, 'var(--yellow)') +
      buildSummaryCard('Released', s.released, 'var(--green)') +
      buildSummaryCard('Overdue', s.overdue, 'var(--red)');
  }

  function buildSummaryCard(label, amount, color) {
    return '<div style="flex:1;min-width:120px;background:var(--bg3);border-radius:var(--radius-sm);padding:.75rem 1rem;text-align:center">' +
      '<div style="font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.25rem">' + label + '</div>' +
      '<div style="font-size:1.1rem;font-weight:800;color:' + color + '">' + formatCurrency(amount) + '</div>' +
    '</div>';
  }

  function renderContracts(contracts) {
    var list = document.getElementById('milestoneContractsList');
    if (!list) return;

    if (contracts.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:2rem 0;color:var(--text3);font-size:.88rem">No contracts tracked yet. Add your first contract above.</div>';
      return;
    }

    var html = '';
    contracts.forEach(function (contract, ci) {
      html += '<div style="background:var(--bg3);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-sm);margin-bottom:1rem;overflow:hidden">';
      html += '<div style="padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.04)">';
      html += '<div>';
      html += '<div style="font-weight:700;font-size:.95rem;color:var(--text)">' + escapeHtml(contract.client) + '</div>';
      html += '<div style="font-size:.75rem;color:var(--text3);margin-top:2px">Total: ' + formatCurrency(contract.total) + ' &middot; ' + (contract.milestones || []).length + ' milestones</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:.5rem">';
      html += '<button data-add-milestone="' + ci + '" style="background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);color:#3b82f6;padding:.35rem .75rem;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit">+ Milestone</button>';
      html += '<button data-delete-contract="' + ci + '" style="background:rgba(255,68,102,.1);border:1px solid rgba(255,68,102,.2);color:var(--red);padding:.35rem .75rem;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit">Delete</button>';
      html += '</div>';
      html += '</div>';

      // milestones
      (contract.milestones || []).forEach(function (m, mi) {
        var sc = STATUS_CONFIG[m.status] || STATUS_CONFIG.funded;
        html += '<div style="padding:.75rem 1.25rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.03);gap:.75rem">';
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="font-size:.85rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(m.name) + '</div>';
        if (m.dueDate) {
          html += '<div style="font-size:.7rem;color:var(--text3);margin-top:2px">Due: ' + m.dueDate + '</div>';
        }
        html += '</div>';
        html += '<div style="font-weight:700;font-size:.88rem;color:var(--text);white-space:nowrap">' + formatCurrency(m.amount) + '</div>';
        html += '<select data-status-contract="' + ci + '" data-status-milestone="' + mi + '" style="background:' + sc.bg + ';border:1px solid ' + sc.border + ';color:' + sc.color + ';padding:.3rem .6rem;border-radius:6px;font-size:.72rem;font-weight:700;font-family:inherit;cursor:pointer;appearance:auto;-webkit-appearance:auto;min-width:95px;text-align:center">';
        ['funded', 'submitted', 'approved', 'released', 'overdue'].forEach(function (st) {
          html += '<option value="' + st + '"' + (m.status === st ? ' selected' : '') + '>' + STATUS_CONFIG[st].label + '</option>';
        });
        html += '</select>';
        html += '<button data-del-milestone-c="' + ci + '" data-del-milestone-m="' + mi + '" style="background:transparent;border:none;color:var(--text3);cursor:pointer;font-size:1rem;padding:0 .25rem" title="Remove milestone">&times;</button>';
        html += '</div>';
      });

      html += '</div>';
    });

    list.innerHTML = html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ─── Contract form ─────────────────────────────────────────────────

  function showContractForm() {
    var container = document.getElementById('milestoneFormContainer');
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML =
      '<div style="background:var(--bg3);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-sm);padding:1.25rem">' +
        '<h4 style="font-size:.88rem;font-weight:700;color:var(--text);margin:0 0 1rem">New Contract</h4>' +
        '<div style="margin-bottom:.75rem">' +
          '<label style="display:block;font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Client Name</label>' +
          '<input id="msClientName" type="text" placeholder="e.g. Acme Corp" style="width:100%;padding:.6rem .8rem;border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-sm);font-size:.88rem;color:var(--text);background:var(--bg);font-family:inherit;outline:none">' +
        '</div>' +
        '<div style="margin-bottom:.75rem">' +
          '<label style="display:block;font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Contract Total ($)</label>' +
          '<input id="msContractTotal" type="number" min="0" step="0.01" placeholder="5000" style="width:100%;padding:.6rem .8rem;border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-sm);font-size:.88rem;color:var(--text);background:var(--bg);font-family:inherit;outline:none">' +
        '</div>' +
        '<div id="msFormMilestones">' +
          buildMilestoneRow(0) +
        '</div>' +
        '<button id="msAddMilestoneRow" style="background:transparent;border:1px dashed rgba(255,255,255,.15);color:var(--text3);padding:.5rem;border-radius:6px;font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit;width:100%;margin:.5rem 0 1rem">+ Add Milestone</button>' +
        '<div style="display:flex;gap:.75rem">' +
          '<button id="msSaveContract" style="flex:1;padding:.7rem;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;border:none;border-radius:100px;font-weight:700;font-size:.88rem;cursor:pointer;font-family:inherit;transition:all .2s">Save Contract</button>' +
          '<button id="msCancelContract" style="flex:1;padding:.7rem;background:var(--bg);border:1px solid rgba(255,255,255,.1);color:var(--text2);border-radius:100px;font-weight:600;font-size:.88rem;cursor:pointer;font-family:inherit">Cancel</button>' +
        '</div>' +
      '</div>';

    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function buildMilestoneRow(index) {
    return '<div class="ms-row" style="display:grid;grid-template-columns:1fr auto auto;gap:.5rem;margin-bottom:.5rem;align-items:end">' +
      '<div>' +
        (index === 0 ? '<label style="display:block;font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Milestone Name</label>' : '') +
        '<input type="text" class="ms-name-input" placeholder="e.g. Design Phase" style="width:100%;padding:.6rem .8rem;border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-sm);font-size:.85rem;color:var(--text);background:var(--bg);font-family:inherit;outline:none">' +
      '</div>' +
      '<div>' +
        (index === 0 ? '<label style="display:block;font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Amount ($)</label>' : '') +
        '<input type="number" class="ms-amount-input" min="0" step="0.01" placeholder="1000" style="width:100px;padding:.6rem .8rem;border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-sm);font-size:.85rem;color:var(--text);background:var(--bg);font-family:inherit;outline:none">' +
      '</div>' +
      '<div>' +
        (index === 0 ? '<label style="display:block;font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Due Date</label>' : '') +
        '<input type="date" class="ms-due-input" style="padding:.6rem .5rem;border:1px solid rgba(255,255,255,.1);border-radius:var(--radius-sm);font-size:.85rem;color:var(--text);background:var(--bg);font-family:inherit;outline:none">' +
      '</div>' +
    '</div>';
  }

  // ─── Add milestone to existing contract ────────────────────────────

  function showAddMilestoneForm(contractIndex) {
    var contracts = loadContracts();
    if (!contracts[contractIndex]) return;

    var name = prompt('Milestone name:');
    if (!name) return;
    var amount = prompt('Milestone amount ($):');
    if (!amount || isNaN(parseFloat(amount))) return;
    var dueDate = prompt('Due date (YYYY-MM-DD, optional):') || '';

    contracts[contractIndex].milestones.push({
      id: generateId(),
      name: name.trim(),
      amount: parseFloat(amount),
      status: 'funded',
      dueDate: dueDate.trim()
    });

    saveContracts(contracts);
    renderAll(contracts);
    pushEvent('milestone_added');
  }

  // ─── Event binding ─────────────────────────────────────────────────

  function bindEvents() {
    var addBtn = document.getElementById('milestoneAddContractBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        showContractForm();
      });
    }

    document.addEventListener('click', function (e) {
      var target = e.target;

      // Save contract
      if (target.id === 'msSaveContract') {
        saveNewContract();
        return;
      }

      // Cancel
      if (target.id === 'msCancelContract') {
        var fc = document.getElementById('milestoneFormContainer');
        if (fc) fc.style.display = 'none';
        return;
      }

      // Add milestone row in form
      if (target.id === 'msAddMilestoneRow') {
        var msDiv = document.getElementById('msFormMilestones');
        if (msDiv) {
          var count = msDiv.querySelectorAll('.ms-row').length;
          var temp = document.createElement('div');
          temp.innerHTML = buildMilestoneRow(count);
          msDiv.appendChild(temp.firstChild);
        }
        return;
      }

      // Delete contract
      if (target.dataset.deleteContract !== undefined) {
        var ci = parseInt(target.dataset.deleteContract, 10);
        if (confirm('Delete this contract and all its milestones?')) {
          var contracts = loadContracts();
          contracts.splice(ci, 1);
          saveContracts(contracts);
          renderAll(contracts);
          pushEvent('contract_deleted');
        }
        return;
      }

      // Add milestone to existing contract
      if (target.dataset.addMilestone !== undefined) {
        showAddMilestoneForm(parseInt(target.dataset.addMilestone, 10));
        return;
      }

      // Delete individual milestone
      if (target.dataset.delMilestoneC !== undefined) {
        var mc = parseInt(target.dataset.delMilestoneC, 10);
        var mm = parseInt(target.dataset.delMilestoneM, 10);
        var cts = loadContracts();
        if (cts[mc] && cts[mc].milestones[mm] !== undefined) {
          cts[mc].milestones.splice(mm, 1);
          saveContracts(cts);
          renderAll(cts);
          pushEvent('milestone_deleted');
        }
        return;
      }
    });

    // Status change
    document.addEventListener('change', function (e) {
      var target = e.target;
      if (target.dataset.statusContract !== undefined && target.dataset.statusMilestone !== undefined) {
        var ci2 = parseInt(target.dataset.statusContract, 10);
        var mi2 = parseInt(target.dataset.statusMilestone, 10);
        var cts2 = loadContracts();
        if (cts2[ci2] && cts2[ci2].milestones[mi2]) {
          cts2[ci2].milestones[mi2].status = target.value;
          saveContracts(cts2);
          renderAll(cts2);
          pushEvent('milestone_status_changed');
        }
      }
    });
  }

  function saveNewContract() {
    var clientEl = document.getElementById('msClientName');
    var totalEl = document.getElementById('msContractTotal');
    var milestoneRows = document.querySelectorAll('#msFormMilestones .ms-row');

    var client = (clientEl ? clientEl.value.trim() : '');
    var total = totalEl ? parseFloat(totalEl.value) : 0;

    if (!client) {
      alert('Please enter a client name.');
      return;
    }

    var milestones = [];
    milestoneRows.forEach(function (row) {
      var nameInput = row.querySelector('.ms-name-input');
      var amountInput = row.querySelector('.ms-amount-input');
      var dueInput = row.querySelector('.ms-due-input');
      var name = nameInput ? nameInput.value.trim() : '';
      var amount = amountInput ? parseFloat(amountInput.value) : 0;
      var dueDate = dueInput ? dueInput.value : '';

      if (name && amount > 0) {
        milestones.push({
          id: generateId(),
          name: name,
          amount: amount,
          status: 'funded',
          dueDate: dueDate
        });
      }
    });

    if (milestones.length === 0) {
      alert('Please add at least one milestone with a name and amount.');
      return;
    }

    // Auto-calculate total if not provided
    if (!total || total <= 0) {
      total = milestones.reduce(function (sum, m) { return sum + m.amount; }, 0);
    }

    var contract = {
      id: generateId(),
      client: client,
      total: total,
      milestones: milestones,
      createdAt: new Date().toISOString()
    };

    var contracts = loadContracts();
    contracts.push(contract);
    saveContracts(contracts);

    var fc = document.getElementById('milestoneFormContainer');
    if (fc) fc.style.display = 'none';

    renderAll(contracts);
    pushEvent('contract_added');
  }

  // ─── Render all ────────────────────────────────────────────────────

  function renderAll(contracts) {
    if (!contracts) contracts = loadContracts();
    renderSummary(contracts);
    renderContracts(contracts);

    // Dispatch event for late-payment-alerts integration
    document.dispatchEvent(new CustomEvent('milestoneDataUpdated', { detail: { contracts: contracts } }));
  }

  // ─── Expose for other modules ──────────────────────────────────────

  window.CortexMilestoneTracker = {
    loadContracts: loadContracts,
    saveContracts: saveContracts,
    computeSummary: computeSummary,
    STATUS_CONFIG: STATUS_CONFIG
  };

  // ─── Init ──────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    // Insert section after reminders or results
    var anchor = document.getElementById('remindersSection') || document.getElementById('results');
    if (!anchor) return;

    var section = buildSection();
    anchor.parentNode.insertBefore(section, anchor.nextSibling);

    bindEvents();
    renderAll();
  });

})();
