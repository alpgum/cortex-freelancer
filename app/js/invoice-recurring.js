/**
 * [CF-123] Invoice Creator — Recurring Invoice Scheduling
 * Let users set invoices to auto-generate weekly/bi-weekly/monthly with saved client details.
 * Exposed on window.CortexFreelancer.InvoiceRecurring
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY_SCHEDULES = 'cf_recurring_invoices';
  var STORAGE_KEY_CLIENTS = 'cf_saved_clients';
  var STORAGE_KEY_GENERATED = 'cf_generated_invoices';
  var CSS_INJECTED = false;
  var MAX_SCHEDULES = 50;
  var MAX_GENERATED_LOG = 200;

  var FREQUENCIES = {
    weekly: { label: 'Weekly', days: 7 },
    biweekly: { label: 'Bi-weekly', days: 14 },
    monthly: { label: 'Monthly', days: 30 },
    quarterly: { label: 'Quarterly', days: 90 }
  };

  var STATUS = {
    active: { label: 'Active', color: '#22c55e' },
    paused: { label: 'Paused', color: '#eab308' },
    cancelled: { label: 'Cancelled', color: '#ef4444' }
  };

  // ─── Client Management ────────────────────────────────────────────

  function getSavedClients() {
    try { var raw = localStorage.getItem(STORAGE_KEY_CLIENTS); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }

  function saveClient(client) {
    if (!client || !client.name) return null;
    var clients = getSavedClients();
    var newClient = {
      id: 'cl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
      name: client.name,
      email: client.email || '',
      company: client.company || '',
      address: client.address || '',
      currency: client.currency || 'USD',
      paymentTerms: client.paymentTerms || 'Net 30',
      taxRate: client.taxRate || 0,
      createdAt: new Date().toISOString()
    };

    // Check for duplicate by name+email
    var existing = clients.findIndex(function (c) { return c.name === newClient.name && c.email === newClient.email; });
    if (existing !== -1) {
      newClient.id = clients[existing].id;
      newClient.createdAt = clients[existing].createdAt;
      newClient.updatedAt = new Date().toISOString();
      clients[existing] = newClient;
    } else {
      clients.push(newClient);
    }

    try { localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients)); } catch (e) { /* ignore */ }
    return newClient;
  }

  function removeClient(clientId) {
    var clients = getSavedClients().filter(function (c) { return c.id !== clientId; });
    try { localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients)); } catch (e) { /* ignore */ }
    return clients;
  }

  // ─── Schedule Management ──────────────────────────────────────────

  function getSchedules() {
    try { var raw = localStorage.getItem(STORAGE_KEY_SCHEDULES); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }

  function _saveSchedules(schedules) {
    try { localStorage.setItem(STORAGE_KEY_SCHEDULES, JSON.stringify(schedules)); } catch (e) { /* ignore */ }
  }

  function createSchedule(config) {
    if (!config || !config.clientId) return null;

    var schedules = getSchedules();
    if (schedules.length >= MAX_SCHEDULES) return null;

    var schedule = {
      id: 'rs_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
      clientId: config.clientId,
      frequency: FREQUENCIES[config.frequency] ? config.frequency : 'monthly',
      items: Array.isArray(config.items) ? config.items : [],
      freelancer: config.freelancer || {},
      currency: config.currency || 'USD',
      taxRate: config.taxRate || 0,
      paymentTerms: config.paymentTerms || 'Net 30',
      notes: config.notes || '',
      startDate: config.startDate || new Date().toISOString().slice(0, 10),
      endDate: config.endDate || null,
      status: 'active',
      lastGeneratedAt: null,
      nextDueDate: _calculateNextDue(config.startDate || new Date().toISOString().slice(0, 10), config.frequency || 'monthly'),
      generatedCount: 0,
      createdAt: new Date().toISOString()
    };

    schedules.push(schedule);
    _saveSchedules(schedules);
    return schedule;
  }

  function updateSchedule(scheduleId, updates) {
    var schedules = getSchedules();
    for (var i = 0; i < schedules.length; i++) {
      if (schedules[i].id === scheduleId) {
        for (var key in updates) {
          if (updates.hasOwnProperty(key) && key !== 'id' && key !== 'createdAt') {
            schedules[i][key] = updates[key];
          }
        }
        if (updates.frequency) {
          schedules[i].nextDueDate = _calculateNextDue(
            schedules[i].lastGeneratedAt || schedules[i].startDate,
            updates.frequency
          );
        }
        schedules[i].updatedAt = new Date().toISOString();
        break;
      }
    }
    _saveSchedules(schedules);
    return schedules;
  }

  function pauseSchedule(scheduleId) {
    return updateSchedule(scheduleId, { status: 'paused' });
  }

  function resumeSchedule(scheduleId) {
    return updateSchedule(scheduleId, { status: 'active' });
  }

  function cancelSchedule(scheduleId) {
    return updateSchedule(scheduleId, { status: 'cancelled' });
  }

  function deleteSchedule(scheduleId) {
    var schedules = getSchedules().filter(function (s) { return s.id !== scheduleId; });
    _saveSchedules(schedules);
    return schedules;
  }

  // ─── Due Date Calculation ─────────────────────────────────────────

  function _calculateNextDue(fromDate, frequency) {
    var date = new Date(fromDate);
    var freq = FREQUENCIES[frequency];
    if (!freq) return null;

    if (frequency === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    } else if (frequency === 'quarterly') {
      date.setMonth(date.getMonth() + 3);
    } else {
      date.setDate(date.getDate() + freq.days);
    }
    return date.toISOString().slice(0, 10);
  }

  // ─── Invoice Generation ───────────────────────────────────────────

  function checkDueSchedules() {
    var schedules = getSchedules();
    var today = new Date().toISOString().slice(0, 10);
    var due = [];

    for (var i = 0; i < schedules.length; i++) {
      var s = schedules[i];
      if (s.status !== 'active') continue;
      if (s.endDate && s.endDate < today) continue;
      if (s.nextDueDate && s.nextDueDate <= today) {
        due.push(s);
      }
    }

    return due;
  }

  function generateScheduledInvoice(scheduleId) {
    var schedules = getSchedules();
    var schedule = null;
    for (var i = 0; i < schedules.length; i++) {
      if (schedules[i].id === scheduleId) { schedule = schedules[i]; break; }
    }
    if (!schedule) return null;

    var clients = getSavedClients();
    var client = null;
    for (var j = 0; j < clients.length; j++) {
      if (clients[j].id === schedule.clientId) { client = clients[j]; break; }
    }
    if (!client) return null;

    var now = new Date();
    var invoiceNumber = 'REC-' + now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '-' +
      Math.random().toString(36).slice(2, 5).toUpperCase();

    var dueDate = new Date(now);
    var terms = parseInt(schedule.paymentTerms.replace(/\D/g, ''), 10) || 30;
    dueDate.setDate(dueDate.getDate() + terms);

    var invoiceData = {
      invoiceNumber: invoiceNumber,
      freelancer: schedule.freelancer,
      client: {
        name: client.name,
        email: client.email,
        company: client.company,
        address: client.address
      },
      items: schedule.items,
      currency: schedule.currency || client.currency || 'USD',
      taxRate: schedule.taxRate || client.taxRate || 0,
      paymentTerms: schedule.paymentTerms || client.paymentTerms || 'Net 30',
      issueDate: now.toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      notes: schedule.notes,
      scheduleId: schedule.id,
      isRecurring: true
    };

    // Update schedule
    schedule.lastGeneratedAt = now.toISOString().slice(0, 10);
    schedule.nextDueDate = _calculateNextDue(schedule.lastGeneratedAt, schedule.frequency);
    schedule.generatedCount++;
    _saveSchedules(schedules);

    // Log generated invoice
    _logGeneratedInvoice(invoiceData);

    return invoiceData;
  }

  function generateAllDueInvoices() {
    var due = checkDueSchedules();
    var generated = [];
    for (var i = 0; i < due.length; i++) {
      var invoice = generateScheduledInvoice(due[i].id);
      if (invoice) generated.push(invoice);
    }
    return generated;
  }

  function _logGeneratedInvoice(invoiceData) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_GENERATED);
      var log = raw ? JSON.parse(raw) : [];
      log.unshift({
        invoiceNumber: invoiceData.invoiceNumber,
        scheduleId: invoiceData.scheduleId,
        clientName: invoiceData.client.name,
        total: _calculateTotal(invoiceData.items, invoiceData.taxRate),
        currency: invoiceData.currency,
        generatedAt: new Date().toISOString()
      });
      if (log.length > MAX_GENERATED_LOG) log = log.slice(0, MAX_GENERATED_LOG);
      localStorage.setItem(STORAGE_KEY_GENERATED, JSON.stringify(log));
    } catch (e) { /* ignore */ }
  }

  function getGeneratedLog() {
    try { var raw = localStorage.getItem(STORAGE_KEY_GENERATED); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }

  function _calculateTotal(items, taxRate) {
    var subtotal = 0;
    for (var i = 0; i < (items || []).length; i++) {
      var item = items[i];
      subtotal += Number(item.amount) || (Number(item.hours || 0) * Number(item.rate || 0));
    }
    return Math.round((subtotal + subtotal * (Number(taxRate) || 0) / 100) * 100) / 100;
  }

  // ─── Render: Schedule Dashboard ───────────────────────────────────

  function renderScheduleDashboard(containerId, options) {
    _injectCSS();
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    function refresh() { _renderDashboard(container, opts); }
    _renderDashboard(container, opts);
  }

  function _renderDashboard(container, opts) {
    var schedules = getSchedules();
    var clients = getSavedClients();
    var dueSchedules = checkDueSchedules();
    var onGenerate = opts.onGenerate || function () {};

    var h = '<div class="irs-panel">';

    // Header
    h += '<div class="irs-header">';
    h += '<div><h3 class="irs-title">Recurring Invoices</h3>';
    h += '<div class="irs-subtitle">' + schedules.length + ' schedule' + (schedules.length !== 1 ? 's' : '') + '</div></div>';
    h += '<button class="irs-btn irs-btn-primary" id="irs-new-btn">+ New Schedule</button>';
    h += '</div>';

    // Due alert
    if (dueSchedules.length > 0) {
      h += '<div class="irs-alert">';
      h += '<strong>' + dueSchedules.length + ' invoice' + (dueSchedules.length !== 1 ? 's' : '') + ' due!</strong> ';
      h += '<button class="irs-btn irs-btn-generate" id="irs-gen-all">Generate All</button>';
      h += '</div>';
    }

    // Schedule list
    if (schedules.length === 0) {
      h += '<div class="irs-empty"><p>No recurring invoices set up yet. Create one to automate your billing.</p></div>';
    } else {
      h += '<div class="irs-schedules">';
      for (var i = 0; i < schedules.length; i++) {
        var s = schedules[i];
        var client = _findClient(clients, s.clientId);
        var statusInfo = STATUS[s.status] || STATUS.active;
        var freq = FREQUENCIES[s.frequency] || FREQUENCIES.monthly;
        var isDue = dueSchedules.indexOf(s) !== -1;

        h += '<div class="irs-schedule' + (isDue ? ' irs-schedule-due' : '') + '" data-id="' + s.id + '">';
        h += '<div class="irs-schedule-header">';
        h += '<div>';
        h += '<div class="irs-schedule-client">' + _escapeHtml(client ? client.name : 'Unknown Client');
        if (client && client.company) h += ' <span class="irs-schedule-company">(' + _escapeHtml(client.company) + ')</span>';
        h += '</div>';
        h += '<div class="irs-schedule-freq">' + freq.label + ' &middot; ' + _escapeHtml(s.currency) + ' &middot; ' + s.items.length + ' item' + (s.items.length !== 1 ? 's' : '') + '</div>';
        h += '</div>';
        h += '<span class="irs-status-badge" style="background:' + statusInfo.color + '20;color:' + statusInfo.color + '">' + statusInfo.label + '</span>';
        h += '</div>';

        h += '<div class="irs-schedule-details">';
        h += '<div class="irs-detail"><span class="irs-detail-label">Next Due</span><span class="irs-detail-value">' + (s.nextDueDate || 'N/A') + '</span></div>';
        h += '<div class="irs-detail"><span class="irs-detail-label">Generated</span><span class="irs-detail-value">' + s.generatedCount + ' invoices</span></div>';
        h += '<div class="irs-detail"><span class="irs-detail-label">Total per Invoice</span><span class="irs-detail-value">' + _fmtCurrency(_calculateTotal(s.items, s.taxRate), s.currency) + '</span></div>';
        h += '</div>';

        h += '<div class="irs-schedule-actions">';
        if (s.status === 'active') {
          h += '<button class="irs-btn irs-btn-sm irs-btn-generate" data-action="generate" data-id="' + s.id + '">Generate Now</button>';
          h += '<button class="irs-btn irs-btn-sm" data-action="pause" data-id="' + s.id + '">Pause</button>';
        } else if (s.status === 'paused') {
          h += '<button class="irs-btn irs-btn-sm irs-btn-primary" data-action="resume" data-id="' + s.id + '">Resume</button>';
        }
        h += '<button class="irs-btn irs-btn-sm irs-btn-danger" data-action="delete" data-id="' + s.id + '">Delete</button>';
        h += '</div>';
        h += '</div>';
      }
      h += '</div>';
    }

    // New schedule form (hidden)
    h += _buildScheduleForm(clients);

    h += '</div>';
    container.innerHTML = h;

    _bindDashboardEvents(container, opts, function () { _renderDashboard(container, opts); });
  }

  function _findClient(clients, clientId) {
    for (var i = 0; i < clients.length; i++) {
      if (clients[i].id === clientId) return clients[i];
    }
    return null;
  }

  function _buildScheduleForm(clients) {
    var h = '<div class="irs-form-panel" id="irs-form" style="display:none;">';
    h += '<div class="irs-form-title">New Recurring Invoice</div>';

    // Client selector
    h += '<div class="irs-form-field"><label class="irs-form-label">Client *</label>';
    h += '<select class="irs-form-select" id="irs-f-client"><option value="">Select a client...</option>';
    for (var i = 0; i < clients.length; i++) {
      h += '<option value="' + clients[i].id + '">' + _escapeHtml(clients[i].name);
      if (clients[i].company) h += ' (' + _escapeHtml(clients[i].company) + ')';
      h += '</option>';
    }
    h += '<option value="__new__">+ Add New Client</option></select></div>';

    // New client fields (hidden)
    h += '<div id="irs-new-client" style="display:none;">';
    h += '<div class="irs-form-field"><label class="irs-form-label">Client Name *</label><input class="irs-form-input" id="irs-f-cname" placeholder="Client name"></div>';
    h += '<div class="irs-form-field"><label class="irs-form-label">Email</label><input class="irs-form-input" id="irs-f-cemail" placeholder="client@example.com"></div>';
    h += '<div class="irs-form-field"><label class="irs-form-label">Company</label><input class="irs-form-input" id="irs-f-ccompany" placeholder="Company name"></div>';
    h += '<div class="irs-form-field"><label class="irs-form-label">Address</label><input class="irs-form-input" id="irs-f-caddress" placeholder="Full address"></div>';
    h += '</div>';

    // Frequency
    h += '<div class="irs-form-field"><label class="irs-form-label">Frequency</label>';
    h += '<div class="irs-freq-options" id="irs-freq-group">';
    for (var freq in FREQUENCIES) {
      if (!FREQUENCIES.hasOwnProperty(freq)) continue;
      var active = freq === 'monthly' ? ' irs-freq-active' : '';
      h += '<button class="irs-btn irs-freq-btn' + active + '" data-freq="' + freq + '">' + FREQUENCIES[freq].label + '</button>';
    }
    h += '</div></div>';

    // Line items
    h += '<div class="irs-form-field"><label class="irs-form-label">Invoice Items</label>';
    h += '<div id="irs-items-list">';
    h += '<div class="irs-item-row" data-row="0">';
    h += '<input class="irs-form-input irs-item-desc" placeholder="Description" style="flex:2">';
    h += '<input class="irs-form-input irs-item-hours" placeholder="Hours" type="number" style="flex:0.5">';
    h += '<input class="irs-form-input irs-item-rate" placeholder="Rate" type="number" style="flex:0.5">';
    h += '</div></div>';
    h += '<button class="irs-btn irs-btn-sm" id="irs-add-item">+ Add Item</button></div>';

    // Currency & payment
    h += '<div style="display:flex;gap:10px;">';
    h += '<div class="irs-form-field" style="flex:1"><label class="irs-form-label">Currency</label>';
    h += '<select class="irs-form-select" id="irs-f-currency">';
    h += '<option value="USD">USD ($)</option><option value="EUR">EUR (\u20ac)</option><option value="GBP">GBP (\u00a3)</option><option value="TRY">TRY (\u20ba)</option>';
    h += '</select></div>';
    h += '<div class="irs-form-field" style="flex:1"><label class="irs-form-label">Tax Rate (%)</label><input class="irs-form-input" id="irs-f-tax" type="number" value="0" min="0" max="100"></div>';
    h += '<div class="irs-form-field" style="flex:1"><label class="irs-form-label">Payment Terms</label><input class="irs-form-input" id="irs-f-terms" value="Net 30"></div>';
    h += '</div>';

    // Start date & notes
    h += '<div class="irs-form-field"><label class="irs-form-label">Start Date</label><input class="irs-form-input" id="irs-f-start" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></div>';
    h += '<div class="irs-form-field"><label class="irs-form-label">Notes (optional)</label><textarea class="irs-form-input irs-form-textarea" id="irs-f-notes" rows="2" placeholder="Additional notes for each invoice..."></textarea></div>';

    h += '<div class="irs-form-actions">';
    h += '<button class="irs-btn irs-btn-primary" id="irs-save-btn">Create Schedule</button>';
    h += '<button class="irs-btn" id="irs-cancel-btn">Cancel</button>';
    h += '</div>';
    h += '</div>';

    return h;
  }

  function _bindDashboardEvents(container, opts, refresh) {
    var onGenerate = opts.onGenerate || function () {};

    // New schedule button
    var newBtn = container.querySelector('#irs-new-btn');
    var form = container.querySelector('#irs-form');
    if (newBtn && form) {
      newBtn.addEventListener('click', function () { form.style.display = 'block'; newBtn.style.display = 'none'; });
    }

    // Cancel
    var cancelBtn = container.querySelector('#irs-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { form.style.display = 'none'; newBtn.style.display = ''; });

    // Client select — show new client fields
    var clientSelect = container.querySelector('#irs-f-client');
    var newClientFields = container.querySelector('#irs-new-client');
    if (clientSelect && newClientFields) {
      clientSelect.addEventListener('change', function () {
        newClientFields.style.display = this.value === '__new__' ? 'block' : 'none';
      });
    }

    // Frequency selection
    var freqBtns = container.querySelectorAll('.irs-freq-btn');
    var selectedFreq = 'monthly';
    for (var f = 0; f < freqBtns.length; f++) {
      freqBtns[f].addEventListener('click', function () {
        for (var g = 0; g < freqBtns.length; g++) freqBtns[g].classList.remove('irs-freq-active');
        this.classList.add('irs-freq-active');
        selectedFreq = this.getAttribute('data-freq');
      });
    }

    // Add item row
    var addItemBtn = container.querySelector('#irs-add-item');
    var itemsList = container.querySelector('#irs-items-list');
    if (addItemBtn && itemsList) {
      addItemBtn.addEventListener('click', function () {
        var count = itemsList.querySelectorAll('.irs-item-row').length;
        var row = document.createElement('div');
        row.className = 'irs-item-row';
        row.setAttribute('data-row', count);
        row.innerHTML = '<input class="irs-form-input irs-item-desc" placeholder="Description" style="flex:2">' +
          '<input class="irs-form-input irs-item-hours" placeholder="Hours" type="number" style="flex:0.5">' +
          '<input class="irs-form-input irs-item-rate" placeholder="Rate" type="number" style="flex:0.5">';
        itemsList.appendChild(row);
      });
    }

    // Save schedule
    var saveBtn = container.querySelector('#irs-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var clientId = clientSelect.value;

        // Handle new client
        if (clientId === '__new__') {
          var cName = container.querySelector('#irs-f-cname').value.trim();
          if (!cName) return;
          var newClient = saveClient({
            name: cName,
            email: (container.querySelector('#irs-f-cemail').value || '').trim(),
            company: (container.querySelector('#irs-f-ccompany').value || '').trim(),
            address: (container.querySelector('#irs-f-caddress').value || '').trim()
          });
          if (newClient) clientId = newClient.id;
          else return;
        }

        if (!clientId) return;

        // Collect items
        var rows = itemsList.querySelectorAll('.irs-item-row');
        var items = [];
        for (var r = 0; r < rows.length; r++) {
          var desc = rows[r].querySelector('.irs-item-desc').value.trim();
          var hours = rows[r].querySelector('.irs-item-hours').value;
          var rate = rows[r].querySelector('.irs-item-rate').value;
          if (desc) {
            items.push({ description: desc, hours: Number(hours) || 0, rate: Number(rate) || 0 });
          }
        }
        if (items.length === 0) return;

        createSchedule({
          clientId: clientId,
          frequency: selectedFreq,
          items: items,
          currency: container.querySelector('#irs-f-currency').value,
          taxRate: Number(container.querySelector('#irs-f-tax').value) || 0,
          paymentTerms: container.querySelector('#irs-f-terms').value.trim() || 'Net 30',
          startDate: container.querySelector('#irs-f-start').value,
          notes: container.querySelector('#irs-f-notes').value.trim()
        });

        refresh();
      });
    }

    // Generate all
    var genAllBtn = container.querySelector('#irs-gen-all');
    if (genAllBtn) {
      genAllBtn.addEventListener('click', function () {
        var generated = generateAllDueInvoices();
        if (generated.length > 0) onGenerate(generated);
        refresh();
      });
    }

    // Individual schedule actions
    var actionBtns = container.querySelectorAll('[data-action]');
    for (var a = 0; a < actionBtns.length; a++) {
      actionBtns[a].addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        var id = this.getAttribute('data-id');

        if (action === 'generate') {
          var invoice = generateScheduledInvoice(id);
          if (invoice) onGenerate([invoice]);
          refresh();
        } else if (action === 'pause') {
          pauseSchedule(id);
          refresh();
        } else if (action === 'resume') {
          resumeSchedule(id);
          refresh();
        } else if (action === 'delete') {
          deleteSchedule(id);
          refresh();
        }
      });
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────

  function _fmtCurrency(amount, currency) {
    var symbols = { USD: '$', EUR: '\u20ac', GBP: '\u00a3', TRY: '\u20ba' };
    var sym = symbols[currency] || currency + ' ';
    return sym + Number(amount).toFixed(2);
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.irs-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '.irs-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #222;background:#151515}',
      '.irs-title{margin:0;color:#e0e0e0;font-size:17px;font-weight:700}',
      '.irs-subtitle{color:#666;font-size:12px;margin-top:2px}',
      '.irs-alert{background:#7c3aed15;border-bottom:1px solid #222;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;font-size:13px;color:#a78bfa}',
      '.irs-empty{padding:24px;text-align:center;color:#666;font-size:13px}',
      '.irs-schedules{padding:8px}',
      '.irs-schedule{background:#1a1a1a;border:1px solid #222;border-radius:10px;padding:14px;margin-bottom:8px;transition:border-color .2s}',
      '.irs-schedule:hover{border-color:#333}',
      '.irs-schedule-due{border-color:#7c3aed}',
      '.irs-schedule-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px}',
      '.irs-schedule-client{color:#e0e0e0;font-size:14px;font-weight:600}',
      '.irs-schedule-company{color:#888;font-weight:400;font-size:12px}',
      '.irs-schedule-freq{color:#666;font-size:12px;margin-top:2px}',
      '.irs-status-badge{padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700}',
      '.irs-schedule-details{display:flex;gap:16px;margin-bottom:10px;flex-wrap:wrap}',
      '.irs-detail{display:flex;flex-direction:column}',
      '.irs-detail-label{font-size:10px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.5px}',
      '.irs-detail-value{font-size:13px;color:#ccc;font-weight:500}',
      '.irs-schedule-actions{display:flex;gap:6px}',
      '.irs-btn{border:none;border-radius:6px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;background:#222;color:#aaa;border:1px solid #333}',
      '.irs-btn:hover{background:#2a2a2a;color:#fff}',
      '.irs-btn-sm{padding:5px 10px;font-size:11px}',
      '.irs-btn-primary{background:#7c3aed;color:#fff;border-color:#7c3aed}',
      '.irs-btn-primary:hover{background:#6d28d9}',
      '.irs-btn-generate{background:#22c55e20;color:#22c55e;border-color:#22c55e40}',
      '.irs-btn-generate:hover{background:#22c55e30}',
      '.irs-btn-danger{background:#ef444420;color:#ef4444;border-color:#ef444440}',
      '.irs-btn-danger:hover{background:#ef444430}',
      '.irs-form-panel{padding:16px 18px;border-top:1px solid #222;background:#151515}',
      '.irs-form-title{font-size:15px;font-weight:700;color:#e0e0e0;margin-bottom:14px}',
      '.irs-form-field{margin-bottom:10px}',
      '.irs-form-label{display:block;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}',
      '.irs-form-input,.irs-form-select{width:100%;background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:8px 10px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box}',
      '.irs-form-input:focus,.irs-form-select:focus{border-color:#7c3aed}',
      '.irs-form-textarea{resize:vertical;min-height:50px;font-family:inherit}',
      '.irs-form-actions{display:flex;gap:8px;margin-top:14px}',
      '.irs-freq-options{display:flex;gap:6px;flex-wrap:wrap}',
      '.irs-freq-btn{background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:6px 14px;color:#aaa;font-size:12px;cursor:pointer}',
      '.irs-freq-active{background:#7c3aed20;color:#a78bfa;border-color:#7c3aed}',
      '.irs-item-row{display:flex;gap:8px;margin-bottom:6px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Public API ───────────────────────────────────────────────────

  CF.InvoiceRecurring = {
    getSavedClients: getSavedClients,
    saveClient: saveClient,
    removeClient: removeClient,
    getSchedules: getSchedules,
    createSchedule: createSchedule,
    updateSchedule: updateSchedule,
    pauseSchedule: pauseSchedule,
    resumeSchedule: resumeSchedule,
    cancelSchedule: cancelSchedule,
    deleteSchedule: deleteSchedule,
    checkDueSchedules: checkDueSchedules,
    generateScheduledInvoice: generateScheduledInvoice,
    generateAllDueInvoices: generateAllDueInvoices,
    getGeneratedLog: getGeneratedLog,
    renderScheduleDashboard: renderScheduleDashboard,
    FREQUENCIES: FREQUENCIES,
    version: '1.0.0'
  };

})();
