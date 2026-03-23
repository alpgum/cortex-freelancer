/**
 * CortexProposalTemplates — Proposal Templates Library
 * IIFE exposing window.CortexProposalTemplates
 */
(function () {
  'use strict';

  const STYLE_ID = 'cortex-proposal-templates-style';
  let _templates = [];
  let _activeCategory = 'All';
  let _searchQuery = '';

  /* ── CSS (dark theme, inline) ─────────────────────────────── */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .cpt-library { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e4e4e7; }

      /* ── Tabs ── */
      .cpt-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
      .cpt-tab {
        padding: 6px 14px; border-radius: 8px; border: 1px solid #3f3f46;
        background: #27272a; color: #a1a1aa; font-size: 13px; cursor: pointer;
        transition: all .15s;
      }
      .cpt-tab:hover { background: #3f3f46; color: #e4e4e7; }
      .cpt-tab.active { background: #6d28d9; border-color: #7c3aed; color: #fff; }

      /* ── Search ── */
      .cpt-search {
        width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid #3f3f46;
        background: #18181b; color: #e4e4e7; font-size: 14px; margin-bottom: 16px;
        outline: none; box-sizing: border-box;
      }
      .cpt-search::placeholder { color: #71717a; }
      .cpt-search:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,.25); }

      /* ── Grid ── */
      .cpt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

      /* ── Card ── */
      .cpt-card {
        background: #1e1e22; border: 1px solid #2e2e33; border-radius: 12px;
        padding: 18px; cursor: pointer; transition: all .15s;
      }
      .cpt-card:hover { border-color: #7c3aed; transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,.4); }
      .cpt-card-cat { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #7c3aed; margin-bottom: 6px; }
      .cpt-card-name { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #f4f4f5; }
      .cpt-card-hook { font-size: 13px; color: #a1a1aa; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

      /* ── Modal Overlay ── */
      .cpt-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        animation: cpt-fadeIn .15s;
      }
      @keyframes cpt-fadeIn { from { opacity: 0; } to { opacity: 1; } }

      .cpt-modal {
        background: #1e1e22; border: 1px solid #3f3f46; border-radius: 14px;
        width: 90%; max-width: 680px; max-height: 85vh; overflow-y: auto;
        padding: 28px; position: relative;
      }
      .cpt-modal-close {
        position: absolute; top: 14px; right: 14px; background: none; border: none;
        color: #a1a1aa; font-size: 22px; cursor: pointer; padding: 4px 8px;
        border-radius: 6px;
      }
      .cpt-modal-close:hover { color: #fff; background: #3f3f46; }
      .cpt-modal-cat { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: #7c3aed; margin-bottom: 4px; }
      .cpt-modal-name { font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #f4f4f5; }

      .cpt-section { margin-bottom: 18px; }
      .cpt-section-label { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #71717a; margin-bottom: 6px; }
      .cpt-section-body {
        background: #27272a; border-radius: 8px; padding: 14px;
        font-size: 13.5px; line-height: 1.65; color: #d4d4d8; white-space: pre-wrap;
      }
      .cpt-section-body .cpt-var { color: #a78bfa; font-weight: 500; }

      .cpt-tips { list-style: none; padding: 0; margin: 0; }
      .cpt-tips li { padding: 6px 0 6px 20px; position: relative; font-size: 13px; color: #a1a1aa; }
      .cpt-tips li::before { content: '💡'; position: absolute; left: 0; }

      .cpt-full-template {
        background: #18181b; border: 1px solid #3f3f46; border-radius: 8px;
        padding: 16px; font-size: 13.5px; line-height: 1.7; color: #d4d4d8;
        white-space: pre-wrap; max-height: 300px; overflow-y: auto;
      }

      /* ── Buttons ── */
      .cpt-btn-row { display: flex; gap: 10px; margin-top: 18px; }
      .cpt-btn {
        padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer;
        font-size: 14px; font-weight: 500; transition: all .15s;
      }
      .cpt-btn-primary { background: #7c3aed; color: #fff; }
      .cpt-btn-primary:hover { background: #6d28d9; }
      .cpt-btn-secondary { background: #27272a; color: #e4e4e7; border: 1px solid #3f3f46; }
      .cpt-btn-secondary:hover { background: #3f3f46; }

      .cpt-copied { background: #16a34a !important; }

      .cpt-empty { text-align: center; padding: 40px 20px; color: #71717a; font-size: 14px; }
    `;
    document.head.appendChild(style);
  }

  /* ── Load Templates ────────────────────────────────────────── */
  async function loadTemplates() {
    try {
      const res = await fetch('/data/proposal-templates.json');
      if (!res.ok) throw new Error('Failed to fetch templates: ' + res.status);
      _templates = await res.json();
      return _templates;
    } catch (err) {
      console.error('[CortexProposalTemplates]', err);
      return [];
    }
  }

  /* ── Helpers ───────────────────────────────────────────────── */
  function getCategories() {
    const cats = new Set(_templates.map(t => t.category));
    return ['All', ...Array.from(cats).sort()];
  }

  function highlightVars(text) {
    if (!text) return '';
    return text.replace(/\{\{(\w+)\}\}/g, '<span class="cpt-var">{{$1}}</span>');
  }

  function fillVariables(text, profileData) {
    if (!text || !profileData) return text || '';
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return profileData[key] !== undefined ? profileData[key] : match;
    });
  }

  function filterTemplates() {
    return _templates.filter(t => {
      const catMatch = _activeCategory === 'All' || t.category === _activeCategory;
      if (!_searchQuery) return catMatch;
      const q = _searchQuery.toLowerCase();
      const textMatch = t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.hook.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }

  /* ── Render: Template Library ──────────────────────────────── */
  function renderTemplateLibrary(profileData, container) {
    injectStyles();
    if (!container) { console.error('[CortexProposalTemplates] No container provided'); return; }

    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) { console.error('[CortexProposalTemplates] Container not found:', container); return; }

    function render() {
      const categories = getCategories();
      const filtered = filterTemplates();

      root.innerHTML = '';
      root.classList.add('cpt-library');

      // Search
      const search = document.createElement('input');
      search.className = 'cpt-search';
      search.type = 'text';
      search.placeholder = '🔍  Search templates by name, category, or keyword…';
      search.value = _searchQuery;
      search.addEventListener('input', function () {
        _searchQuery = this.value;
        render();
      });
      root.appendChild(search);

      // Tabs
      const tabs = document.createElement('div');
      tabs.className = 'cpt-tabs';
      categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cpt-tab' + (cat === _activeCategory ? ' active' : '');
        btn.textContent = cat;
        btn.addEventListener('click', () => { _activeCategory = cat; render(); });
        tabs.appendChild(btn);
      });
      root.appendChild(tabs);

      // Grid
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cpt-empty';
        empty.textContent = 'No templates match your search.';
        root.appendChild(empty);
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'cpt-grid';

      filtered.forEach(tmpl => {
        const card = document.createElement('div');
        card.className = 'cpt-card';
        card.innerHTML = `
          <div class="cpt-card-cat">${tmpl.category}</div>
          <div class="cpt-card-name">${tmpl.name}</div>
          <div class="cpt-card-hook">${tmpl.hook}</div>
        `;
        card.addEventListener('click', () => openPreview(tmpl, profileData));
        grid.appendChild(card);
      });
      root.appendChild(grid);
    }

    // If templates aren't loaded yet, fetch them and render when ready
    if (!_templates || _templates.length === 0) {
      root.innerHTML = '<div class="cpt-empty">Loading templates…</div>';
      loadTemplates().then(() => {
        if (_activeCategory !== 'All' && !_templates.some(t => t.category === _activeCategory)) {
          _activeCategory = 'All';
        }
        render();
      });
      return;
    }

    render();
  }

  /* ── Preview Modal ─────────────────────────────────────────── */
  function openPreview(tmpl, profileData) {
    const overlay = document.createElement('div');
    overlay.className = 'cpt-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    const filledFull = fillVariables(tmpl.fullTemplate, profileData);

    const modal = document.createElement('div');
    modal.className = 'cpt-modal';
    modal.innerHTML = `
      <button class="cpt-modal-close" title="Close">&times;</button>
      <div class="cpt-modal-cat">${tmpl.category}</div>
      <div class="cpt-modal-name">${tmpl.name}</div>

      <div class="cpt-section">
        <div class="cpt-section-label">Hook</div>
        <div class="cpt-section-body">${highlightVars(tmpl.hook)}</div>
      </div>

      <div class="cpt-section">
        <div class="cpt-section-label">Experience</div>
        <div class="cpt-section-body">${highlightVars(tmpl.experience)}</div>
      </div>

      <div class="cpt-section">
        <div class="cpt-section-label">Approach</div>
        <div class="cpt-section-body">${highlightVars(tmpl.approach)}</div>
      </div>

      <div class="cpt-section">
        <div class="cpt-section-label">Timeline</div>
        <div class="cpt-section-body">${highlightVars(tmpl.timeline)}</div>
      </div>

      <div class="cpt-section">
        <div class="cpt-section-label">Call to Action</div>
        <div class="cpt-section-body">${highlightVars(tmpl.cta)}</div>
      </div>

      <div class="cpt-section">
        <div class="cpt-section-label">Full Template Preview</div>
        <div class="cpt-full-template">${highlightVars(filledFull)}</div>
      </div>

      ${tmpl.tips && tmpl.tips.length ? `
      <div class="cpt-section">
        <div class="cpt-section-label">Tips</div>
        <ul class="cpt-tips">
          ${tmpl.tips.map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>` : ''}

      <div class="cpt-btn-row">
        <button class="cpt-btn cpt-btn-primary" id="cpt-copy-btn">📋 Copy Template</button>
        <button class="cpt-btn cpt-btn-secondary" id="cpt-copy-filled-btn">📝 Copy with Variables Filled</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close button
    modal.querySelector('.cpt-modal-close').addEventListener('click', () => overlay.remove());

    // Copy raw template
    modal.querySelector('#cpt-copy-btn').addEventListener('click', function () {
      copyToClipboard(tmpl.fullTemplate, this);
    });

    // Copy filled template
    modal.querySelector('#cpt-copy-filled-btn').addEventListener('click', function () {
      copyToClipboard(filledFull, this);
    });

    // Escape key
    function onKey(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);
  }

  /* ── Clipboard ─────────────────────────────────────────────── */
  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      btn.classList.add('cpt-copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('cpt-copied'); }, 1500);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      const orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      btn.classList.add('cpt-copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('cpt-copied'); }, 1500);
    });
  }

  /* ── Public API ────────────────────────────────────────────── */
  window.CortexProposalTemplates = {
    loadTemplates: loadTemplates,
    renderTemplateLibrary: renderTemplateLibrary
  };

})();
