/**
 * [UW-005] Profile Rewriter UI
 * Shows before → after comparison with selectable title pills,
 * highlighted description changes, copy buttons, and SEO score meter.
 * Dark theme. Exposed as window.CortexProfileRewriter.
 */
(function () {
  'use strict';

  // ── Styles ──────────────────────────────────────────────────────────────
  var STYLES = `
    .pr-section { max-width: 700px; margin: 2rem auto; padding: 1.5rem; }
    .pr-title { font-size: 1.3rem; font-weight: 800; color: #fff; margin-bottom: 0.25rem; }
    .pr-subtitle { font-size: 0.8rem; color: #888; margin-bottom: 1.5rem; }

    /* Before / After cards */
    .pr-comparison { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.75rem; align-items: start; margin-bottom: 1.5rem; }
    @media (max-width: 640px) { .pr-comparison { grid-template-columns: 1fr; } .pr-arrow { transform: rotate(90deg); } }
    .pr-card { background: #111; border: 1px solid #222; border-radius: 12px; padding: 1rem; }
    .pr-card-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; margin-bottom: 0.5rem; }
    .pr-card-label-before { color: #888; }
    .pr-card-label-after { color: #00ff88; }
    .pr-card-title { font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; word-break: break-word; }
    .pr-card-desc { font-size: 0.8rem; color: #ccc; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .pr-arrow { display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #00ff88; padding-top: 2rem; }

    /* Title pills */
    .pr-pills-label { font-size: 0.75rem; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem; }
    .pr-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; }
    .pr-pill { padding: 0.5rem 1rem; border: 1px solid #333; border-radius: 100px; background: #111; color: #ccc;
               font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; user-select: none; }
    .pr-pill:hover { border-color: #00ff88; color: #00ff88; }
    .pr-pill.active { border-color: #00ff88; background: rgba(0,255,136,0.1); color: #00ff88; }

    /* Highlighted changes */
    .pr-added { background: rgba(0,255,136,0.12); color: #00ff88; padding: 0 2px; border-radius: 3px; }
    .pr-removed { text-decoration: line-through; color: #ff5555; opacity: 0.7; }

    /* Changes list */
    .pr-changes { margin-bottom: 1.5rem; }
    .pr-changes-title { font-size: 0.75rem; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem; }
    .pr-change-item { font-size: 0.8rem; color: #ccc; padding: 0.25rem 0; display: flex; align-items: baseline; gap: 0.5rem; }
    .pr-change-bullet { color: #00ff88; font-size: 0.7rem; }

    /* SEO score meter */
    .pr-score-section { margin-bottom: 1.5rem; }
    .pr-score-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
    .pr-score-label { font-size: 0.75rem; font-weight: 600; color: #888; min-width: 50px; }
    .pr-score-bar { flex: 1; height: 8px; background: #222; border-radius: 100px; overflow: hidden; position: relative; }
    .pr-score-fill { height: 100%; border-radius: 100px; transition: width 0.8s ease; }
    .pr-score-fill-before { background: #ff5555; }
    .pr-score-fill-after { background: linear-gradient(90deg, #00ff88, #00cc66); }
    .pr-score-value { font-size: 0.85rem; font-weight: 800; min-width: 32px; text-align: right; }
    .pr-score-value-before { color: #ff5555; }
    .pr-score-value-after { color: #00ff88; }
    .pr-score-delta { font-size: 0.7rem; color: #00ff88; font-weight: 700; text-align: center; margin-top: 0.25rem; }

    /* Buttons */
    .pr-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .pr-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0.55rem 1.2rem; border: 1px solid #333;
              border-radius: 100px; background: #111; color: #ccc; font-size: 0.8rem; font-weight: 600;
              cursor: pointer; transition: all 0.2s; font-family: inherit; }
    .pr-btn:hover { border-color: #00ff88; color: #00ff88; }
    .pr-btn-primary { border-color: #00ff88; background: rgba(0,255,136,0.1); color: #00ff88; }
    .pr-btn-primary:hover { background: rgba(0,255,136,0.2); }
    .pr-btn .pr-copied { display: none; }
    .pr-btn.copied .pr-copied { display: inline; }
    .pr-btn.copied .pr-default { display: none; }

    /* Rewrite button */
    .pr-rewrite-btn { width: 100%; padding: 0.75rem; border: 1px solid #333; border-radius: 12px;
                      background: linear-gradient(135deg, rgba(255,136,68,0.1), rgba(0,255,136,0.1));
                      color: #fff; font-size: 0.9rem; font-weight: 700; cursor: pointer;
                      transition: all 0.2s; font-family: inherit; margin-bottom: 1rem; }
    .pr-rewrite-btn:hover { border-color: #00ff88; transform: translateY(-1px); }
    .pr-rewrite-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    /* Loading */
    .pr-loading { text-align: center; padding: 2rem; color: #888; font-size: 0.85rem; }
    .pr-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(0,255,136,0.3);
                  border-top-color: #00ff88; border-radius: 50%; animation: pr-spin 0.6s linear infinite;
                  vertical-align: middle; margin-right: 8px; }
    @keyframes pr-spin { to { transform: rotate(360deg); } }
    .pr-error { color: #ff5555; font-size: 0.8rem; text-align: center; padding: 0.5rem; }
  `;

  var styleInjected = false;
  function injectStyles() {
    if (styleInjected) return;
    var el = document.createElement('style');
    el.textContent = STYLES;
    document.head.appendChild(el);
    styleInjected = true;
  }

  // ── Diff Highlight ──────────────────────────────────────────────────────

  function highlightDiff(before, after) {
    if (!before || !after) return escHtml(after || '');

    var beforeWords = before.split(/\s+/);
    var afterWords = after.split(/\s+/);
    var beforeSet = new Set(beforeWords.map(function (w) { return w.toLowerCase().replace(/[^a-z0-9]/g, ''); }));

    var html = afterWords.map(function (word) {
      var clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean && !beforeSet.has(clean)) {
        return '<span class="pr-added">' + escHtml(word) + '</span>';
      }
      return escHtml(word);
    }).join(' ');

    return html;
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  var state = { selectedTitle: 0, result: null, profileData: null };

  function renderProfileRewriter(profileData, container) {
    injectStyles();
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return;

    state.profileData = profileData;
    container.innerHTML = '';

    // Section header
    var header = document.createElement('div');
    header.className = 'pr-section';
    header.innerHTML =
      '<div class="pr-title">✍️ Profile Rewriter</div>' +
      '<div class="pr-subtitle">AI-powered title & description optimization for maximum Upwork visibility</div>';

    // Rewrite button
    var rewriteBtn = document.createElement('button');
    rewriteBtn.className = 'pr-rewrite-btn';
    rewriteBtn.innerHTML = '🚀 Rewrite My Profile with AI';
    rewriteBtn.onclick = function () { fetchRewrite(profileData, container, header); };
    header.appendChild(rewriteBtn);

    // Result container
    var resultDiv = document.createElement('div');
    resultDiv.id = 'pr-result';
    header.appendChild(resultDiv);

    container.appendChild(header);

    // If we already have a cached result, show it
    if (state.result) {
      renderResult(state.result, profileData, resultDiv);
    }
  }

  function fetchRewrite(profileData, container, header) {
    var resultDiv = document.getElementById('pr-result');
    if (!resultDiv) return;

    var btn = header.querySelector('.pr-rewrite-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="pr-spinner"></span>Rewriting…'; }

    resultDiv.innerHTML = '<div class="pr-loading"><span class="pr-spinner"></span>Analyzing your profile and generating optimized versions…</div>';

    var payload = {
      currentTitle: profileData.title || '',
      currentDescription: profileData.description || '',
      skills: profileData.skills || [],
      rate: profileData.hourlyRate || profileData.rate || null,
      jss: profileData.jobSuccess || profileData.jss || null,
      earnings: profileData.totalEarnings || profileData.earnings || null
    };

    fetch('/api/rewrite-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed (' + r.status + ')');
        return r.json();
      })
      .then(function (data) {
        state.result = data;
        state.selectedTitle = 0;
        renderResult(data, profileData, resultDiv);
        if (btn) { btn.innerHTML = '🔄 Rewrite Again'; btn.disabled = false; }
      })
      .catch(function (err) {
        resultDiv.innerHTML = '<div class="pr-error">⚠️ ' + escHtml(err.message) + '. Try again.</div>';
        if (btn) { btn.innerHTML = '🚀 Rewrite My Profile with AI'; btn.disabled = false; }
      });
  }

  function renderResult(data, profileData, container) {
    container.innerHTML = '';

    // ── SEO Score Meter ──
    var scoreHtml =
      '<div class="pr-score-section">' +
        '<div class="pr-score-row">' +
          '<span class="pr-score-label">Before</span>' +
          '<div class="pr-score-bar"><div class="pr-score-fill pr-score-fill-before" style="width:' + data.seoScore.before + '%"></div></div>' +
          '<span class="pr-score-value pr-score-value-before">' + data.seoScore.before + '</span>' +
        '</div>' +
        '<div class="pr-score-row">' +
          '<span class="pr-score-label">After</span>' +
          '<div class="pr-score-bar"><div class="pr-score-fill pr-score-fill-after" style="width:' + data.seoScore.after + '%"></div></div>' +
          '<span class="pr-score-value pr-score-value-after">' + data.seoScore.after + '</span>' +
        '</div>' +
        '<div class="pr-score-delta">+' + (data.seoScore.after - data.seoScore.before) + ' SEO points improvement</div>' +
      '</div>';
    container.insertAdjacentHTML('beforeend', scoreHtml);

    // ── Title Pills ──
    var pillsHtml = '<div class="pr-pills-label">Choose optimized title</div><div class="pr-pills">';
    data.titles.forEach(function (t, i) {
      pillsHtml += '<button class="pr-pill' + (i === state.selectedTitle ? ' active' : '') + '" data-idx="' + i + '">' + escHtml(t) + '</button>';
    });
    pillsHtml += '</div>';
    container.insertAdjacentHTML('beforeend', pillsHtml);

    // Pill click handler
    container.querySelectorAll('.pr-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        state.selectedTitle = parseInt(this.getAttribute('data-idx'));
        container.querySelectorAll('.pr-pill').forEach(function (p) { p.classList.remove('active'); });
        this.classList.add('active');
        // Update after card title
        var afterTitle = container.querySelector('.pr-after-title');
        if (afterTitle) afterTitle.textContent = data.titles[state.selectedTitle];
      });
    });

    // ── Before → After Comparison ──
    var selectedTitle = data.titles[state.selectedTitle];
    var compHtml =
      '<div class="pr-comparison">' +
        '<div class="pr-card">' +
          '<div class="pr-card-label pr-card-label-before">Before</div>' +
          '<div class="pr-card-title">' + escHtml(profileData.title || 'No title set') + '</div>' +
          '<div class="pr-card-desc">' + escHtml(truncate(profileData.description || 'No description', 300)) + '</div>' +
        '</div>' +
        '<div class="pr-arrow">→</div>' +
        '<div class="pr-card">' +
          '<div class="pr-card-label pr-card-label-after">After ✨</div>' +
          '<div class="pr-card-title pr-after-title">' + escHtml(selectedTitle) + '</div>' +
          '<div class="pr-card-desc">' + highlightDiff(profileData.description || '', data.description) + '</div>' +
        '</div>' +
      '</div>';
    container.insertAdjacentHTML('beforeend', compHtml);

    // ── Changes List ──
    if (data.changes && data.changes.length) {
      var changesHtml = '<div class="pr-changes"><div class="pr-changes-title">What changed</div>';
      data.changes.forEach(function (c) {
        changesHtml += '<div class="pr-change-item"><span class="pr-change-bullet">✦</span>' + escHtml(c) + '</div>';
      });
      changesHtml += '</div>';
      container.insertAdjacentHTML('beforeend', changesHtml);
    }

    // ── Copy Buttons ──
    var actionsHtml =
      '<div class="pr-actions">' +
        '<button class="pr-btn pr-btn-primary" id="pr-copy-title">' +
          '<span class="pr-default">📋 Copy Optimized Title</span>' +
          '<span class="pr-copied">✅ Copied!</span>' +
        '</button>' +
        '<button class="pr-btn pr-btn-primary" id="pr-copy-desc">' +
          '<span class="pr-default">📋 Copy Optimized Description</span>' +
          '<span class="pr-copied">✅ Copied!</span>' +
        '</button>' +
      '</div>';
    container.insertAdjacentHTML('beforeend', actionsHtml);

    // Copy handlers
    document.getElementById('pr-copy-title').addEventListener('click', function () {
      copyToClipboard(data.titles[state.selectedTitle], this);
    });
    document.getElementById('pr-copy-desc').addEventListener('click', function () {
      copyToClipboard(data.description, this);
    });
  }

  function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  function copyToClipboard(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flashCopied(btn); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      flashCopied(btn);
    }
  }

  function flashCopied(btn) {
    btn.classList.add('copied');
    setTimeout(function () { btn.classList.remove('copied'); }, 2000);
  }

  // ── Expose ──────────────────────────────────────────────────────────────

  window.CortexProfileRewriter = {
    renderProfileRewriter: renderProfileRewriter
  };
})();
