/**
 * [CF3-003] Client Research Module
 * Extracts client intelligence from job postings, provides personalized
 * proposal hooks, and integrates with the proposal generator.
 *
 * window.CortexFreelancer.ClientResearch
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_client_research_cache';
  var CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  var CSS_INJECTED = false;

  // ─── Fetch Client Intelligence from API ─────────────────────

  function fetchIntelligence(jobDescription, clientName) {
    var apiBase = CF._apiBase || '';
    return fetch(apiBase + '/api/client-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobDescription: jobDescription, clientName: clientName || null })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('Client research API failed: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      if (data.success && data.intelligence) {
        _cacheResult(jobDescription, data.intelligence);
        return data.intelligence;
      }
      throw new Error('Invalid response');
    })
    .catch(function () {
      // Fallback to local analysis
      return localAnalysis(jobDescription, clientName);
    });
  }

  // ─── Local Fallback Analysis ────────────────────────────────

  function localAnalysis(jobDescription, clientName) {
    var desc = (jobDescription || '').toLowerCase();

    // Quick industry detection
    var industries = {
      fintech: ['payment', 'banking', 'fintech', 'crypto', 'wallet', 'trading'],
      saas: ['saas', 'subscription', 'dashboard', 'multi-tenant', 'b2b'],
      ecommerce: ['ecommerce', 'e-commerce', 'store', 'shopify', 'cart', 'checkout'],
      healthcare: ['health', 'medical', 'hipaa', 'patient', 'telemedicine'],
      education: ['edtech', 'learning', 'course', 'lms', 'student'],
      marketplace: ['marketplace', 'two-sided', 'buyer', 'seller', 'booking'],
      ai: ['ai', 'machine learning', 'ml', 'nlp', 'chatbot', 'llm']
    };

    var bestIndustry = null;
    var bestScore = 0;
    for (var ind in industries) {
      var score = 0;
      var matched = [];
      for (var i = 0; i < industries[ind].length; i++) {
        if (desc.indexOf(industries[ind][i]) !== -1) { score++; matched.push(industries[ind][i]); }
      }
      if (score > bestScore) { bestScore = score; bestIndustry = { name: ind, confidence: Math.min(score * 25, 100), signals: matched }; }
    }

    // Pain points via regex
    var painPoints = [];
    var painPatterns = [
      /(?:struggling|problem|issue|challenge)\w*\s+(?:with\s+)?([^.!?\n]{10,80})/gi,
      /(?:need|want|looking for)\s+(?:someone|help)\s+(?:to|who can)\s+([^.!?\n]{10,80})/gi
    ];
    for (var p = 0; p < painPatterns.length; p++) {
      var match;
      while ((match = painPatterns[p].exec(jobDescription || '')) !== null) {
        var text = match[1].trim();
        if (text.length > 5) painPoints.push({ type: 'extracted', text: text });
      }
    }

    return {
      clientName: clientName || null,
      industry: bestIndustry,
      companyStage: null,
      painPoints: painPoints.slice(0, 5),
      decisionMaker: 'unknown',
      teamSize: 'unknown',
      communicationPrefs: [],
      previousFreelancerExperience: 'unknown',
      recommendations: [],
      _source: 'local'
    };
  }

  // ─── Build Personalized Proposal Hooks ──────────────────────

  function buildProposalHooks(intelligence, profile) {
    var hooks = [];
    var intel = intelligence || {};
    var prof = profile || {};

    // Industry-specific opener
    if (intel.industry) {
      var industryOpeners = {
        fintech: 'I noticed this is a fintech project — I take security and compliance seriously in every line of code.',
        saas: 'Building SaaS products is my specialty — I understand subscription dynamics, onboarding flows, and churn prevention.',
        ecommerce: 'I\'ve built e-commerce experiences that directly drove conversion increases — I know what moves the needle.',
        healthcare: 'I have experience building HIPAA-compliant systems and understand the sensitivity of healthcare data.',
        education: 'I\'m passionate about edtech and have built learning platforms with measurable engagement improvements.',
        marketplace: 'I\'ve worked on two-sided marketplaces before and understand the unique challenges of balancing supply and demand.',
        ai: 'I\'ve shipped production AI/ML features and understand the full pipeline from model training to deployment.'
      };
      if (industryOpeners[intel.industry.name]) {
        hooks.push({ type: 'industry_opener', text: industryOpeners[intel.industry.name], priority: 1 });
      }
    }

    // Pain point address
    if (intel.painPoints && intel.painPoints.length > 0) {
      var topPain = intel.painPoints[0].text;
      hooks.push({
        type: 'pain_address',
        text: 'I specifically noticed your challenge with ' + topPain + ' — I\'ve solved exactly this kind of problem before and can walk you through my approach.',
        priority: 1
      });
    }

    // Company stage hook
    if (intel.companyStage) {
      var stageHooks = {
        early_stage: 'I love working with early-stage teams — I\'m used to wearing multiple hats, moving fast, and iterating based on user feedback.',
        growth: 'At your growth stage, I focus on building for scale while maintaining development velocity. I\'ve helped similar companies navigate this exact transition.',
        established: 'I bring enterprise-grade discipline to my work — proper documentation, testing, and change management are built into my process.',
        agency: 'I\'ve worked with agencies before and understand the workflow — clear deliverables, fast turnaround, and reliable communication.'
      };
      if (stageHooks[intel.companyStage.stage]) {
        hooks.push({ type: 'stage_hook', text: stageHooks[intel.companyStage.stage], priority: 2 });
      }
    }

    // Trust builder based on freelancer experience
    if (intel.previousFreelancerExperience === 'negative_past') {
      hooks.push({
        type: 'trust_builder',
        text: 'I understand you may have had mixed experiences with freelancers before. I differentiate myself through daily progress updates, milestone-based billing, and a no-surprises approach.',
        priority: 1
      });
    } else if (intel.previousFreelancerExperience === 'first_time') {
      hooks.push({
        type: 'trust_builder',
        text: 'If this is your first time hiring on the platform, I\'m happy to guide you through the process. I\'ll make it easy with clear milestones and regular check-ins.',
        priority: 2
      });
    }

    // Skill match hook (using profile)
    if (prof.skills && prof.skills.length > 0 && intel.industry) {
      var skillMatch = prof.skills.filter(function (s) {
        return (intel.industry.signals || []).some(function (sig) {
          return s.toLowerCase().indexOf(sig) !== -1 || sig.indexOf(s.toLowerCase()) !== -1;
        });
      });
      if (skillMatch.length > 0) {
        hooks.push({
          type: 'skill_match',
          text: 'My direct experience with ' + skillMatch.slice(0, 3).join(', ') + ' means I can hit the ground running on this project without a ramp-up period.',
          priority: 2
        });
      }
    }

    // Sort by priority (1 = highest)
    hooks.sort(function (a, b) { return a.priority - b.priority; });
    return hooks;
  }

  // ─── Generate Personalized Pitch Block ──────────────────────

  function generatePitchBlock(intelligence, profile) {
    var hooks = buildProposalHooks(intelligence, profile);
    if (!hooks.length) return '';

    var lines = [];
    // Use top 3 hooks max
    for (var i = 0; i < Math.min(hooks.length, 3); i++) {
      lines.push(hooks[i].text);
    }
    return lines.join('\n\n');
  }

  // ─── Build Enhanced Skill Context for API ───────────────────
  // Merges client research into the skillContext format expected by generate-proposal API

  function buildEnhancedContext(intelligence, baseContext) {
    var ctx = baseContext || {};
    var intel = intelligence || {};

    // Merge industry into key phrases
    var keyPhrases = (ctx.keyPhrases || []).slice();
    if (intel.industry) {
      keyPhrases.push('Industry: ' + intel.industry.name);
    }
    if (intel.painPoints) {
      for (var i = 0; i < Math.min(intel.painPoints.length, 2); i++) {
        keyPhrases.push('Pain: ' + intel.painPoints[i].text);
      }
    }

    // Build recommendation string for pastWinSnippet enrichment
    var recTexts = [];
    if (intel.recommendations) {
      for (var r = 0; r < Math.min(intel.recommendations.length, 3); r++) {
        recTexts.push(intel.recommendations[r].text);
      }
    }

    return {
      clientType: ctx.clientType || (intel.companyStage ? _stageToClientType(intel.companyStage.stage) : undefined),
      budgetTier: ctx.budgetTier,
      keyPhrases: keyPhrases,
      pastWinSnippet: ctx.pastWinSnippet || (recTexts.length ? recTexts.join(' ') : undefined),
      // CF3-003 extensions
      industry: intel.industry ? intel.industry.name : undefined,
      companyStage: intel.companyStage ? intel.companyStage.stage : undefined,
      decisionMaker: intel.decisionMaker !== 'unknown' ? intel.decisionMaker : undefined,
      painPoints: (intel.painPoints || []).map(function (p) { return p.text; }).slice(0, 3),
      previousFreelancerExperience: intel.previousFreelancerExperience !== 'unknown' ? intel.previousFreelancerExperience : undefined,
    };
  }

  function _stageToClientType(stage) {
    var map = { early_stage: 'startup', growth: 'startup', established: 'enterprise', agency: 'agency' };
    return map[stage] || undefined;
  }

  // ─── Cache ──────────────────────────────────────────────────

  function _cacheResult(jobDesc, result) {
    try {
      var key = _hashStr(jobDesc);
      var cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      cache[key] = { data: result, ts: Date.now() };
      // Keep only last 20 entries
      var keys = Object.keys(cache);
      if (keys.length > 20) {
        keys.sort(function (a, b) { return cache[a].ts - cache[b].ts; });
        for (var i = 0; i < keys.length - 20; i++) delete cache[keys[i]];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch (e) { /* ignore */ }
  }

  function getCached(jobDesc) {
    try {
      var key = _hashStr(jobDesc);
      var cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      var entry = cache[key];
      if (entry && (Date.now() - entry.ts) < CACHE_TTL) return entry.data;
    } catch (e) { /* ignore */ }
    return null;
  }

  function _hashStr(str) {
    var hash = 0;
    for (var i = 0; i < Math.min(str.length, 200); i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'cr_' + Math.abs(hash).toString(36);
  }

  // ─── Render: Client Intelligence Panel ──────────────────────

  function renderIntelPanel(containerId, intelligence) {
    _injectCSS();
    var container = document.getElementById(containerId);
    if (!container) return;
    var intel = intelligence || {};

    if (!intel.industry && !intel.painPoints?.length && !intel.companyStage) {
      container.innerHTML = '<div class="cri-panel"><div class="cri-empty">No client intelligence available. Paste a job description to analyze.</div></div>';
      return;
    }

    var h = '<div class="cri-panel">';
    h += '<div class="cri-header"><span class="cri-title">Client Intelligence</span>';

    // Industry badge
    if (intel.industry) {
      h += '<span class="cri-badge cri-badge-industry">' + _escapeHtml(intel.industry.name.replace(/_/g, ' ')) + '</span>';
    }
    // Stage badge
    if (intel.companyStage) {
      h += '<span class="cri-badge cri-badge-stage">' + _escapeHtml(intel.companyStage.stage.replace(/_/g, ' ')) + '</span>';
    }
    h += '</div>';

    // Pain points
    if (intel.painPoints && intel.painPoints.length) {
      h += '<div class="cri-section">';
      h += '<div class="cri-section-label">Pain Points Detected</div>';
      for (var i = 0; i < intel.painPoints.length; i++) {
        h += '<div class="cri-pain-item">';
        h += '<span class="cri-pain-icon">!</span>';
        h += '<span class="cri-pain-text">' + _escapeHtml(intel.painPoints[i].text) + '</span>';
        h += '</div>';
      }
      h += '</div>';
    }

    // Recommendations
    if (intel.recommendations && intel.recommendations.length) {
      h += '<div class="cri-section">';
      h += '<div class="cri-section-label">Personalization Tips</div>';
      for (var r = 0; r < intel.recommendations.length; r++) {
        var rec = intel.recommendations[r];
        var priorityClass = rec.priority === 'high' ? 'cri-rec-high' : 'cri-rec-normal';
        h += '<div class="cri-rec ' + priorityClass + '">';
        h += '<span class="cri-rec-type">' + _escapeHtml(rec.type) + '</span>';
        h += '<span class="cri-rec-text">' + _escapeHtml(rec.text) + '</span>';
        h += '</div>';
      }
      h += '</div>';
    }

    // Context signals
    h += '<div class="cri-section cri-signals">';
    h += '<div class="cri-section-label">Signals</div>';
    h += '<div class="cri-signal-grid">';
    h += '<div class="cri-signal"><span class="cri-signal-label">Decision Maker</span><span class="cri-signal-value">' + _escapeHtml(intel.decisionMaker || 'unknown') + '</span></div>';
    h += '<div class="cri-signal"><span class="cri-signal-label">Team Size</span><span class="cri-signal-value">' + _escapeHtml(intel.teamSize || 'unknown') + '</span></div>';
    h += '<div class="cri-signal"><span class="cri-signal-label">Past Freelancer Exp</span><span class="cri-signal-value">' + _escapeHtml((intel.previousFreelancerExperience || 'unknown').replace(/_/g, ' ')) + '</span></div>';
    if (intel.communicationPrefs && intel.communicationPrefs.length) {
      h += '<div class="cri-signal"><span class="cri-signal-label">Comm Prefs</span><span class="cri-signal-value">' + _escapeHtml(intel.communicationPrefs.join(', ')) + '</span></div>';
    }
    h += '</div></div>';

    h += '</div>';
    container.innerHTML = h;
  }

  // ─── CSS ────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.cri-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;margin-bottom:12px}',
      '.cri-header{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #222;background:#151515;flex-wrap:wrap}',
      '.cri-title{font-size:13px;font-weight:700;color:#e0e0e0;flex:1}',
      '.cri-badge{font-size:11px;font-weight:600;padding:3px 10px;border-radius:10px;text-transform:capitalize}',
      '.cri-badge-industry{background:#3b82f620;color:#60a5fa}',
      '.cri-badge-stage{background:#8b5cf620;color:#a78bfa}',
      '.cri-section{padding:10px 16px;border-bottom:1px solid #1a1a1a}',
      '.cri-section:last-child{border-bottom:none}',
      '.cri-section-label{font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}',
      '.cri-pain-item{display:flex;gap:8px;align-items:flex-start;padding:4px 0}',
      '.cri-pain-icon{width:18px;height:18px;background:#ef444420;color:#f87171;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}',
      '.cri-pain-text{font-size:13px;color:#ccc;line-height:1.4}',
      '.cri-rec{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:6px;margin-bottom:4px}',
      '.cri-rec-high{background:#7c3aed10}',
      '.cri-rec-normal{background:#1a1a1a}',
      '.cri-rec-type{font-size:10px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px}',
      '.cri-rec-text{font-size:12px;color:#bbb;line-height:1.4}',
      '.cri-signal-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.cri-signal{display:flex;flex-direction:column;gap:2px}',
      '.cri-signal-label{font-size:10px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.3px}',
      '.cri-signal-value{font-size:12px;color:#aaa;text-transform:capitalize}',
      '.cri-empty{padding:20px;color:#666;font-size:13px;text-align:center}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function _escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Public API ─────────────────────────────────────────────

  CF.ClientResearch = {
    fetchIntelligence: fetchIntelligence,
    localAnalysis: localAnalysis,
    buildProposalHooks: buildProposalHooks,
    generatePitchBlock: generatePitchBlock,
    buildEnhancedContext: buildEnhancedContext,
    getCached: getCached,
    renderIntelPanel: renderIntelPanel,
    version: '1.0.0'
  };

})();
