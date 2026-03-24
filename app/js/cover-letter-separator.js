/**
 * Cortex Freelancer — Cover Letter vs Proposal Separator [CF-036]
 *
 * Splits a proposal into a cover-letter section (personal touch, greeting,
 * enthusiasm) and a technical-approach section (skills, methodology, timeline).
 * Supports auto-detection, manual adjustment, independent editing, merging,
 * section templates, and validation.
 */
window.CortexFreelancer = window.CortexFreelancer || {};
window.CortexFreelancer.CoverLetterSeparator = (function () {
  'use strict';

  var STORAGE_KEY = 'cortex_cover_letter_sections';
  var CSS_INJECTED = false;
  var _containerEl = null;

  // ── Section detection patterns ───────────────────────────────────────

  var TECHNICAL_TRIGGERS = [
    /\b(technical approach|my approach|methodology|how i would|here(?:'|')?s how|my plan|project plan)\b/i,
    /\b(deliverables|milestones|timeline|phases?|step\s*\d|stack|tools? i(?:'|')?ll use)\b/i,
    /\b(implementation|architecture|tech stack|solution overview)\b/i
  ];

  var COVER_LETTER_SIGNALS = [
    /\b(hi|hello|dear|greetings)\b/i,
    /\b(excited|thrilled|passionate|love|interest(?:ed|ing))\b/i,
    /\b(i(?:'|')?m a|my name is|about me|i have \d+ years)\b/i,
    /\b(thank you|thanks for|looking forward)\b/i
  ];

  // ── Templates ────────────────────────────────────────────────────────

  var TEMPLATES = {
    coverLetter: {
      greeting: 'Hi [Client Name],',
      body: [
        'I came across your project and am excited about the opportunity to contribute.',
        'With [X] years of experience in [relevant field], I have a strong track record of delivering [type of work].',
        'What drew me to this project is [specific reason].'
      ].join('\n\n'),
      closing: 'I would love to discuss how I can help bring your vision to life.'
    },
    technical: {
      header: 'Technical Approach',
      body: [
        '**Understanding:** [Restate the problem in your own words]',
        '',
        '**Proposed Solution:**',
        '1. [Phase 1 description]',
        '2. [Phase 2 description]',
        '3. [Phase 3 description]',
        '',
        '**Timeline:** [Estimated duration]',
        '',
        '**Deliverables:**',
        '- [Deliverable 1]',
        '- [Deliverable 2]'
      ].join('\n')
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  /**
   * Score a paragraph for how "technical" it reads.
   */
  function technicalScore(paragraph) {
    var score = 0;
    TECHNICAL_TRIGGERS.forEach(function (rx) {
      if (rx.test(paragraph)) score += 2;
    });
    // Bullet / numbered lists boost technical score
    if (/^\s*[-*•]\s/m.test(paragraph)) score += 1;
    if (/^\s*\d+[.)]\s/m.test(paragraph)) score += 1;
    return score;
  }

  function coverLetterScore(paragraph) {
    var score = 0;
    COVER_LETTER_SIGNALS.forEach(function (rx) {
      if (rx.test(paragraph)) score += 2;
    });
    return score;
  }

  // ── Core: auto-detect split point ────────────────────────────────────

  /**
   * Auto-split proposal text into cover letter and technical sections.
   *
   * Strategy: walk paragraphs top-down. Once cumulative technical score
   * exceeds cover-letter score, the remaining text is technical.
   *
   * @param {string} text - Full proposal text.
   * @returns {{ coverLetter: string, technical: string, splitIndex: number }}
   */
  function autoSplit(text) {
    if (!text || !text.trim()) {
      return { coverLetter: '', technical: '', splitIndex: -1 };
    }

    var paragraphs = text.split(/\n\s*\n/).filter(function (p) { return p.trim().length > 0; });

    if (paragraphs.length <= 1) {
      return { coverLetter: text.trim(), technical: '', splitIndex: -1 };
    }

    var bestSplit = -1;
    var bestDelta = -Infinity;

    for (var i = 1; i < paragraphs.length; i++) {
      var techSum = 0;
      var coverSum = 0;

      // Before split = cover letter
      for (var c = 0; c < i; c++) coverSum += coverLetterScore(paragraphs[c]);
      // After split = technical
      for (var t = i; t < paragraphs.length; t++) techSum += technicalScore(paragraphs[t]);

      var delta = techSum + coverSum;
      if (delta > bestDelta) {
        bestDelta = delta;
        bestSplit = i;
      }
    }

    if (bestSplit <= 0) bestSplit = Math.ceil(paragraphs.length / 2);

    var coverParagraphs = paragraphs.slice(0, bestSplit);
    var techParagraphs = paragraphs.slice(bestSplit);

    return {
      coverLetter: coverParagraphs.join('\n\n'),
      technical: techParagraphs.join('\n\n'),
      splitIndex: bestSplit
    };
  }

  /**
   * Manually split at a specific paragraph index.
   */
  function manualSplit(text, splitAtParagraph) {
    var paragraphs = (text || '').split(/\n\s*\n/).filter(function (p) { return p.trim().length > 0; });
    var idx = Math.max(0, Math.min(splitAtParagraph, paragraphs.length));
    return {
      coverLetter: paragraphs.slice(0, idx).join('\n\n'),
      technical: paragraphs.slice(idx).join('\n\n'),
      splitIndex: idx
    };
  }

  // ── Merge ────────────────────────────────────────────────────────────

  /**
   * Merge cover letter and technical sections into a single proposal.
   *
   * @param {string} coverLetter
   * @param {string} technical
   * @param {Object} [options]
   * @param {string} [options.separator] - Text between sections (default: blank line).
   * @param {string} [options.transition] - Transition sentence inserted between sections.
   * @returns {string} Merged proposal.
   */
  function merge(coverLetter, technical, options) {
    var opts = options || {};
    var parts = [];
    if (coverLetter && coverLetter.trim()) parts.push(coverLetter.trim());
    if (opts.transition) parts.push(opts.transition);
    if (technical && technical.trim()) parts.push(technical.trim());
    var sep = opts.separator !== undefined ? opts.separator : '\n\n';
    return parts.join(sep);
  }

  // ── Validation ───────────────────────────────────────────────────────

  function validateCoverLetter(text) {
    var issues = [];
    if (!text || !text.trim()) {
      issues.push('Cover letter section is empty.');
      return { valid: false, issues: issues };
    }
    var hasGreeting = /\b(hi|hello|dear|greetings)\b/i.test(text);
    if (!hasGreeting) issues.push('Consider adding a greeting (e.g., "Hi [Client Name]").');

    var hasPersonalTouch = /\b(I|my|me)\b/i.test(text);
    if (!hasPersonalTouch) issues.push('Add a personal touch — mention your background or enthusiasm.');

    return { valid: issues.length === 0, issues: issues };
  }

  function validateTechnical(text) {
    var issues = [];
    if (!text || !text.trim()) {
      issues.push('Technical approach section is empty.');
      return { valid: false, issues: issues };
    }
    var hasSpecifics = /\b(step|phase|deliver|timeline|milestone|approach|implement)\b/i.test(text);
    if (!hasSpecifics) issues.push('Include specifics such as steps, deliverables, or a timeline.');

    var hasList = /^\s*[-*•\d]/m.test(text);
    if (!hasList) issues.push('Consider using a bulleted or numbered list for clarity.');

    return { valid: issues.length === 0, issues: issues };
  }

  // ── Persistence ──────────────────────────────────────────────────────

  function saveSections(proposalId, coverLetter, technical) {
    var store = loadStore();
    store[proposalId] = {
      coverLetter: coverLetter,
      technical: technical,
      updatedAt: new Date().toISOString()
    };
    saveStore(store);
    return store[proposalId];
  }

  function loadSections(proposalId) {
    var store = loadStore();
    return store[proposalId] || null;
  }

  function deleteSections(proposalId) {
    var store = loadStore();
    if (!store[proposalId]) return false;
    delete store[proposalId];
    saveStore(store);
    return true;
  }

  // ── HTML escape helper ──────────────────────────────────────────────

  function _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── CSS injection ─────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      /* Panel */
      '.cls-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;color:#e0e0e0;padding:20px}',
      '.cls-title{font-size:18px;font-weight:700;color:#e0e0e0;margin-bottom:16px}',

      /* Full-text input area */
      '.cls-full-input{width:100%;min-height:120px;background:#0a0a0a;color:#e0e0e0;border:1px solid #1e1e1e;border-radius:8px;padding:12px;font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box}',
      '.cls-full-input:focus{outline:none;border-color:#00ff88}',

      /* Buttons */
      '.cls-btn{border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}',
      '.cls-btn-primary{background:#00ff88;color:#0a0a0a}',
      '.cls-btn-primary:hover{background:#00e07a}',
      '.cls-btn-secondary{background:#222;color:#aaa;border:1px solid #333}',
      '.cls-btn-secondary:hover{background:#2a2a2a;color:#fff}',
      '.cls-btn-save{background:#7c3aed;color:#fff}',
      '.cls-btn-save:hover{background:#6d28d9}',

      /* Button row */
      '.cls-btn-row{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap}',

      /* Split panes container */
      '.cls-split{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}',
      '@media(max-width:700px){.cls-split{grid-template-columns:1fr}}',

      /* Individual pane */
      '.cls-pane{background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:8px}',
      '.cls-pane-label{font-size:13px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.5px}',
      '.cls-pane-textarea{width:100%;min-height:180px;background:#111;color:#e0e0e0;border:1px solid #222;border-radius:6px;padding:10px;font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box}',
      '.cls-pane-textarea:focus{outline:none;border-color:#00ff88}',

      /* Validation indicator */
      '.cls-validation{font-size:12px;min-height:18px;line-height:1.4}',
      '.cls-validation-ok{color:#00ff88}',
      '.cls-validation-warn{color:#f59e0b}',

      /* Preview area */
      '.cls-preview-wrap{margin-top:16px;display:none}',
      '.cls-preview-wrap.cls-visible{display:block}',
      '.cls-preview-label{font-size:13px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}',
      '.cls-preview{background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px;font-size:13px;color:#ccc;white-space:pre-wrap;word-wrap:break-word;max-height:300px;overflow-y:auto;line-height:1.6}',

      /* Status toast */
      '.cls-toast{font-size:12px;color:#00ff88;margin-left:8px;opacity:0;transition:opacity .3s}',
      '.cls-toast.cls-visible{opacity:1}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Render ────────────────────────────────────────────────────────

  function _buildValidationHtml(result) {
    if (result.valid) {
      return '<span class="cls-validation cls-validation-ok">&#10003; Looks good</span>';
    }
    var msgs = result.issues.map(function (m) { return _escapeHtml(m); }).join('<br>');
    return '<span class="cls-validation cls-validation-warn">&#9888; ' + msgs + '</span>';
  }

  function _renderContent() {
    if (!_containerEl) return;

    var h = '<div class="cls-panel">';
    h += '<div class="cls-title">Cover Letter &amp; Technical Approach Separator</div>';

    /* Full proposal input */
    h += '<label class="cls-pane-label" for="cls-full-text">Paste Full Proposal</label>';
    h += '<textarea class="cls-full-input" id="cls-full-text" placeholder="Paste your full proposal text here..."></textarea>';

    /* Action row */
    h += '<div class="cls-btn-row">';
    h += '<button class="cls-btn cls-btn-primary" data-cls-action="auto-split">Auto-Split</button>';
    h += '<button class="cls-btn cls-btn-secondary" data-cls-action="load-cover-tpl">Load Cover Letter Template</button>';
    h += '<button class="cls-btn cls-btn-secondary" data-cls-action="load-tech-tpl">Load Technical Template</button>';
    h += '</div>';

    /* Split panes */
    h += '<div class="cls-split">';

    /* Left — Cover Letter */
    h += '<div class="cls-pane">';
    h += '<span class="cls-pane-label">Cover Letter</span>';
    h += '<textarea class="cls-pane-textarea" id="cls-cover-letter" placeholder="Cover letter section..."></textarea>';
    h += '<div id="cls-cover-validation"></div>';
    h += '</div>';

    /* Right — Technical Approach */
    h += '<div class="cls-pane">';
    h += '<span class="cls-pane-label">Technical Approach</span>';
    h += '<textarea class="cls-pane-textarea" id="cls-technical" placeholder="Technical approach section..."></textarea>';
    h += '<div id="cls-tech-validation"></div>';
    h += '</div>';

    h += '</div>'; /* .cls-split */

    /* Bottom action row */
    h += '<div class="cls-btn-row">';
    h += '<button class="cls-btn cls-btn-primary" data-cls-action="merge-preview">Merge &amp; Preview</button>';
    h += '<button class="cls-btn cls-btn-save" data-cls-action="save">Save</button>';
    h += '<span class="cls-toast" id="cls-toast"></span>';
    h += '</div>';

    /* Preview area */
    h += '<div class="cls-preview-wrap" id="cls-preview-wrap">';
    h += '<span class="cls-preview-label">Merged Preview</span>';
    h += '<div class="cls-preview" id="cls-preview-content"></div>';
    h += '</div>';

    h += '</div>'; /* .cls-panel */

    _containerEl.innerHTML = h;

    /* Attach events via delegation */
    _containerEl.addEventListener('click', _handleClick);
    _containerEl.addEventListener('input', _handleInput);
  }

  function _handleClick(e) {
    var btn = e.target.closest('[data-cls-action]');
    if (!btn) return;

    var action = btn.getAttribute('data-cls-action');

    if (action === 'auto-split') {
      var fullText = document.getElementById('cls-full-text');
      if (!fullText) return;
      var result = autoSplit(fullText.value);
      var coverEl = document.getElementById('cls-cover-letter');
      var techEl = document.getElementById('cls-technical');
      if (coverEl) coverEl.value = result.coverLetter;
      if (techEl) techEl.value = result.technical;
      _updateValidation();
      return;
    }

    if (action === 'load-cover-tpl') {
      var tpls = JSON.parse(JSON.stringify(TEMPLATES));
      var coverEl = document.getElementById('cls-cover-letter');
      if (coverEl) {
        coverEl.value = tpls.coverLetter.greeting + '\n\n' + tpls.coverLetter.body + '\n\n' + tpls.coverLetter.closing;
      }
      _updateValidation();
      return;
    }

    if (action === 'load-tech-tpl') {
      var tpls = JSON.parse(JSON.stringify(TEMPLATES));
      var techEl = document.getElementById('cls-technical');
      if (techEl) {
        techEl.value = tpls.technical.header + '\n\n' + tpls.technical.body;
      }
      _updateValidation();
      return;
    }

    if (action === 'merge-preview') {
      var coverVal = (document.getElementById('cls-cover-letter') || {}).value || '';
      var techVal = (document.getElementById('cls-technical') || {}).value || '';
      var merged = merge(coverVal, techVal);
      var previewWrap = document.getElementById('cls-preview-wrap');
      var previewContent = document.getElementById('cls-preview-content');
      if (previewContent) previewContent.textContent = merged;
      if (previewWrap) previewWrap.classList.add('cls-visible');
      return;
    }

    if (action === 'save') {
      var coverVal = (document.getElementById('cls-cover-letter') || {}).value || '';
      var techVal = (document.getElementById('cls-technical') || {}).value || '';
      var proposalId = 'cls_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
      saveSections(proposalId, coverVal, techVal);
      _showToast('Saved (' + proposalId + ')');
      return;
    }
  }

  function _handleInput(e) {
    var target = e.target;
    if (target && (target.id === 'cls-cover-letter' || target.id === 'cls-technical')) {
      _updateValidation();
    }
  }

  function _updateValidation() {
    var coverEl = document.getElementById('cls-cover-letter');
    var techEl = document.getElementById('cls-technical');
    var coverValEl = document.getElementById('cls-cover-validation');
    var techValEl = document.getElementById('cls-tech-validation');

    if (coverEl && coverValEl) {
      coverValEl.innerHTML = _buildValidationHtml(validateCoverLetter(coverEl.value));
    }
    if (techEl && techValEl) {
      techValEl.innerHTML = _buildValidationHtml(validateTechnical(techEl.value));
    }
  }

  function _showToast(msg) {
    var toast = document.getElementById('cls-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('cls-visible');
    setTimeout(function () { toast.classList.remove('cls-visible'); }, 2500);
  }

  /**
   * Render the split-pane editor UI into a container.
   * @param {HTMLElement|string} container - DOM element or element ID.
   */
  function render(container) {
    _injectCSS();
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    _containerEl = el;
    _renderContent();
  }

  /**
   * Destroy the rendered UI and release event listeners.
   */
  function destroy() {
    if (_containerEl) {
      _containerEl.removeEventListener('click', _handleClick);
      _containerEl.removeEventListener('input', _handleInput);
      _containerEl.innerHTML = '';
      _containerEl = null;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────

  return {
    autoSplit: autoSplit,
    manualSplit: manualSplit,
    merge: merge,
    validateCoverLetter: validateCoverLetter,
    validateTechnical: validateTechnical,
    saveSections: saveSections,
    loadSections: loadSections,
    deleteSections: deleteSections,
    getTemplates: function () {
      return JSON.parse(JSON.stringify(TEMPLATES));
    },
    render: render,
    destroy: destroy
  };
})();
