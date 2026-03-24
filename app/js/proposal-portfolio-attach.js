/**
 * [CF-122] Proposal Writer — Portfolio Auto-Attach Suggestions
 * Suggest relevant portfolio items to reference based on job requirements.
 * Exposed on window.CortexFreelancer.ProposalPortfolioAttach
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_portfolio_items';
  var CSS_INJECTED = false;

  var _config = {
    apiKey: null,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
    apiEndpoint: 'https://api.anthropic.com/v1/messages',
    maxSuggestions: 5,
    minRelevanceScore: 30
  };

  // Skill category mapping for matching
  var SKILL_CATEGORIES = {
    frontend: ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'sass', 'tailwind', 'nextjs', 'gatsby', 'svelte', 'jquery', 'bootstrap', 'responsive', 'ui', 'ux', 'figma'],
    backend: ['node', 'express', 'python', 'django', 'flask', 'ruby', 'rails', 'php', 'laravel', 'java', 'spring', 'go', 'golang', 'rust', 'api', 'rest', 'graphql', 'microservices'],
    mobile: ['ios', 'android', 'react native', 'flutter', 'swift', 'kotlin', 'mobile', 'app'],
    database: ['sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'firebase', 'dynamodb', 'database', 'nosql'],
    devops: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'ci/cd', 'terraform', 'devops', 'linux', 'nginx'],
    design: ['figma', 'sketch', 'photoshop', 'illustrator', 'ui', 'ux', 'design', 'wireframe', 'prototype', 'branding', 'logo'],
    data: ['machine learning', 'ml', 'ai', 'data science', 'analytics', 'pandas', 'tensorflow', 'pytorch', 'nlp'],
    wordpress: ['wordpress', 'wp', 'woocommerce', 'elementor', 'cms', 'shopify', 'webflow'],
    writing: ['copywriting', 'content', 'blog', 'seo', 'technical writing', 'documentation', 'editing']
  };

  // ─── Init ─────────────────────────────────────────────────────────

  function init(config) {
    if (!config) return;
    if (config.apiKey) _config.apiKey = config.apiKey;
    if (config.model) _config.model = config.model;
    if (config.apiEndpoint) _config.apiEndpoint = config.apiEndpoint;
    if (config.maxSuggestions) _config.maxSuggestions = config.maxSuggestions;
    if (config.minRelevanceScore) _config.minRelevanceScore = config.minRelevanceScore;
  }

  // ─── Portfolio Management ─────────────────────────────────────────

  function getPortfolioItems() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function savePortfolioItems(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) { /* ignore */ }
  }

  function addPortfolioItem(item) {
    if (!item || !item.title) return null;
    var items = getPortfolioItems();
    var newItem = {
      id: 'pf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
      title: item.title,
      description: item.description || '',
      url: item.url || '',
      imageUrl: item.imageUrl || '',
      skills: Array.isArray(item.skills) ? item.skills : [],
      category: item.category || '',
      clientName: item.clientName || '',
      completedDate: item.completedDate || '',
      outcome: item.outcome || '',
      createdAt: new Date().toISOString()
    };
    items.push(newItem);
    savePortfolioItems(items);
    return newItem;
  }

  function removePortfolioItem(id) {
    var items = getPortfolioItems();
    var filtered = items.filter(function (item) { return item.id !== id; });
    savePortfolioItems(filtered);
    return filtered;
  }

  function updatePortfolioItem(id, updates) {
    var items = getPortfolioItems();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        for (var key in updates) {
          if (updates.hasOwnProperty(key) && key !== 'id' && key !== 'createdAt') {
            items[i][key] = updates[key];
          }
        }
        items[i].updatedAt = new Date().toISOString();
        break;
      }
    }
    savePortfolioItems(items);
    return items;
  }

  // ─── Job Analysis ─────────────────────────────────────────────────

  function analyzeJobRequirements(jobDescription) {
    if (!jobDescription) return { skills: [], categories: [], keywords: [] };

    var desc = jobDescription.toLowerCase();
    var words = desc.split(/[\s,;.!?()[\]{}]+/).filter(function (w) { return w.length > 2; });
    var detectedSkills = [];
    var detectedCategories = [];

    for (var category in SKILL_CATEGORIES) {
      if (!SKILL_CATEGORIES.hasOwnProperty(category)) continue;
      var catSkills = SKILL_CATEGORIES[category];
      var found = false;
      for (var i = 0; i < catSkills.length; i++) {
        if (desc.indexOf(catSkills[i]) !== -1) {
          detectedSkills.push(catSkills[i]);
          found = true;
        }
      }
      if (found) detectedCategories.push(category);
    }

    // Extract additional keywords (nouns/technical terms)
    var stopWords = { the: 1, and: 1, for: 1, are: 1, but: 1, not: 1, you: 1, all: 1, can: 1, had: 1, her: 1, was: 1, one: 1, our: 1, out: 1, has: 1, have: 1, been: 1, with: 1, this: 1, that: 1, from: 1, they: 1, will: 1, would: 1, there: 1, their: 1, what: 1, about: 1, which: 1, when: 1, make: 1, like: 1, need: 1, looking: 1, work: 1, also: 1 };
    var keywords = [];
    var seen = {};
    for (var j = 0; j < words.length; j++) {
      var w = words[j];
      if (!stopWords[w] && !seen[w] && w.length > 3) {
        keywords.push(w);
        seen[w] = true;
      }
    }

    return {
      skills: detectedSkills,
      categories: detectedCategories,
      keywords: keywords.slice(0, 30)
    };
  }

  // ─── Relevance Scoring ────────────────────────────────────────────

  function scorePortfolioRelevance(portfolioItem, jobAnalysis) {
    var score = 0;
    var reasons = [];
    var itemText = (portfolioItem.title + ' ' + portfolioItem.description + ' ' + portfolioItem.category + ' ' + (portfolioItem.skills || []).join(' ')).toLowerCase();

    // Skill match (highest weight)
    var matchedSkills = [];
    for (var i = 0; i < jobAnalysis.skills.length; i++) {
      if (itemText.indexOf(jobAnalysis.skills[i]) !== -1 ||
          (portfolioItem.skills || []).some(function (s) { return s.toLowerCase().indexOf(jobAnalysis.skills[i]) !== -1; })) {
        matchedSkills.push(jobAnalysis.skills[i]);
        score += 15;
      }
    }
    if (matchedSkills.length > 0) {
      reasons.push('Matches skills: ' + matchedSkills.join(', '));
    }

    // Category match
    for (var j = 0; j < jobAnalysis.categories.length; j++) {
      var cat = jobAnalysis.categories[j];
      if (portfolioItem.category && portfolioItem.category.toLowerCase().indexOf(cat) !== -1) {
        score += 10;
        reasons.push('Category match: ' + cat);
      }
    }

    // Keyword match
    var keywordMatches = 0;
    for (var k = 0; k < jobAnalysis.keywords.length; k++) {
      if (itemText.indexOf(jobAnalysis.keywords[k]) !== -1) {
        keywordMatches++;
      }
    }
    if (keywordMatches > 0) {
      var keywordScore = Math.min(20, keywordMatches * 4);
      score += keywordScore;
      reasons.push(keywordMatches + ' keyword matches');
    }

    // Outcome bonus — having measurable results is always good
    if (portfolioItem.outcome && portfolioItem.outcome.length > 10) {
      score += 5;
      reasons.push('Has measurable outcome');
    }

    // URL bonus — verifiable work
    if (portfolioItem.url) {
      score += 3;
      reasons.push('Has live URL');
    }

    return {
      score: Math.min(100, score),
      reasons: reasons,
      matchedSkills: matchedSkills
    };
  }

  // ─── Suggestion Engine ────────────────────────────────────────────

  function suggestPortfolioItems(jobDescription, options) {
    var opts = options || {};
    var portfolioItems = opts.portfolioItems || getPortfolioItems();
    var maxItems = opts.maxSuggestions || _config.maxSuggestions;
    var minScore = opts.minRelevanceScore || _config.minRelevanceScore;

    if (!jobDescription || portfolioItems.length === 0) {
      return Promise.resolve({ suggestions: [], jobAnalysis: analyzeJobRequirements(jobDescription), totalPortfolioItems: portfolioItems.length });
    }

    if (_config.apiKey && portfolioItems.length > 0) {
      return _suggestViaAPI(jobDescription, portfolioItems, maxItems).catch(function () {
        return _suggestLocal(jobDescription, portfolioItems, maxItems, minScore);
      });
    }

    return Promise.resolve(_suggestLocal(jobDescription, portfolioItems, maxItems, minScore));
  }

  function _suggestLocal(jobDescription, portfolioItems, maxItems, minScore) {
    var jobAnalysis = analyzeJobRequirements(jobDescription);
    var scored = [];

    for (var i = 0; i < portfolioItems.length; i++) {
      var relevance = scorePortfolioRelevance(portfolioItems[i], jobAnalysis);
      if (relevance.score >= minScore) {
        scored.push({
          item: portfolioItems[i],
          relevance: relevance
        });
      }
    }

    scored.sort(function (a, b) { return b.relevance.score - a.relevance.score; });
    var suggestions = scored.slice(0, maxItems);

    return {
      suggestions: suggestions,
      jobAnalysis: jobAnalysis,
      totalPortfolioItems: portfolioItems.length,
      source: 'local'
    };
  }

  function _suggestViaAPI(jobDescription, portfolioItems, maxItems) {
    var portfolioSummary = portfolioItems.map(function (item, idx) {
      return (idx + 1) + '. "' + item.title + '" - ' + (item.description || 'No description').substring(0, 100) +
        ' [Skills: ' + (item.skills || []).join(', ') + ']' +
        (item.outcome ? ' [Outcome: ' + item.outcome.substring(0, 60) + ']' : '');
    }).join('\n');

    var systemPrompt = 'You are a freelance proposal strategist. Given a job description and portfolio items, ' +
      'select the most relevant portfolio items and explain why they should be referenced in the proposal. ' +
      'Return JSON: { "suggestions": [{ "index": <1-based>, "reason": "<why relevant>", "howToReference": "<suggestion for mentioning in proposal>" }] }. ' +
      'Select up to ' + maxItems + ' items, ranked by relevance.';

    return fetch(_config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: _config.model,
        max_tokens: _config.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'JOB DESCRIPTION:\n' + jobDescription + '\n\nPORTFOLIO ITEMS:\n' + portfolioSummary }]
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('API failed');
      return res.json();
    })
    .then(function (data) {
      var text = data.content && data.content[0] && data.content[0].text;
      if (!text) throw new Error('Empty');
      var jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Parse error');
      var parsed = JSON.parse(jsonMatch[0]);
      var suggestions = (parsed.suggestions || []).map(function (s) {
        var idx = (s.index || 1) - 1;
        if (idx < 0 || idx >= portfolioItems.length) return null;
        return {
          item: portfolioItems[idx],
          relevance: { score: 80, reasons: [s.reason], matchedSkills: [] },
          howToReference: s.howToReference || ''
        };
      }).filter(Boolean);

      return {
        suggestions: suggestions,
        jobAnalysis: analyzeJobRequirements(jobDescription),
        totalPortfolioItems: portfolioItems.length,
        source: 'ai'
      };
    });
  }

  // ─── Generate Reference Text ──────────────────────────────────────

  function generateReferenceText(suggestion, options) {
    var opts = options || {};
    var item = suggestion.item || suggestion;
    var style = opts.style || 'inline'; // 'inline', 'bullet', 'detailed'

    if (style === 'bullet') {
      var bullet = '- **' + item.title + '**';
      if (item.description) bullet += ': ' + item.description.substring(0, 80);
      if (item.outcome) bullet += ' (' + item.outcome + ')';
      if (item.url) bullet += ' [View](' + item.url + ')';
      return bullet;
    }

    if (style === 'detailed') {
      var detailed = 'In a similar project, "' + item.title + '", ';
      if (item.description) detailed += item.description.substring(0, 120) + '. ';
      if (item.outcome) detailed += 'The result: ' + item.outcome + '. ';
      if (item.url) detailed += 'You can see it live at ' + item.url + '.';
      return detailed;
    }

    // inline
    var text = 'I recently completed "' + item.title + '"';
    if (item.outcome) text += ' achieving ' + item.outcome;
    if (item.url) text += ' (' + item.url + ')';
    return text + '.';
  }

  // ─── Render: Suggestions Panel ────────────────────────────────────

  function renderSuggestions(containerId, jobDescription, options) {
    _injectCSS();
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div class="ppa-panel"><div class="ppa-loading">Analyzing portfolio relevance...</div></div>';

    suggestPortfolioItems(jobDescription, opts).then(function (result) {
      _renderSuggestionsResult(container, result, opts);
    });
  }

  function _renderSuggestionsResult(container, result, opts) {
    var onAttach = opts.onAttach || function () {};

    var h = '<div class="ppa-panel">';
    h += '<div class="ppa-header">';
    h += '<h3 class="ppa-title">Portfolio Suggestions</h3>';
    h += '<span class="ppa-count">' + result.suggestions.length + ' of ' + result.totalPortfolioItems + ' items match</span>';
    h += '</div>';

    if (result.suggestions.length === 0) {
      h += '<div class="ppa-empty">';
      if (result.totalPortfolioItems === 0) {
        h += '<p>No portfolio items saved yet. Add some to get suggestions.</p>';
      } else {
        h += '<p>No strong matches found. Try adding portfolio items with more detailed descriptions and skills.</p>';
      }
      h += '</div>';
    } else {
      h += '<div class="ppa-suggestions">';
      for (var i = 0; i < result.suggestions.length; i++) {
        var sg = result.suggestions[i];
        var item = sg.item;
        var rel = sg.relevance;

        h += '<div class="ppa-suggestion" data-index="' + i + '">';
        h += '<div class="ppa-suggestion-header">';
        h += '<div class="ppa-suggestion-title">' + _escapeHtml(item.title) + '</div>';
        h += '<div class="ppa-score-badge" style="background:' + _scoreColor(rel.score) + '20;color:' + _scoreColor(rel.score) + '">' + rel.score + '%</div>';
        h += '</div>';

        if (item.description) {
          h += '<div class="ppa-suggestion-desc">' + _escapeHtml(item.description.substring(0, 120)) + '</div>';
        }

        if (rel.matchedSkills && rel.matchedSkills.length > 0) {
          h += '<div class="ppa-skills">';
          for (var j = 0; j < rel.matchedSkills.length; j++) {
            h += '<span class="ppa-skill-tag">' + _escapeHtml(rel.matchedSkills[j]) + '</span>';
          }
          h += '</div>';
        }

        if (rel.reasons && rel.reasons.length > 0) {
          h += '<div class="ppa-reasons">' + _escapeHtml(rel.reasons[0]) + '</div>';
        }

        if (sg.howToReference) {
          h += '<div class="ppa-how-to">' + _escapeHtml(sg.howToReference) + '</div>';
        }

        h += '<div class="ppa-suggestion-actions">';
        h += '<button class="ppa-btn ppa-btn-attach" data-index="' + i + '">Attach to Proposal</button>';
        if (item.url) {
          h += '<a class="ppa-btn ppa-btn-view" href="' + _escapeHtml(item.url) + '" target="_blank" rel="noopener">View Project</a>';
        }
        h += '</div>';
        h += '</div>';
      }
      h += '</div>';
    }

    // Job analysis summary
    if (result.jobAnalysis && result.jobAnalysis.skills.length > 0) {
      h += '<div class="ppa-analysis">';
      h += '<div class="ppa-analysis-label">Detected Requirements</div>';
      h += '<div class="ppa-skills">';
      for (var k = 0; k < result.jobAnalysis.skills.length; k++) {
        h += '<span class="ppa-skill-tag ppa-skill-detected">' + _escapeHtml(result.jobAnalysis.skills[k]) + '</span>';
      }
      h += '</div></div>';
    }

    h += '</div>';
    container.innerHTML = h;

    // Bind attach buttons
    var attachBtns = container.querySelectorAll('.ppa-btn-attach');
    for (var m = 0; m < attachBtns.length; m++) {
      attachBtns[m].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-index'), 10);
        var suggestion = result.suggestions[idx];
        if (suggestion) {
          var refText = generateReferenceText(suggestion);
          onAttach(suggestion, refText);
          this.textContent = 'Attached!';
          this.disabled = true;
          var btn = this;
          setTimeout(function () { btn.textContent = 'Attach to Proposal'; btn.disabled = false; }, 2000);
        }
      });
    }
  }

  // ─── Render: Portfolio Manager ────────────────────────────────────

  function renderPortfolioManager(containerId, options) {
    _injectCSS();
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    function refresh() { _renderPortfolioList(container, opts); }
    _renderPortfolioList(container, opts);
  }

  function _renderPortfolioList(container, opts) {
    var items = getPortfolioItems();

    var h = '<div class="ppa-panel">';
    h += '<div class="ppa-header">';
    h += '<h3 class="ppa-title">Portfolio Items</h3>';
    h += '<button class="ppa-btn ppa-btn-add" id="ppa-add-btn">+ Add Item</button>';
    h += '</div>';

    // Add form (hidden by default)
    h += '<div class="ppa-add-form" id="ppa-add-form" style="display:none;">';
    h += '<div class="ppa-form-field"><label class="ppa-form-label">Title *</label><input class="ppa-form-input" id="ppa-f-title" placeholder="Project title"></div>';
    h += '<div class="ppa-form-field"><label class="ppa-form-label">Description</label><textarea class="ppa-form-input ppa-form-textarea" id="ppa-f-desc" rows="3" placeholder="Brief description of the project"></textarea></div>';
    h += '<div class="ppa-form-field"><label class="ppa-form-label">URL</label><input class="ppa-form-input" id="ppa-f-url" placeholder="https://example.com"></div>';
    h += '<div class="ppa-form-field"><label class="ppa-form-label">Skills (comma-separated)</label><input class="ppa-form-input" id="ppa-f-skills" placeholder="React, Node.js, MongoDB"></div>';
    h += '<div class="ppa-form-field"><label class="ppa-form-label">Category</label><input class="ppa-form-input" id="ppa-f-cat" placeholder="e.g., Web Development, Design"></div>';
    h += '<div class="ppa-form-field"><label class="ppa-form-label">Outcome / Results</label><input class="ppa-form-input" id="ppa-f-outcome" placeholder="e.g., Increased sales by 40%"></div>';
    h += '<div class="ppa-form-actions"><button class="ppa-btn ppa-btn-save" id="ppa-save-btn">Save</button><button class="ppa-btn ppa-btn-cancel" id="ppa-cancel-btn">Cancel</button></div>';
    h += '</div>';

    if (items.length === 0) {
      h += '<div class="ppa-empty"><p>No portfolio items yet. Add your best work to get smart suggestions!</p></div>';
    } else {
      h += '<div class="ppa-items">';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        h += '<div class="ppa-item" data-id="' + item.id + '">';
        h += '<div class="ppa-item-header">';
        h += '<span class="ppa-item-title">' + _escapeHtml(item.title) + '</span>';
        h += '<button class="ppa-btn ppa-btn-remove" data-id="' + item.id + '">&times;</button>';
        h += '</div>';
        if (item.description) h += '<div class="ppa-item-desc">' + _escapeHtml(item.description.substring(0, 100)) + '</div>';
        if (item.skills && item.skills.length) {
          h += '<div class="ppa-skills">';
          for (var j = 0; j < item.skills.length; j++) {
            h += '<span class="ppa-skill-tag">' + _escapeHtml(item.skills[j]) + '</span>';
          }
          h += '</div>';
        }
        h += '</div>';
      }
      h += '</div>';
    }

    h += '</div>';
    container.innerHTML = h;

    // Bind events
    var addBtn = container.querySelector('#ppa-add-btn');
    var addForm = container.querySelector('#ppa-add-form');
    var saveBtn = container.querySelector('#ppa-save-btn');
    var cancelBtn = container.querySelector('#ppa-cancel-btn');

    if (addBtn) addBtn.addEventListener('click', function () { addForm.style.display = 'block'; addBtn.style.display = 'none'; });
    if (cancelBtn) cancelBtn.addEventListener('click', function () { addForm.style.display = 'none'; addBtn.style.display = ''; });
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var title = container.querySelector('#ppa-f-title').value.trim();
      if (!title) return;
      addPortfolioItem({
        title: title,
        description: container.querySelector('#ppa-f-desc').value.trim(),
        url: container.querySelector('#ppa-f-url').value.trim(),
        skills: container.querySelector('#ppa-f-skills').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
        category: container.querySelector('#ppa-f-cat').value.trim(),
        outcome: container.querySelector('#ppa-f-outcome').value.trim()
      });
      _renderPortfolioList(container, opts);
    });

    var removeBtns = container.querySelectorAll('.ppa-btn-remove');
    for (var k = 0; k < removeBtns.length; k++) {
      removeBtns[k].addEventListener('click', function () {
        removePortfolioItem(this.getAttribute('data-id'));
        _renderPortfolioList(container, opts);
      });
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────

  function _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _scoreColor(score) {
    if (score >= 60) return '#22c55e';
    if (score >= 35) return '#eab308';
    return '#ef4444';
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.ppa-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '.ppa-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #222;background:#151515}',
      '.ppa-title{margin:0;color:#e0e0e0;font-size:16px;font-weight:700}',
      '.ppa-count{font-size:12px;color:#888;background:#1a1a1a;padding:3px 10px;border-radius:12px}',
      '.ppa-loading{padding:20px;text-align:center;color:#888;font-size:13px}',
      '.ppa-empty{padding:20px;text-align:center;color:#666;font-size:13px}',
      '.ppa-suggestions,.ppa-items{padding:8px}',
      '.ppa-suggestion,.ppa-item{background:#1a1a1a;border:1px solid #222;border-radius:10px;padding:14px;margin-bottom:8px;transition:border-color .2s}',
      '.ppa-suggestion:hover,.ppa-item:hover{border-color:#333}',
      '.ppa-suggestion-header,.ppa-item-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
      '.ppa-suggestion-title,.ppa-item-title{color:#e0e0e0;font-size:14px;font-weight:600}',
      '.ppa-score-badge{padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700}',
      '.ppa-suggestion-desc,.ppa-item-desc{color:#888;font-size:13px;line-height:1.5;margin-bottom:8px}',
      '.ppa-skills{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}',
      '.ppa-skill-tag{background:#222;color:#aaa;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}',
      '.ppa-skill-detected{background:#7c3aed20;color:#a78bfa}',
      '.ppa-reasons{color:#666;font-size:12px;font-style:italic;margin-bottom:8px}',
      '.ppa-how-to{color:#a78bfa;font-size:12px;background:#7c3aed10;padding:6px 10px;border-radius:6px;margin-bottom:8px}',
      '.ppa-suggestion-actions{display:flex;gap:6px}',
      '.ppa-btn{border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;text-decoration:none}',
      '.ppa-btn-attach{background:#7c3aed;color:#fff}',
      '.ppa-btn-attach:hover{background:#6d28d9}',
      '.ppa-btn-attach:disabled{opacity:.5;cursor:not-allowed}',
      '.ppa-btn-view{background:#222;color:#aaa;border:1px solid #333;display:inline-block}',
      '.ppa-btn-view:hover{background:#2a2a2a;color:#fff}',
      '.ppa-btn-add{background:#7c3aed;color:#fff;padding:6px 14px}',
      '.ppa-btn-add:hover{background:#6d28d9}',
      '.ppa-btn-save{background:#22c55e;color:#fff}',
      '.ppa-btn-cancel{background:#333;color:#aaa}',
      '.ppa-btn-remove{background:transparent;color:#666;font-size:16px;padding:2px 6px}',
      '.ppa-btn-remove:hover{color:#f87171}',
      '.ppa-analysis{padding:12px 18px;border-top:1px solid #222}',
      '.ppa-analysis-label{font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}',
      '.ppa-add-form{padding:14px 18px;border-bottom:1px solid #222;background:#151515}',
      '.ppa-form-field{margin-bottom:10px}',
      '.ppa-form-label{display:block;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}',
      '.ppa-form-input{width:100%;background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:8px 10px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box}',
      '.ppa-form-input:focus{border-color:#7c3aed}',
      '.ppa-form-textarea{resize:vertical;min-height:60px;font-family:inherit}',
      '.ppa-form-actions{display:flex;gap:8px;margin-top:12px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Public API ───────────────────────────────────────────────────

  CF.ProposalPortfolioAttach = {
    init: init,
    getPortfolioItems: getPortfolioItems,
    savePortfolioItems: savePortfolioItems,
    addPortfolioItem: addPortfolioItem,
    removePortfolioItem: removePortfolioItem,
    updatePortfolioItem: updatePortfolioItem,
    analyzeJobRequirements: analyzeJobRequirements,
    scorePortfolioRelevance: scorePortfolioRelevance,
    suggestPortfolioItems: suggestPortfolioItems,
    generateReferenceText: generateReferenceText,
    renderSuggestions: renderSuggestions,
    renderPortfolioManager: renderPortfolioManager,
    SKILL_CATEGORIES: SKILL_CATEGORIES,
    version: '1.0.0'
  };

})();
