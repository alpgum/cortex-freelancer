/* ============================================
   CORTEX FREELANCER — Communication Core Engine
   cf3-011 | communication-core.js
   ============================================
   Template engine, communication log, follow-up tracking,
   variable substitution, and client integration.
   ============================================ */
;(function(global) {
  'use strict';

  const STORAGE_KEYS = {
    MESSAGES: 'cortex_comm_messages',
    TEMPLATES: 'cortex_comm_templates',
    FOLLOWUPS: 'cortex_comm_followups',
  };
  const VERSION = '1.0.0';

  // ── Helpers ─────────────────────────────────────────────────
  function uid() { return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8); }
  function now() { return new Date().toISOString(); }
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function dateStamp() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function formatDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  function formatDateTime(iso) { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
  function timeAgo(iso) { if (!iso) return '—'; const diff = Date.now() - new Date(iso).getTime(); const m = Math.floor(diff/60000); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; const h = Math.floor(m/60); if (h < 24) return h + 'h ago'; const d = Math.floor(h/24); if (d < 30) return d + 'd ago'; return Math.floor(d/30) + 'mo ago'; }
  function daysUntil(dateStr) { const target = new Date(dateStr); target.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0); return Math.floor((target - today) / 86400000); }
  function downloadFile(content, filename, mime) { const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }

  // ── Storage Layer ───────────────────────────────────────────
  function loadJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch(e) { console.warn('[CommCore] Load error:', key, e); return fallback; }
  }
  function saveJSON(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch(e) { console.error('[CommCore] Save error:', key, e); }
  }

  // ── Template Engine ─────────────────────────────────────────
  const DEFAULT_TEMPLATES = [
    {
      id: 'tpl_proposal_followup',
      name: 'Proposal Follow-Up',
      category: 'sales',
      subject: 'Following up on my proposal — {{projectName}}',
      body: `Hi {{clientName}},

I hope you're doing well! I wanted to follow up on the proposal I sent for {{projectName}}.

I'm excited about the opportunity to work together and believe my approach would deliver excellent results for {{company}}.

If you have any questions or would like to discuss adjustments to the scope or timeline, I'd be happy to hop on a quick call.

Looking forward to hearing from you!

Best regards,
{{myName}}
{{myTitle}}
{{myEmail}}`,
      followUpDays: 3,
      type: 'email',
    },
    {
      id: 'tpl_payment_reminder',
      name: 'Payment Reminder',
      category: 'billing',
      subject: 'Payment reminder — Invoice #{{invoiceNumber}}',
      body: `Hi {{clientName}},

I hope this message finds you well. I'm writing to follow up on Invoice #{{invoiceNumber}} for {{amount}} which was due on {{dueDate}}.

Project: {{projectName}}
Amount: {{amount}}
Payment Terms: {{paymentTerms}}

If payment has already been sent, please disregard this message. Otherwise, could you let me know the expected payment date?

I've attached the invoice for your convenience. Please let me know if you need any clarification.

Thank you,
{{myName}}
{{myEmail}}`,
      followUpDays: 7,
      type: 'email',
    },
    {
      id: 'tpl_project_update',
      name: 'Project Status Update',
      category: 'project',
      subject: 'Project update — {{projectName}}',
      body: `Hi {{clientName}},

Here's a quick update on {{projectName}}:

📊 Status: {{projectStatus}}
⏱ Hours logged: {{hoursLogged}}
📅 Next milestone: {{nextMilestone}}

What's been completed:
• [List completed items]

What's coming up next:
• [List upcoming tasks]

Let me know if you have any questions or feedback.

Best,
{{myName}}`,
      followUpDays: 0,
      type: 'email',
    },
    {
      id: 'tpl_milestone_delivery',
      name: 'Milestone Delivery',
      category: 'project',
      subject: 'Milestone delivered — {{projectName}}',
      body: `Hi {{clientName}},

Great news! I've completed the {{milestoneName}} milestone for {{projectName}}.

Here's what's included in this delivery:
• [Deliverable 1]
• [Deliverable 2]
• [Deliverable 3]

You can review everything at: [link]

I'd love to get your feedback. Please take a look and let me know:
1. What looks good ✅
2. Any changes needed 🔄
3. Questions or concerns ❓

Looking forward to your thoughts!

Best,
{{myName}}`,
      followUpDays: 2,
      type: 'email',
    },
    {
      id: 'tpl_meeting_request',
      name: 'Meeting Request',
      category: 'meeting',
      subject: 'Meeting request — {{meetingTopic}}',
      body: `Hi {{clientName}},

I'd like to schedule a meeting to discuss {{meetingTopic}}.

Would any of these times work for you?
• [Option 1]
• [Option 2]
• [Option 3]

Duration: ~{{meetingDuration}} minutes
Format: {{meetingFormat}} (Video call / Phone / In-person)

Please let me know your preference and I'll send a calendar invite.

Thanks,
{{myName}}
{{myEmail}}`,
      followUpDays: 1,
      type: 'email',
    },
    {
      id: 'tpl_thank_you',
      name: 'Thank You / Project Wrap',
      category: 'relationship',
      subject: 'Thank you — {{projectName}} completed! 🎉',
      body: `Hi {{clientName}},

I wanted to take a moment to thank you for the opportunity to work on {{projectName}}. It's been a great collaboration!

A quick recap:
• Project: {{projectName}}
• Duration: {{projectDuration}}
• Deliverables: All completed and delivered ✅

If you're happy with the work, I'd really appreciate:
• A testimonial or review (even a sentence or two helps!)
• Referrals to anyone who might need similar work

I'd love to work together again in the future. Don't hesitate to reach out!

All the best,
{{myName}}
{{myTitle}}`,
      followUpDays: 5,
      type: 'email',
    },
    {
      id: 'tpl_scope_change',
      name: 'Scope Change Notice',
      category: 'project',
      subject: 'Scope change discussion — {{projectName}}',
      body: `Hi {{clientName}},

I've been reviewing the latest requirements for {{projectName}} and wanted to flag some changes from the original scope:

Changes identified:
• [Change 1]
• [Change 2]

Impact:
• Timeline: [estimated additional time]
• Budget: [estimated additional cost]

I want to make sure we're aligned before proceeding. Could we discuss this at your earliest convenience?

Options:
A) Proceed with changes (adjusted timeline/budget)
B) Keep original scope
C) Discuss a middle ground

Let me know your thoughts!

Best,
{{myName}}`,
      followUpDays: 2,
      type: 'email',
    },
    {
      id: 'tpl_quick_checkin',
      name: 'Quick Check-In',
      category: 'relationship',
      subject: 'Quick check-in 👋',
      body: `Hey {{clientName}},

Just wanted to check in and see how things are going! It's been a while since we last connected.

I've been working on some interesting projects lately and thought of you. If you have any upcoming needs, I'd love to chat.

Hope all is well!

Cheers,
{{myName}}`,
      followUpDays: 14,
      type: 'email',
    },
  ];

  // Extract all possible variable names from templates
  const AVAILABLE_VARIABLES = [
    { key: 'clientName', label: 'Client Name', source: 'client' },
    { key: 'company', label: 'Company', source: 'client' },
    { key: 'clientEmail', label: 'Client Email', source: 'client' },
    { key: 'projectName', label: 'Project Name', source: 'manual' },
    { key: 'projectStatus', label: 'Project Status', source: 'manual' },
    { key: 'amount', label: 'Amount', source: 'manual' },
    { key: 'invoiceNumber', label: 'Invoice #', source: 'manual' },
    { key: 'dueDate', label: 'Due Date', source: 'manual' },
    { key: 'paymentTerms', label: 'Payment Terms', source: 'settings' },
    { key: 'hoursLogged', label: 'Hours Logged', source: 'time' },
    { key: 'nextMilestone', label: 'Next Milestone', source: 'manual' },
    { key: 'milestoneName', label: 'Milestone Name', source: 'manual' },
    { key: 'meetingTopic', label: 'Meeting Topic', source: 'manual' },
    { key: 'meetingDuration', label: 'Duration (min)', source: 'manual' },
    { key: 'meetingFormat', label: 'Format', source: 'manual' },
    { key: 'projectDuration', label: 'Project Duration', source: 'manual' },
    { key: 'myName', label: 'Your Name', source: 'settings' },
    { key: 'myTitle', label: 'Your Title', source: 'settings' },
    { key: 'myEmail', label: 'Your Email', source: 'settings' },
  ];

  const TemplateEngine = {
    _templates: [],

    load() {
      const stored = loadJSON(STORAGE_KEYS.TEMPLATES, null);
      if (stored && stored.length > 0) {
        this._templates = stored;
      } else {
        this._templates = [...DEFAULT_TEMPLATES];
        this.save();
      }
      return this._templates;
    },

    save() { saveJSON(STORAGE_KEYS.TEMPLATES, this._templates); },

    getAll() { return [...this._templates]; },
    getById(id) { return this._templates.find(t => t.id === id) || null; },
    getByCategory(cat) { return this._templates.filter(t => t.category === cat); },

    create(template) {
      const record = { id: 'tpl_' + Date.now(), ...template };
      this._templates.push(record);
      this.save();
      return record;
    },

    update(id, updates) {
      const idx = this._templates.findIndex(t => t.id === id);
      if (idx === -1) return null;
      this._templates[idx] = { ...this._templates[idx], ...updates, id };
      this.save();
      return this._templates[idx];
    },

    delete(id) {
      this._templates = this._templates.filter(t => t.id !== id);
      this.save();
    },

    /**
     * Replace {{variables}} in text with provided values
     */
    render(text, variables = {}) {
      if (!text) return '';
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined && variables[key] !== '' ? variables[key] : match;
      });
    },

    /**
     * Extract variable names used in a template
     */
    extractVariables(text) {
      const matches = text.match(/\{\{(\w+)\}\}/g) || [];
      return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
    },

    /**
     * Build variables from client data + settings
     */
    buildVariables(clientId) {
      const vars = {};

      // From Settings
      if (typeof CortexSettings !== 'undefined') {
        const settings = CortexSettings.get();
        vars.myName = settings.user?.displayName || settings.business?.name || '';
        vars.myTitle = settings.business?.title || '';
        vars.myEmail = settings.user?.email || '';
        vars.paymentTerms = CortexSettings.getPaymentTermsLabel ? CortexSettings.getPaymentTermsLabel() : (settings.payment?.defaultTerms || 'Net 30');
      }

      // From Client Directory
      if (clientId) {
        const clientStore = localStorage.getItem('cortex_client_directory');
        if (clientStore) {
          try {
            const data = JSON.parse(clientStore);
            const client = (data.clients || []).find(c => c.id === clientId);
            if (client) {
              vars.clientName = client.name || '';
              vars.company = client.company || '';
              vars.clientEmail = client.email || '';
              // Get first active project
              const activeProject = (client.projects || []).find(p => p.status === 'active');
              if (activeProject) {
                vars.projectName = vars.projectName || activeProject.name || '';
                vars.amount = activeProject.amount ? ('$' + Number(activeProject.amount).toLocaleString()) : '';
              }
            }
          } catch(e) {}
        }
      }

      return vars;
    },

    resetToDefaults() {
      this._templates = [...DEFAULT_TEMPLATES];
      this.save();
    }
  };

  // ── Communication Log ───────────────────────────────────────
  const CommLog = {
    _messages: [],

    load() {
      this._messages = loadJSON(STORAGE_KEYS.MESSAGES, []);
      return this._messages;
    },

    save() { saveJSON(STORAGE_KEYS.MESSAGES, this._messages); },

    getAll() { return [...this._messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); },

    getByClient(clientId) {
      return this._messages
        .filter(m => m.clientId === clientId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getById(id) { return this._messages.find(m => m.id === id) || null; },

    /**
     * Log a new communication
     * @param {object} msg - { clientId, clientName, type, subject, body, templateId?, notes? }
     */
    create(msg) {
      const record = {
        id: uid(),
        createdAt: now(),
        status: 'sent',
        ...msg,
      };
      this._messages.unshift(record);
      this.save();
      return record;
    },

    update(id, updates) {
      const idx = this._messages.findIndex(m => m.id === id);
      if (idx === -1) return null;
      this._messages[idx] = { ...this._messages[idx], ...updates };
      this.save();
      return this._messages[idx];
    },

    delete(id) {
      this._messages = this._messages.filter(m => m.id !== id);
      this.save();
    },

    /**
     * Get unique client threads (grouped by clientId)
     */
    getThreads() {
      const threads = {};
      for (const msg of this._messages) {
        const cid = msg.clientId || '_unknown';
        if (!threads[cid]) {
          threads[cid] = {
            clientId: cid,
            clientName: msg.clientName || 'Unknown',
            messages: [],
            lastMessage: null,
            unread: 0,
          };
        }
        threads[cid].messages.push(msg);
      }
      // Sort each thread's messages and compute metadata
      for (const t of Object.values(threads)) {
        t.messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        t.lastMessage = t.messages[0];
        t.count = t.messages.length;
      }
      // Sort threads by last message date
      return Object.values(threads).sort((a, b) =>
        new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
      );
    },

    getStats() {
      const total = this._messages.length;
      const thisWeek = this._messages.filter(m => {
        const d = new Date(m.createdAt);
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      }).length;
      const thisMonth = this._messages.filter(m => {
        const d = new Date(m.createdAt);
        const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
        return d >= monthAgo;
      }).length;
      const types = {};
      this._messages.forEach(m => { types[m.type || 'email'] = (types[m.type || 'email'] || 0) + 1; });
      const uniqueClients = new Set(this._messages.map(m => m.clientId)).size;
      return { total, thisWeek, thisMonth, types, uniqueClients };
    },

    search(query) {
      if (!query) return this.getAll();
      const q = query.toLowerCase();
      return this._messages.filter(m =>
        (m.subject || '').toLowerCase().includes(q) ||
        (m.body || '').toLowerCase().includes(q) ||
        (m.clientName || '').toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q)
      ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    /**
     * Export messages to CSV
     */
    exportCSV(messages) {
      const headers = ['Date', 'Client', 'Type', 'Subject', 'Body', 'Notes', 'Status'];
      const rows = (messages || this._messages).map(m => [
        m.createdAt ? new Date(m.createdAt).toLocaleString() : '',
        m.clientName || '',
        m.type || 'email',
        (m.subject || '').replace(/"/g, '""'),
        (m.body || '').replace(/"/g, '""').replace(/\n/g, ' '),
        (m.notes || '').replace(/"/g, '""'),
        m.status || 'sent',
      ]);
      const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
      downloadFile(csv, 'cortex-communications-' + dateStamp() + '.csv', 'text/csv');
    },

    /**
     * Export messages to printable PDF view
     */
    exportPDF(messages) {
      const msgs = messages || this._messages;
      const win = window.open('', '_blank');
      const html = `<!DOCTYPE html><html><head><title>Communication Log Export</title>
      <style>
        body{font-family:Arial,sans-serif;padding:2rem;color:#333;max-width:900px;margin:0 auto}
        h1{font-size:1.5rem;margin-bottom:.25rem}
        .subtitle{color:#666;margin-bottom:2rem;font-size:.9rem}
        .entry{border-bottom:1px solid #eee;padding:1rem 0}
        .entry-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}
        .entry-client{font-weight:700;font-size:.95rem}
        .entry-date{color:#999;font-size:.8rem}
        .entry-type{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600;background:#f0f0f0;color:#666;margin-right:.5rem}
        .entry-subject{font-weight:600;margin-bottom:.35rem}
        .entry-body{color:#555;font-size:.85rem;line-height:1.6;white-space:pre-wrap}
        .footer{margin-top:2rem;font-size:.75rem;color:#999;text-align:center}
      </style></head><body>
      <h1>Communication Log</h1>
      <p class="subtitle">Exported ${new Date().toLocaleDateString()} · ${msgs.length} message${msgs.length !== 1 ? 's' : ''}</p>
      ${msgs.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(m => `
        <div class="entry">
          <div class="entry-header">
            <div><span class="entry-type">${esc(m.type || 'email').toUpperCase()}</span><span class="entry-client">${esc(m.clientName || 'Unknown')}</span></div>
            <div class="entry-date">${formatDateTime(m.createdAt)}</div>
          </div>
          ${m.subject ? `<div class="entry-subject">${esc(m.subject)}</div>` : ''}
          <div class="entry-body">${esc(m.body || '')}</div>
        </div>
      `).join('')}
      <p class="footer">Generated by Cortex Freelancer · cortexfreelancer.com</p>
      </body></html>`;
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  // ── Follow-Up Tracker ───────────────────────────────────────
  const FollowUps = {
    _items: [],

    load() {
      this._items = loadJSON(STORAGE_KEYS.FOLLOWUPS, []);
      return this._items;
    },

    save() { saveJSON(STORAGE_KEYS.FOLLOWUPS, this._items); },

    getAll() {
      return [...this._items].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    },

    getPending() {
      return this.getAll().filter(f => f.status === 'pending');
    },

    getOverdue() {
      const today = new Date(); today.setHours(0,0,0,0);
      return this.getPending().filter(f => new Date(f.dueDate) < today);
    },

    getDueToday() {
      const today = new Date(); today.setHours(0,0,0,0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      return this.getPending().filter(f => {
        const d = new Date(f.dueDate);
        return d >= today && d < tomorrow;
      });
    },

    getUpcoming(days = 7) {
      const today = new Date(); today.setHours(0,0,0,0);
      const end = new Date(today); end.setDate(end.getDate() + days);
      return this.getPending().filter(f => {
        const d = new Date(f.dueDate);
        return d >= today && d <= end;
      });
    },

    /**
     * Create a follow-up
     * @param {object} data - { clientId, clientName, messageId?, description, dueDate, type? }
     */
    create(data) {
      const record = {
        id: 'fu_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        createdAt: now(),
        status: 'pending', // pending, completed, snoozed, dismissed
        type: 'general',
        ...data,
      };
      this._items.push(record);
      this.save();
      return record;
    },

    complete(id) {
      const item = this._items.find(f => f.id === id);
      if (item) { item.status = 'completed'; item.completedAt = now(); this.save(); }
      return item;
    },

    snooze(id, days = 1) {
      const item = this._items.find(f => f.id === id);
      if (item) {
        const d = new Date(item.dueDate);
        d.setDate(d.getDate() + days);
        item.dueDate = d.toISOString();
        item.status = 'pending';
        this.save();
      }
      return item;
    },

    dismiss(id) {
      const item = this._items.find(f => f.id === id);
      if (item) { item.status = 'dismissed'; this.save(); }
      return item;
    },

    delete(id) {
      this._items = this._items.filter(f => f.id !== id);
      this.save();
    },

    getStats() {
      const pending = this.getPending().length;
      const overdue = this.getOverdue().length;
      const today = this.getDueToday().length;
      const completed = this._items.filter(f => f.status === 'completed').length;
      return { pending, overdue, today, completed, total: this._items.length };
    },

    /**
     * Auto-create follow-up from a sent message + template
     */
    createFromMessage(message, template) {
      if (!template || !template.followUpDays || template.followUpDays <= 0) return null;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + template.followUpDays);
      return this.create({
        clientId: message.clientId,
        clientName: message.clientName,
        messageId: message.id,
        description: `Follow up on: ${message.subject || template.name}`,
        dueDate: dueDate.toISOString(),
        type: template.category || 'general',
      });
    }
  };

  // ── UI Controller ───────────────────────────────────────────
  const CommUI = {
    currentView: 'compose', // compose, log, followups
    selectedClientId: null,
    selectedTemplateId: null,
    manualVariables: {},
    activeThreadId: null,

    init() {
      TemplateEngine.load();
      CommLog.load();
      FollowUps.load();
      this.bindEvents();
      this.renderStats();
      this.renderThreads();
      this.renderFollowUps();
      this.showView('compose');

      // Seed demo data if empty
      if (CommLog.getAll().length === 0) this.seedDemo();

      // Check for overdue follow-ups
      const overdue = FollowUps.getOverdue();
      if (overdue.length > 0) {
        setTimeout(() => showToast(`${overdue.length} overdue follow-up${overdue.length > 1 ? 's' : ''} need attention!`, 'info'), 800);
      }
    },

    bindEvents() {
      // View tabs
      document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', () => this.showView(tab.dataset.view));
      });

      // Thread search
      const threadSearch = document.getElementById('threadSearch');
      if (threadSearch) threadSearch.addEventListener('input', () => this.renderThreads());

      // Client selector
      const clientSelect = document.getElementById('composeClient');
      if (clientSelect) clientSelect.addEventListener('change', (e) => {
        this.selectedClientId = e.target.value;
        this.updateVariables();
        this.updatePreview();
      });

      // Template selector
      const tplSelect = document.getElementById('composeTemplate');
      if (tplSelect) tplSelect.addEventListener('change', (e) => {
        this.selectedTemplateId = e.target.value;
        this.applyTemplate();
      });

      // Live preview on input
      ['composeSubject', 'composeBody'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => this.updatePreview());
      });

      // Compose type
      const typeSelect = document.getElementById('composeType');
      if (typeSelect) typeSelect.addEventListener('change', () => this.updatePreview());

      // Send button
      const sendBtn = document.getElementById('btnSend');
      if (sendBtn) sendBtn.addEventListener('click', () => this.sendMessage());

      // Save draft
      const draftBtn = document.getElementById('btnSaveDraft');
      if (draftBtn) draftBtn.addEventListener('click', () => this.saveDraft());

      // Copy to clipboard
      const copyBtn = document.getElementById('btnCopy');
      if (copyBtn) copyBtn.addEventListener('click', () => this.copyToClipboard());

      // Template manager
      const manageTplBtn = document.getElementById('btnManageTemplates');
      if (manageTplBtn) manageTplBtn.addEventListener('click', () => this.openTemplateManager());

      // Modal close
      const modalOverlay = document.getElementById('templateModalOverlay');
      if (modalOverlay) {
        modalOverlay.addEventListener('click', e => { if (e.target === e.currentTarget) this.closeTemplateManager(); });
      }
      const modalClose = document.getElementById('templateModalClose');
      if (modalClose) modalClose.addEventListener('click', () => this.closeTemplateManager());

      // New thread button
      const newBtn = document.getElementById('btnNewThread');
      if (newBtn) newBtn.addEventListener('click', () => {
        this.activeThreadId = null;
        this.clearCompose();
        this.showView('compose');
        this.renderThreads();
      });

      // Export buttons
      const exportCSVBtn = document.getElementById('btnExportCSV');
      if (exportCSVBtn) exportCSVBtn.addEventListener('click', () => { CommLog.exportCSV(); showToast('CSV exported'); });
      const exportPDFBtn = document.getElementById('btnExportPDF');
      if (exportPDFBtn) exportPDFBtn.addEventListener('click', () => { CommLog.exportPDF(); showToast('PDF export opened'); });

      // Follow-up add
      const addFuBtn = document.getElementById('btnAddFollowUp');
      if (addFuBtn) addFuBtn.addEventListener('click', () => this.addManualFollowUp());

      // Keyboard shortcuts
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') this.closeTemplateManager();
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') this.sendMessage();
      });
    },

    // ── View Switching ──────────────────────────────────
    showView(view) {
      this.currentView = view;
      document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
      document.getElementById('composeView').style.display = view === 'compose' ? 'block' : 'none';
      document.getElementById('logView').style.display = view === 'log' ? 'block' : 'none';

      if (view === 'compose') {
        this.populateClientDropdown();
        this.populateTemplateDropdown();
        this.updateVariables();
      }
      if (view === 'log') {
        this.renderLog();
      }
    },

    // ── Client Dropdown ─────────────────────────────────
    populateClientDropdown() {
      const select = document.getElementById('composeClient');
      if (!select) return;
      let clients = [];
      try {
        const data = JSON.parse(localStorage.getItem('cortex_client_directory') || '{}');
        clients = data.clients || [];
      } catch(e) {}

      select.innerHTML = '<option value="">— Select Client —</option>' +
        clients.map(c => `<option value="${c.id}" ${c.id === this.selectedClientId ? 'selected' : ''}>${esc(c.name)}${c.company ? ' (' + esc(c.company) + ')' : ''}</option>`).join('');
    },

    // ── Template Dropdown ───────────────────────────────
    populateTemplateDropdown() {
      const select = document.getElementById('composeTemplate');
      if (!select) return;
      const templates = TemplateEngine.getAll();
      const categories = [...new Set(templates.map(t => t.category))];
      let html = '<option value="">— Select Template —</option>';
      categories.forEach(cat => {
        html += `<optgroup label="${cat.charAt(0).toUpperCase() + cat.slice(1)}">`;
        templates.filter(t => t.category === cat).forEach(t => {
          html += `<option value="${t.id}" ${t.id === this.selectedTemplateId ? 'selected' : ''}>${esc(t.name)}</option>`;
        });
        html += '</optgroup>';
      });
      select.innerHTML = html;
    },

    // ── Apply Template ──────────────────────────────────
    applyTemplate() {
      const tpl = TemplateEngine.getById(this.selectedTemplateId);
      if (!tpl) return;
      document.getElementById('composeSubject').value = tpl.subject || '';
      document.getElementById('composeBody').value = tpl.body || '';
      if (tpl.type) document.getElementById('composeType').value = tpl.type;
      this.updateVariables();
      this.updatePreview();
    },

    // ── Variable Chips ──────────────────────────────────
    updateVariables() {
      const autoVars = TemplateEngine.buildVariables(this.selectedClientId);
      this.manualVariables = { ...this.manualVariables, ...autoVars };

      // Show variable chips
      const container = document.getElementById('varChips');
      if (!container) return;
      const subject = document.getElementById('composeSubject').value;
      const body = document.getElementById('composeBody').value;
      const usedVars = TemplateEngine.extractVariables(subject + ' ' + body);
      if (usedVars.length === 0) { container.innerHTML = ''; return; }

      container.innerHTML = usedVars.map(v => {
        const val = this.manualVariables[v] || '';
        const meta = AVAILABLE_VARIABLES.find(av => av.key === v);
        const label = meta ? meta.label : v;
        return `<span class="var-chip" data-var="${v}" title="${val ? 'Filled: ' + val : 'Click to set'}" onclick="window._CommUI.promptVariable('${v}', '${esc(label)}')">${val ? '✓' : '?'} {{${v}}}</span>`;
      }).join('');
    },

    promptVariable(key, label) {
      const current = this.manualVariables[key] || '';
      const val = prompt(`Set value for ${label}:`, current);
      if (val !== null) {
        this.manualVariables[key] = val;
        this.updateVariables();
        this.updatePreview();
      }
    },

    // ── Live Preview ────────────────────────────────────
    updatePreview() {
      const subject = document.getElementById('composeSubject').value;
      const body = document.getElementById('composeBody').value;
      const preview = document.getElementById('previewBox');
      if (!preview) return;

      const renderedSubject = TemplateEngine.render(subject, this.manualVariables);
      const renderedBody = TemplateEngine.render(body, this.manualVariables);

      preview.innerHTML = (renderedSubject ? `<div class="preview-subject">${esc(renderedSubject)}</div>` : '') +
        esc(renderedBody);
    },

    // ── Send Message ────────────────────────────────────
    sendMessage() {
      const clientId = document.getElementById('composeClient').value;
      const subject = document.getElementById('composeSubject').value.trim();
      const body = document.getElementById('composeBody').value.trim();
      const type = document.getElementById('composeType').value;
      const notes = document.getElementById('composeNotes')?.value?.trim() || '';

      if (!body) { showToast('Message body is required', 'error'); return; }

      // Get client name
      let clientName = 'Unknown';
      if (clientId) {
        try {
          const data = JSON.parse(localStorage.getItem('cortex_client_directory') || '{}');
          const client = (data.clients || []).find(c => c.id === clientId);
          if (client) clientName = client.name;
        } catch(e) {}
      }

      // Render with variables
      const renderedSubject = TemplateEngine.render(subject, this.manualVariables);
      const renderedBody = TemplateEngine.render(body, this.manualVariables);

      const message = CommLog.create({
        clientId: clientId || '_manual',
        clientName,
        type,
        subject: renderedSubject,
        body: renderedBody,
        templateId: this.selectedTemplateId || null,
        notes,
      });

      // Auto-create follow-up if template has followUpDays
      if (this.selectedTemplateId) {
        const tpl = TemplateEngine.getById(this.selectedTemplateId);
        const fu = FollowUps.createFromMessage(message, tpl);
        if (fu) showToast(`Follow-up scheduled for ${formatDate(fu.dueDate)}`, 'info');
      }

      // Refresh UI
      this.clearCompose();
      this.renderStats();
      this.renderThreads();
      this.renderFollowUps();
      showToast('Message logged successfully!');
    },

    saveDraft() {
      const subject = document.getElementById('composeSubject').value;
      const body = document.getElementById('composeBody').value;
      if (!subject && !body) { showToast('Nothing to save', 'error'); return; }
      localStorage.setItem('cortex_comm_draft', JSON.stringify({
        clientId: this.selectedClientId,
        templateId: this.selectedTemplateId,
        subject, body,
        type: document.getElementById('composeType').value,
        notes: document.getElementById('composeNotes')?.value || '',
        variables: this.manualVariables,
        savedAt: now(),
      }));
      showToast('Draft saved');
    },

    loadDraft() {
      try {
        const draft = JSON.parse(localStorage.getItem('cortex_comm_draft') || 'null');
        if (!draft) return false;
        this.selectedClientId = draft.clientId;
        this.selectedTemplateId = draft.templateId;
        this.manualVariables = draft.variables || {};
        document.getElementById('composeSubject').value = draft.subject || '';
        document.getElementById('composeBody').value = draft.body || '';
        document.getElementById('composeType').value = draft.type || 'email';
        if (document.getElementById('composeNotes')) document.getElementById('composeNotes').value = draft.notes || '';
        this.populateClientDropdown();
        this.populateTemplateDropdown();
        this.updateVariables();
        this.updatePreview();
        return true;
      } catch(e) { return false; }
    },

    copyToClipboard() {
      const subject = TemplateEngine.render(document.getElementById('composeSubject').value, this.manualVariables);
      const body = TemplateEngine.render(document.getElementById('composeBody').value, this.manualVariables);
      const text = (subject ? 'Subject: ' + subject + '\n\n' : '') + body;
      navigator.clipboard.writeText(text).then(
        () => showToast('Copied to clipboard!'),
        () => showToast('Copy failed', 'error')
      );
    },

    clearCompose() {
      document.getElementById('composeSubject').value = '';
      document.getElementById('composeBody').value = '';
      if (document.getElementById('composeNotes')) document.getElementById('composeNotes').value = '';
      document.getElementById('composeType').value = 'email';
      this.selectedTemplateId = null;
      this.manualVariables = {};
      this.populateTemplateDropdown();
      this.updateVariables();
      this.updatePreview();
    },

    // ── Thread List ─────────────────────────────────────
    renderThreads() {
      const container = document.getElementById('threadList');
      if (!container) return;
      const searchQ = (document.getElementById('threadSearch')?.value || '').toLowerCase();
      let threads = CommLog.getThreads();
      if (searchQ) {
        threads = threads.filter(t =>
          t.clientName.toLowerCase().includes(searchQ) ||
          (t.lastMessage?.subject || '').toLowerCase().includes(searchQ)
        );
      }

      if (threads.length === 0) {
        container.innerHTML = `<div class="thread-empty"><div class="empty-icon">💬</div><p>No conversations yet.<br>Compose your first message!</p></div>`;
        return;
      }

      container.innerHTML = threads.map(t => {
        const preview = t.lastMessage?.subject || t.lastMessage?.body?.substring(0, 60) || 'No subject';
        const fuCount = FollowUps.getPending().filter(f => f.clientId === t.clientId).length;
        const overdue = FollowUps.getOverdue().filter(f => f.clientId === t.clientId).length;
        return `<div class="thread-item ${this.activeThreadId === t.clientId ? 'active' : ''}" data-client="${t.clientId}" onclick="window._CommUI.selectThread('${t.clientId}')">
          <div class="thread-item-name">
            <span>${esc(t.clientName)}</span>
            <span style="font-size:.72rem;color:var(--text3)">${t.count}</span>
          </div>
          <div class="thread-item-preview">${esc(preview)}</div>
          <div class="thread-item-meta">
            <span class="thread-item-time">${timeAgo(t.lastMessage?.createdAt)}</span>
            ${fuCount > 0 ? `<span class="thread-badge ${overdue > 0 ? 'badge-overdue' : 'badge-followup'}">${overdue > 0 ? '⚠ ' + overdue + ' overdue' : '📅 ' + fuCount + ' follow-up'}</span>` : ''}
          </div>
        </div>`;
      }).join('');
    },

    selectThread(clientId) {
      this.activeThreadId = clientId;
      this.selectedClientId = clientId;
      this.renderThreads();

      // Show log view for this client
      this.showView('log');
      this.renderLog(clientId);

      // Also update compose client dropdown
      this.populateClientDropdown();
    },

    // ── Communication Log ───────────────────────────────
    renderLog(clientId) {
      const container = document.getElementById('logEntries');
      if (!container) return;
      const messages = clientId ? CommLog.getByClient(clientId) : CommLog.getAll();

      if (messages.length === 0) {
        container.innerHTML = `<div class="thread-empty"><div class="empty-icon">📋</div><p>No communications logged yet.</p></div>`;
        return;
      }

      container.innerHTML = messages.map(m => `
        <div class="log-entry" data-id="${m.id}">
          <div class="log-entry-header">
            <div>
              <span class="log-entry-type type-${m.type || 'email'}">${esc(m.type || 'email')}</span>
              ${!clientId ? `<strong style="font-size:.85rem">${esc(m.clientName)}</strong>` : ''}
            </div>
            <span class="log-entry-date">${formatDateTime(m.createdAt)}</span>
          </div>
          ${m.subject ? `<div class="log-entry-subject">${esc(m.subject)}</div>` : ''}
          <div class="log-entry-body">${esc(m.body || '').substring(0, 300)}${(m.body || '').length > 300 ? '...' : ''}</div>
          ${m.notes ? `<div style="margin-top:.5rem;padding:.5rem;background:rgba(255,200,0,.05);border-radius:6px;font-size:.78rem;color:var(--yellow)">📝 ${esc(m.notes)}</div>` : ''}
          <div class="log-entry-actions">
            <button class="btn btn-secondary btn-sm" onclick="window._CommUI.reuseMessage('${m.id}')">♻ Reuse</button>
            <button class="btn btn-secondary btn-sm" onclick="window._CommUI.addFollowUpForMessage('${m.id}')">📅 Follow-Up</button>
            <button class="btn btn-danger btn-sm" onclick="window._CommUI.deleteMessage('${m.id}')">✕</button>
          </div>
        </div>
      `).join('');
    },

    reuseMessage(msgId) {
      const msg = CommLog.getById(msgId);
      if (!msg) return;
      this.selectedClientId = msg.clientId;
      document.getElementById('composeSubject').value = msg.subject || '';
      document.getElementById('composeBody').value = msg.body || '';
      document.getElementById('composeType').value = msg.type || 'email';
      this.showView('compose');
      this.populateClientDropdown();
      this.updatePreview();
      showToast('Message loaded for reuse');
    },

    deleteMessage(msgId) {
      if (!confirm('Delete this communication log entry?')) return;
      CommLog.delete(msgId);
      this.renderLog(this.activeThreadId);
      this.renderThreads();
      this.renderStats();
      showToast('Entry deleted');
    },

    addFollowUpForMessage(msgId) {
      const msg = CommLog.getById(msgId);
      if (!msg) return;
      const days = prompt('Follow up in how many days?', '3');
      if (!days) return;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + parseInt(days));
      FollowUps.create({
        clientId: msg.clientId,
        clientName: msg.clientName,
        messageId: msg.id,
        description: `Follow up on: ${msg.subject || 'message'}`,
        dueDate: dueDate.toISOString(),
        type: msg.type || 'general',
      });
      this.renderFollowUps();
      this.renderStats();
      showToast(`Follow-up set for ${formatDate(dueDate.toISOString())}`);
    },

    // ── Follow-Ups ──────────────────────────────────────
    renderFollowUps() {
      const container = document.getElementById('followupList');
      if (!container) return;
      const items = FollowUps.getPending();

      if (items.length === 0) {
        container.innerHTML = `<div class="followup-empty">✅ No pending follow-ups</div>`;
        return;
      }

      container.innerHTML = items.map(f => {
        const days = daysUntil(f.dueDate);
        let dateClass = 'upcoming';
        let dateLabel = formatDate(f.dueDate);
        if (days < 0) { dateClass = 'overdue'; dateLabel = Math.abs(days) + 'd overdue'; }
        else if (days === 0) { dateClass = 'today'; dateLabel = 'Today'; }
        else if (days === 1) { dateLabel = 'Tomorrow'; }
        else { dateLabel = `In ${days}d`; }

        return `<div class="followup-item ${days < 0 ? 'overdue' : days === 0 ? 'today' : ''}">
          <div class="followup-info">
            <div class="followup-client">${esc(f.clientName)}</div>
            <div class="followup-desc">${esc(f.description)}</div>
          </div>
          <span class="followup-date ${dateClass}">${dateLabel}</span>
          <div class="followup-actions">
            <button class="btn btn-green btn-sm" onclick="window._CommUI.completeFollowUp('${f.id}')" title="Complete">✓</button>
            <button class="btn btn-secondary btn-sm" onclick="window._CommUI.snoozeFollowUp('${f.id}')" title="Snooze 1 day">⏰</button>
            <button class="btn btn-danger btn-sm" onclick="window._CommUI.dismissFollowUp('${f.id}')" title="Dismiss">✕</button>
          </div>
        </div>`;
      }).join('');
    },

    completeFollowUp(id) {
      FollowUps.complete(id);
      this.renderFollowUps();
      this.renderThreads();
      this.renderStats();
      showToast('Follow-up completed ✓');
    },

    snoozeFollowUp(id) {
      const days = prompt('Snooze for how many days?', '1');
      if (!days) return;
      FollowUps.snooze(id, parseInt(days));
      this.renderFollowUps();
      showToast(`Snoozed for ${days} day(s)`);
    },

    dismissFollowUp(id) {
      FollowUps.dismiss(id);
      this.renderFollowUps();
      this.renderStats();
      showToast('Follow-up dismissed');
    },

    addManualFollowUp() {
      // Get clients for selection
      let clients = [];
      try {
        const data = JSON.parse(localStorage.getItem('cortex_client_directory') || '{}');
        clients = data.clients || [];
      } catch(e) {}

      const clientName = this.selectedClientId ?
        (clients.find(c => c.id === this.selectedClientId)?.name || 'Unknown') :
        prompt('Client name:');
      if (!clientName) return;
      const desc = prompt('Follow-up description:');
      if (!desc) return;
      const days = prompt('Due in how many days?', '3');
      if (!days) return;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + parseInt(days));

      FollowUps.create({
        clientId: this.selectedClientId || '_manual',
        clientName,
        description: desc,
        dueDate: dueDate.toISOString(),
        type: 'general',
      });

      this.renderFollowUps();
      this.renderStats();
      showToast(`Follow-up created for ${formatDate(dueDate.toISOString())}`);
    },

    // ── Stats ───────────────────────────────────────────
    renderStats() {
      const commStats = CommLog.getStats();
      const fuStats = FollowUps.getStats();

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('statTotalMessages', commStats.total);
      set('statThisWeek', commStats.thisWeek);
      set('statUniqueClients', commStats.uniqueClients);
      set('statPendingFollowUps', fuStats.pending);
      set('statOverdue', fuStats.overdue);
    },

    // ── Template Manager Modal ──────────────────────────
    openTemplateManager() {
      const overlay = document.getElementById('templateModalOverlay');
      if (!overlay) return;
      this.renderTemplateList();
      overlay.classList.add('active');
    },

    closeTemplateManager() {
      const overlay = document.getElementById('templateModalOverlay');
      if (overlay) overlay.classList.remove('active');
    },

    renderTemplateList() {
      const container = document.getElementById('templateList');
      if (!container) return;
      const templates = TemplateEngine.getAll();
      container.innerHTML = templates.map(t => `
        <div class="template-card" onclick="window._CommUI.editTemplate('${t.id}')">
          <div class="template-card-header">
            <span class="template-card-name">${esc(t.name)}</span>
            <span class="template-card-category">${esc(t.category)}</span>
          </div>
          <div class="template-card-preview">${esc(t.body?.substring(0, 120) || '')}</div>
        </div>
      `).join('') +
      `<div style="text-align:center;padding:1rem">
        <button class="btn btn-orange btn-sm" onclick="window._CommUI.createNewTemplate()">+ New Template</button>
        <button class="btn btn-secondary btn-sm" onclick="window._CommUI.resetTemplates()">↺ Reset Defaults</button>
      </div>`;
    },

    editTemplate(id) {
      const tpl = TemplateEngine.getById(id);
      if (!tpl) return;
      const name = prompt('Template name:', tpl.name);
      if (!name) return;
      const subject = prompt('Subject line:', tpl.subject);
      const body = prompt('Body (use {{variables}}):', tpl.body);
      if (body === null) return;
      const category = prompt('Category (sales/billing/project/meeting/relationship):', tpl.category);
      const followUpDays = prompt('Auto follow-up days (0 = none):', tpl.followUpDays);

      TemplateEngine.update(id, {
        name: name || tpl.name,
        subject: subject !== null ? subject : tpl.subject,
        body: body || tpl.body,
        category: category || tpl.category,
        followUpDays: parseInt(followUpDays) || 0,
      });
      this.renderTemplateList();
      this.populateTemplateDropdown();
      showToast('Template updated');
    },

    createNewTemplate() {
      const name = prompt('New template name:');
      if (!name) return;
      const category = prompt('Category (sales/billing/project/meeting/relationship):', 'project');
      TemplateEngine.create({
        name,
        category: category || 'project',
        subject: '',
        body: `Hi {{clientName}},\n\n[Your message here]\n\nBest,\n{{myName}}`,
        followUpDays: 0,
        type: 'email',
      });
      this.renderTemplateList();
      this.populateTemplateDropdown();
      showToast('Template created');
    },

    resetTemplates() {
      if (!confirm('Reset all templates to defaults? Custom templates will be lost.')) return;
      TemplateEngine.resetToDefaults();
      this.renderTemplateList();
      this.populateTemplateDropdown();
      showToast('Templates reset to defaults');
    },

    // ── Demo Data ───────────────────────────────────────
    seedDemo() {
      // Get demo clients from client directory
      let clients = [];
      try {
        const data = JSON.parse(localStorage.getItem('cortex_client_directory') || '{}');
        clients = data.clients || [];
      } catch(e) {}

      if (clients.length === 0) return;

      const demoMessages = [
        { clientIdx: 0, type: 'email', subject: 'Dashboard Redesign — Progress Update', body: 'Hi Sarah,\n\nQuick update on the Dashboard Redesign project:\n\n✅ Wireframes approved\n✅ Design system implemented\n🔄 Frontend development — 65% complete\n\nWe\'re on track for the March 15 delivery. I\'ll send the staging link by Friday.\n\nBest,\nFreelancer', daysAgo: 2 },
        { clientIdx: 0, type: 'email', subject: 'Mobile App MVP — Kickoff Summary', body: 'Hi Sarah,\n\nThanks for the productive kickoff call today! Here\'s a summary:\n\n• Timeline: 8 weeks\n• Tech stack: React Native + Node.js\n• First milestone: User auth + onboarding (2 weeks)\n\nI\'ll send the detailed project plan by tomorrow.\n\nLooking forward to it!', daysAgo: 5 },
        { clientIdx: 1, type: 'email', subject: 'Monthly Retainer — January Report', body: 'Hi Marcus,\n\nHere\'s the January maintenance report for GreenLeaf:\n\n• Uptime: 99.8%\n• Bug fixes: 3 resolved\n• Performance: Page load improved 15%\n• Next month: Security audit planned\n\nHours logged: 12h (of 15h monthly allowance)\n\nLet me know if you have questions!', daysAgo: 1 },
        { clientIdx: 2, type: 'email', subject: 'Re: AI Dashboard Project — Proposal', body: 'Hi Amira,\n\nGreat meeting at TechCrunch! As discussed, I\'ve put together a proposal for the AI dashboard project.\n\nKey highlights:\n• Custom ML pipeline visualization\n• Real-time data streaming\n• Mobile-responsive dashboard\n• Estimated: $18,000 / 6 weeks\n\nI\'ve attached the full proposal. Would love to discuss further!', daysAgo: 8 },
      ];

      demoMessages.forEach(dm => {
        const client = clients[dm.clientIdx];
        if (!client) return;
        const date = new Date();
        date.setDate(date.getDate() - dm.daysAgo);
        CommLog._messages.push({
          id: uid(),
          createdAt: date.toISOString(),
          status: 'sent',
          clientId: client.id,
          clientName: client.name,
          type: dm.type,
          subject: dm.subject,
          body: dm.body,
        });
      });
      CommLog.save();

      // Demo follow-ups
      if (clients[2]) {
        const fuDate = new Date();
        fuDate.setDate(fuDate.getDate() - 1); // overdue
        FollowUps.create({
          clientId: clients[2].id,
          clientName: clients[2].name,
          description: 'Follow up on AI Dashboard proposal',
          dueDate: fuDate.toISOString(),
          type: 'sales',
        });
      }
      if (clients[0]) {
        const fuDate2 = new Date();
        fuDate2.setDate(fuDate2.getDate() + 2);
        FollowUps.create({
          clientId: clients[0].id,
          clientName: clients[0].name,
          description: 'Send staging link for Dashboard Redesign',
          dueDate: fuDate2.toISOString(),
          type: 'project',
        });
      }

      this.renderStats();
      this.renderThreads();
      this.renderFollowUps();
    },
  };

  // ── Toast ───────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast.active');
    if (existing) existing.classList.remove('active');
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.className = 'toast ' + type;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${esc(message)}`;
    requestAnimationFrame(() => toast.classList.add('active'));
    setTimeout(() => toast.classList.remove('active'), 3000);
  }

  // Expose
  global._CommUI = CommUI;
  global.CortexComm = { TemplateEngine, CommLog, FollowUps, AVAILABLE_VARIABLES };

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CommUI.init());
  } else {
    CommUI.init();
  }

})(typeof window !== 'undefined' ? window : globalThis);
