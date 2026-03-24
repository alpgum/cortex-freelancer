/**
 * [CF-159] Templates — Community Template Sharing
 * Browse and share community-contributed templates with ratings,
 * categories, search, and download functionality.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_template_sharing';
  var CSS_ID = 'cf-ts-styles';
  var _container = null;
  var _injected = false;

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }

  function loadData() {
    try {
      var d = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (d && d.templates) return d;
      return seedData();
    } catch (e) { return seedData(); }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  var CATEGORIES = ['Proposals', 'Contracts', 'Invoices', 'Emails', 'Scope of Work', 'NDA', 'Project Brief'];

  function seedData() {
    var templates = [
      { id: uid(), title: 'Professional Project Proposal', author: 'Sarah Chen', category: 'Proposals', rating: 4.7, ratingCount: 42, downloads: 312, preview: 'Dear [Client Name],\n\nThank you for considering our services. I am pleased to present this proposal for [Project Name]...\n\nScope of Work:\n1. Discovery & Research\n2. Design & Development\n3. Testing & Deployment\n\nTimeline: [X] weeks\nBudget: $[Amount]', content: 'Dear [Client Name],\n\nThank you for considering our services. I am pleased to present this proposal for [Project Name].\n\nProject Overview:\n[Brief description of the project and its objectives]\n\nScope of Work:\n1. Discovery & Research Phase\n   - Stakeholder interviews\n   - Market research\n   - Requirements documentation\n\n2. Design & Development Phase\n   - Wireframes and prototypes\n   - Visual design\n   - Development sprints\n\n3. Testing & Deployment\n   - QA testing\n   - User acceptance testing\n   - Production deployment\n\nTimeline: [X] weeks from project kickoff\nBudget: $[Amount]\nPayment Terms: 50% upfront, 50% on completion\n\nBest regards,\n[Your Name]', createdAt: '2026-01-15', flagged: false },
      { id: uid(), title: 'Freelance Service Contract', author: 'Mike Rodriguez', category: 'Contracts', rating: 4.5, ratingCount: 28, downloads: 198, preview: 'FREELANCE SERVICE AGREEMENT\n\nThis agreement is entered into between [Freelancer] and [Client]...\n\nServices: [Description]\nCompensation: $[Rate]/hour\nDuration: [Start] to [End]', content: 'FREELANCE SERVICE AGREEMENT\n\nThis agreement is entered into as of [Date] between:\n\nFreelancer: [Your Name/Business]\nClient: [Client Name/Business]\n\n1. SERVICES\nFreelancer agrees to provide: [Detailed description]\n\n2. COMPENSATION\nRate: $[Rate] per hour/project\nPayment schedule: [Net 15/30]\nLate payment fee: 1.5% per month\n\n3. TERM\nStart: [Date]\nEnd: [Date]\n\n4. INTELLECTUAL PROPERTY\nAll work product transfers to Client upon full payment.\n\n5. CONFIDENTIALITY\nBoth parties agree to maintain confidentiality.\n\n6. TERMINATION\nEither party may terminate with [14] days written notice.\n\nSignatures:\n_______________ Date: ___\n_______________ Date: ___', createdAt: '2026-02-03', flagged: false },
      { id: uid(), title: 'Monthly Invoice Template', author: 'Lisa Park', category: 'Invoices', rating: 4.8, ratingCount: 56, downloads: 445, preview: 'INVOICE #[Number]\nDate: [Date]\n\nBill To: [Client Name]\n\nServices Rendered:\n- [Service 1]: $[Amount]\n- [Service 2]: $[Amount]\n\nTotal: $[Total]', content: 'INVOICE\n\nInvoice #: [INV-001]\nDate: [Date]\nDue Date: [Due Date]\n\nFrom:\n[Your Name]\n[Your Address]\n[Your Email]\n\nBill To:\n[Client Name]\n[Client Address]\n\nServices Rendered:\n| Description | Hours | Rate | Amount |\n|-------------|-------|------|--------|\n| [Service 1] | [X]   | $[Y] | $[Z]  |\n| [Service 2] | [X]   | $[Y] | $[Z]  |\n\nSubtotal: $[Amount]\nTax: $[Amount]\nTotal Due: $[Total]\n\nPayment Methods:\n- Bank Transfer: [Details]\n- PayPal: [Email]\n\nThank you for your business!', createdAt: '2026-01-28', flagged: false },
      { id: uid(), title: 'Client Follow-up Email', author: 'Alex Kim', category: 'Emails', rating: 4.3, ratingCount: 19, downloads: 156, preview: 'Subject: Following Up on Our Conversation\n\nHi [Client Name],\n\nI wanted to follow up on our discussion about [Project]...', content: 'Subject: Following Up on Our Conversation\n\nHi [Client Name],\n\nI wanted to follow up on our discussion about [Project]. I have been thinking about your requirements and I believe we can achieve [specific outcome].\n\nHere are the next steps I propose:\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]\n\nWould you be available for a brief call this [day] to discuss further?\n\nBest regards,\n[Your Name]', createdAt: '2026-02-10', flagged: false },
      { id: uid(), title: 'Scope of Work Document', author: 'Jordan Taylor', category: 'Scope of Work', rating: 4.6, ratingCount: 33, downloads: 267, preview: 'SCOPE OF WORK\n\nProject: [Name]\nClient: [Client]\nDate: [Date]\n\n1. Project Objectives\n2. Deliverables\n3. Timeline\n4. Assumptions', content: 'SCOPE OF WORK\n\nProject: [Project Name]\nClient: [Client Name]\nPrepared by: [Your Name]\nDate: [Date]\nVersion: 1.0\n\n1. PROJECT OBJECTIVES\n[Describe what the project aims to achieve]\n\n2. DELIVERABLES\n- [Deliverable 1]: [Description]\n- [Deliverable 2]: [Description]\n- [Deliverable 3]: [Description]\n\n3. TIMELINE\nPhase 1: [Dates] - [Description]\nPhase 2: [Dates] - [Description]\nPhase 3: [Dates] - [Description]\n\n4. ASSUMPTIONS\n- [Assumption 1]\n- [Assumption 2]\n\n5. OUT OF SCOPE\n- [Item 1]\n- [Item 2]\n\n6. ACCEPTANCE CRITERIA\n[Define what constitutes project completion]', createdAt: '2026-02-20', flagged: false },
      { id: uid(), title: 'Standard NDA Agreement', author: 'Pat Williams', category: 'NDA', rating: 4.4, ratingCount: 21, downloads: 189, preview: 'NON-DISCLOSURE AGREEMENT\n\nBetween [Party A] and [Party B]\n\nEffective Date: [Date]\n\nConfidential Information includes...', content: 'NON-DISCLOSURE AGREEMENT\n\nThis NDA is entered into between:\nDisclosing Party: [Name]\nReceiving Party: [Name]\nEffective Date: [Date]\n\n1. DEFINITION\nConfidential Information includes all non-public information disclosed by either party, including but not limited to: business plans, technical data, trade secrets, customer lists, and financial information.\n\n2. OBLIGATIONS\nThe Receiving Party agrees to:\n- Maintain confidentiality\n- Not disclose to third parties\n- Use information only for agreed purposes\n\n3. EXCLUSIONS\nInformation that is:\n- Publicly available\n- Already known to Receiving Party\n- Independently developed\n\n4. TERM\nThis agreement remains in effect for [2] years.\n\n5. REMEDIES\nBreach may result in injunctive relief and damages.\n\nSignatures:\n_______________ Date: ___\n_______________ Date: ___', createdAt: '2026-03-01', flagged: false }
    ];
    var data = { templates: templates, userRatings: {} };
    saveData(data);
    return data;
  }

  /* ── CSS ── */

  function injectCSS() {
    if (_injected) return;
    _injected = true;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.ts-panel{background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#1e1e1e);border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--text-primary,#e0e0e0);overflow:hidden}',
      '.ts-header{padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}',
      '.ts-title{font-size:16px;font-weight:700}',
      '.ts-toolbar{padding:12px 20px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--border,#1e1e1e)}',
      '.ts-search{flex:1;min-width:180px;background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:13px;padding:6px 10px}',
      '.ts-filter{background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:12px;padding:6px 8px;cursor:pointer}',
      '.ts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding:16px 20px}',
      '.ts-card{background:var(--bg-secondary,#111);border:1px solid var(--border,#1e1e1e);border-radius:10px;padding:16px;cursor:pointer;transition:border-color .2s}',
      '.ts-card:hover{border-color:#7c3aed}',
      '.ts-card-title{font-size:14px;font-weight:600;margin-bottom:6px}',
      '.ts-card-meta{display:flex;gap:8px;align-items:center;font-size:11px;color:var(--text-muted,#888);margin-bottom:8px;flex-wrap:wrap}',
      '.ts-card-cat{background:#7c3aed22;color:#a78bfa;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600}',
      '.ts-card-stars{color:#f59e0b}',
      '.ts-card-preview{font-size:12px;color:var(--text-muted,#888);line-height:1.5;max-height:60px;overflow:hidden;white-space:pre-line}',
      '.ts-card-footer{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:11px;color:var(--text-muted,#666)}',
      '.ts-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}',
      '.ts-modal{background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#1e1e1e);border-radius:12px;max-width:640px;width:100%;max-height:80vh;overflow-y:auto;padding:24px}',
      '.ts-modal-title{font-size:18px;font-weight:700;margin-bottom:4px}',
      '.ts-modal-meta{font-size:12px;color:var(--text-muted,#888);margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap}',
      '.ts-modal-content{background:var(--bg-secondary,#111);border:1px solid var(--border,#1e1e1e);border-radius:8px;padding:16px;font-size:13px;line-height:1.6;white-space:pre-wrap;margin-bottom:16px;max-height:300px;overflow-y:auto}',
      '.ts-modal-actions{display:flex;gap:8px;flex-wrap:wrap}',
      '.ts-btn{border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;padding:8px 16px}',
      '.ts-btn-primary{background:#7c3aed;color:#fff}',
      '.ts-btn-primary:hover{background:#6d28d9}',
      '.ts-btn-secondary{background:var(--bg-secondary,#222);color:var(--text-primary,#e0e0e0);border:1px solid var(--border,#333)}',
      '.ts-btn-secondary:hover{background:var(--border,#333)}',
      '.ts-btn-danger{background:#dc262622;color:#ef4444;border:1px solid #dc262644}',
      '.ts-rating-input{display:flex;gap:4px;margin:12px 0}',
      '.ts-rating-star{font-size:20px;cursor:pointer;color:var(--border,#333);transition:color .15s}',
      '.ts-rating-star.active,.ts-rating-star:hover{color:#f59e0b}',
      '.ts-share-form{padding:16px 20px;border-top:1px solid var(--border,#1e1e1e)}',
      '.ts-share-form label{display:block;font-size:11px;color:var(--text-muted,#888);text-transform:uppercase;letter-spacing:.5px;margin:10px 0 4px}',
      '.ts-share-form input,.ts-share-form select,.ts-share-form textarea{width:100%;background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:13px;padding:6px 10px;box-sizing:border-box;font-family:inherit}',
      '.ts-share-form textarea{min-height:120px;resize:vertical}',
      '.ts-empty{padding:40px 20px;text-align:center;color:var(--text-muted,#555);font-size:13px}',
      '@media(max-width:600px){.ts-grid{grid-template-columns:1fr}.ts-modal{margin:10px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Stars ── */

  function renderStars(rating) {
    var h = '';
    for (var i = 1; i <= 5; i++) {
      h += i <= Math.round(rating) ? '&#9733;' : '&#9734;';
    }
    return h;
  }

  /* ── Render ── */

  function render(container) {
    injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    _container = el;

    renderMain(el, { search: '', category: 'All', sort: 'popular' });
  }

  function renderMain(el, filters) {
    var data = loadData();
    var templates = data.templates.slice();

    // Filter
    if (filters.search) {
      var q = filters.search.toLowerCase();
      templates = templates.filter(function (t) {
        return t.title.toLowerCase().indexOf(q) >= 0 || t.author.toLowerCase().indexOf(q) >= 0 || t.category.toLowerCase().indexOf(q) >= 0;
      });
    }
    if (filters.category && filters.category !== 'All') {
      templates = templates.filter(function (t) { return t.category === filters.category; });
    }

    // Sort
    if (filters.sort === 'popular') templates.sort(function (a, b) { return b.downloads - a.downloads; });
    else if (filters.sort === 'rating') templates.sort(function (a, b) { return b.rating - a.rating; });
    else if (filters.sort === 'newest') templates.sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });

    var h = '<div class="ts-panel">';

    // Header
    h += '<div class="ts-header"><span class="ts-title">Community Templates</span>';
    h += '<button class="ts-btn ts-btn-primary" id="ts-share-btn">+ Share Template</button></div>';

    // Toolbar
    h += '<div class="ts-toolbar">';
    h += '<input class="ts-search" id="ts-search" placeholder="Search templates..." value="' + esc(filters.search) + '">';
    h += '<select class="ts-filter" id="ts-cat-filter"><option value="All">All Categories</option>';
    CATEGORIES.forEach(function (c) {
      h += '<option value="' + esc(c) + '"' + (filters.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    });
    h += '</select>';
    h += '<select class="ts-filter" id="ts-sort"><option value="popular"' + (filters.sort === 'popular' ? ' selected' : '') + '>Most Downloaded</option>';
    h += '<option value="rating"' + (filters.sort === 'rating' ? ' selected' : '') + '>Highest Rated</option>';
    h += '<option value="newest"' + (filters.sort === 'newest' ? ' selected' : '') + '>Newest</option></select></div>';

    // Grid
    if (templates.length === 0) {
      h += '<div class="ts-empty">No templates found. Try adjusting your filters or share the first one!</div>';
    } else {
      h += '<div class="ts-grid">';
      templates.forEach(function (t) {
        h += '<div class="ts-card" data-id="' + t.id + '">';
        h += '<div class="ts-card-title">' + esc(t.title) + '</div>';
        h += '<div class="ts-card-meta"><span class="ts-card-cat">' + esc(t.category) + '</span>';
        h += '<span class="ts-card-stars">' + renderStars(t.rating) + ' ' + t.rating.toFixed(1) + '</span>';
        h += '<span>by ' + esc(t.author) + '</span></div>';
        h += '<div class="ts-card-preview">' + esc(t.preview || t.content.substring(0, 150)) + '</div>';
        h += '<div class="ts-card-footer"><span>' + t.downloads + ' downloads</span><span>' + t.ratingCount + ' ratings</span></div>';
        h += '</div>';
      });
      h += '</div>';
    }

    h += '</div>';
    el.innerHTML = h;

    // Events
    el.querySelectorAll('.ts-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-id');
        var tmpl = data.templates.find(function (t) { return t.id === id; });
        if (tmpl) showModal(el, tmpl, data, filters);
      });
    });

    var searchInput = el.querySelector('#ts-search');
    if (searchInput) searchInput.addEventListener('input', function () {
      filters.search = searchInput.value;
      renderMain(el, filters);
    });

    var catFilter = el.querySelector('#ts-cat-filter');
    if (catFilter) catFilter.addEventListener('change', function () {
      filters.category = catFilter.value;
      renderMain(el, filters);
    });

    var sortSelect = el.querySelector('#ts-sort');
    if (sortSelect) sortSelect.addEventListener('change', function () {
      filters.sort = sortSelect.value;
      renderMain(el, filters);
    });

    var shareBtn = el.querySelector('#ts-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', function () {
      showShareForm(el, data, filters);
    });
  }

  function showModal(el, tmpl, data, filters) {
    var overlay = document.createElement('div');
    overlay.className = 'ts-modal-overlay';

    var userRating = (data.userRatings && data.userRatings[tmpl.id]) || 0;

    var h = '<div class="ts-modal">';
    h += '<div class="ts-modal-title">' + esc(tmpl.title) + '</div>';
    h += '<div class="ts-modal-meta"><span>by ' + esc(tmpl.author) + '</span><span class="ts-card-cat">' + esc(tmpl.category) + '</span>';
    h += '<span class="ts-card-stars">' + renderStars(tmpl.rating) + ' ' + tmpl.rating.toFixed(1) + ' (' + tmpl.ratingCount + ')</span>';
    h += '<span>' + tmpl.downloads + ' downloads</span></div>';
    h += '<div class="ts-modal-content">' + esc(tmpl.content) + '</div>';

    // Rating
    h += '<div style="font-size:12px;color:var(--text-muted,#888)">Rate this template:</div>';
    h += '<div class="ts-rating-input">';
    for (var i = 1; i <= 5; i++) {
      h += '<span class="ts-rating-star' + (i <= userRating ? ' active' : '') + '" data-star="' + i + '">&#9733;</span>';
    }
    h += '</div>';

    h += '<div class="ts-modal-actions">';
    h += '<button class="ts-btn ts-btn-primary" id="ts-download">Download Template</button>';
    h += '<button class="ts-btn ts-btn-secondary" id="ts-copy">Copy to Clipboard</button>';
    if (tmpl.flagged) {
      h += '<button class="ts-btn ts-btn-danger" disabled>Flagged</button>';
    } else {
      h += '<button class="ts-btn ts-btn-danger" id="ts-flag">Report</button>';
    }
    h += '<button class="ts-btn ts-btn-secondary" id="ts-close">Close</button>';
    h += '</div></div>';

    overlay.innerHTML = h;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { document.body.removeChild(overlay); }
    });

    overlay.querySelector('#ts-close').addEventListener('click', function () {
      document.body.removeChild(overlay);
    });

    overlay.querySelector('#ts-copy').addEventListener('click', function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(tmpl.content);
        this.textContent = 'Copied!';
      }
    });

    overlay.querySelector('#ts-download').addEventListener('click', function () {
      tmpl.downloads++;
      saveData(data);
      var blob = new Blob([tmpl.content], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = tmpl.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.txt';
      a.click();
      URL.revokeObjectURL(a.href);
      this.textContent = 'Downloaded!';
    });

    var flagBtn = overlay.querySelector('#ts-flag');
    if (flagBtn) {
      flagBtn.addEventListener('click', function () {
        tmpl.flagged = true;
        saveData(data);
        this.textContent = 'Flagged';
        this.disabled = true;
      });
    }

    overlay.querySelectorAll('.ts-rating-star').forEach(function (star) {
      star.addEventListener('click', function () {
        var val = parseInt(star.getAttribute('data-star'), 10);
        if (!data.userRatings) data.userRatings = {};
        var oldRating = data.userRatings[tmpl.id] || 0;
        data.userRatings[tmpl.id] = val;

        if (oldRating > 0) {
          var totalScore = tmpl.rating * tmpl.ratingCount - oldRating + val;
          tmpl.rating = totalScore / tmpl.ratingCount;
        } else {
          var total = tmpl.rating * tmpl.ratingCount + val;
          tmpl.ratingCount++;
          tmpl.rating = total / tmpl.ratingCount;
        }
        tmpl.rating = Math.round(tmpl.rating * 10) / 10;

        saveData(data);
        document.body.removeChild(overlay);
        showModal(el, tmpl, data, filters);
      });
    });
  }

  function showShareForm(el, data, filters) {
    var panel = el.querySelector('.ts-panel');
    if (!panel) return;

    var existing = el.querySelector('.ts-share-form');
    if (existing) { existing.remove(); return; }

    var form = document.createElement('div');
    form.className = 'ts-share-form';
    var h = '<label>Template Title</label><input type="text" id="ts-new-title" placeholder="e.g., Professional Proposal">';
    h += '<label>Category</label><select id="ts-new-cat">';
    CATEGORIES.forEach(function (c) { h += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
    h += '</select>';
    h += '<label>Your Name</label><input type="text" id="ts-new-author" placeholder="Your name">';
    h += '<label>Template Content</label><textarea id="ts-new-content" placeholder="Paste your template content here..."></textarea>';
    h += '<button class="ts-btn ts-btn-primary" id="ts-submit" style="margin-top:12px">Share Template</button>';
    h += ' <button class="ts-btn ts-btn-secondary" id="ts-cancel" style="margin-top:12px">Cancel</button>';
    form.innerHTML = h;
    panel.appendChild(form);

    form.querySelector('#ts-cancel').addEventListener('click', function () { form.remove(); });
    form.querySelector('#ts-submit').addEventListener('click', function () {
      var title = document.getElementById('ts-new-title').value.trim();
      var author = document.getElementById('ts-new-author').value.trim();
      var category = document.getElementById('ts-new-cat').value;
      var content = document.getElementById('ts-new-content').value.trim();

      if (!title || !content) return;

      data.templates.push({
        id: uid(),
        title: title,
        author: author || 'Anonymous',
        category: category,
        rating: 0,
        ratingCount: 0,
        downloads: 0,
        preview: content.substring(0, 200),
        content: content,
        createdAt: new Date().toISOString().split('T')[0],
        flagged: false
      });
      saveData(data);
      renderMain(el, filters);
    });
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
    var overlay = document.querySelector('.ts-modal-overlay');
    if (overlay) overlay.remove();
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.TemplateSharing = {
    init: init,
    render: render,
    destroy: destroy,
    CATEGORIES: CATEGORIES
  };
})();
