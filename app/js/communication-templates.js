/**
 * CortexCommTemplates — Communication Templates Renderer
 * [UX-008] Dark-themed IIFE for browsing, searching, and copying freelancer templates.
 */
(function () {
  'use strict';

  /* ── State ── */
  let _templates = null;
  let _categories = null;
  let _activeCategory = 'all';
  let _searchQuery = '';
  let _styleInjected = false;

  /* ── CSS ── */
  const STYLES = `
    .ct-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e4e4e7; }

    /* Header */
    .ct-header { font-size: 1.55rem; font-weight: 700; margin-bottom: 1.25rem; }

    /* Tabs */
    .ct-tabs { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .ct-tab {
      padding: .45rem .95rem; border-radius: 9999px; border: 1px solid #3f3f46;
      background: transparent; color: #a1a1aa; cursor: pointer; font-size: .85rem;
      transition: all .18s ease;
    }
    .ct-tab:hover { border-color: #a78bfa; color: #e4e4e7; }
    .ct-tab--active { background: #7c3aed; border-color: #7c3aed; color: #fff; }

    /* Search */
    .ct-search {
      width: 100%; padding: .6rem .85rem; border-radius: .55rem; border: 1px solid #3f3f46;
      background: #18181b; color: #e4e4e7; font-size: .9rem; margin-bottom: 1.25rem;
      outline: none; transition: border-color .18s;
    }
    .ct-search::placeholder { color: #71717a; }
    .ct-search:focus { border-color: #7c3aed; }

    /* Grid */
    .ct-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }

    /* Card */
    .ct-card {
      background: #1e1e23; border: 1px solid #2a2a30; border-radius: .75rem;
      padding: 1rem 1.1rem; cursor: pointer; transition: border-color .18s, transform .15s;
    }
    .ct-card:hover { border-color: #7c3aed; transform: translateY(-2px); }
    .ct-card-name { font-weight: 600; font-size: .95rem; margin-bottom: .45rem; }
    .ct-card-badge {
      display: inline-block; font-size: .7rem; padding: .15rem .5rem; border-radius: 9999px;
      background: #27272a; color: #a1a1aa; margin-bottom: .55rem;
    }
    .ct-card-preview { font-size: .8rem; color: #71717a; line-height: 1.45; }

    /* Empty */
    .ct-empty { text-align: center; color: #71717a; padding: 2.5rem 1rem; font-size: .9rem; }

    /* Modal overlay */
    .ct-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.72); z-index: 9000;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .ct-modal {
      background: #1e1e23; border: 1px solid #3f3f46; border-radius: .85rem;
      width: 100%; max-width: 620px; max-height: 85vh; display: flex; flex-direction: column;
      overflow: hidden;
    }
    .ct-modal-head {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 1.25rem; border-bottom: 1px solid #27272a;
    }
    .ct-modal-title { font-weight: 700; font-size: 1.05rem; }
    .ct-modal-close {
      background: none; border: none; color: #71717a; font-size: 1.3rem;
      cursor: pointer; line-height: 1;
    }
    .ct-modal-close:hover { color: #e4e4e7; }
    .ct-modal-body { padding: 1.25rem; overflow-y: auto; flex: 1; }
    .ct-modal-subject { font-size: .85rem; color: #a1a1aa; margin-bottom: .75rem; }
    .ct-modal-text {
      white-space: pre-wrap; font-size: .88rem; line-height: 1.6; color: #d4d4d8;
    }
    .ct-var {
      background: #7c3aed33; color: #c4b5fd; padding: .1rem .35rem; border-radius: .3rem;
      font-family: 'SF Mono', 'Fira Code', monospace; font-size: .82rem;
    }
    .ct-tip {
      margin-top: 1rem; padding: .75rem; background: #27272a; border-radius: .55rem;
      font-size: .8rem; color: #a1a1aa; line-height: 1.45;
    }
    .ct-tip strong { color: #e4e4e7; }
    .ct-modal-foot {
      padding: .85rem 1.25rem; border-top: 1px solid #27272a; display: flex;
      justify-content: flex-end; gap: .5rem;
    }
    .ct-btn {
      padding: .5rem 1.1rem; border-radius: .5rem; border: none; font-size: .85rem;
      font-weight: 600; cursor: pointer; transition: background .15s;
    }
    .ct-btn--primary { background: #7c3aed; color: #fff; }
    .ct-btn--primary:hover { background: #6d28d9; }
    .ct-btn--ghost { background: transparent; color: #a1a1aa; border: 1px solid #3f3f46; }
    .ct-btn--ghost:hover { border-color: #7c3aed; color: #e4e4e7; }
    .ct-copied { background: #059669 !important; }
  `;

  function injectStyles() {
    if (_styleInjected) return;
    var s = document.createElement('style');
    s.textContent = STYLES;
    document.head.appendChild(s);
    _styleInjected = true;
  }

  /* ── Helpers ── */
  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function highlightVars(text) {
    return esc(text).replace(/\{\{(\w+)\}\}/g, '<span class="ct-var">{{$1}}</span>');
  }

  function fillVariables(template, vars) {
    if (!vars || typeof vars !== 'object') return template;
    return template.replace(/\{\{(\w+)\}\}/g, function (match, key) {
      return vars[key] !== undefined ? vars[key] : match;
    });
  }

  function mapProfileToVars(profileData) {
    if (!profileData) return {};
    var map = {};
    if (profileData.name) map.myName = profileData.name;
    if (profileData.rate) { map.currentRate = profileData.rate; map.newRate = profileData.rate; }
    if (profileData.responseTime) map.responseTime = profileData.responseTime;
    if (profileData.email) map.email = profileData.email;
    return map;
  }

  /* ── Data loading ── */
  function loadTemplates() {
    return fetch('/data/communication-templates.json')
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load templates: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        _categories = data.categories || [];
        _templates = data.templates || [];
        return data;
      });
  }

  /* ── Rendering ── */
  function renderTemplates(profileData, container) {
    injectStyles();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) { console.error('CortexCommTemplates: container not found'); return; }

    var vars = mapProfileToVars(profileData);

    function draw() {
      var filtered = (_templates || []).filter(function (t) {
        var catOk = _activeCategory === 'all' || t.category === _activeCategory;
        var searchOk = !_searchQuery || t.name.toLowerCase().indexOf(_searchQuery) !== -1 ||
          t.body.toLowerCase().indexOf(_searchQuery) !== -1;
        return catOk && searchOk;
      });

      var html = '<div class="ct-root">';
      html += '<div class="ct-header">💬 Communication Templates</div>';

      /* Tabs */
      html += '<div class="ct-tabs">';
      html += '<button class="ct-tab' + (_activeCategory === 'all' ? ' ct-tab--active' : '') +
        '" data-cat="all">All</button>';
      (_categories || []).forEach(function (c) {
        html += '<button class="ct-tab' + (_activeCategory === c.id ? ' ct-tab--active' : '') +
          '" data-cat="' + c.id + '">' + c.icon + ' ' + esc(c.name) + '</button>';
      });
      html += '</div>';

      /* Search */
      html += '<input class="ct-search" placeholder="🔍 Search templates…" value="' + esc(_searchQuery) + '">';

      /* Grid */
      if (filtered.length === 0) {
        html += '<div class="ct-empty">No templates found.</div>';
      } else {
        html += '<div class="ct-grid">';
        filtered.forEach(function (t) {
          var cat = (_categories || []).find(function (c) { return c.id === t.category; });
          var badgeLabel = cat ? (cat.icon + ' ' + cat.name) : t.category;
          var preview = t.body.length > 50 ? t.body.substring(0, 50) + '…' : t.body;
          html += '<div class="ct-card" data-id="' + t.id + '">';
          html += '<div class="ct-card-name">' + esc(t.name) + '</div>';
          html += '<span class="ct-card-badge">' + esc(badgeLabel) + '</span>';
          html += '<div class="ct-card-preview">' + esc(preview) + '</div>';
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
      el.innerHTML = html;

      /* Bind tabs */
      el.querySelectorAll('.ct-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          _activeCategory = btn.getAttribute('data-cat');
          draw();
        });
      });

      /* Bind search */
      var searchInput = el.querySelector('.ct-search');
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          _searchQuery = searchInput.value.toLowerCase();
          draw();
        });
        /* restore cursor position */
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }

      /* Bind cards */
      el.querySelectorAll('.ct-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var t = (_templates || []).find(function (x) { return x.id === card.getAttribute('data-id'); });
          if (t) openModal(t, vars);
        });
      });
    }

    if (!_templates) {
      loadTemplates().then(draw).catch(function (err) {
        el.innerHTML = '<div class="ct-root"><div class="ct-empty">⚠️ ' + esc(err.message) + '</div></div>';
      });
    } else {
      draw();
    }
  }

  /* ── Modal ── */
  function openModal(template, vars) {
    var filledBody = fillVariables(template.body, vars);
    var filledSubject = fillVariables(template.subject || '', vars);

    var overlay = document.createElement('div');
    overlay.className = 'ct-overlay';

    var html = '<div class="ct-modal">';
    html += '<div class="ct-modal-head">';
    html += '<div class="ct-modal-title">' + esc(template.name) + '</div>';
    html += '<button class="ct-modal-close" aria-label="Close">&times;</button>';
    html += '</div>';
    html += '<div class="ct-modal-body">';
    if (filledSubject) {
      html += '<div class="ct-modal-subject">📧 ' + highlightVars(filledSubject) + '</div>';
    }
    html += '<div class="ct-modal-text">' + highlightVars(filledBody) + '</div>';
    if (template.tips) {
      html += '<div class="ct-tip"><strong>💡 Tip:</strong> ' + esc(template.tips) + '</div>';
    }
    html += '</div>';
    html += '<div class="ct-modal-foot">';
    html += '<button class="ct-btn ct-btn--ghost ct-modal-close-btn">Close</button>';
    html += '<button class="ct-btn ct-btn--primary ct-copy-btn">📋 Copy</button>';
    html += '</div>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    /* Close handlers */
    function close() { overlay.remove(); }
    overlay.querySelector('.ct-modal-close').addEventListener('click', close);
    overlay.querySelector('.ct-modal-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
    });

    /* Copy */
    overlay.querySelector('.ct-copy-btn').addEventListener('click', function () {
      var copyBtn = this;
      var text = (filledSubject ? 'Subject: ' + filledSubject + '\n\n' : '') + filledBody;
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = '✅ Copied!';
        copyBtn.classList.add('ct-copied');
        setTimeout(function () {
          copyBtn.textContent = '📋 Copy';
          copyBtn.classList.remove('ct-copied');
        }, 1800);
      }).catch(function () {
        /* Fallback */
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        copyBtn.textContent = '✅ Copied!';
        copyBtn.classList.add('ct-copied');
        setTimeout(function () {
          copyBtn.textContent = '📋 Copy';
          copyBtn.classList.remove('ct-copied');
        }, 1800);
      });
    });
  }

  /* ── Public API ── */
  window.CortexCommTemplates = {
    loadTemplates: loadTemplates,
    renderTemplates: renderTemplates,
    fillVariables: fillVariables
  };
})();
