/**
 * Client Directory Core - Cortex Freelancer Phase 3
 * Full CRUD, search/filter, localStorage persistence, CSV/PDF export
 */
(function() {
  'use strict';

  const STORAGE_KEY = 'cortex_client_directory';
  const VERSION = '1.0.0';

  // ── Data Layer ──────────────────────────────────────────────
  const Store = {
    _data: { clients: [], version: VERSION },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this._data = { ...this._data, ...parsed };
        }
      } catch(e) { console.warn('Store load error:', e); }
      return this._data.clients;
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
      } catch(e) { console.error('Store save error:', e); }
    },

    getAll() { return [...this._data.clients]; },

    getById(id) { return this._data.clients.find(c => c.id === id) || null; },

    create(client) {
      const now = new Date().toISOString();
      const record = {
        id: 'cli_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
        createdAt: now,
        updatedAt: now,
        ...client,
        projects: client.projects || [],
        tags: client.tags || []
      };
      this._data.clients.unshift(record);
      this.save();
      return record;
    },

    update(id, updates) {
      const idx = this._data.clients.findIndex(c => c.id === id);
      if (idx === -1) return null;
      this._data.clients[idx] = {
        ...this._data.clients[idx],
        ...updates,
        id,
        updatedAt: new Date().toISOString()
      };
      this.save();
      return this._data.clients[idx];
    },

    delete(id) {
      const idx = this._data.clients.findIndex(c => c.id === id);
      if (idx === -1) return false;
      this._data.clients.splice(idx, 1);
      this.save();
      return true;
    },

    getStats() {
      const clients = this._data.clients;
      const active = clients.filter(c => c.status === 'active').length;
      const prospects = clients.filter(c => c.status === 'prospect').length;
      const totalRevenue = clients.reduce((sum, c) => {
        return sum + (c.projects || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      }, 0);
      const avgRate = clients.filter(c => c.hourlyRate).length > 0
        ? clients.filter(c => c.hourlyRate).reduce((s, c) => s + parseFloat(c.hourlyRate), 0) / clients.filter(c => c.hourlyRate).length
        : 0;
      return { total: clients.length, active, prospects, totalRevenue, avgRate };
    }
  };

  // ── Search & Filter ─────────────────────────────────────────
  function filterClients(clients, { query = '', status = '', projectType = '', sortBy = 'newest' }) {
    let filtered = [...clients];

    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (c.notes || '').toLowerCase().includes(q)
      );
    }

    if (status) {
      filtered = filtered.filter(c => c.status === status);
    }

    if (projectType) {
      filtered = filtered.filter(c =>
        (c.tags || []).some(t => t.toLowerCase() === projectType.toLowerCase()) ||
        (c.projects || []).some(p => (p.type || '').toLowerCase() === projectType.toLowerCase())
      );
    }

    switch(sortBy) {
      case 'newest': filtered.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
      case 'oldest': filtered.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case 'name': filtered.sort((a,b) => (a.name||'').localeCompare(b.name||'')); break;
      case 'revenue':
        filtered.sort((a,b) => {
          const ra = (b.projects||[]).reduce((s,p) => s+(parseFloat(p.amount)||0),0);
          const rb = (a.projects||[]).reduce((s,p) => s+(parseFloat(p.amount)||0),0);
          return ra - rb;
        });
        break;
      case 'rate': filtered.sort((a,b) => (parseFloat(b.hourlyRate)||0) - (parseFloat(a.hourlyRate)||0)); break;
    }

    return filtered;
  }

  // ── Export: CSV ──────────────────────────────────────────────
  function exportCSV(clients) {
    const headers = ['Name','Company','Email','Phone','Status','Hourly Rate','Payment Terms','Tags','Total Revenue','Projects Count','Notes','Created'];
    const rows = clients.map(c => {
      const revenue = (c.projects||[]).reduce((s,p) => s+(parseFloat(p.amount)||0),0);
      return [
        c.name || '',
        c.company || '',
        c.email || '',
        c.phone || '',
        c.status || '',
        c.hourlyRate || '',
        c.paymentTerms || '',
        (c.tags||[]).join('; '),
        revenue.toFixed(2),
        (c.projects||[]).length,
        (c.notes||'').replace(/"/g,'""'),
        c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''
      ];
    });

    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    downloadFile(csv, 'cortex-clients-' + dateStamp() + '.csv', 'text/csv');
  }

  // ── Export: PDF (via print) ─────────────────────────────────
  function exportPDF(clients) {
    const win = window.open('', '_blank');
    const html = `<!DOCTYPE html><html><head><title>Client Directory Export</title>
    <style>
      body{font-family:Arial,sans-serif;padding:2rem;color:#333}
      h1{font-size:1.5rem;margin-bottom:.25rem}
      .subtitle{color:#666;margin-bottom:1.5rem;font-size:.9rem}
      table{width:100%;border-collapse:collapse;font-size:.8rem}
      th{background:#f5f5f5;text-align:left;padding:.5rem;border-bottom:2px solid #ddd;font-weight:700}
      td{padding:.5rem;border-bottom:1px solid #eee}
      .status{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600}
      .status-active{background:#e6ffe6;color:#006600}
      .status-prospect{background:#fff8e6;color:#996600}
      .status-inactive{background:#f0f0f0;color:#666}
      .status-archived{background:#f0e6ff;color:#660099}
      .total-row{font-weight:700;background:#f9f9f9}
      .footer{margin-top:2rem;font-size:.75rem;color:#999;text-align:center}
    </style></head><body>
    <h1>Client Directory</h1>
    <p class="subtitle">Exported ${new Date().toLocaleDateString()} · ${clients.length} client${clients.length!==1?'s':''}</p>
    <table>
      <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Status</th><th>Rate</th><th>Revenue</th><th>Projects</th></tr></thead>
      <tbody>${clients.map(c => {
        const rev = (c.projects||[]).reduce((s,p) => s+(parseFloat(p.amount)||0),0);
        return `<tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td>${esc(c.company||'—')}</td>
          <td>${esc(c.email||'—')}</td>
          <td><span class="status status-${c.status||'inactive'}">${(c.status||'inactive').toUpperCase()}</span></td>
          <td>${c.hourlyRate ? '$'+c.hourlyRate+'/hr' : '—'}</td>
          <td>$${rev.toLocaleString()}</td>
          <td>${(c.projects||[]).length}</td>
        </tr>`;
      }).join('')}
      <tr class="total-row">
        <td colspan="5">Total</td>
        <td>$${clients.reduce((s,c)=>s+(c.projects||[]).reduce((s2,p)=>s2+(parseFloat(p.amount)||0),0),0).toLocaleString()}</td>
        <td>${clients.reduce((s,c)=>s+(c.projects||[]).length,0)}</td>
      </tr></tbody>
    </table>
    <p class="footer">Generated by Cortex Freelancer · cortexfreelancer.com</p>
    </body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  }

  // ── Helpers ─────────────────────────────────────────────────
  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function dateStamp() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function formatCurrency(n) {
    return '$' + parseFloat(n||0).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0});
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff/60000);
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins/60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs/24);
    if (days < 30) return days + 'd ago';
    const months = Math.floor(days/30);
    return months + 'mo ago';
  }

  // ── Toast Notifications ─────────────────────────────────────
  function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast.active');
    if (existing) existing.classList.remove('active');

    const toast = document.getElementById('toast');
    toast.className = 'toast ' + type;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${esc(message)}`;
    requestAnimationFrame(() => toast.classList.add('active'));
    setTimeout(() => toast.classList.remove('active'), 3000);
  }

  // ── UI Controller ───────────────────────────────────────────
  const UI = {
    currentFilters: { query: '', status: '', projectType: '', sortBy: 'newest' },
    editingId: null,
    formProjects: [],

    init() {
      Store.load();
      this.bindEvents();
      this.render();

      // Seed demo data if empty
      if (Store.getAll().length === 0) {
        this.seedDemo();
        this.render();
      }
    },

    bindEvents() {
      // Search & filters
      document.getElementById('searchInput').addEventListener('input', e => {
        this.currentFilters.query = e.target.value;
        this.renderClients();
      });
      document.getElementById('filterStatus').addEventListener('change', e => {
        this.currentFilters.status = e.target.value;
        this.renderClients();
      });
      document.getElementById('filterType').addEventListener('change', e => {
        this.currentFilters.projectType = e.target.value;
        this.renderClients();
      });
      document.getElementById('sortBy').addEventListener('change', e => {
        this.currentFilters.sortBy = e.target.value;
        this.renderClients();
      });

      // Add client button
      document.getElementById('btnAddClient').addEventListener('click', () => this.openModal());

      // Modal events
      document.getElementById('modalOverlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) this.closeModal();
      });
      document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
      document.getElementById('btnCancelClient').addEventListener('click', () => this.closeModal());
      document.getElementById('btnSaveClient').addEventListener('click', () => this.saveClient());

      // Detail panel
      document.getElementById('detailOverlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) this.closeDetail();
      });
      document.getElementById('detailClose').addEventListener('click', () => this.closeDetail());

      // Export menu
      document.getElementById('btnExport').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('exportDropdown').classList.toggle('active');
      });
      document.getElementById('exportCSV').addEventListener('click', () => {
        const clients = filterClients(Store.getAll(), this.currentFilters);
        exportCSV(clients);
        document.getElementById('exportDropdown').classList.remove('active');
        showToast('CSV exported successfully');
      });
      document.getElementById('exportPDF').addEventListener('click', () => {
        const clients = filterClients(Store.getAll(), this.currentFilters);
        exportPDF(clients);
        document.getElementById('exportDropdown').classList.remove('active');
        showToast('PDF export opened');
      });

      // Close export on outside click
      document.addEventListener('click', () => {
        document.getElementById('exportDropdown').classList.remove('active');
      });

      // Add project in form
      document.getElementById('btnAddProject').addEventListener('click', () => this.addFormProject());

      // Keyboard shortcut
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          this.closeModal();
          this.closeDetail();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
          e.preventDefault();
          this.openModal();
        }
      });
    },

    render() {
      this.renderStats();
      this.renderClients();
    },

    renderStats() {
      const stats = Store.getStats();
      document.getElementById('statTotal').textContent = stats.total;
      document.getElementById('statActive').textContent = stats.active;
      document.getElementById('statProspects').textContent = stats.prospects;
      document.getElementById('statRevenue').textContent = formatCurrency(stats.totalRevenue);
      document.getElementById('statAvgRate').textContent = stats.avgRate ? '$' + Math.round(stats.avgRate) + '/hr' : '—';
    },

    renderClients() {
      const clients = filterClients(Store.getAll(), this.currentFilters);
      const grid = document.getElementById('clientsGrid');

      if (clients.length === 0) {
        const hasAny = Store.getAll().length > 0;
        grid.innerHTML = `<div class="empty-state">
          <div class="empty-icon">${hasAny ? '🔍' : '👥'}</div>
          <p>${hasAny ? 'No clients match your filters' : 'No clients yet — add your first one!'}</p>
          ${!hasAny ? '<button class="btn btn-orange" onclick="window._UI.openModal()">+ Add Client</button>' : ''}
        </div>`;
        return;
      }

      grid.innerHTML = clients.map(c => {
        const revenue = (c.projects||[]).reduce((s,p) => s+(parseFloat(p.amount)||0), 0);
        const projCount = (c.projects||[]).length;
        return `<div class="client-card" data-id="${c.id}" onclick="window._UI.openDetail('${c.id}')">
          <div class="client-card-header">
            <div>
              <div class="client-name">${esc(c.name)}</div>
              ${c.company ? `<div class="client-company">${esc(c.company)}</div>` : ''}
            </div>
            <span class="client-status status-${c.status||'inactive'}">${(c.status||'inactive').toUpperCase()}</span>
          </div>
          <div class="client-meta">
            ${c.email ? `<div class="client-meta-item"><span class="icon">✉</span>${esc(c.email)}</div>` : ''}
            ${c.phone ? `<div class="client-meta-item"><span class="icon">☎</span>${esc(c.phone)}</div>` : ''}
            ${c.hourlyRate ? `<div class="client-meta-item"><span class="icon">$</span>${esc(c.hourlyRate)}/hr · ${esc(c.paymentTerms||'Net 30')}</div>` : ''}
          </div>
          ${(c.tags||[]).length ? `<div class="client-tags">${c.tags.map(t => `<span class="client-tag">${esc(t)}</span>`).join('')}</div>` : ''}
          <div class="client-stats">
            <div class="client-stat"><span class="cs-val">${formatCurrency(revenue)}</span><span class="cs-label">Revenue</span></div>
            <div class="client-stat"><span class="cs-val">${projCount}</span><span class="cs-label">Projects</span></div>
            <div class="client-stat"><span class="cs-val">${timeAgo(c.updatedAt)}</span><span class="cs-label">Updated</span></div>
          </div>
          <div class="client-actions" onclick="event.stopPropagation()">
            <button class="btn btn-secondary btn-sm" onclick="window._UI.openModal('${c.id}')">✎ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="window._UI.deleteClient('${c.id}')">✕ Delete</button>
          </div>
        </div>`;
      }).join('');
    },

    openModal(editId) {
      this.editingId = editId || null;
      this.formProjects = [];
      const modal = document.getElementById('modalOverlay');
      const title = document.getElementById('modalTitle');

      if (editId) {
        const c = Store.getById(editId);
        if (!c) return;
        title.textContent = 'Edit Client';
        document.getElementById('fName').value = c.name || '';
        document.getElementById('fCompany').value = c.company || '';
        document.getElementById('fEmail').value = c.email || '';
        document.getElementById('fPhone').value = c.phone || '';
        document.getElementById('fStatus').value = c.status || 'prospect';
        document.getElementById('fRate').value = c.hourlyRate || '';
        document.getElementById('fPayTerms').value = c.paymentTerms || 'net30';
        document.getElementById('fTags').value = (c.tags||[]).join(', ');
        document.getElementById('fNotes').value = c.notes || '';
        document.getElementById('fWebsite').value = c.website || '';
        document.getElementById('fAddress').value = c.address || '';
        this.formProjects = [...(c.projects||[])];
      } else {
        title.textContent = 'Add New Client';
        document.getElementById('clientForm').reset();
        document.getElementById('fStatus').value = 'prospect';
        document.getElementById('fPayTerms').value = 'net30';
      }

      this.renderFormProjects();
      modal.classList.add('active');
      document.getElementById('fName').focus();
    },

    closeModal() {
      document.getElementById('modalOverlay').classList.remove('active');
      this.editingId = null;
      this.formProjects = [];
    },

    saveClient() {
      const name = document.getElementById('fName').value.trim();
      if (!name) {
        document.getElementById('fName').classList.add('error');
        setTimeout(() => document.getElementById('fName').classList.remove('error'), 500);
        return;
      }

      const data = {
        name,
        company: document.getElementById('fCompany').value.trim(),
        email: document.getElementById('fEmail').value.trim(),
        phone: document.getElementById('fPhone').value.trim(),
        status: document.getElementById('fStatus').value,
        hourlyRate: document.getElementById('fRate').value.trim(),
        paymentTerms: document.getElementById('fPayTerms').value,
        tags: document.getElementById('fTags').value.split(',').map(t => t.trim()).filter(Boolean),
        notes: document.getElementById('fNotes').value.trim(),
        website: document.getElementById('fWebsite').value.trim(),
        address: document.getElementById('fAddress').value.trim(),
        projects: this.formProjects
      };

      if (this.editingId) {
        Store.update(this.editingId, data);
        showToast('Client updated');
      } else {
        Store.create(data);
        showToast('Client added');
      }

      this.closeModal();
      this.render();
    },

    deleteClient(id) {
      const c = Store.getById(id);
      if (!c) return;
      if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
      Store.delete(id);
      this.closeDetail();
      this.render();
      showToast('Client deleted');
    },

    // ── Project Management in Form ────────────────────────────
    addFormProject() {
      const name = document.getElementById('fpName').value.trim();
      const amount = document.getElementById('fpAmount').value.trim();
      const type = document.getElementById('fpType').value;
      const status = document.getElementById('fpStatus').value;
      if (!name) return;

      this.formProjects.push({
        id: 'proj_' + Date.now(),
        name, amount: parseFloat(amount) || 0, type, status,
        date: new Date().toISOString()
      });

      document.getElementById('fpName').value = '';
      document.getElementById('fpAmount').value = '';
      this.renderFormProjects();
    },

    removeFormProject(projId) {
      this.formProjects = this.formProjects.filter(p => p.id !== projId);
      this.renderFormProjects();
    },

    renderFormProjects() {
      const container = document.getElementById('projectsList');
      if (!this.formProjects.length) {
        container.innerHTML = '<p style="color:var(--text3);font-size:.78rem">No projects added yet</p>';
        return;
      }
      container.innerHTML = this.formProjects.map(p => `
        <div class="project-row">
          <span class="pname">${esc(p.name)}</span>
          <span class="pamount">${formatCurrency(p.amount)}</span>
          <span class="pstatus pstatus-${p.status}">${p.status}</span>
          <button class="premove" onclick="window._UI.removeFormProject('${p.id}')" title="Remove">✕</button>
        </div>
      `).join('');
    },

    // ── Detail Panel ──────────────────────────────────────────
    openDetail(id) {
      const c = Store.getById(id);
      if (!c) return;

      const revenue = (c.projects||[]).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
      const panel = document.getElementById('detailOverlay');

      document.getElementById('detailName').textContent = c.name;
      document.getElementById('detailStatus').className = 'client-status status-' + (c.status||'inactive');
      document.getElementById('detailStatus').textContent = (c.status||'inactive').toUpperCase();

      const body = document.getElementById('detailBody');
      body.innerHTML = `
        <div class="detail-section">
          <h3>Contact Information</h3>
          <div class="detail-row"><span class="dr-label">Email</span><span class="dr-value">${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</span></div>
          <div class="detail-row"><span class="dr-label">Phone</span><span class="dr-value">${esc(c.phone||'—')}</span></div>
          <div class="detail-row"><span class="dr-label">Company</span><span class="dr-value">${esc(c.company||'—')}</span></div>
          <div class="detail-row"><span class="dr-label">Website</span><span class="dr-value">${c.website ? `<a href="${esc(c.website)}" target="_blank">${esc(c.website)}</a>` : '—'}</span></div>
          <div class="detail-row"><span class="dr-label">Address</span><span class="dr-value">${esc(c.address||'—')}</span></div>
        </div>
        <div class="detail-section">
          <h3>Billing</h3>
          <div class="detail-row"><span class="dr-label">Hourly Rate</span><span class="dr-value">${c.hourlyRate ? '$'+c.hourlyRate+'/hr' : '—'}</span></div>
          <div class="detail-row"><span class="dr-label">Payment Terms</span><span class="dr-value">${formatPaymentTerms(c.paymentTerms)}</span></div>
          <div class="detail-row"><span class="dr-label">Total Revenue</span><span class="dr-value" style="color:var(--green);font-weight:800">${formatCurrency(revenue)}</span></div>
        </div>
        ${(c.tags||[]).length ? `<div class="detail-section">
          <h3>Tags</h3>
          <div class="client-tags">${c.tags.map(t=>`<span class="client-tag">${esc(t)}</span>`).join('')}</div>
        </div>` : ''}
        <div class="detail-section">
          <h3>Projects (${(c.projects||[]).length})</h3>
          ${(c.projects||[]).length ? (c.projects||[]).map(p => `
            <div class="project-row">
              <span class="pname">${esc(p.name)}</span>
              <span class="pamount">${formatCurrency(p.amount)}</span>
              <span class="pstatus pstatus-${p.status}">${p.status}</span>
            </div>
          `).join('') : '<p style="color:var(--text3);font-size:.8rem">No projects recorded</p>'}
        </div>
        ${c.notes ? `<div class="detail-section">
          <h3>Notes</h3>
          <p style="font-size:.85rem;color:var(--text2);line-height:1.6">${esc(c.notes)}</p>
        </div>` : ''}
        <div class="detail-section">
          <h3>Timeline</h3>
          <div class="detail-row"><span class="dr-label">Added</span><span class="dr-value">${new Date(c.createdAt).toLocaleDateString()}</span></div>
          <div class="detail-row"><span class="dr-label">Last Updated</span><span class="dr-value">${new Date(c.updatedAt).toLocaleDateString()} (${timeAgo(c.updatedAt)})</span></div>
        </div>
      `;

      // Action buttons
      document.getElementById('detailActions').innerHTML = `
        <button class="btn btn-orange" onclick="window._UI.openModal('${c.id}');window._UI.closeDetail()">✎ Edit Client</button>
        <button class="btn btn-danger" onclick="window._UI.deleteClient('${c.id}')">✕ Delete</button>
      `;

      panel.classList.add('active');
    },

    closeDetail() {
      document.getElementById('detailOverlay').classList.remove('active');
    },

    // ── Demo Data ─────────────────────────────────────────────
    seedDemo() {
      const demos = [
        {
          name: 'Sarah Chen', company: 'TechVista Inc.', email: 'sarah@techvista.io', phone: '+1 415-555-0123',
          status: 'active', hourlyRate: '150', paymentTerms: 'net30',
          tags: ['SaaS', 'React', 'Long-term'], website: 'https://techvista.io',
          notes: 'Great communicator. Prefers Slack. Q1 redesign went well.',
          projects: [
            { id: 'p1', name: 'Dashboard Redesign', amount: 12000, type: 'Web Development', status: 'completed', date: '2025-11-01' },
            { id: 'p2', name: 'Mobile App MVP', amount: 28000, type: 'Mobile Development', status: 'active', date: '2026-01-15' }
          ]
        },
        {
          name: 'Marcus Johnson', company: 'GreenLeaf Co.', email: 'marcus@greenleaf.co', phone: '+1 212-555-0456',
          status: 'active', hourlyRate: '125', paymentTerms: 'net15',
          tags: ['E-commerce', 'Shopify', 'Recurring'],
          notes: 'Monthly retainer for site maintenance. Always pays on time.',
          projects: [
            { id: 'p3', name: 'Shopify Migration', amount: 8500, type: 'E-commerce', status: 'completed', date: '2025-09-01' },
            { id: 'p4', name: 'Monthly Retainer', amount: 2000, type: 'Maintenance', status: 'active', date: '2026-01-01' }
          ]
        },
        {
          name: 'Amira Patel', company: '', email: 'amira.patel@gmail.com', phone: '',
          status: 'prospect', hourlyRate: '135', paymentTerms: 'net30',
          tags: ['Startup', 'MVP', 'AI/ML'],
          notes: 'Met at TechCrunch Disrupt. Interested in AI dashboard project. Follow up in April.',
          projects: []
        },
        {
          name: 'David Kim', company: 'NovaBrand Agency', email: 'dkim@novabrand.com', phone: '+44 20 7946 0958',
          status: 'inactive', hourlyRate: '110', paymentTerms: 'net45',
          tags: ['Agency', 'WordPress', 'Design'],
          notes: 'Completed 3 projects in 2025. May re-engage Q3.',
          projects: [
            { id: 'p5', name: 'Brand Website', amount: 15000, type: 'Web Development', status: 'completed', date: '2025-06-01' },
            { id: 'p6', name: 'Landing Pages x5', amount: 5000, type: 'Design', status: 'completed', date: '2025-10-01' },
            { id: 'p7', name: 'Email Templates', amount: 3200, type: 'Design', status: 'completed', date: '2025-12-01' }
          ]
        }
      ];

      demos.forEach(d => Store.create(d));
    }
  };

  function formatPaymentTerms(terms) {
    const map = { 'net15': 'Net 15', 'net30': 'Net 30', 'net45': 'Net 45', 'net60': 'Net 60', 'immediate': 'Due on Receipt', 'milestone': 'Milestone-based', 'custom': 'Custom' };
    return map[terms] || terms || 'Net 30';
  }

  // Expose for inline onclick handlers
  window._UI = UI;

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UI.init());
  } else {
    UI.init();
  }
})();
