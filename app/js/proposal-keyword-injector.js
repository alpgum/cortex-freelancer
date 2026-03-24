/**
 * Cortex Freelancer — Proposal Keyword Injector [CF-037]
 *
 * Extracts important keywords from a job description, compares them against
 * proposal text, scores keyword coverage, and suggests where to place
 * missing keywords for better matching.
 */
window.CortexFreelancer = window.CortexFreelancer || {};
window.CortexFreelancer.ProposalKeywordInjector = (function () {
  'use strict';

  // ── Stop words (common English words to ignore) ──────────────────────
  var STOP_WORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','are','was','were','be','been','being','have','has',
    'had','do','does','did','will','would','could','should','may','might',
    'shall','can','need','must','that','this','these','those','it','its',
    'i','me','my','we','our','you','your','he','she','they','them','their',
    'what','which','who','whom','where','when','how','not','no','nor',
    'if','then','than','so','as','up','out','about','into','over','after',
    'also','just','only','very','more','most','some','any','each','all',
    'both','few','many','such','own','same','other','new','one','two',
    'able','get','got','us','am','been','hi','hello','dear','please',
    'thank','thanks','looking','look','like','well','good','great','best',
    'work','working','project','job','experience','years','time'
  ]);

  // Technical terms get a weight boost
  var TECH_BOOST_PATTERNS = [
    /^[A-Z][a-zA-Z]*(?:\.js|\.py|\.ts)?$/,     // PascalCase / filenames
    /^[a-z]+[-_][a-z]+/,                          // kebab-case / snake_case
    /^(?:api|sdk|css|html|sql|aws|gcp|ci|cd)$/i,
    /^(?:react|vue|angular|node|django|flask|rails|spring|docker|kubernetes|graphql|rest|oauth)$/i
  ];

  // ── Tokenization ─────────────────────────────────────────────────────

  function tokenize(text) {
    if (!text) return [];
    return text
      .replace(/[^a-zA-Z0-9#+.\-_/]/g, ' ')
      .split(/\s+/)
      .filter(function (t) { return t.length > 1; });
  }

  function normalize(word) {
    return word.toLowerCase().replace(/[.\-_]/g, '');
  }

  function isStopWord(word) {
    return STOP_WORDS.has(normalize(word));
  }

  function isTechnicalTerm(word) {
    return TECH_BOOST_PATTERNS.some(function (rx) { return rx.test(word); });
  }

  // ── Extract keywords from job description ────────────────────────────

  /**
   * Extract and rank keywords from a job description.
   *
   * @param {string} jobDescription
   * @returns {Array<{ keyword: string, frequency: number, weight: number, isTechnical: boolean }>}
   */
  function extractKeywords(jobDescription) {
    var tokens = tokenize(jobDescription);
    var freq = {};
    var original = {}; // preserve original casing of first occurrence

    tokens.forEach(function (token) {
      if (isStopWord(token)) return;
      var key = normalize(token);
      if (key.length < 2) return;
      freq[key] = (freq[key] || 0) + 1;
      if (!original[key]) original[key] = token;
    });

    // Also extract 2-word phrases (bigrams)
    for (var i = 0; i < tokens.length - 1; i++) {
      if (isStopWord(tokens[i]) || isStopWord(tokens[i + 1])) continue;
      var bigram = normalize(tokens[i]) + ' ' + normalize(tokens[i + 1]);
      if (bigram.length < 5) continue;
      freq[bigram] = (freq[bigram] || 0) + 1;
      if (!original[bigram]) original[bigram] = tokens[i] + ' ' + tokens[i + 1];
    }

    var keywords = Object.keys(freq).map(function (key) {
      var tech = isTechnicalTerm(original[key]);
      var weight = freq[key] + (tech ? 3 : 0);
      return {
        keyword: original[key],
        normalized: key,
        frequency: freq[key],
        weight: weight,
        isTechnical: tech
      };
    });

    keywords.sort(function (a, b) { return b.weight - a.weight; });
    return keywords;
  }

  // ── Compare keywords against proposal ────────────────────────────────

  /**
   * Analyze which job-description keywords appear in the proposal.
   *
   * @param {string} jobDescription
   * @param {string} proposalText
   * @param {Object} [options]
   * @param {number} [options.maxKeywords=30] - Max keywords to consider.
   * @param {string[]} [options.customKeywords] - Extra keywords to include.
   * @param {string[]} [options.excludeKeywords] - Keywords to ignore.
   * @returns {Object} Analysis result.
   */
  function analyze(jobDescription, proposalText, options) {
    var opts = options || {};
    var maxKw = opts.maxKeywords || 30;

    var keywords = extractKeywords(jobDescription).slice(0, maxKw);

    // Apply custom additions
    if (opts.customKeywords && opts.customKeywords.length) {
      opts.customKeywords.forEach(function (kw) {
        var n = normalize(kw);
        var exists = keywords.some(function (k) { return k.normalized === n; });
        if (!exists) {
          keywords.push({
            keyword: kw,
            normalized: n,
            frequency: 0,
            weight: 2,
            isTechnical: isTechnicalTerm(kw)
          });
        }
      });
    }

    // Apply exclusions
    if (opts.excludeKeywords && opts.excludeKeywords.length) {
      var excludeSet = new Set(opts.excludeKeywords.map(normalize));
      keywords = keywords.filter(function (k) { return !excludeSet.has(k.normalized); });
    }

    var proposalLower = (proposalText || '').toLowerCase();
    var matched = [];
    var missing = [];

    keywords.forEach(function (kw) {
      if (proposalLower.indexOf(kw.normalized) !== -1) {
        matched.push(kw);
      } else {
        missing.push(kw);
      }
    });

    var totalWeight = keywords.reduce(function (s, k) { return s + k.weight; }, 0);
    var matchedWeight = matched.reduce(function (s, k) { return s + k.weight; }, 0);
    var score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

    return {
      score: score,
      totalKeywords: keywords.length,
      matched: matched.map(function (k) { return k.keyword; }),
      missing: missing.map(function (k) { return k.keyword; }),
      keywords: keywords
    };
  }

  // ── Suggest placements for missing keywords ──────────────────────────

  /**
   * Suggest where to insert missing keywords in the proposal.
   *
   * @param {string} proposalText
   * @param {string[]} missingKeywords
   * @returns {Array<{ keyword: string, suggestion: string, section: string }>}
   */
  function suggestPlacements(proposalText, missingKeywords) {
    if (!missingKeywords || !missingKeywords.length) return [];

    var paragraphs = (proposalText || '').split(/\n\s*\n/).filter(function (p) { return p.trim(); });
    var hasTechnicalSection = paragraphs.some(function (p) {
      return /\b(approach|technical|deliver|implement|solution)\b/i.test(p);
    });

    return missingKeywords.map(function (kw) {
      var tech = isTechnicalTerm(kw);
      var section, suggestion;

      if (tech) {
        section = 'technical';
        suggestion = 'Mention "' + kw + '" in your technical approach or skills section.';
      } else {
        section = 'introduction';
        suggestion = 'Work "' + kw + '" into your opening or experience summary.';
      }

      if (!hasTechnicalSection && tech) {
        suggestion += ' Consider adding a brief technical approach paragraph.';
      }

      return { keyword: kw, suggestion: suggestion, section: section };
    });
  }

  /**
   * Generate an enriched version of the proposal by appending a skills line
   * for any missing technical keywords.
   *
   * @param {string} proposalText
   * @param {string[]} missingKeywords
   * @returns {string} Enriched proposal text.
   */
  function enrichProposal(proposalText, missingKeywords) {
    if (!missingKeywords || !missingKeywords.length) return proposalText;

    var techMissing = missingKeywords.filter(isTechnicalTerm);
    var otherMissing = missingKeywords.filter(function (k) { return !isTechnicalTerm(k); });

    var additions = [];
    if (techMissing.length) {
      additions.push('Relevant skills: ' + techMissing.join(', ') + '.');
    }
    if (otherMissing.length) {
      additions.push('I also bring expertise in ' + otherMissing.join(', ') + '.');
    }

    return (proposalText || '').trim() + '\n\n' + additions.join(' ');
  }

  // ── UI State ────────────────────────────────────────────────────────

  var CSS_INJECTED = false;
  var _container = null;

  // ── Helpers (UI) ───────────────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ── Render ─────────────────────────────────────────────────────────

  /**
   * Render the keyword analysis UI into the given container.
   *
   * @param {HTMLElement|string} container - DOM element or element ID string.
   */
  function render(container) {
    _injectCSS();

    if (typeof container === 'string') {
      _container = document.getElementById(container);
    } else {
      _container = container;
    }
    if (!_container) return;

    _renderFull();
  }

  /**
   * Build and inject the full keyword analysis UI.
   */
  function _renderFull() {
    if (!_container) return;

    var h = '<div class="pki-panel">';

    // ── Header
    h += '<div class="pki-header">';
    h += '<div class="pki-header-left">';
    h += '<div class="pki-title">Proposal Keyword Injector</div>';
    h += '<div class="pki-subtitle">Analyze keyword coverage and enrich your proposals</div>';
    h += '</div>';
    h += '<span class="pki-badge">CF-037</span>';
    h += '</div>';

    // ── Input area: two textareas side by side
    h += '<div class="pki-input-row">';

    h += '<div class="pki-input-col">';
    h += '<label class="pki-label" for="pki-job-desc">Job Description</label>';
    h += '<textarea id="pki-job-desc" class="pki-textarea" rows="8" placeholder="Paste the job description here..."></textarea>';
    h += '</div>';

    h += '<div class="pki-input-col">';
    h += '<label class="pki-label" for="pki-proposal">Your Proposal</label>';
    h += '<textarea id="pki-proposal" class="pki-textarea" rows="8" placeholder="Paste your proposal text here..."></textarea>';
    h += '</div>';

    h += '</div>';

    // ── Custom keywords input
    h += '<div class="pki-custom-row">';
    h += '<label class="pki-label" for="pki-custom-kw">Custom Keywords <span class="pki-hint">(comma-separated, optional)</span></label>';
    h += '<input id="pki-custom-kw" class="pki-input" type="text" placeholder="e.g. React, GraphQL, microservices" />';
    h += '</div>';

    // ── Action button
    h += '<div class="pki-actions">';
    h += '<button id="pki-analyze-btn" class="pki-btn pki-btn-primary">Analyze Keywords</button>';
    h += '</div>';

    // ── Results section (hidden initially)
    h += '<div id="pki-results" class="pki-results" style="display:none;">';

    // Score ring
    h += '<div class="pki-score-section">';
    h += '<div class="pki-score-ring-wrap">';
    h += '<svg id="pki-score-ring" class="pki-score-ring" viewBox="0 0 120 120">';
    h += '<circle class="pki-ring-bg" cx="60" cy="60" r="52" />';
    h += '<circle id="pki-ring-fg" class="pki-ring-fg" cx="60" cy="60" r="52" />';
    h += '<text id="pki-score-text" class="pki-score-text" x="60" y="60" text-anchor="middle" dominant-baseline="central">0%</text>';
    h += '</svg>';
    h += '</div>';
    h += '<div class="pki-score-label">Keyword Coverage</div>';
    h += '</div>';

    // Matched keywords
    h += '<div class="pki-keyword-group">';
    h += '<div class="pki-group-title pki-group-matched">Matched Keywords</div>';
    h += '<div id="pki-matched" class="pki-badges"></div>';
    h += '</div>';

    // Missing keywords
    h += '<div class="pki-keyword-group">';
    h += '<div class="pki-group-title pki-group-missing">Missing Keywords</div>';
    h += '<div id="pki-missing" class="pki-badges"></div>';
    h += '</div>';

    // Suggested placements
    h += '<div class="pki-keyword-group">';
    h += '<div class="pki-group-title">Suggested Placements</div>';
    h += '<ul id="pki-suggestions" class="pki-suggestions-list"></ul>';
    h += '</div>';

    // Auto-enrich button
    h += '<div class="pki-actions">';
    h += '<button id="pki-enrich-btn" class="pki-btn pki-btn-accent">Auto-Enrich Proposal</button>';
    h += '</div>';

    h += '</div>'; // pki-results
    h += '</div>'; // pki-panel

    _container.innerHTML = h;

    // ── Bind events
    _container.querySelector('#pki-analyze-btn').addEventListener('click', _onAnalyze);
    _container.querySelector('#pki-enrich-btn').addEventListener('click', _onEnrich);
  }

  /**
   * Handle "Analyze Keywords" click.
   */
  function _onAnalyze() {
    var jobDesc = document.getElementById('pki-job-desc').value.trim();
    var proposal = document.getElementById('pki-proposal').value.trim();
    var customRaw = document.getElementById('pki-custom-kw').value.trim();

    if (!jobDesc) {
      _flash('pki-job-desc', 'Please enter a job description.');
      return;
    }
    if (!proposal) {
      _flash('pki-proposal', 'Please enter your proposal.');
      return;
    }

    var customKeywords = [];
    if (customRaw) {
      customKeywords = customRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }

    var result = analyze(jobDesc, proposal, { customKeywords: customKeywords });
    var placements = suggestPlacements(proposal, result.missing);

    _renderResults(result, placements);
  }

  /**
   * Handle "Auto-Enrich Proposal" click.
   */
  function _onEnrich() {
    var proposal = document.getElementById('pki-proposal').value.trim();
    var jobDesc = document.getElementById('pki-job-desc').value.trim();
    var customRaw = document.getElementById('pki-custom-kw').value.trim();

    var customKeywords = [];
    if (customRaw) {
      customKeywords = customRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }

    var result = analyze(jobDesc, proposal, { customKeywords: customKeywords });
    var enriched = enrichProposal(proposal, result.missing);

    document.getElementById('pki-proposal').value = enriched;

    // Re-analyze with the enriched text
    var updatedResult = analyze(jobDesc, enriched, { customKeywords: customKeywords });
    var updatedPlacements = suggestPlacements(enriched, updatedResult.missing);
    _renderResults(updatedResult, updatedPlacements);
  }

  /**
   * Render analysis results into the results section.
   */
  function _renderResults(result, placements) {
    var resultsEl = document.getElementById('pki-results');
    resultsEl.style.display = '';

    // ── Score ring
    var score = result.score;
    var circumference = 2 * Math.PI * 52;
    var offset = circumference - (score / 100) * circumference;
    var ringFg = document.getElementById('pki-ring-fg');
    var scoreText = document.getElementById('pki-score-text');

    var color;
    if (score >= 70) {
      color = '#00ff88';
    } else if (score >= 40) {
      color = '#ffaa00';
    } else {
      color = '#ff4444';
    }

    ringFg.style.stroke = color;
    ringFg.style.strokeDasharray = circumference;
    ringFg.style.strokeDashoffset = offset;
    scoreText.textContent = score + '%';
    scoreText.style.fill = color;

    // ── Matched badges
    var matchedEl = document.getElementById('pki-matched');
    if (result.matched.length) {
      matchedEl.innerHTML = result.matched.map(function (kw) {
        return '<span class="pki-badge-kw pki-badge-matched">' + escapeHtml(kw) + '</span>';
      }).join('');
    } else {
      matchedEl.innerHTML = '<span class="pki-empty">No matched keywords</span>';
    }

    // ── Missing badges
    var missingEl = document.getElementById('pki-missing');
    if (result.missing.length) {
      missingEl.innerHTML = result.missing.map(function (kw) {
        return '<span class="pki-badge-kw pki-badge-missing">' + escapeHtml(kw) + '</span>';
      }).join('');
    } else {
      missingEl.innerHTML = '<span class="pki-empty pki-empty-good">All keywords covered!</span>';
    }

    // ── Suggested placements
    var suggestionsEl = document.getElementById('pki-suggestions');
    if (placements.length) {
      suggestionsEl.innerHTML = placements.map(function (p) {
        var sectionClass = p.section === 'technical' ? 'pki-section-tech' : 'pki-section-intro';
        return '<li class="pki-suggestion-item">'
          + '<span class="pki-suggestion-kw">' + escapeHtml(p.keyword) + '</span>'
          + '<span class="pki-section-tag ' + sectionClass + '">' + escapeHtml(p.section) + '</span>'
          + '<span class="pki-suggestion-text">' + escapeHtml(p.suggestion) + '</span>'
          + '</li>';
      }).join('');
    } else {
      suggestionsEl.innerHTML = '<li class="pki-empty pki-empty-good">No suggestions needed — great coverage!</li>';
    }
  }

  /**
   * Flash a brief error hint on an element.
   */
  function _flash(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add('pki-flash');
    el.setAttribute('placeholder', msg);
    setTimeout(function () {
      el.classList.remove('pki-flash');
    }, 1500);
  }

  // ── Destroy ────────────────────────────────────────────────────────

  /**
   * Tear down the keyword analysis UI and clean up.
   */
  function destroy() {
    if (_container) {
      var analyzeBtn = _container.querySelector('#pki-analyze-btn');
      var enrichBtn = _container.querySelector('#pki-enrich-btn');
      if (analyzeBtn) analyzeBtn.removeEventListener('click', _onAnalyze);
      if (enrichBtn) enrichBtn.removeEventListener('click', _onEnrich);
      _container.innerHTML = '';
    }
    _container = null;
  }

  // ── CSS Injection ──────────────────────────────────────────────────

  /**
   * Inject scoped CSS for the keyword analysis UI.
   * Uses a CSS_INJECTED guard to prevent duplicate injection.
   */
  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      /* Panel */
      '.pki-panel{background:#0a0a0a;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;color:#e0e0e0}',

      /* Header */
      '.pki-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #222;background:#111}',
      '.pki-header-left{display:flex;flex-direction:column;gap:2px}',
      '.pki-title{font-size:16px;font-weight:700;color:#e0e0e0}',
      '.pki-subtitle{font-size:12px;color:#666}',
      '.pki-badge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;white-space:nowrap}',

      /* Input row */
      '.pki-input-row{display:flex;gap:16px;padding:16px 20px;border-bottom:1px solid #222}',
      '.pki-input-col{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.pki-label{font-size:12px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:0.5px}',
      '.pki-hint{font-weight:400;text-transform:none;letter-spacing:0;color:#555;font-size:11px}',
      '.pki-textarea{background:#111;border:1px solid #222;border-radius:8px;padding:10px 12px;color:#e0e0e0;font-size:13px;font-family:inherit;resize:vertical;line-height:1.5;transition:border-color .15s}',
      '.pki-textarea:focus{outline:none;border-color:#7c3aed}',
      '.pki-textarea.pki-flash{border-color:#ff4444;animation:pki-shake .3s}',

      /* Custom keywords input */
      '.pki-custom-row{padding:12px 20px;border-bottom:1px solid #222}',
      '.pki-input{background:#111;border:1px solid #222;border-radius:8px;padding:8px 12px;color:#e0e0e0;font-size:13px;font-family:inherit;width:100%;box-sizing:border-box;transition:border-color .15s}',
      '.pki-input:focus{outline:none;border-color:#7c3aed}',

      /* Actions */
      '.pki-actions{display:flex;gap:10px;padding:12px 20px;justify-content:flex-end}',
      '.pki-btn{border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit}',
      '.pki-btn-primary{background:#7c3aed;color:#fff}',
      '.pki-btn-primary:hover{background:#6d28d9}',
      '.pki-btn-accent{background:rgba(0,255,136,0.12);color:#00ff88;border:1px solid rgba(0,255,136,0.25)}',
      '.pki-btn-accent:hover{background:rgba(0,255,136,0.2)}',

      /* Results */
      '.pki-results{padding:0 20px 20px}',

      /* Score section */
      '.pki-score-section{display:flex;flex-direction:column;align-items:center;padding:20px 0 16px}',
      '.pki-score-ring-wrap{width:120px;height:120px}',
      '.pki-score-ring{width:100%;height:100%}',
      '.pki-ring-bg{fill:none;stroke:#222;stroke-width:8}',
      '.pki-ring-fg{fill:none;stroke:#00ff88;stroke-width:8;stroke-linecap:round;transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset .6s ease,stroke .3s}',
      '.pki-score-text{font-size:24px;font-weight:700;fill:#00ff88}',
      '.pki-score-label{font-size:13px;color:#888;margin-top:8px;font-weight:600}',

      /* Keyword groups */
      '.pki-keyword-group{margin-top:16px}',
      '.pki-group-title{font-size:13px;font-weight:700;margin-bottom:8px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px}',
      '.pki-group-matched{color:#00ff88}',
      '.pki-group-missing{color:#ff6b6b}',

      /* Badges */
      '.pki-badges{display:flex;flex-wrap:wrap;gap:6px}',
      '.pki-badge-kw{display:inline-block;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600}',
      '.pki-badge-matched{background:rgba(0,255,136,0.1);color:#00ff88;border:1px solid rgba(0,255,136,0.25)}',
      '.pki-badge-missing{background:rgba(255,107,107,0.1);color:#ff6b6b;border:1px solid rgba(255,107,107,0.25)}',
      '.pki-empty{font-size:12px;color:#555;font-style:italic}',
      '.pki-empty-good{color:#00ff88}',

      /* Suggestions list */
      '.pki-suggestions-list{list-style:none;padding:0;margin:0}',
      '.pki-suggestion-item{display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #1a1a1a;font-size:13px;color:#ccc;flex-wrap:wrap}',
      '.pki-suggestion-item:last-child{border-bottom:none}',
      '.pki-suggestion-kw{font-weight:700;color:#e0e0e0;min-width:80px}',
      '.pki-section-tag{font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:4px;letter-spacing:0.5px;white-space:nowrap}',
      '.pki-section-tech{background:rgba(124,58,237,0.15);color:#a78bfa}',
      '.pki-section-intro{background:rgba(0,255,136,0.1);color:#00ff88}',
      '.pki-suggestion-text{flex:1;min-width:200px;color:#999}',

      /* Shake animation */
      '@keyframes pki-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}50%{transform:translateX(4px)}75%{transform:translateX(-4px)}}',

      /* Responsive */
      '@media (max-width:640px){',
        '.pki-input-row{flex-direction:column}',
        '.pki-suggestion-item{flex-direction:column;gap:4px}',
        '.pki-suggestion-kw{min-width:auto}',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Public API ───────────────────────────────────────────────────────

  return {
    extractKeywords: extractKeywords,
    analyze: analyze,
    suggestPlacements: suggestPlacements,
    enrichProposal: enrichProposal,
    render: render,
    destroy: destroy
  };
})();
