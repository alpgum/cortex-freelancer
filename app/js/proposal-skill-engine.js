/**
 * [CFX-051] Proposal Skill Engine — OpenClaw Integration
 * Context-aware template matching, client type detection,
 * win-history learning, intelligent auto-population.
 *
 * window.CortexFreelancer.ProposalSkillEngine
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY_WIN_HISTORY = 'cf_proposal_win_history';
  var CSS_INJECTED = false;

  // ─── Client Type Detection ──────────────────────────────────────

  var CLIENT_TYPES = {
    startup: {
      label: 'Startup',
      signals: ['mvp', 'co-founder', 'equity', 'seed', 'iterate', 'lean', 'prototype', 'launch', 'early-stage', 'bootstrapped', 'disrupt', 'pivot'],
      tone: 'friendly',
      emphasis: ['Speed & flexibility', 'Wearing multiple hats', 'Iterative delivery'],
      color: '#22c55e'
    },
    enterprise: {
      label: 'Enterprise',
      signals: ['compliance', 'sla', 'stakeholders', 'enterprise', 'governance', 'procurement', 'vendor', 'rfi', 'rfp', 'corporate', 'security audit', 'gdpr', 'hipaa', 'sox'],
      tone: 'professional',
      emphasis: ['Process & methodology', 'Scalability & security', 'Documentation & compliance'],
      color: '#3b82f6'
    },
    agency: {
      label: 'Agency',
      signals: ['white-label', 'white label', 'our client', 'deliverables', 'brief', 'creative brief', 'retainer', 'ongoing work', 'multiple projects', 'agency'],
      tone: 'confident',
      emphasis: ['Fast turnaround', 'Clear communication', 'Portfolio depth'],
      color: '#f59e0b'
    },
    smb: {
      label: 'Small Business',
      signals: ['small business', 'our team', 'budget-friendly', 'affordable', 'small company', 'local business', 'family business', 'growing team'],
      tone: 'friendly',
      emphasis: ['Value for money', 'Clear milestones', 'Plain language'],
      color: '#8b5cf6'
    },
    individual: {
      label: 'Individual',
      signals: ['i need', 'my website', 'my app', 'personal project', 'my blog', 'my store', 'help me', 'i want', 'i have an idea'],
      tone: 'casual',
      emphasis: ['Simplicity', 'Guidance & education', 'Quick wins'],
      color: '#ec4899'
    }
  };

  function detectClientType(jobDescription) {
    if (!jobDescription) return { type: 'unknown', confidence: 0, details: null };
    var desc = jobDescription.toLowerCase();
    var scores = {};
    var maxScore = 0;
    var bestType = 'unknown';

    for (var type in CLIENT_TYPES) {
      if (!CLIENT_TYPES.hasOwnProperty(type)) continue;
      var signals = CLIENT_TYPES[type].signals;
      var score = 0;
      var matched = [];
      for (var i = 0; i < signals.length; i++) {
        if (desc.indexOf(signals[i]) !== -1) {
          score++;
          matched.push(signals[i]);
        }
      }
      scores[type] = { score: score, matched: matched };
      if (score > maxScore) {
        maxScore = score;
        bestType = type;
      }
    }

    // Budget-based fallback
    if (maxScore === 0) {
      var budgetMatch = desc.match(/\$[\d,]+/g);
      if (budgetMatch) {
        var amounts = budgetMatch.map(function (b) { return parseInt(b.replace(/[$,]/g, ''), 10); });
        var maxBudget = Math.max.apply(null, amounts);
        if (maxBudget < 200) bestType = 'individual';
        else if (maxBudget < 2000) bestType = 'smb';
        else if (maxBudget < 10000) bestType = 'agency';
        else bestType = 'enterprise';
        maxScore = 1;
      }
    }

    var confidence = maxScore === 0 ? 0 : Math.min(Math.round((maxScore / 3) * 100), 100);

    return {
      type: bestType,
      confidence: confidence,
      details: CLIENT_TYPES[bestType] || null,
      scores: scores
    };
  }

  // ─── Project Category Detection ────────────────────────────────

  var CATEGORY_MAP = [
    { category: 'web-development', keywords: ['react', 'angular', 'vue', 'node', 'frontend', 'front-end', 'backend', 'back-end', 'fullstack', 'full-stack', 'javascript', 'typescript', 'html', 'css', 'php', 'laravel', 'django', 'ruby', 'rails', 'wordpress', 'shopify', 'api', 'rest', 'graphql', 'next.js', 'nuxt'], templateId: 'tpl-web-dev' },
    { category: 'mobile-development', keywords: ['ios', 'android', 'flutter', 'react native', 'swift', 'kotlin', 'mobile app', 'app development', 'xamarin', 'ionic'], templateId: 'tpl-mobile' },
    { category: 'design', keywords: ['figma', 'sketch', 'ui design', 'ux design', 'ui/ux', 'branding', 'mockup', 'wireframe', 'prototype', 'graphic design', 'logo', 'illustration', 'adobe', 'photoshop', 'illustrator'], templateId: 'tpl-design' },
    { category: 'writing', keywords: ['blog', 'seo', 'copywriting', 'content writing', 'article', 'ghostwriting', 'editing', 'proofreading', 'technical writing', 'creative writing', 'script'], templateId: 'tpl-writing' },
    { category: 'marketing', keywords: ['ads', 'ppc', 'google ads', 'facebook ads', 'meta ads', 'social media', 'growth', 'analytics', 'campaign', 'email marketing', 'funnel', 'conversion', 'tiktok', 'instagram'], templateId: 'tpl-marketing' },
    { category: 'devops', keywords: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'terraform', 'ansible', 'devops', 'cloud', 'infrastructure', 'linux', 'nginx', 'server'], templateId: 'tpl-devops' },
    { category: 'data-entry', keywords: ['data entry', 'spreadsheet', 'excel', 'google sheets', 'scraping', 'web scraping', 'data collection', 'transcription', 'admin', 'virtual assistant'], templateId: 'tpl-data-entry' },
    { category: 'qa-testing', keywords: ['testing', 'qa', 'quality assurance', 'automation', 'selenium', 'cypress', 'playwright', 'test cases', 'bug', 'regression'], templateId: 'tpl-qa' },
    { category: 'project-management', keywords: ['project management', 'scrum', 'agile', 'jira', 'strategy', 'consulting', 'business analysis', 'requirements', 'roadmap', 'stakeholder'], templateId: 'tpl-pm' }
  ];

  function detectProjectCategory(jobDescription, jobSkills) {
    if (!jobDescription && (!jobSkills || !jobSkills.length)) return { category: null, templateId: null, confidence: 0, matchedKeywords: [] };
    var text = ((jobDescription || '') + ' ' + (jobSkills || []).join(' ')).toLowerCase();
    var bestCategory = null;
    var bestTemplateId = null;
    var bestScore = 0;
    var bestMatched = [];

    for (var i = 0; i < CATEGORY_MAP.length; i++) {
      var cat = CATEGORY_MAP[i];
      var score = 0;
      var matched = [];
      for (var j = 0; j < cat.keywords.length; j++) {
        if (text.indexOf(cat.keywords[j]) !== -1) {
          score++;
          matched.push(cat.keywords[j]);
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = cat.category;
        bestTemplateId = cat.templateId;
        bestMatched = matched;
      }
    }

    return {
      category: bestCategory,
      templateId: bestTemplateId,
      confidence: bestScore === 0 ? 0 : Math.min(Math.round((bestScore / 3) * 100), 100),
      matchedKeywords: bestMatched
    };
  }

  // ─── Budget Analysis ───────────────────────────────────────────

  function analyzeBudget(jobDescription, jobBudget) {
    var budget = null;
    var budgetType = 'unknown';

    // Parse explicit budget field
    if (jobBudget) {
      var nums = jobBudget.match(/[\d,]+/g);
      if (nums) {
        var values = nums.map(function (n) { return parseInt(n.replace(/,/g, ''), 10); });
        budget = values.length > 1 ? { low: values[0], high: values[1] } : { low: values[0], high: values[0] };
      }
      if (/fixed/i.test(jobBudget)) budgetType = 'fixed';
      else if (/hour/i.test(jobBudget)) budgetType = 'hourly';
    }

    // Fallback: extract from description
    if (!budget && jobDescription) {
      var match = jobDescription.match(/\$\s*([\d,]+)\s*(?:-|to)\s*\$?\s*([\d,]+)/);
      if (match) {
        budget = { low: parseInt(match[1].replace(/,/g, ''), 10), high: parseInt(match[2].replace(/,/g, ''), 10) };
      } else {
        var single = jobDescription.match(/\$\s*([\d,]+)/);
        if (single) {
          var val = parseInt(single[1].replace(/,/g, ''), 10);
          budget = { low: val, high: val };
        }
      }
    }

    var tier = 'micro';
    if (budget) {
      var avg = (budget.low + budget.high) / 2;
      if (avg >= 10000) tier = 'premium';
      else if (avg >= 2000) tier = 'mid';
      else if (avg >= 500) tier = 'standard';
      else tier = 'micro';
    }

    return { budget: budget, type: budgetType, tier: tier };
  }

  // ─── Tone Recommendation ───────────────────────────────────────

  function recommendTone(clientType, budgetTier) {
    // Client type takes priority
    if (clientType && CLIENT_TYPES[clientType]) {
      var baseTone = CLIENT_TYPES[clientType].tone;
      // Budget can override: premium budgets always professional
      if (budgetTier === 'premium' && baseTone !== 'professional') {
        return { tone: 'professional', reason: 'High-budget projects respond best to structured, professional proposals' };
      }
      return { tone: baseTone, reason: CLIENT_TYPES[clientType].label + ' clients respond best to ' + baseTone + ' tone' };
    }

    // Budget-only fallback
    if (budgetTier === 'premium') return { tone: 'professional', reason: 'Premium budget — professional tone builds trust' };
    if (budgetTier === 'mid') return { tone: 'professional', reason: 'Mid-range budget — professional tone recommended' };
    if (budgetTier === 'standard') return { tone: 'friendly', reason: 'Standard budget — friendly tone increases response rate' };
    return { tone: 'friendly', reason: 'Default — friendly tone has highest overall response rate' };
  }

  // ─── Key Phrases Extraction ────────────────────────────────────

  function extractKeyPhrases(jobDescription) {
    if (!jobDescription) return [];
    var desc = jobDescription.toLowerCase();

    // Extract requirement phrases
    var phrases = [];
    var patterns = [
      /(?:must|should|need to|required to|looking for someone who can|we need)\s+([^.!?\n]{10,80})/gi,
      /(?:experience with|proficient in|knowledge of|expertise in|skilled in)\s+([^.!?\n]{5,60})/gi,
      /(?:deliverables?|deliver|build|create|develop|design|implement)\s+([^.!?\n]{10,80})/gi
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match;
      while ((match = patterns[i].exec(jobDescription)) !== null) {
        var phrase = match[1].trim();
        if (phrase.length > 5 && phrases.indexOf(phrase) === -1) {
          phrases.push(phrase);
        }
      }
      if (phrases.length >= 8) break;
    }

    return phrases.slice(0, 8);
  }

  // ─── Red Flag Detection ────────────────────────────────────────

  var RED_FLAGS = [
    { pattern: /\b(asap|urgent|immediately|right now)\b/i, flag: 'Urgency pressure', severity: 'medium', advice: 'Set clear timeline expectations upfront' },
    { pattern: /\b(cheap|cheapest|lowest price|minimum budget)\b/i, flag: 'Price-focused client', severity: 'high', advice: 'Emphasize value over price; consider if worth pursuing' },
    { pattern: /\b(simple|easy|quick|just)\b.*\b(app|website|platform|system)\b/i, flag: 'Scope underestimation', severity: 'medium', advice: 'Clarify actual scope before committing to timeline/price' },
    { pattern: /\b(full.?time|40\s*hr|dedicated)\b.*\b(freelancer|contractor)\b/i, flag: 'Full-time expectation', severity: 'low', advice: 'Clarify availability and rate structure' },
    { pattern: /\b(equity|revenue.?share|profit.?share|unpaid)\b/i, flag: 'Non-cash compensation', severity: 'high', advice: 'Require upfront payment or clear milestone structure' },
    { pattern: /\b(no budget|flexible budget|depends on|tbd)\b/i, flag: 'Undefined budget', severity: 'medium', advice: 'Ask for budget range early to avoid wasting time' },
    { pattern: /\b(nda|non.?disclosure|confidential)\b.*\b(before|first|prior)\b/i, flag: 'NDA-first requirement', severity: 'low', advice: 'Normal for enterprise; flag if combined with vague scope' }
  ];

  function detectRedFlags(jobDescription) {
    if (!jobDescription) return [];
    var flags = [];
    for (var i = 0; i < RED_FLAGS.length; i++) {
      if (RED_FLAGS[i].pattern.test(jobDescription)) {
        flags.push({
          flag: RED_FLAGS[i].flag,
          severity: RED_FLAGS[i].severity,
          advice: RED_FLAGS[i].advice
        });
      }
    }
    return flags;
  }

  // ─── Win History ───────────────────────────────────────────────

  function getWinHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_WIN_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function recordWin(proposalData) {
    if (!proposalData) return;
    var history = getWinHistory();
    var entry = {
      id: 'win_' + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      clientType: proposalData.clientType || 'unknown',
      category: proposalData.category || 'unknown',
      tone: proposalData.tone || 'professional',
      templateId: proposalData.templateId || null,
      budget: proposalData.budget || null,
      jobTitle: (proposalData.jobTitle || '').substring(0, 100),
      proposalSnippet: (proposalData.proposalText || '').substring(0, 300)
    };
    history.unshift(entry);
    if (history.length > 100) history = history.slice(0, 100);
    try { localStorage.setItem(STORAGE_KEY_WIN_HISTORY, JSON.stringify(history)); } catch (e) { /* ignore */ }
  }

  function findSimilarWins(category, clientType) {
    var history = getWinHistory();
    if (!history.length) return [];

    return history.filter(function (win) {
      var catMatch = !category || win.category === category;
      var clientMatch = !clientType || win.clientType === clientType;
      return catMatch || clientMatch;
    }).slice(0, 5);
  }

  function getWinStats() {
    var history = getWinHistory();
    if (!history.length) return null;

    var byTone = {};
    var byCategory = {};
    var byClientType = {};

    for (var i = 0; i < history.length; i++) {
      var w = history[i];
      byTone[w.tone] = (byTone[w.tone] || 0) + 1;
      byCategory[w.category] = (byCategory[w.category] || 0) + 1;
      byClientType[w.clientType] = (byClientType[w.clientType] || 0) + 1;
    }

    return {
      total: history.length,
      byTone: byTone,
      byCategory: byCategory,
      byClientType: byClientType,
      bestTone: _topKey(byTone),
      bestCategory: _topKey(byCategory)
    };
  }

  function _topKey(obj) {
    var best = null;
    var max = 0;
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] > max) { max = obj[key]; best = key; }
    }
    return best;
  }

  // ─── Auto-Population ───────────────────────────────────────────

  function buildVariables(profile, jobDescription, jobSkills, jobBudget) {
    var prof = profile || {};
    var skills = prof.skills || [];
    var jobSkillsList = jobSkills || [];

    // Find overlapping skills
    var profileLower = skills.map(function (s) { return s.toLowerCase(); });
    var jobLower = jobSkillsList.map(function (s) { return s.toLowerCase(); });
    var overlap = profileLower.filter(function (s) {
      return jobLower.some(function (js) { return js.indexOf(s) !== -1 || s.indexOf(js) !== -1; });
    });
    var topSkill = overlap.length > 0 ? overlap[0] : (skills[0] || 'relevant technologies');

    // Estimate timeline from scope
    var scope = null;
    if (CF.ProposalGenerator && CF.ProposalGenerator.estimateProjectScope) {
      scope = CF.ProposalGenerator.estimateProjectScope(jobDescription || '');
    }

    var budgetInfo = analyzeBudget(jobDescription, jobBudget);
    var estimatedHours = scope ? scope.estimatedHours : 40;
    var rate = prof.hourlyRate || 50;
    var projectRate = Math.round(rate * estimatedHours);

    // Timeline string
    var timeline = '2-4 weeks';
    if (scope && scope.estimatedWeeks) {
      timeline = scope.estimatedWeeks <= 1 ? '1 week' : scope.estimatedWeeks + ' weeks';
    }

    // JSS and earnings
    var jss = prof.jobSuccessScore || prof.jss;
    var earnings = prof.totalEarnings || prof.earnings;

    return {
      CLIENT_NAME: 'Hiring Manager',
      PROJECT_NAME: _extractProjectName(jobDescription) || 'your project',
      YEARS_EXPERIENCE: prof.yearsExperience || prof.experience || 'several',
      RELEVANT_SKILL: topSkill.charAt(0).toUpperCase() + topSkill.slice(1),
      HOURLY_RATE: String(rate),
      PROJECT_RATE: String(projectRate),
      TIMELINE: timeline,
      PORTFOLIO_LINK: prof.portfolio || prof.profileUrl || 'my portfolio',
      WIN_RATE: _calcWinRate(),
      PAST_SIMILAR: _findPastSimilar(jobDescription),
      JSS: jss ? String(jss) + '%' : ''
    };
  }

  function _extractProjectName(desc) {
    if (!desc) return null;
    var firstLine = desc.split(/[\n]+/)[0];
    if (firstLine && firstLine.length > 5 && firstLine.length < 100) {
      return firstLine.trim();
    }
    return null;
  }

  function _calcWinRate() {
    var wins = getWinHistory().length;
    // Get total proposals from tracker if available
    if (CF.ProposalTracker && typeof CF.ProposalTracker.getAll === 'function') {
      var all = CF.ProposalTracker.getAll();
      if (all && all.length > 0) {
        return Math.round((wins / all.length) * 100) + '%';
      }
    }
    return '';
  }

  function _findPastSimilar(jobDescription) {
    if (!jobDescription) return '';
    var history = getWinHistory();
    if (!history.length) return '';
    // Simple keyword overlap
    var words = jobDescription.toLowerCase().split(/\s+/).slice(0, 20);
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < Math.min(history.length, 20); i++) {
      var snippet = (history[i].jobTitle + ' ' + history[i].proposalSnippet).toLowerCase();
      var score = 0;
      for (var j = 0; j < words.length; j++) {
        if (words[j].length > 3 && snippet.indexOf(words[j]) !== -1) score++;
      }
      if (score > bestScore) { bestScore = score; best = history[i]; }
    }
    return (best && bestScore > 3) ? best.jobTitle : '';
  }

  // ─── Full Analysis (Main Entry Point) ──────────────────────────

  function analyzeJob(jobDescription, jobSkills, jobBudget, userProfile) {
    var clientType = detectClientType(jobDescription);
    var projectCategory = detectProjectCategory(jobDescription, jobSkills);
    var budgetInfo = analyzeBudget(jobDescription, jobBudget);
    var toneRec = recommendTone(clientType.type, budgetInfo.tier);
    var keyPhrases = extractKeyPhrases(jobDescription);
    var redFlags = detectRedFlags(jobDescription);
    var similarWins = findSimilarWins(projectCategory.category, clientType.type);
    var variables = buildVariables(userProfile, jobDescription, jobSkills, jobBudget);
    var winStats = getWinStats();

    return {
      clientType: clientType,
      projectCategory: projectCategory,
      budget: budgetInfo,
      toneRecommendation: toneRec,
      keyPhrases: keyPhrases,
      redFlags: redFlags,
      similarWins: similarWins,
      variables: variables,
      winStats: winStats,
      suggestions: _buildSuggestions(clientType, projectCategory, budgetInfo, toneRec, redFlags, similarWins)
    };
  }

  function _buildSuggestions(clientType, category, budget, toneRec, redFlags, wins) {
    var suggestions = [];

    if (category.templateId) {
      suggestions.push({
        type: 'template',
        icon: '📋',
        text: 'Use "' + (category.category || '').replace(/-/g, ' ') + '" template — ' + category.matchedKeywords.slice(0, 3).join(', ') + ' detected',
        action: 'select-template',
        value: category.templateId
      });
    }

    suggestions.push({
      type: 'tone',
      icon: '🎯',
      text: toneRec.reason,
      action: 'set-tone',
      value: toneRec.tone
    });

    if (clientType.type !== 'unknown' && clientType.details) {
      var emphasisList = clientType.details.emphasis.slice(0, 2).join(', ');
      suggestions.push({
        type: 'emphasis',
        icon: '💡',
        text: clientType.details.label + ' client — emphasize: ' + emphasisList,
        action: 'info',
        value: null
      });
    }

    if (budget.tier === 'premium') {
      suggestions.push({
        type: 'strategy',
        icon: '💰',
        text: 'Premium budget — propose a phased approach with discovery call first',
        action: 'info',
        value: null
      });
    }

    if (wins.length > 0) {
      suggestions.push({
        type: 'history',
        icon: '🏆',
        text: 'You won ' + wins.length + ' similar project(s) before — reuse winning patterns',
        action: 'show-wins',
        value: wins
      });
    }

    for (var i = 0; i < redFlags.length; i++) {
      suggestions.push({
        type: 'warning',
        icon: redFlags[i].severity === 'high' ? '🚩' : '⚠️',
        text: redFlags[i].flag + ' — ' + redFlags[i].advice,
        action: 'info',
        value: null
      });
    }

    return suggestions;
  }

  // ─── Render: Smart Suggestions Panel ───────────────────────────

  function renderSuggestionsPanel(containerId, analysis) {
    _injectCSS();
    var container = document.getElementById(containerId);
    if (!container) return;
    if (!analysis || !analysis.suggestions || !analysis.suggestions.length) {
      container.innerHTML = '';
      return;
    }

    var h = '<div class="pse-panel">';
    h += '<div class="pse-header">';
    h += '<span class="pse-title">Smart Suggestions</span>';
    if (analysis.clientType.type !== 'unknown') {
      var ct = analysis.clientType;
      h += '<span class="pse-badge" style="background:' + (ct.details ? ct.details.color : '#666') + '20;color:' + (ct.details ? ct.details.color : '#888') + ';">' + (ct.details ? ct.details.label : 'Unknown') + ' Client</span>';
    }
    if (analysis.budget.tier !== 'micro') {
      var tierLabels = { premium: 'Premium', mid: 'Mid-Range', standard: 'Standard' };
      h += '<span class="pse-badge pse-badge-budget">' + (tierLabels[analysis.budget.tier] || '') + ' Budget</span>';
    }
    h += '</div>';

    // Suggestions list
    h += '<div class="pse-suggestions">';
    for (var i = 0; i < analysis.suggestions.length; i++) {
      var s = analysis.suggestions[i];
      var cls = 'pse-suggestion';
      if (s.type === 'warning') cls += ' pse-suggestion-warn';
      if (s.action !== 'info') cls += ' pse-suggestion-clickable';

      h += '<div class="' + cls + '" data-action="' + s.action + '" data-value="' + _escapeAttr(s.value) + '">';
      h += '<span class="pse-icon">' + s.icon + '</span>';
      h += '<span class="pse-text">' + _escapeHtml(s.text) + '</span>';
      if (s.action === 'select-template' || s.action === 'set-tone') {
        h += '<span class="pse-apply">Apply</span>';
      }
      h += '</div>';
    }
    h += '</div>';

    // Key phrases
    if (analysis.keyPhrases && analysis.keyPhrases.length) {
      h += '<div class="pse-phrases">';
      h += '<span class="pse-phrases-label">Key phrases to address:</span>';
      h += '<div class="pse-phrase-list">';
      for (var p = 0; p < analysis.keyPhrases.length; p++) {
        h += '<span class="pse-phrase">' + _escapeHtml(analysis.keyPhrases[p]) + '</span>';
      }
      h += '</div></div>';
    }

    h += '</div>';
    container.innerHTML = h;

    // Bind click events
    var items = container.querySelectorAll('.pse-suggestion-clickable');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        var value = this.getAttribute('data-value');
        window.dispatchEvent(new CustomEvent('cf:skill-suggestion-apply', {
          detail: { action: action, value: value }
        }));
        // Visual feedback
        this.classList.add('pse-suggestion-applied');
        var applyEl = this.querySelector('.pse-apply');
        if (applyEl) applyEl.textContent = 'Applied';
      });
    }
  }

  // ─── Render: Win History Panel ─────────────────────────────────

  function renderWinHistoryPanel(containerId) {
    _injectCSS();
    var container = document.getElementById(containerId);
    if (!container) return;

    var stats = getWinStats();
    var history = getWinHistory();

    if (!history.length) {
      container.innerHTML = '<div class="pse-panel"><div class="pse-empty">No winning proposals recorded yet. Mark proposals as "hired" in the tracker to build your win history.</div></div>';
      return;
    }

    var h = '<div class="pse-panel">';
    h += '<div class="pse-header"><span class="pse-title">Win History</span>';
    h += '<span class="pse-badge pse-badge-wins">' + stats.total + ' wins</span></div>';

    // Stats row
    h += '<div class="pse-stats-row">';
    if (stats.bestTone) {
      h += '<div class="pse-stat"><span class="pse-stat-label">Best Tone</span><span class="pse-stat-value">' + _escapeHtml(stats.bestTone) + '</span></div>';
    }
    if (stats.bestCategory) {
      h += '<div class="pse-stat"><span class="pse-stat-label">Best Category</span><span class="pse-stat-value">' + _escapeHtml(stats.bestCategory.replace(/-/g, ' ')) + '</span></div>';
    }
    h += '</div>';

    // Recent wins
    h += '<div class="pse-win-list">';
    for (var i = 0; i < Math.min(history.length, 5); i++) {
      var w = history[i];
      h += '<div class="pse-win-item">';
      h += '<div class="pse-win-title">' + _escapeHtml(w.jobTitle || 'Untitled') + '</div>';
      h += '<div class="pse-win-meta">';
      h += '<span>' + _escapeHtml(w.category || 'General') + '</span>';
      h += '<span>' + _escapeHtml(w.tone || 'N/A') + ' tone</span>';
      h += '<span>' + _escapeHtml(w.clientType || 'Unknown') + '</span>';
      h += '</div></div>';
    }
    h += '</div></div>';

    container.innerHTML = h;
  }

  // ─── CSS ───────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.pse-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;margin-bottom:12px}',
      '.pse-header{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #222;background:#151515;flex-wrap:wrap}',
      '.pse-title{font-size:13px;font-weight:700;color:#e0e0e0;flex:1}',
      '.pse-badge{font-size:11px;font-weight:600;padding:3px 10px;border-radius:10px;white-space:nowrap}',
      '.pse-badge-budget{background:#f59e0b20;color:#f59e0b}',
      '.pse-badge-wins{background:#22c55e20;color:#22c55e}',
      '.pse-suggestions{padding:8px}',
      '.pse-suggestion{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:8px;transition:background .15s}',
      '.pse-suggestion-clickable{cursor:pointer}',
      '.pse-suggestion-clickable:hover{background:#1a1a2a}',
      '.pse-suggestion-warn{background:#2e1a1a08}',
      '.pse-suggestion-applied{background:#22c55e10}',
      '.pse-icon{font-size:14px;flex-shrink:0;margin-top:1px}',
      '.pse-text{font-size:13px;color:#bbb;line-height:1.4;flex:1}',
      '.pse-apply{font-size:11px;font-weight:600;color:#7c3aed;background:#7c3aed15;padding:2px 10px;border-radius:6px;white-space:nowrap;flex-shrink:0}',
      '.pse-phrases{padding:10px 16px;border-top:1px solid #1a1a1a}',
      '.pse-phrases-label{font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px}',
      '.pse-phrase-list{display:flex;flex-wrap:wrap;gap:4px}',
      '.pse-phrase{background:#1e1e2e;color:#a78bfa;font-size:11px;padding:3px 8px;border-radius:6px;line-height:1.3}',
      '.pse-empty{padding:20px;color:#666;font-size:13px;text-align:center}',
      '.pse-stats-row{display:flex;gap:16px;padding:12px 16px;border-bottom:1px solid #1a1a1a}',
      '.pse-stat{display:flex;flex-direction:column;gap:2px}',
      '.pse-stat-label{font-size:10px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.5px}',
      '.pse-stat-value{font-size:13px;font-weight:600;color:#e0e0e0;text-transform:capitalize}',
      '.pse-win-list{padding:8px}',
      '.pse-win-item{padding:8px 10px;border-bottom:1px solid #1a1a1a}',
      '.pse-win-item:last-child{border-bottom:none}',
      '.pse-win-title{font-size:13px;font-weight:600;color:#ccc;margin-bottom:4px}',
      '.pse-win-meta{display:flex;gap:10px;font-size:11px;color:#666}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function _escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _escapeAttr(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return _escapeHtml(JSON.stringify(val));
    return _escapeHtml(String(val));
  }

  // ─── Public API ────────────────────────────────────────────────

  CF.ProposalSkillEngine = {
    // Analysis
    analyzeJob: analyzeJob,
    detectClientType: detectClientType,
    detectProjectCategory: detectProjectCategory,
    analyzeBudget: analyzeBudget,
    recommendTone: recommendTone,
    extractKeyPhrases: extractKeyPhrases,
    detectRedFlags: detectRedFlags,

    // Auto-population
    buildVariables: buildVariables,

    // Win history
    recordWin: recordWin,
    findSimilarWins: findSimilarWins,
    getWinStats: getWinStats,
    getWinHistory: getWinHistory,

    // Rendering
    renderSuggestionsPanel: renderSuggestionsPanel,
    renderWinHistoryPanel: renderWinHistoryPanel,

    // Constants
    CLIENT_TYPES: CLIENT_TYPES,
    CATEGORY_MAP: CATEGORY_MAP,
    RED_FLAGS: RED_FLAGS,

    version: '1.0.0'
  };

})();
