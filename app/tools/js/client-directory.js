/**
 * Client Directory - Cortex Freelancer [cf3-009]
 * Enhanced client management with ratings, timezone, linked invoices/proposals,
 * import from existing data, and quick-add API.
 * Compatible with cortex_client_directory localStorage format.
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'cortex_client_directory';
  var INVOICES_KEY = 'cortex_invoices';
  var PROPOSALS_KEY = 'cortex_proposals';
  var VERSION = '2.0.0';

  // ── Data Layer ──────────────────────────────────────────────
  var Store = {
    _data: { clients: [], version: VERSION },

    load: function() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          this._data = { clients: parsed.clients || [], version: VERSION };
        }
      } catch(e) { console.warn('[client-dir] Store load error:', e); }
      return this._data.clients;
    },

    save: function() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
      } catch(e) { console.error('[client-dir] Store save error:', e); }
    },

    getAll: function() { return this._data.clients.slice(); },

    getById: function(id) {
      for (var i = 0; i < this._data.clients.length; i++) {
        if (this._data.clients[i].id === id) return this._data.clients[i];
      }
      return null;
    },

    create: function(client) {
      var now = new Date().toISOString();
      var record = {
        id: 'cli_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        createdAt: now,
        updatedAt: now,
        name: client.name || '',
        company: client.company || '',
        email: client.email || '',
        phone: client.phone || '',
        status: client.status || 'prospect',
        hourlyRate: client.hourlyRate || '',
        paymentTerms: client.paymentTerms || 'net30',
        tags: client.tags || [],
        notes: client.notes || '',
        website: client.website || '',
        address: client.address || '',
        timezone: client.timezone || '',
        rating: parseInt(client.rating) || 0,
        projects: client.projects || []
      };
      this._data.clients.unshift(record);
      this.save();
      return record;
    },

    update: function(id, updates) {
      for (var i = 0; i < this._data.clients.length; i++) {
        if (this._data.clients[i].id === id) {
          var existing = this._data.clients[i];
          for (var key in updates) {
            if (updates.hasOwnProperty(key) && key !== 'id') {
              existing[key] = updates[key];
            }
          }
          existing.updatedAt = new Date().toISOString();
          this.save();
          return existing;
        }
      }
      return null;
    },

    delete: function(id) {
      for (var i = 0; i < this._data.clients.length; i++) {
        if (this._data.clients[i].id === id) {
          this._data.clients.splice(i, 1);
          this.save();
          return true;
        }
      }
      return false;
    },

    findByName: function(name) {
      var lower = (name || '').toLowerCase().trim();
      if (!lower) return null;
      for (var i = 0; i < this._data.clients.length; i++) {
        if ((this._data.clients[i].name || '').toLowerCase().trim() === lower) {
          return this._data.clients[i];
        }
      }
      return null;
    },

    getStats: function() {
      var clients = this._data.clients;
      var active = 0, prospects = 0, totalRevenue = 0, rateSum = 0, rateCount = 0;
      for (var i = 0; i < clients.length; i++) {
        var c = clients[i];
        if (c.status === 'active') active++;
        if (c.status === 'prospect') prospects++;
        var projects = c.projects || [];
        for (var j = 0; j < projects.length; j++) {
          totalRevenue += parseFloat(projects[j].amount) || 0;
        }
        if (c.hourlyRate) { rateSum += parseFloat(c.hourlyRate); rateCount++; }
      }
      return {
        total: clients.length,
        active: active,
        prospects: prospects,
        totalRevenue: totalRevenue,
        avgRate: rateCount > 0 ? rateSum / rateCount : 0
      };
    }
  };

  // ── Linked Data (Invoices & Proposals) ────────────────────
  var LinkedData = {
    getInvoices: function() {
      try { return JSON.parse(localStorage.getItem(INVOICES_KEY) || '[]'); }
      catch(e) { return []; }
    },

    getProposals: function() {
      try { return JSON.parse(localStorage.getItem(PROPOSALS_KEY) || '[]'); }
      catch(e) { return []; }
    },

    getForClient: function(clientName) {
      var name = (clientName || '').toLowerCase().trim();
      if (!name) return { invoices: [], proposals: [] };

      var invoices = this.getInvoices().filter(function(inv) {
        return (inv.clientName || inv.toName || '').toLowerCase().trim() === name;
      });

      var proposals = this.getProposals().filter(function(p) {
        return (p.clientName || p.jobTitle || '').toLowerCase().trim().indexOf(name) !== -1;
      });

      return { invoices: invoices, proposals: proposals };
    },

    getUniqueClientNames: function() {
      var names = {};
      var existingClients = Store.getAll();
      var existingNames = {};
      for (var i = 0; i < existingClients.length; i++) {
        existingNames[(existingClients[i].name || '').toLowerCase().trim()] = true;
      }

      var invoices = this.getInvoices();
      for (var j = 0; j < invoices.length; j++) {
        var iName = (invoices[j].clientName || invoices[j].toName || '').trim();
        if (iName && !existingNames[iName.toLowerCase()]) {
          if (!names[iName.toLowerCase()]) {
            names[iName.toLowerCase()] = {
              name: iName,
              email: invoices[j].clientEmail || invoices[j].toEmail || '',
              source: 'invoice',
              count: 0
            };
          }
          names[iName.toLowerCase()].count++;
        }
      }

      var proposals = this.getProposals();
      for (var k = 0; k < proposals.length; k++) {
        var pName = (proposals[k].clientName || '').trim();
        if (pName && !existingNames[pName.toLowerCase()]) {
          if (!names[pName.toLowerCase()]) {
            names[pName.toLowerCase()] = { name: pName, email: '', source: 'proposal', count: 0 };
          } else if (names[pName.toLowerCase()].source === 'invoice') {
            names[pName.toLowerCase()].source = 'both';
          }
          names[pName.toLowerCase()].count++;
        }
      }

      var result = [];
      for (var key in names) {
        if (names.hasOwnProperty(key)) result.push(names[key]);
      }
      result.sort(function(a, b) { return b.count - a.count; });
      return result;
    }
  };

  // ── Search & Filter ─────────────────────────────────────────
  function filterClients(clients, filters) {
    var query = filters.query || '';
    var status = filters.status || '';
    var projectType = filters.projectType || '';
    var sortBy = filters.sortBy || 'newest';
    var filtered = clients.slice();

    if (query) {
      var q = query.toLowerCase();
      filtered = filtered.filter(function(c) {
        return (c.name || '').toLowerCase().indexOf(q) !== -1 ||
          (c.company || '').toLowerCase().indexOf(q) !== -1 ||
          (c.email || '').toLowerCase().indexOf(q) !== -1 ||
          (c.notes || '').toLowerCase().indexOf(q) !== -1 ||
          (c.tags || []).some(function(t) { return t.toLowerCase().indexOf(q) !== -1; });
      });
    }

    if (status) {
      filtered = filtered.filter(function(c) { return c.status === status; });
    }

    if (projectType) {
      filtered = filtered.filter(function(c) {
        return (c.tags || []).some(function(t) { return t.toLowerCase() === projectType.toLowerCase(); }) ||
          (c.projects || []).some(function(p) { return (p.type || '').toLowerCase() === projectType.toLowerCase(); });
      });
    }

    switch (sortBy) {
      case 'newest':
        filtered.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        break;
      case 'oldest':
        filtered.sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
        break;
      case 'name':
        filtered.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
        break;
      case 'revenue':
        filtered.sort(function(a, b) {
          var ra = (a.projects || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
          var rb = (b.projects || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
          return rb - ra;
        });
        break;
      case 'rate':
        filtered.sort(function(a, b) { return (parseFloat(b.hourlyRate) || 0) - (parseFloat(a.hourlyRate) || 0); });
        break;
      case 'rating':
        filtered.sort(function(a, b) { return (parseInt(b.rating) || 0) - (parseInt(a.rating) || 0); });
        break;
    }

    return filtered;
  }

  // ── Export: CSV ────────────────────────────────────────────
  function exportCSV(clients) {
    var headers = ['Name', 'Company', 'Email', 'Phone', 'Status', 'Rating', 'Hourly Rate', 'Payment Terms', 'Timezone', 'Tags', 'Total Revenue', 'Projects Count', 'Notes', 'Created'];
    var rows = clients.map(function(c) {
      var revenue = (c.projects || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
      return [
        c.name || '', c.company || '', c.email || '', c.phone || '',
        c.status || '', c.rating || '', c.hourlyRate || '',
        formatPaymentTerms(c.paymentTerms), c.timezone || '',
        (c.tags || []).join('; '), revenue.toFixed(2),
        (c.projects || []).length,
        (c.notes || '').replace(/"/g, '""'),
        c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''
      ];
    });

    var csv = [headers].concat(rows).map(function(r) {
      return r.map(function(v) { return '"' + v + '"'; }).join(',');
    }).join('\n');
    downloadFile(csv, 'cortex-clients-' + dateStamp() + '.csv', 'text/csv');
  }

  // ── Export: PDF ────────────────────────────────────────────
  function exportPDF(clients) {
    var win = window.open('', '_blank');
    if (!win) return;
    var tbody = clients.map(function(c) {
      var rev = (c.projects || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
      var stars = '';
      for (var i = 1; i <= 5; i++) stars += i <= (c.rating || 0) ? '\u2605' : '\u2606';
      return '<tr>' +
        '<td><strong>' + esc(c.name) + '</strong></td>' +
        '<td>' + esc(c.company || '\u2014') + '</td>' +
        '<td>' + esc(c.email || '\u2014') + '</td>' +
        '<td><span class="status status-' + (c.status || 'inactive') + '">' + (c.status || 'inactive').toUpperCase() + '</span></td>' +
        '<td style="color:#c90">' + stars + '</td>' +
        '<td>' + (c.hourlyRate ? '$' + c.hourlyRate + '/hr' : '\u2014') + '</td>' +
        '<td>$' + rev.toLocaleString() + '</td>' +
        '<td>' + (c.projects || []).length + '</td>' +
        '</tr>';
    }).join('');

    var totalRev = clients.reduce(function(s, c) {
      return s + (c.projects || []).reduce(function(s2, p) { return s2 + (parseFloat(p.amount) || 0); }, 0);
    }, 0);
    var totalProj = clients.reduce(function(s, c) { return s + (c.projects || []).length; }, 0);

    var html = '<!DOCTYPE html><html><head><title>Client Directory Export</title>' +
      '<style>body{font-family:Arial,sans-serif;padding:2rem;color:#333}' +
      'h1{font-size:1.5rem;margin-bottom:.25rem}.subtitle{color:#666;margin-bottom:1.5rem;font-size:.9rem}' +
      'table{width:100%;border-collapse:collapse;font-size:.8rem}' +
      'th{background:#f5f5f5;text-align:left;padding:.5rem;border-bottom:2px solid #ddd;font-weight:700}' +
      'td{padding:.5rem;border-bottom:1px solid #eee}' +
      '.status{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600}' +
      '.status-active{background:#e6ffe6;color:#006600}.status-prospect{background:#fff8e6;color:#996600}' +
      '.status-inactive{background:#f0f0f0;color:#666}.status-archived{background:#f0e6ff;color:#660099}' +
      '.total-row{font-weight:700;background:#f9f9f9}' +
      '.footer{margin-top:2rem;font-size:.75rem;color:#999;text-align:center}</style></head><body>' +
      '<h1>Client Directory</h1>' +
      '<p class="subtitle">Exported ' + new Date().toLocaleDateString() + ' \u00b7 ' + clients.length + ' client' + (clients.length !== 1 ? 's' : '') + '</p>' +
      '<table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Status</th><th>Rating</th><th>Rate</th><th>Revenue</th><th>Projects</th></tr></thead>' +
      '<tbody>' + tbody +
      '<tr class="total-row"><td colspan="6">Total</td><td>$' + totalRev.toLocaleString() + '</td><td>' + totalProj + '</td></tr>' +
      '</tbody></table>' +
      '<p class="footer">Generated by Cortex Freelancer</p></body></html>';
    win.document.write(html);
    win.document.close();
    setTimeout(function() { win.print(); }, 500);
  }

  // ── Helpers ───────────────────────────────────────────────
  function downloadFile(content, filename, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function dateStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function formatCurrency(n) {
    return '$' + parseFloat(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '\u2014';
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return Math.floor(days / 30) + 'mo ago';
  }

  function formatPaymentTerms(terms) {
    var map = { net15: 'Net 15', net30: 'Net 30', net45: 'Net 45', net60: 'Net 60', immediate: 'Due on Receipt', milestone: 'Milestone-based', custom: 'Custom' };
    return map[terms] || terms || 'Net 30';
  }

  function renderStars(rating, size) {
    var cls = size === 'card' ? 'star-rating-card' : 'star-rating-display';
    var html = '<span class="' + cls + '">';
    for (var i = 1; i <= 5; i++) {
      html += '<span class="star' + (i <= (rating || 0) ? ' filled' : '') + '">\u2605</span>';
    }
    return html + '</span>';
  }

  // ── Toast ──────────────────────────────────────────────────
  function showToast(message, type) {
    type = type || 'success';
    var toast = document.getElementById('toast');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<span>' + (type === 'success' ? '\u2713' : '\u2717') + '</span> ' + esc(message);
    requestAnimationFrame(function() { toast.classList.add('active'); });
    setTimeout(function() { toast.classList.remove('active'); }, 3000);
  }

  // ── UI Controller ─────────────────────────────────────────
  var UI = {
    currentFilters: { query: '', status: '', projectType: '', sortBy: 'newest' },
    editingId: null,
    formProjects: [],

    init: function() {
      Store.load();
      this.bindEvents();
      this.checkQuickAdd();
      this.render();

      if (Store.getAll().length === 0) {
        this.seedDemo();
        this.render();
      }
    },

    bindEvents: function() {
      var self = this;

      // Search & filters
      document.getElementById('searchInput').addEventListener('input', function(e) {
        self.currentFilters.query = e.target.value;
        self.renderClients();
      });
      document.getElementById('filterStatus').addEventListener('change', function(e) {
        self.currentFilters.status = e.target.value;
        self.renderClients();
      });
      document.getElementById('filterType').addEventListener('change', function(e) {
        self.currentFilters.projectType = e.target.value;
        self.renderClients();
      });
      document.getElementById('sortBy').addEventListener('change', function(e) {
        self.currentFilters.sortBy = e.target.value;
        self.renderClients();
      });

      // Add client
      document.getElementById('btnAddClient').addEventListener('click', function() { self.openModal(); });

      // Import
      document.getElementById('btnImport').addEventListener('click', function() { self.openImport(); });
      document.getElementById('importClose').addEventListener('click', function() { self.closeImport(); });
      document.getElementById('importCancel').addEventListener('click', function() { self.closeImport(); });
      document.getElementById('importConfirm').addEventListener('click', function() { self.confirmImport(); });
      document.getElementById('importOverlay').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) self.closeImport();
      });

      // Modal
      document.getElementById('modalOverlay').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) self.closeModal();
      });
      document.getElementById('modalClose').addEventListener('click', function() { self.closeModal(); });
      document.getElementById('btnCancelClient').addEventListener('click', function() { self.closeModal(); });
      document.getElementById('btnSaveClient').addEventListener('click', function() { self.saveClient(); });

      // Detail panel
      document.getElementById('detailOverlay').addEventListener('click', function(e) {
        if (e.target === e.currentTarget) self.closeDetail();
      });
      document.getElementById('detailClose').addEventListener('click', function() { self.closeDetail(); });

      // Export menu
      document.getElementById('btnExport').addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('exportDropdown').classList.toggle('active');
      });
      document.getElementById('exportCSV').addEventListener('click', function() {
        exportCSV(filterClients(Store.getAll(), self.currentFilters));
        document.getElementById('exportDropdown').classList.remove('active');
        showToast('CSV exported successfully');
      });
      document.getElementById('exportPDF').addEventListener('click', function() {
        exportPDF(filterClients(Store.getAll(), self.currentFilters));
        document.getElementById('exportDropdown').classList.remove('active');
        showToast('PDF export opened');
      });
      document.addEventListener('click', function() {
        document.getElementById('exportDropdown').classList.remove('active');
      });

      // Add project in form
      document.getElementById('btnAddProject').addEventListener('click', function() { self.addFormProject(); });

      // Star rating in form
      var ratingEl = document.getElementById('fRating');
      ratingEl.addEventListener('click', function(e) {
        var star = e.target.closest('.star');
        if (!star) return;
        var val = parseInt(star.getAttribute('data-val'));
        var current = parseInt(ratingEl.getAttribute('data-value')) || 0;
        // Click same star to clear
        if (val === current) val = 0;
        ratingEl.setAttribute('data-value', val);
        self.updateFormStars(val);
      });

      // Quick-add banner
      document.getElementById('qabConfirm').addEventListener('click', function() { self.confirmQuickAdd(); });
      document.getElementById('qabDismiss').addEventListener('click', function() { self.dismissQuickAdd(); });

      // Keyboard shortcuts
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          self.closeModal();
          self.closeDetail();
          self.closeImport();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
          e.preventDefault();
          self.openModal();
        }
      });
    },

    updateFormStars: function(val) {
      var stars = document.getElementById('fRating').querySelectorAll('.star');
      for (var i = 0; i < stars.length; i++) {
        if (i < val) stars[i].classList.add('filled');
        else stars[i].classList.remove('filled');
      }
    },

    render: function() {
      this.renderStats();
      this.renderClients();
    },

    renderStats: function() {
      var stats = Store.getStats();
      document.getElementById('statTotal').textContent = stats.total;
      document.getElementById('statActive').textContent = stats.active;
      document.getElementById('statProspects').textContent = stats.prospects;
      document.getElementById('statRevenue').textContent = formatCurrency(stats.totalRevenue);
      document.getElementById('statAvgRate').textContent = stats.avgRate ? '$' + Math.round(stats.avgRate) + '/hr' : '\u2014';
    },

    renderClients: function() {
      var clients = filterClients(Store.getAll(), this.currentFilters);
      var grid = document.getElementById('clientsGrid');

      if (clients.length === 0) {
        var hasAny = Store.getAll().length > 0;
        grid.innerHTML = '<div class="empty-state">' +
          '<div class="empty-icon">' + (hasAny ? '\uD83D\uDD0D' : '\uD83D\uDC65') + '</div>' +
          '<p>' + (hasAny ? 'No clients match your filters' : 'No clients yet \u2014 add your first one!') + '</p>' +
          (!hasAny ? '<button class="btn btn-orange" onclick="window._UI.openModal()">+ Add Client</button>' : '') +
          '</div>';
        return;
      }

      grid.innerHTML = clients.map(function(c) {
        var revenue = (c.projects || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
        var projCount = (c.projects || []).length;
        return '<div class="client-card" data-id="' + c.id + '" onclick="window._UI.openDetail(\'' + c.id + '\')">' +
          '<div class="client-card-header">' +
            '<div>' +
              '<div class="client-name">' + esc(c.name) + (c.rating ? renderStars(c.rating, 'card') : '') + '</div>' +
              (c.company ? '<div class="client-company">' + esc(c.company) + '</div>' : '') +
            '</div>' +
            '<span class="client-status status-' + (c.status || 'inactive') + '">' + (c.status || 'inactive').toUpperCase() + '</span>' +
          '</div>' +
          '<div class="client-meta">' +
            (c.email ? '<div class="client-meta-item"><span class="icon">\u2709</span>' + esc(c.email) + '</div>' : '') +
            (c.phone ? '<div class="client-meta-item"><span class="icon">\u260E</span>' + esc(c.phone) + '</div>' : '') +
            (c.hourlyRate ? '<div class="client-meta-item"><span class="icon">$</span>' + esc(c.hourlyRate) + '/hr \u00b7 ' + esc(formatPaymentTerms(c.paymentTerms)) + '</div>' : '') +
            (c.timezone ? '<div class="client-meta-item"><span class="tz-badge">\uD83C\uDF10 ' + esc(c.timezone) + '</span></div>' : '') +
          '</div>' +
          ((c.tags || []).length ? '<div class="client-tags">' + c.tags.map(function(t) { return '<span class="client-tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="client-stats">' +
            '<div class="client-stat"><span class="cs-val">' + formatCurrency(revenue) + '</span><span class="cs-label">Revenue</span></div>' +
            '<div class="client-stat"><span class="cs-val">' + projCount + '</span><span class="cs-label">Projects</span></div>' +
            '<div class="client-stat"><span class="cs-val">' + timeAgo(c.updatedAt) + '</span><span class="cs-label">Updated</span></div>' +
          '</div>' +
          '<div class="client-actions" onclick="event.stopPropagation()">' +
            '<button class="btn btn-secondary btn-sm" onclick="window._UI.openModal(\'' + c.id + '\')">\u270E Edit</button>' +
            '<button class="btn btn-danger btn-sm" onclick="window._UI.deleteClient(\'' + c.id + '\')">\u2715 Delete</button>' +
          '</div>' +
        '</div>';
      }).join('');
    },

    // ── Modal ────────────────────────────────────────────────
    openModal: function(editId) {
      this.editingId = editId || null;
      this.formProjects = [];
      var title = document.getElementById('modalTitle');

      if (editId) {
        var c = Store.getById(editId);
        if (!c) return;
        title.textContent = 'Edit Client';
        document.getElementById('fName').value = c.name || '';
        document.getElementById('fCompany').value = c.company || '';
        document.getElementById('fEmail').value = c.email || '';
        document.getElementById('fPhone').value = c.phone || '';
        document.getElementById('fStatus').value = c.status || 'prospect';
        document.getElementById('fRate').value = c.hourlyRate || '';
        document.getElementById('fPayTerms').value = c.paymentTerms || 'net30';
        document.getElementById('fTimezone').value = c.timezone || '';
        document.getElementById('fTags').value = (c.tags || []).join(', ');
        document.getElementById('fNotes').value = c.notes || '';
        document.getElementById('fWebsite').value = c.website || '';
        document.getElementById('fAddress').value = c.address || '';
        document.getElementById('fRating').setAttribute('data-value', c.rating || 0);
        this.updateFormStars(c.rating || 0);
        this.formProjects = (c.projects || []).slice();
      } else {
        title.textContent = 'Add New Client';
        document.getElementById('clientForm').reset();
        document.getElementById('fStatus').value = 'prospect';
        document.getElementById('fPayTerms').value = 'net30';
        document.getElementById('fRating').setAttribute('data-value', '0');
        this.updateFormStars(0);
      }

      this.renderFormProjects();
      document.getElementById('modalOverlay').classList.add('active');
      document.getElementById('fName').focus();
    },

    closeModal: function() {
      document.getElementById('modalOverlay').classList.remove('active');
      this.editingId = null;
      this.formProjects = [];
    },

    saveClient: function() {
      var name = document.getElementById('fName').value.trim();
      if (!name) {
        document.getElementById('fName').classList.add('error');
        setTimeout(function() { document.getElementById('fName').classList.remove('error'); }, 500);
        return;
      }

      var data = {
        name: name,
        company: document.getElementById('fCompany').value.trim(),
        email: document.getElementById('fEmail').value.trim(),
        phone: document.getElementById('fPhone').value.trim(),
        status: document.getElementById('fStatus').value,
        hourlyRate: document.getElementById('fRate').value.trim(),
        paymentTerms: document.getElementById('fPayTerms').value,
        timezone: document.getElementById('fTimezone').value,
        rating: parseInt(document.getElementById('fRating').getAttribute('data-value')) || 0,
        tags: document.getElementById('fTags').value.split(',').map(function(t) { return t.trim(); }).filter(Boolean),
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

    deleteClient: function(id) {
      var c = Store.getById(id);
      if (!c) return;
      if (!confirm('Delete "' + c.name + '"? This cannot be undone.')) return;
      Store.delete(id);
      this.closeDetail();
      this.render();
      showToast('Client deleted');
    },

    // ── Projects in Form ──────────────────────────────────────
    addFormProject: function() {
      var name = document.getElementById('fpName').value.trim();
      var amount = document.getElementById('fpAmount').value.trim();
      var type = document.getElementById('fpType').value;
      var status = document.getElementById('fpStatus').value;
      if (!name) return;

      this.formProjects.push({
        id: 'proj_' + Date.now(),
        name: name,
        amount: parseFloat(amount) || 0,
        type: type,
        status: status,
        date: new Date().toISOString()
      });

      document.getElementById('fpName').value = '';
      document.getElementById('fpAmount').value = '';
      this.renderFormProjects();
    },

    removeFormProject: function(projId) {
      this.formProjects = this.formProjects.filter(function(p) { return p.id !== projId; });
      this.renderFormProjects();
    },

    renderFormProjects: function() {
      var container = document.getElementById('projectsList');
      if (!this.formProjects.length) {
        container.innerHTML = '<p style="color:var(--text3);font-size:.78rem">No projects added yet</p>';
        return;
      }
      container.innerHTML = this.formProjects.map(function(p) {
        return '<div class="project-row">' +
          '<span class="pname">' + esc(p.name) + '</span>' +
          '<span class="pamount">' + formatCurrency(p.amount) + '</span>' +
          '<span class="pstatus pstatus-' + p.status + '">' + p.status + '</span>' +
          '<button class="premove" onclick="window._UI.removeFormProject(\'' + p.id + '\')" title="Remove">\u2715</button>' +
          '</div>';
      }).join('');
    },

    // ── Detail Panel ──────────────────────────────────────────
    openDetail: function(id) {
      var c = Store.getById(id);
      if (!c) return;

      var revenue = (c.projects || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
      var linked = LinkedData.getForClient(c.name);

      document.getElementById('detailName').textContent = c.name;
      document.getElementById('detailStatus').className = 'client-status status-' + (c.status || 'inactive');
      document.getElementById('detailStatus').textContent = (c.status || 'inactive').toUpperCase();

      var body = document.getElementById('detailBody');
      var html = '';

      // Rating
      if (c.rating) {
        html += '<div class="detail-section">' +
          '<h3>Rating</h3>' +
          '<div>' + renderStars(c.rating) + ' <span style="color:var(--text2);font-size:.85rem;margin-left:.5rem">' + c.rating + '/5</span></div>' +
          '</div>';
      }

      // Contact
      html += '<div class="detail-section">' +
        '<h3>Contact Information</h3>' +
        '<div class="detail-row"><span class="dr-label">Email</span><span class="dr-value">' + (c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '\u2014') + '</span></div>' +
        '<div class="detail-row"><span class="dr-label">Phone</span><span class="dr-value">' + esc(c.phone || '\u2014') + '</span></div>' +
        '<div class="detail-row"><span class="dr-label">Company</span><span class="dr-value">' + esc(c.company || '\u2014') + '</span></div>' +
        '<div class="detail-row"><span class="dr-label">Website</span><span class="dr-value">' + (c.website ? '<a href="' + esc(c.website) + '" target="_blank">' + esc(c.website) + '</a>' : '\u2014') + '</span></div>' +
        '<div class="detail-row"><span class="dr-label">Address</span><span class="dr-value">' + esc(c.address || '\u2014') + '</span></div>' +
        (c.timezone ? '<div class="detail-row"><span class="dr-label">Timezone</span><span class="dr-value"><span class="tz-badge">\uD83C\uDF10 ' + esc(c.timezone) + '</span></span></div>' : '') +
        '</div>';

      // Billing
      html += '<div class="detail-section">' +
        '<h3>Billing</h3>' +
        '<div class="detail-row"><span class="dr-label">Hourly Rate</span><span class="dr-value">' + (c.hourlyRate ? '$' + c.hourlyRate + '/hr' : '\u2014') + '</span></div>' +
        '<div class="detail-row"><span class="dr-label">Payment Terms</span><span class="dr-value">' + formatPaymentTerms(c.paymentTerms) + '</span></div>' +
        '<div class="detail-row"><span class="dr-label">Total Revenue</span><span class="dr-value" style="color:var(--green);font-weight:800">' + formatCurrency(revenue) + '</span></div>' +
        '</div>';

      // Tags
      if ((c.tags || []).length) {
        html += '<div class="detail-section"><h3>Tags</h3>' +
          '<div class="client-tags">' + c.tags.map(function(t) { return '<span class="client-tag">' + esc(t) + '</span>'; }).join('') + '</div></div>';
      }

      // Projects
      html += '<div class="detail-section"><h3>Projects (' + (c.projects || []).length + ')</h3>';
      if ((c.projects || []).length) {
        html += (c.projects || []).map(function(p) {
          return '<div class="project-row">' +
            '<span class="pname">' + esc(p.name) + '</span>' +
            '<span class="pamount">' + formatCurrency(p.amount) + '</span>' +
            '<span class="pstatus pstatus-' + p.status + '">' + p.status + '</span>' +
            '</div>';
        }).join('');
      } else {
        html += '<p style="color:var(--text3);font-size:.8rem">No projects recorded</p>';
      }
      html += '</div>';

      // Linked Invoices
      if (linked.invoices.length) {
        html += '<div class="detail-section"><h3>Linked Invoices (' + linked.invoices.length + ')</h3><div class="linked-items">';
        html += linked.invoices.map(function(inv) {
          var num = inv.invoiceNumber || inv.number || '\u2014';
          var total = inv.total || inv.amount || 0;
          var date = inv.issueDate || inv.date || '';
          return '<div class="linked-item">' +
            '<span class="li-type li-type-invoice">INV</span>' +
            '<span class="li-name">#' + esc(String(num)) + '</span>' +
            '<span class="li-date">' + (date ? new Date(date).toLocaleDateString() : '') + '</span>' +
            '<span class="li-amount">' + formatCurrency(total) + '</span>' +
            '<a class="li-link" href="/app/tools/invoice" title="Open Invoice tool">\u2192</a>' +
            '</div>';
        }).join('');
        html += '</div></div>';
      }

      // Linked Proposals
      if (linked.proposals.length) {
        html += '<div class="detail-section"><h3>Linked Proposals (' + linked.proposals.length + ')</h3><div class="linked-items">';
        html += linked.proposals.map(function(p) {
          var title = p.jobTitle || p.title || 'Untitled';
          var date = p.createdAt || p.date || '';
          return '<div class="linked-item">' +
            '<span class="li-type li-type-proposal">PROP</span>' +
            '<span class="li-name">' + esc(title) + '</span>' +
            '<span class="li-date">' + (date ? new Date(date).toLocaleDateString() : '') + '</span>' +
            '<a class="li-link" href="/app/tools/proposal" title="Open Proposal tool">\u2192</a>' +
            '</div>';
        }).join('');
        html += '</div></div>';
      }

      // Notes
      if (c.notes) {
        html += '<div class="detail-section"><h3>Notes</h3>' +
          '<p style="font-size:.85rem;color:var(--text2);line-height:1.6">' + esc(c.notes) + '</p></div>';
      }

      // Timeline
      html += '<div class="detail-section"><h3>Timeline</h3>' +
        '<div class="detail-row"><span class="dr-label">Added</span><span class="dr-value">' + new Date(c.createdAt).toLocaleDateString() + '</span></div>' +
        '<div class="detail-row"><span class="dr-label">Last Updated</span><span class="dr-value">' + new Date(c.updatedAt).toLocaleDateString() + ' (' + timeAgo(c.updatedAt) + ')</span></div>' +
        '</div>';

      body.innerHTML = html;

      // Actions
      document.getElementById('detailActions').innerHTML =
        '<button class="btn btn-orange" onclick="window._UI.openModal(\'' + c.id + '\');window._UI.closeDetail()">\u270E Edit Client</button>' +
        '<button class="btn btn-danger" onclick="window._UI.deleteClient(\'' + c.id + '\')">\u2715 Delete</button>';

      document.getElementById('detailOverlay').classList.add('active');
    },

    closeDetail: function() {
      document.getElementById('detailOverlay').classList.remove('active');
    },

    // ── Import ────────────────────────────────────────────────
    _importSelected: [],

    openImport: function() {
      var candidates = LinkedData.getUniqueClientNames();
      this._importSelected = [];

      var list = document.getElementById('importList');
      var count = document.getElementById('importCount');

      if (candidates.length === 0) {
        count.textContent = '';
        list.innerHTML = '<div class="empty-state" style="padding:2rem"><div class="empty-icon">\u2713</div><p>No new clients found in your invoices or proposals. All client names are already in your directory.</p></div>';
      } else {
        count.textContent = candidates.length + ' new client' + (candidates.length !== 1 ? 's' : '') + ' found in your data';
        list.innerHTML = candidates.map(function(c, idx) {
          var sourceClass = c.source === 'invoice' ? 'ii-source-invoice' : (c.source === 'proposal' ? 'ii-source-proposal' : 'ii-source-invoice');
          var sourceLabel = c.source === 'both' ? 'INV+PROP' : (c.source === 'invoice' ? 'INVOICE' : 'PROPOSAL');
          return '<div class="import-item" data-idx="' + idx + '" onclick="window._UI.toggleImportItem(' + idx + ')">' +
            '<span class="ii-check">\u2713</span>' +
            '<span class="ii-name">' + esc(c.name) + '</span>' +
            (c.email ? '<span style="color:var(--text3);font-size:.75rem">' + esc(c.email) + '</span>' : '') +
            '<span class="ii-source ' + sourceClass + '">' + sourceLabel + '</span>' +
            '</div>';
        }).join('');
      }

      this._importCandidates = candidates;
      document.getElementById('importOverlay').classList.add('active');
    },

    closeImport: function() {
      document.getElementById('importOverlay').classList.remove('active');
      this._importSelected = [];
    },

    toggleImportItem: function(idx) {
      var pos = this._importSelected.indexOf(idx);
      if (pos === -1) this._importSelected.push(idx);
      else this._importSelected.splice(pos, 1);

      var items = document.querySelectorAll('.import-item');
      for (var i = 0; i < items.length; i++) {
        var itemIdx = parseInt(items[i].getAttribute('data-idx'));
        if (this._importSelected.indexOf(itemIdx) !== -1) {
          items[i].classList.add('selected');
        } else {
          items[i].classList.remove('selected');
        }
      }
    },

    confirmImport: function() {
      var candidates = this._importCandidates || [];
      var count = 0;

      for (var i = 0; i < this._importSelected.length; i++) {
        var c = candidates[this._importSelected[i]];
        if (c && !Store.findByName(c.name)) {
          Store.create({ name: c.name, email: c.email || '', status: 'prospect' });
          count++;
        }
      }

      this.closeImport();
      if (count > 0) {
        this.render();
        showToast(count + ' client' + (count !== 1 ? 's' : '') + ' imported');
      } else {
        showToast('No new clients to import', 'error');
      }
    },

    // ── Quick-Add (from other tools) ──────────────────────────
    _quickAddData: null,

    checkQuickAdd: function() {
      try {
        var raw = localStorage.getItem('cortex_quick_add_client');
        if (raw) {
          var data = JSON.parse(raw);
          localStorage.removeItem('cortex_quick_add_client');
          if (data && data.name && !Store.findByName(data.name)) {
            this._quickAddData = data;
            document.getElementById('qabClientName').textContent = data.name + (data.company ? ' (' + data.company + ')' : '');
            document.getElementById('quickAddBanner').classList.add('visible');
          }
        }
      } catch(e) { /* ignore */ }
    },

    confirmQuickAdd: function() {
      if (!this._quickAddData) return;
      Store.create(this._quickAddData);
      document.getElementById('quickAddBanner').classList.remove('visible');
      this._quickAddData = null;
      this.render();
      showToast('Client added from quick-add');
    },

    dismissQuickAdd: function() {
      document.getElementById('quickAddBanner').classList.remove('visible');
      this._quickAddData = null;
    },

    // ── Demo Data ─────────────────────────────────────────────
    seedDemo: function() {
      var demos = [
        {
          name: 'Sarah Chen', company: 'TechVista Inc.', email: 'sarah@techvista.io', phone: '+1 415-555-0123',
          status: 'active', hourlyRate: '150', paymentTerms: 'net30', timezone: 'UTC-08:00', rating: 5,
          tags: ['SaaS', 'React', 'Long-term'], website: 'https://techvista.io',
          notes: 'Great communicator. Prefers Slack. Q1 redesign went well.',
          projects: [
            { id: 'p1', name: 'Dashboard Redesign', amount: 12000, type: 'Web Development', status: 'completed', date: '2025-11-01' },
            { id: 'p2', name: 'Mobile App MVP', amount: 28000, type: 'Mobile Development', status: 'active', date: '2026-01-15' }
          ]
        },
        {
          name: 'Marcus Johnson', company: 'GreenLeaf Co.', email: 'marcus@greenleaf.co', phone: '+1 212-555-0456',
          status: 'active', hourlyRate: '125', paymentTerms: 'net15', timezone: 'UTC-05:00', rating: 4,
          tags: ['E-commerce', 'Shopify', 'Recurring'],
          notes: 'Monthly retainer for site maintenance. Always pays on time.',
          projects: [
            { id: 'p3', name: 'Shopify Migration', amount: 8500, type: 'E-commerce', status: 'completed', date: '2025-09-01' },
            { id: 'p4', name: 'Monthly Retainer', amount: 2000, type: 'Maintenance', status: 'active', date: '2026-01-01' }
          ]
        },
        {
          name: 'Amira Patel', company: '', email: 'amira.patel@gmail.com', phone: '',
          status: 'prospect', hourlyRate: '135', paymentTerms: 'net30', timezone: 'UTC+05:30', rating: 0,
          tags: ['Startup', 'MVP', 'AI/ML'],
          notes: 'Met at TechCrunch Disrupt. Interested in AI dashboard project. Follow up in April.',
          projects: []
        },
        {
          name: 'David Kim', company: 'NovaBrand Agency', email: 'dkim@novabrand.com', phone: '+44 20 7946 0958',
          status: 'inactive', hourlyRate: '110', paymentTerms: 'net45', timezone: 'UTC+00:00', rating: 3,
          tags: ['Agency', 'WordPress', 'Design'],
          notes: 'Completed 3 projects in 2025. May re-engage Q3.',
          projects: [
            { id: 'p5', name: 'Brand Website', amount: 15000, type: 'Web Development', status: 'completed', date: '2025-06-01' },
            { id: 'p6', name: 'Landing Pages x5', amount: 5000, type: 'Design', status: 'completed', date: '2025-10-01' },
            { id: 'p7', name: 'Email Templates', amount: 3200, type: 'Design', status: 'completed', date: '2025-12-01' }
          ]
        }
      ];

      for (var i = 0; i < demos.length; i++) {
        Store.create(demos[i]);
      }
    }
  };

  // Expose for inline onclick handlers
  window._UI = UI;

  // ── Quick-Add API (for use from other tools) ──────────────
  window.CortexClientDirectory = {
    /**
     * Quick-add a client from any tool.
     * Usage: CortexClientDirectory.quickAdd({ name: 'John', email: 'j@x.com', company: 'Acme' })
     * If on the clients page, adds directly. Otherwise stores in localStorage for pickup.
     */
    quickAdd: function(data) {
      if (!data || !data.name) return false;
      if (Store.findByName(data.name)) return false; // already exists
      try {
        localStorage.setItem('cortex_quick_add_client', JSON.stringify(data));
      } catch(e) { return false; }
      return true;
    },

    /** Check if a client exists by name */
    exists: function(name) {
      Store.load();
      return !!Store.findByName(name);
    },

    /** Get all client names for autocomplete */
    getNames: function() {
      Store.load();
      return Store.getAll().map(function(c) { return c.name; });
    }
  };

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { UI.init(); });
  } else {
    UI.init();
  }
})();
