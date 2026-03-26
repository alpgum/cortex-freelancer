/* ============================================
   CORTEX FREELANCER — Follow-Up Reminder System
   cf3-012 | followup-system.js
   ============================================
   Automated follow-up tracking after proposals,
   invoices, and project deliveries. Dashboard widget
   with snooze/dismiss. Notification badge integration.
   ============================================ */
;(function(global) {
  'use strict';

  var STORAGE_KEY = 'cortex_followup_reminders';
  var RULES_KEY = 'cortex_followup_rules';

  // ── Helpers ─────────────────────────────────────────────────
  function uid() { return 'fur_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8); }
  function now() { return new Date().toISOString(); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function loadJSON(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch(e) { return fallback; }
  }
  function saveJSON(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch(e) { console.warn('[FollowUp] Save error:', e); }
  }

  function daysFromNow(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  function daysUntil(dateStr) {
    var target = new Date(dateStr); target.setHours(0,0,0,0);
    var today = new Date(); today.setHours(0,0,0,0);
    return Math.floor((target - today) / 86400000);
  }

  function formatDate(iso) {
    if (!iso) return '\u2014';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatRelative(iso) {
    var days = daysUntil(iso);
    if (days < -1) return Math.abs(days) + ' days overdue';
    if (days === -1) return 'Yesterday';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return 'In ' + days + ' days';
    return formatDate(iso);
  }

  // ── Default Follow-Up Rules ─────────────────────────────────
  var DEFAULT_RULES = [
    { id: 'rule_proposal',  trigger: 'proposal',  label: 'Proposal sent',       days: 3, icon: '\uD83D\uDCDD', color: '#4488ff' },
    { id: 'rule_invoice',   trigger: 'invoice',   label: 'Invoice sent',        days: 7, icon: '\uD83D\uDCB3', color: '#ff8844' },
    { id: 'rule_delivery',  trigger: 'delivery',  label: 'Project delivered',   days: 2, icon: '\uD83D\uDCE6', color: '#00ff88' },
    { id: 'rule_contract',  trigger: 'contract',  label: 'Contract sent',       days: 5, icon: '\uD83D\uDCDC', color: '#aa66ff' },
    { id: 'rule_meeting',   trigger: 'meeting',   label: 'Meeting completed',   days: 1, icon: '\uD83D\uDCC5', color: '#ffc800' },
    { id: 'rule_estimate',  trigger: 'estimate',  label: 'Estimate sent',       days: 4, icon: '\uD83D\uDCCA', color: '#44ddff' },
  ];

  // ── Core Engine ─────────────────────────────────────────────
  var _reminders = [];
  var _rules = [];

  function loadReminders() {
    _reminders = loadJSON(STORAGE_KEY, []);
  }

  function saveReminders() {
    saveJSON(STORAGE_KEY, _reminders);
  }

  function loadRules() {
    _rules = loadJSON(RULES_KEY, null);
    if (!_rules || !_rules.length) {
      _rules = DEFAULT_RULES.slice();
      saveJSON(RULES_KEY, _rules);
    }
  }

  function getRules() {
    return _rules.slice();
  }

  function getRule(trigger) {
    for (var i = 0; i < _rules.length; i++) {
      if (_rules[i].trigger === trigger) return _rules[i];
    }
    return null;
  }

  function updateRule(trigger, days) {
    var rule = getRule(trigger);
    if (rule && days >= 0) {
      rule.days = days;
      saveJSON(RULES_KEY, _rules);
    }
    return rule;
  }

  // ── CRUD ────────────────────────────────────────────────────

  /**
   * Create a follow-up reminder
   * @param {object} data - { clientName, clientId?, trigger, description?, projectName?, amount?, dueDate? }
   */
  function createReminder(data) {
    var rule = getRule(data.trigger);
    var days = (data.customDays != null) ? data.customDays : (rule ? rule.days : 3);

    var reminder = {
      id: uid(),
      createdAt: now(),
      status: 'pending',   // pending | snoozed | completed | dismissed
      trigger: data.trigger || 'general',
      clientName: data.clientName || 'Unknown',
      clientId: data.clientId || null,
      projectName: data.projectName || '',
      description: data.description || (rule ? 'Follow up: ' + rule.label : 'Follow up'),
      amount: data.amount || null,
      dueDate: data.dueDate || daysFromNow(days),
      snoozeCount: 0,
      notes: data.notes || '',
    };

    _reminders.unshift(reminder);
    saveReminders();
    pushNotification(reminder);
    return reminder;
  }

  function getReminder(id) {
    for (var i = 0; i < _reminders.length; i++) {
      if (_reminders[i].id === id) return _reminders[i];
    }
    return null;
  }

  function getAllReminders() {
    return _reminders.slice();
  }

  function getPending() {
    return _reminders.filter(function(r) { return r.status === 'pending' || r.status === 'snoozed'; });
  }

  function getOverdue() {
    var today = new Date(); today.setHours(0,0,0,0);
    return getPending().filter(function(r) { return new Date(r.dueDate) < today; });
  }

  function getDueToday() {
    var today = new Date(); today.setHours(0,0,0,0);
    var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    return getPending().filter(function(r) {
      var d = new Date(r.dueDate);
      return d >= today && d < tomorrow;
    });
  }

  function getUpcoming(days) {
    days = days || 7;
    var today = new Date(); today.setHours(0,0,0,0);
    var end = new Date(today); end.setDate(end.getDate() + days);
    return getPending().filter(function(r) {
      var d = new Date(r.dueDate);
      return d >= today && d <= end;
    });
  }

  function completeReminder(id) {
    var r = getReminder(id);
    if (r) {
      r.status = 'completed';
      r.completedAt = now();
      saveReminders();
    }
    return r;
  }

  function snoozeReminder(id, days) {
    days = days || 1;
    var r = getReminder(id);
    if (r) {
      var d = new Date(r.dueDate);
      d.setDate(d.getDate() + days);
      r.dueDate = d.toISOString();
      r.status = 'snoozed';
      r.snoozeCount = (r.snoozeCount || 0) + 1;
      saveReminders();
    }
    return r;
  }

  function dismissReminder(id) {
    var r = getReminder(id);
    if (r) {
      r.status = 'dismissed';
      r.dismissedAt = now();
      saveReminders();
    }
    return r;
  }

  function deleteReminder(id) {
    _reminders = _reminders.filter(function(r) { return r.id !== id; });
    saveReminders();
  }

  function getStats() {
    var pending = getPending();
    var overdue = getOverdue();
    var dueToday = getDueToday();
    var completed = _reminders.filter(function(r) { return r.status === 'completed'; });
    var dismissed = _reminders.filter(function(r) { return r.status === 'dismissed'; });
    return {
      pending: pending.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      completed: completed.length,
      dismissed: dismissed.length,
      total: _reminders.length,
      urgentCount: overdue.length + dueToday.length,
    };
  }

  // ── Notification Integration ────────────────────────────────
  function pushNotification(reminder) {
    if (typeof cortexNotifications !== 'undefined' && cortexNotifications.add) {
      var rule = getRule(reminder.trigger);
      var icon = rule ? rule.icon : '\uD83D\uDD14';
      cortexNotifications.add(
        'followup-' + reminder.id,
        'payment',
        icon + ' Follow-up: ' + reminder.clientName,
        reminder.description + ' — due ' + formatRelative(reminder.dueDate)
      );
    }
  }

  function checkOverdueNotifications() {
    var overdue = getOverdue();
    if (overdue.length > 0 && typeof cortexNotifications !== 'undefined' && cortexNotifications.add) {
      cortexNotifications.add(
        'followup-overdue-' + new Date().toISOString().split('T')[0],
        'payment',
        '\u26A0\uFE0F ' + overdue.length + ' overdue follow-up' + (overdue.length > 1 ? 's' : ''),
        'You have ' + overdue.length + ' follow-up' + (overdue.length > 1 ? 's' : '') + ' that need attention.'
      );
    }
    var dueToday = getDueToday();
    if (dueToday.length > 0 && typeof cortexNotifications !== 'undefined' && cortexNotifications.add) {
      cortexNotifications.add(
        'followup-today-' + new Date().toISOString().split('T')[0],
        'payment',
        '\uD83D\uDCC5 ' + dueToday.length + ' follow-up' + (dueToday.length > 1 ? 's' : '') + ' due today',
        dueToday.map(function(r) { return r.clientName; }).join(', ')
      );
    }
  }

  // ── Dashboard Widget Renderer ───────────────────────────────

  function renderWidget(containerId) {
    var container = document.getElementById(containerId || 'followup-widget');
    if (!container) return;

    var pending = getPending();
    var stats = getStats();

    // Sort: overdue first, then by due date ascending
    pending.sort(function(a, b) {
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    if (pending.length === 0) {
      container.innerHTML =
        '<div class="fu-empty">' +
          '<div class="fu-empty-icon">\u2705</div>' +
          '<p>No pending follow-ups</p>' +
          '<button class="fu-btn fu-btn-add" onclick="CortexFollowUp.showCreateModal()">+ Add Follow-Up</button>' +
        '</div>';
      return;
    }

    var header =
      '<div class="fu-widget-header">' +
        '<div class="fu-widget-stats">' +
          (stats.overdue > 0 ? '<span class="fu-stat fu-stat-overdue">' + stats.overdue + ' overdue</span>' : '') +
          (stats.dueToday > 0 ? '<span class="fu-stat fu-stat-today">' + stats.dueToday + ' today</span>' : '') +
          '<span class="fu-stat fu-stat-pending">' + stats.pending + ' pending</span>' +
        '</div>' +
        '<button class="fu-btn fu-btn-add" onclick="CortexFollowUp.showCreateModal()">+ New</button>' +
      '</div>';

    var items = pending.slice(0, 8).map(function(r) {
      var days = daysUntil(r.dueDate);
      var urgency = days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 2 ? 'soon' : 'normal';
      var rule = getRule(r.trigger);
      var icon = rule ? rule.icon : '\uD83D\uDD14';
      var color = rule ? rule.color : '#888';

      return '<div class="fu-item fu-' + urgency + '" data-id="' + r.id + '">' +
        '<div class="fu-item-icon" style="color:' + color + '">' + icon + '</div>' +
        '<div class="fu-item-body">' +
          '<div class="fu-item-client">' + esc(r.clientName) + '</div>' +
          '<div class="fu-item-desc">' + esc(r.description) + '</div>' +
          (r.projectName ? '<div class="fu-item-project">' + esc(r.projectName) + '</div>' : '') +
        '</div>' +
        '<div class="fu-item-meta">' +
          '<span class="fu-item-date fu-date-' + urgency + '">' + formatRelative(r.dueDate) + '</span>' +
          (r.snoozeCount > 0 ? '<span class="fu-snoozed">\uD83D\uDD04 ' + r.snoozeCount + '</span>' : '') +
        '</div>' +
        '<div class="fu-item-actions">' +
          '<button class="fu-action fu-action-complete" onclick="CortexFollowUp.complete(\'' + r.id + '\');CortexFollowUp.renderWidget()" title="Complete">\u2713</button>' +
          '<button class="fu-action fu-action-snooze" onclick="CortexFollowUp.showSnoozeMenu(\'' + r.id + '\',this)" title="Snooze">\u23F0</button>' +
          '<button class="fu-action fu-action-dismiss" onclick="CortexFollowUp.dismiss(\'' + r.id + '\');CortexFollowUp.renderWidget()" title="Dismiss">\u2715</button>' +
        '</div>' +
      '</div>';
    }).join('');

    var footer = pending.length > 8
      ? '<div class="fu-widget-footer"><a href="/app/tools/communication-hub.html" class="fu-view-all">View all ' + pending.length + ' follow-ups \u2192</a></div>'
      : '';

    container.innerHTML = header + '<div class="fu-list">' + items + '</div>' + footer;
  }

  // ── Snooze Menu ─────────────────────────────────────────────
  function showSnoozeMenu(id, btn) {
    // Remove existing menus
    var existing = document.querySelector('.fu-snooze-menu');
    if (existing) existing.remove();

    var menu = document.createElement('div');
    menu.className = 'fu-snooze-menu';
    menu.innerHTML =
      '<button onclick="CortexFollowUp.snooze(\'' + id + '\',1);this.parentElement.remove();CortexFollowUp.renderWidget()">Tomorrow</button>' +
      '<button onclick="CortexFollowUp.snooze(\'' + id + '\',3);this.parentElement.remove();CortexFollowUp.renderWidget()">In 3 days</button>' +
      '<button onclick="CortexFollowUp.snooze(\'' + id + '\',7);this.parentElement.remove();CortexFollowUp.renderWidget()">In 1 week</button>';

    btn.style.position = 'relative';
    btn.appendChild(menu);

    // Close on outside click
    var close = function(e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(function() { document.addEventListener('click', close); }, 10);
  }

  // ── Create Modal ────────────────────────────────────────────
  function showCreateModal() {
    var existing = document.getElementById('fu-modal-overlay');
    if (existing) existing.remove();

    var clients = getClientNames();
    var clientOptions = clients.map(function(c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');

    var triggerOptions = _rules.map(function(r) {
      return '<option value="' + r.trigger + '">' + r.icon + ' ' + esc(r.label) + ' (' + r.days + ' day' + (r.days !== 1 ? 's' : '') + ')</option>';
    }).join('');

    var overlay = document.createElement('div');
    overlay.id = 'fu-modal-overlay';
    overlay.className = 'fu-modal-overlay';
    overlay.innerHTML =
      '<div class="fu-modal">' +
        '<div class="fu-modal-header">' +
          '<h3>New Follow-Up Reminder</h3>' +
          '<button class="fu-modal-close" onclick="document.getElementById(\'fu-modal-overlay\').remove()">\u2715</button>' +
        '</div>' +
        '<div class="fu-modal-body">' +
          '<div class="fu-field">' +
            '<label>Client Name</label>' +
            '<input type="text" id="fu-client" list="fu-client-list" placeholder="Enter client name..." />' +
            '<datalist id="fu-client-list">' + clientOptions + '</datalist>' +
          '</div>' +
          '<div class="fu-field">' +
            '<label>Follow-Up Type</label>' +
            '<select id="fu-trigger">' + triggerOptions +
              '<option value="general">\uD83D\uDD14 Custom</option>' +
            '</select>' +
          '</div>' +
          '<div class="fu-field">' +
            '<label>Project / Reference</label>' +
            '<input type="text" id="fu-project" placeholder="Project name or reference..." />' +
          '</div>' +
          '<div class="fu-field">' +
            '<label>Description</label>' +
            '<input type="text" id="fu-description" placeholder="What to follow up on..." />' +
          '</div>' +
          '<div class="fu-field">' +
            '<label>Notes (optional)</label>' +
            '<textarea id="fu-notes" rows="2" placeholder="Additional context..."></textarea>' +
          '</div>' +
        '</div>' +
        '<div class="fu-modal-footer">' +
          '<button class="fu-btn fu-btn-cancel" onclick="document.getElementById(\'fu-modal-overlay\').remove()">Cancel</button>' +
          '<button class="fu-btn fu-btn-create" onclick="CortexFollowUp._handleCreate()">Create Reminder</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // Auto-fill description from trigger
    var triggerSelect = document.getElementById('fu-trigger');
    var descInput = document.getElementById('fu-description');
    if (triggerSelect && descInput) {
      triggerSelect.addEventListener('change', function() {
        var rule = getRule(this.value);
        if (rule && !descInput.value) {
          descInput.value = 'Follow up: ' + rule.label;
        }
      });
      // Set initial description
      var firstRule = getRule(triggerSelect.value);
      if (firstRule) descInput.value = 'Follow up: ' + firstRule.label;
    }

    // Focus client input
    var clientInput = document.getElementById('fu-client');
    if (clientInput) setTimeout(function() { clientInput.focus(); }, 100);
  }

  function _handleCreate() {
    var clientName = (document.getElementById('fu-client') || {}).value || '';
    var trigger = (document.getElementById('fu-trigger') || {}).value || 'general';
    var projectName = (document.getElementById('fu-project') || {}).value || '';
    var description = (document.getElementById('fu-description') || {}).value || '';
    var notes = (document.getElementById('fu-notes') || {}).value || '';

    if (!clientName.trim()) {
      var input = document.getElementById('fu-client');
      if (input) { input.style.borderColor = 'var(--red)'; input.focus(); }
      return;
    }

    createReminder({
      clientName: clientName.trim(),
      trigger: trigger,
      projectName: projectName.trim(),
      description: description.trim() || 'Follow up with ' + clientName.trim(),
      notes: notes.trim(),
    });

    var overlay = document.getElementById('fu-modal-overlay');
    if (overlay) overlay.remove();

    renderWidget();
    updateNavBadge();
    showWidgetToast('Follow-up created for ' + clientName.trim());
  }

  // ── Client Name Helper ──────────────────────────────────────
  function getClientNames() {
    var names = [];
    try {
      var raw = localStorage.getItem('cortex_client_directory');
      if (raw) {
        var data = JSON.parse(raw);
        var clients = data.clients || [];
        for (var i = 0; i < clients.length; i++) {
          if (clients[i].name) names.push(clients[i].name);
        }
      }
    } catch(e) { /* ignore */ }
    return names;
  }

  // ── Nav Badge ───────────────────────────────────────────────
  function updateNavBadge() {
    var stats = getStats();
    var badge = document.getElementById('fu-nav-badge');
    if (badge) {
      var count = stats.urgentCount;
      badge.textContent = count > 0 ? (count > 9 ? '9+' : count) : '';
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  function injectNavBadge() {
    // Find the nav — same selectors as notifications.js
    var nav = document.querySelector('.site-nav') || document.querySelector('.dash-nav') || document.querySelector('nav[role="navigation"]');
    if (!nav) return;

    // Check if already injected
    if (document.getElementById('fu-nav-badge')) return;

    // Find the notification bell or auth area
    var bellWrapper = nav.querySelector('.notif-bell');
    if (bellWrapper) {
      var parent = bellWrapper.parentElement;
      if (parent) {
        var fuLink = document.createElement('a');
        fuLink.href = '/app/tools/communication-hub.html';
        fuLink.className = 'fu-nav-link';
        fuLink.setAttribute('aria-label', 'Follow-up reminders');
        fuLink.setAttribute('title', 'Follow-up reminders');
        fuLink.style.cssText = 'position:relative;display:flex;align-items:center;margin-right:8px;font-size:1.1rem;text-decoration:none;cursor:pointer;';
        fuLink.innerHTML = '\uD83D\uDD14';

        var badge = document.createElement('span');
        badge.id = 'fu-nav-badge';
        badge.style.cssText = 'position:absolute;top:-4px;right:-6px;min-width:16px;height:16px;border-radius:8px;background:#ff4466;color:#fff;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 4px;';
        fuLink.appendChild(badge);

        parent.parentElement.insertBefore(fuLink, parent);
      }
    }

    updateNavBadge();
  }

  // ── Widget Toast ────────────────────────────────────────────
  function showWidgetToast(message) {
    // Use dashboard toast if available
    if (typeof DashboardCore !== 'undefined' && DashboardCore.showToast) {
      DashboardCore.showToast(message);
      return;
    }
    // Fallback: create a temporary toast
    var toast = document.getElementById('toast');
    if (toast) {
      toast.className = 'toast success';
      toast.innerHTML = '\u2713 ' + esc(message);
      requestAnimationFrame(function() { toast.classList.add('active'); });
      setTimeout(function() { toast.classList.remove('active'); }, 3000);
    }
  }

  // ── Auto-Create from Events ─────────────────────────────────
  // Listen for custom events from other tools (proposal sent, invoice sent, etc.)
  function listenForTriggers() {
    window.addEventListener('cortex:proposal-sent', function(e) {
      var detail = e.detail || {};
      createReminder({
        trigger: 'proposal',
        clientName: detail.clientName || 'Client',
        projectName: detail.projectName || '',
        description: 'Follow up on proposal' + (detail.projectName ? ': ' + detail.projectName : ''),
        amount: detail.amount || null,
      });
      renderWidget();
      updateNavBadge();
    });

    window.addEventListener('cortex:invoice-sent', function(e) {
      var detail = e.detail || {};
      createReminder({
        trigger: 'invoice',
        clientName: detail.clientName || 'Client',
        projectName: detail.projectName || '',
        description: 'Follow up on invoice' + (detail.invoiceNumber ? ' #' + detail.invoiceNumber : ''),
        amount: detail.amount || null,
      });
      renderWidget();
      updateNavBadge();
    });

    window.addEventListener('cortex:delivery-sent', function(e) {
      var detail = e.detail || {};
      createReminder({
        trigger: 'delivery',
        clientName: detail.clientName || 'Client',
        projectName: detail.projectName || '',
        description: 'Follow up after project delivery' + (detail.projectName ? ': ' + detail.projectName : ''),
      });
      renderWidget();
      updateNavBadge();
    });

    window.addEventListener('cortex:contract-sent', function(e) {
      var detail = e.detail || {};
      createReminder({
        trigger: 'contract',
        clientName: detail.clientName || 'Client',
        projectName: detail.projectName || '',
        description: 'Follow up on contract' + (detail.projectName ? ' for ' + detail.projectName : ''),
      });
      renderWidget();
      updateNavBadge();
    });
  }

  // ── Cross-Tab Sync ──────────────────────────────────────────
  function listenForStorageChanges() {
    window.addEventListener('storage', function(e) {
      if (e.key === STORAGE_KEY) {
        loadReminders();
        renderWidget();
        updateNavBadge();
      }
    });
  }

  // ── Inject CSS ──────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('fu-system-styles')) return;
    var style = document.createElement('style');
    style.id = 'fu-system-styles';
    style.textContent =
      /* Widget */
      '.fu-widget-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem}' +
      '.fu-widget-stats{display:flex;gap:.5rem;flex-wrap:wrap}' +
      '.fu-stat{font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:100px}' +
      '.fu-stat-overdue{background:rgba(255,68,102,.15);color:#ff4466}' +
      '.fu-stat-today{background:rgba(255,200,0,.15);color:#ffc800}' +
      '.fu-stat-pending{background:rgba(255,255,255,.08);color:#b0b0b0}' +

      /* Buttons */
      '.fu-btn{display:inline-flex;align-items:center;gap:.3rem;padding:.4rem .9rem;border:none;border-radius:100px;font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}' +
      '.fu-btn-add{background:rgba(255,255,255,.08);color:#f0f0f0}' +
      '.fu-btn-add:hover{background:rgba(255,136,68,.2);color:#ff8844}' +
      '.fu-btn-create{background:linear-gradient(135deg,#ff8844,#ff6622);color:#000}' +
      '.fu-btn-create:hover{box-shadow:0 4px 16px rgba(255,136,68,.3);transform:translateY(-1px)}' +
      '.fu-btn-cancel{background:rgba(255,255,255,.06);color:#b0b0b0}' +
      '.fu-btn-cancel:hover{background:rgba(255,255,255,.1)}' +

      /* List items */
      '.fu-list{display:flex;flex-direction:column;gap:2px}' +
      '.fu-item{display:flex;align-items:center;gap:.6rem;padding:.6rem .5rem;border-radius:10px;transition:background .15s}' +
      '.fu-item:hover{background:rgba(255,255,255,.04)}' +
      '.fu-item-icon{font-size:1.1rem;flex-shrink:0;width:28px;text-align:center}' +
      '.fu-item-body{flex:1;min-width:0}' +
      '.fu-item-client{font-size:.82rem;font-weight:600;color:#f0f0f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.fu-item-desc{font-size:.72rem;color:#b0b0b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.fu-item-project{font-size:.68rem;color:#666;margin-top:1px}' +
      '.fu-item-meta{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0}' +
      '.fu-item-date{font-size:.72rem;font-weight:600;white-space:nowrap}' +
      '.fu-date-overdue{color:#ff4466}' +
      '.fu-date-today{color:#ffc800}' +
      '.fu-date-soon{color:#ff8844}' +
      '.fu-date-normal{color:#b0b0b0}' +
      '.fu-snoozed{font-size:.62rem;color:#666}' +

      /* Urgency borders */
      '.fu-overdue{border-left:3px solid #ff4466;padding-left:calc(.5rem - 3px)}' +
      '.fu-today{border-left:3px solid #ffc800;padding-left:calc(.5rem - 3px)}' +
      '.fu-soon{border-left:3px solid #ff8844;padding-left:calc(.5rem - 3px)}' +

      /* Actions */
      '.fu-item-actions{display:flex;gap:2px;flex-shrink:0;opacity:0;transition:opacity .15s}' +
      '.fu-item:hover .fu-item-actions{opacity:1}' +
      '.fu-action{width:26px;height:26px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;display:flex;align-items:center;justify-content:center;transition:all .15s;background:transparent;color:#888}' +
      '.fu-action-complete:hover{background:rgba(0,255,136,.15);color:#00ff88}' +
      '.fu-action-snooze:hover{background:rgba(255,200,0,.15);color:#ffc800}' +
      '.fu-action-dismiss:hover{background:rgba(255,68,102,.15);color:#ff4466}' +

      /* Snooze menu */
      '.fu-snooze-menu{position:absolute;bottom:100%;right:0;background:#1a1a24;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:4px;z-index:100;min-width:120px;box-shadow:0 8px 24px rgba(0,0,0,.4)}' +
      '.fu-snooze-menu button{display:block;width:100%;text-align:left;padding:.4rem .6rem;border:none;background:transparent;color:#f0f0f0;font-size:.75rem;font-family:inherit;cursor:pointer;border-radius:6px;transition:background .15s}' +
      '.fu-snooze-menu button:hover{background:rgba(255,255,255,.08)}' +

      /* Empty state */
      '.fu-empty{text-align:center;padding:1.5rem .5rem}' +
      '.fu-empty-icon{font-size:2rem;margin-bottom:.5rem}' +
      '.fu-empty p{color:#666;font-size:.82rem;margin-bottom:.75rem}' +

      /* Footer */
      '.fu-widget-footer{text-align:center;padding-top:.5rem;border-top:1px solid rgba(255,255,255,.04);margin-top:.5rem}' +
      '.fu-view-all{font-size:.75rem;color:#ff8844;text-decoration:none;font-weight:600}' +
      '.fu-view-all:hover{color:#00ff88}' +

      /* Modal */
      '.fu-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)}' +
      '.fu-modal{background:#111118;border:1px solid rgba(255,255,255,.1);border-radius:16px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.5)}' +
      '.fu-modal-header{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.2rem;border-bottom:1px solid rgba(255,255,255,.06)}' +
      '.fu-modal-header h3{font-size:.95rem;font-weight:700;color:#f0f0f0}' +
      '.fu-modal-close{background:none;border:none;color:#666;font-size:1.1rem;cursor:pointer;padding:4px}' +
      '.fu-modal-close:hover{color:#ff4466}' +
      '.fu-modal-body{padding:1.2rem}' +
      '.fu-field{margin-bottom:.9rem}' +
      '.fu-field label{display:block;font-size:.75rem;font-weight:600;color:#b0b0b0;margin-bottom:.35rem}' +
      '.fu-field input,.fu-field select,.fu-field textarea{width:100%;background:#0a0a0f;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:.55rem .75rem;color:#f0f0f0;font-size:.82rem;font-family:inherit;outline:none;transition:border-color .2s}' +
      '.fu-field input:focus,.fu-field select:focus,.fu-field textarea:focus{border-color:#ff8844}' +
      '.fu-field textarea{resize:vertical}' +
      '.fu-modal-footer{display:flex;justify-content:flex-end;gap:.5rem;padding:.8rem 1.2rem;border-top:1px solid rgba(255,255,255,.06)}' +

      /* Responsive */
      '@media(max-width:640px){' +
        '.fu-item-actions{opacity:1}' +
        '.fu-item{gap:.4rem;padding:.5rem .3rem}' +
        '.fu-item-client{font-size:.78rem}' +
        '.fu-field input,.fu-field select,.fu-field textarea{font-size:16px}' +
      '}';
    document.head.appendChild(style);
  }

  // ── Seed Demo Data ──────────────────────────────────────────
  function seedDemoIfEmpty() {
    if (_reminders.length > 0) return;

    var demoClients = getClientNames();
    if (demoClients.length === 0) demoClients = ['Sarah Chen', 'Acme Corp', 'TechStart Inc'];

    var today = new Date();

    // Overdue proposal follow-up
    var d1 = new Date(today); d1.setDate(d1.getDate() - 2); d1.setHours(9,0,0,0);
    _reminders.push({
      id: uid(), createdAt: now(), status: 'pending', trigger: 'proposal',
      clientName: demoClients[0] || 'Sarah Chen', clientId: null,
      projectName: 'Dashboard Redesign', description: 'Follow up on proposal: Dashboard Redesign',
      amount: null, dueDate: d1.toISOString(), snoozeCount: 0, notes: '',
    });

    // Due today invoice
    var d2 = new Date(today); d2.setHours(9,0,0,0);
    _reminders.push({
      id: uid(), createdAt: now(), status: 'pending', trigger: 'invoice',
      clientName: demoClients[1] || 'Acme Corp', clientId: null,
      projectName: 'API Integration', description: 'Follow up on invoice #1047',
      amount: 2400, dueDate: d2.toISOString(), snoozeCount: 0, notes: 'Net 30 terms',
    });

    // Upcoming delivery follow-up
    var d3 = new Date(today); d3.setDate(d3.getDate() + 2); d3.setHours(9,0,0,0);
    _reminders.push({
      id: uid(), createdAt: now(), status: 'pending', trigger: 'delivery',
      clientName: demoClients[2] || 'TechStart Inc', clientId: null,
      projectName: 'Mobile App v2', description: 'Follow up after project delivery: Mobile App v2',
      amount: null, dueDate: d3.toISOString(), snoozeCount: 0, notes: 'Check if handoff docs were sufficient',
    });

    saveReminders();
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    loadRules();
    loadReminders();
    seedDemoIfEmpty();
    injectStyles();
    injectNavBadge();
    listenForTriggers();
    listenForStorageChanges();
    checkOverdueNotifications();
    renderWidget();

    // Periodic check every 60s for overdue items
    setInterval(function() {
      checkOverdueNotifications();
      updateNavBadge();
    }, 60000);
  }

  // ── Public API ──────────────────────────────────────────────
  var CortexFollowUp = {
    init: init,
    create: createReminder,
    get: getReminder,
    getAll: getAllReminders,
    getPending: getPending,
    getOverdue: getOverdue,
    getDueToday: getDueToday,
    getUpcoming: getUpcoming,
    complete: completeReminder,
    snooze: snoozeReminder,
    dismiss: dismissReminder,
    delete: deleteReminder,
    getStats: getStats,
    getRules: getRules,
    updateRule: updateRule,
    renderWidget: renderWidget,
    showCreateModal: showCreateModal,
    showSnoozeMenu: showSnoozeMenu,
    updateNavBadge: updateNavBadge,
    _handleCreate: _handleCreate,
  };

  global.CortexFollowUp = CortexFollowUp;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : globalThis);
