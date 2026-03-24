/**
 * [CF-067] Auto-Apply Rules Engine
 * Configure rules: auto-apply to jobs matching criteria with pre-approved
 * proposal templates. Rule matching engine.
 *
 * Also retains legacy UW-009 one-click apply UI.
 *
 * Exposed as window.CortexFreelancer.autoApply AND window.CortexAutoApply (legacy)
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────
  var STORAGE_KEY = 'cortex_applications';
  var RULES_KEY = 'cortex_auto_apply_rules';
  var TIMELINE_OPTIONS = ['1 week', '2 weeks', '1 month', '3 months', 'Ongoing'];

  // ─── Rule Schema ──────────────────────────────────────────────────
  // Each rule:
  // {
  //   id: string,
  //   name: string,
  //   enabled: boolean,
  //   conditions: { ... },
  //   template: { ... },
  //   priority: number,
  //   createdAt: string,
  //   matchCount: number,
  //   lastMatchedAt: string|null
  // }

  // ─── Storage Helpers ──────────────────────────────────────────────

  function _readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; }
  }

  function _writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota */ }
  }

  function getApplications() { return _readJSON(STORAGE_KEY) || []; }

  function saveApplication(entry) {
    var apps = getApplications();
    apps.unshift(entry);
    _writeJSON(STORAGE_KEY, apps);
  }

  function isApplied(jobUrl) {
    return getApplications().some(function (a) { return a.jobUrl === jobUrl; });
  }

  // ─── Rules CRUD ───────────────────────────────────────────────────

  function getRules() { return _readJSON(RULES_KEY) || []; }

  function saveRules(rules) { _writeJSON(RULES_KEY, rules); }

  function _genId() { return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); }

  /**
   * Create a new auto-apply rule.
   * @param {Object} opts
   * @param {string} opts.name - Rule display name
   * @param {Object} opts.conditions - Matching conditions
   * @param {string[]} [opts.conditions.requiredSkills] - Job must have ALL of these
   * @param {string[]} [opts.conditions.anySkills] - Job must have at least ONE of these
   * @param {string[]} [opts.conditions.excludeSkills] - Skip if job has any of these
   * @param {number} [opts.conditions.minBudget] - Min budget in USD
   * @param {number} [opts.conditions.maxBudget] - Max budget in USD
   * @param {string} [opts.conditions.budgetType] - 'hourly' | 'fixed' | 'any'
   * @param {string[]} [opts.conditions.keywords] - Title/desc must contain at least one
   * @param {string[]} [opts.conditions.excludeKeywords] - Skip if title/desc contains any
   * @param {number} [opts.conditions.minClientRating] - 0-5
   * @param {number} [opts.conditions.minClientSpent] - Min total client spend
   * @param {number} [opts.conditions.maxProposals] - Skip if too many proposals already
   * @param {number} [opts.conditions.minMatchScore] - Min bid strategy score (0-100)
   * @param {string} [opts.conditions.category] - Category match
   * @param {Object} opts.template - Proposal template
   * @param {string} opts.template.coverLetter - Template text (supports {{job_title}}, {{client_name}}, {{skills}})
   * @param {number} [opts.template.rate] - Bid rate override
   * @param {string} [opts.template.timeline] - Timeline
   * @param {number} [opts.priority] - Higher = evaluated first
   * @returns {Object} created rule
   */
  function createRule(opts) {
    opts = opts || {};
    var rule = {
      id: _genId(),
      name: opts.name || 'Untitled Rule',
      enabled: true,
      conditions: opts.conditions || {},
      template: opts.template || {},
      priority: opts.priority || 0,
      createdAt: new Date().toISOString(),
      matchCount: 0,
      lastMatchedAt: null
    };
    var rules = getRules();
    rules.push(rule);
    rules.sort(function (a, b) { return b.priority - a.priority; });
    saveRules(rules);
    return rule;
  }

  /**
   * Update a rule by ID.
   */
  function updateRule(ruleId, updates) {
    var rules = getRules();
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].id === ruleId) {
        for (var key in updates) {
          if (updates.hasOwnProperty(key) && key !== 'id') {
            rules[i][key] = updates[key];
          }
        }
        saveRules(rules);
        return rules[i];
      }
    }
    return null;
  }

  /**
   * Delete a rule by ID.
   */
  function deleteRule(ruleId) {
    var rules = getRules().filter(function (r) { return r.id !== ruleId; });
    saveRules(rules);
  }

  /**
   * Toggle rule enabled/disabled.
   */
  function toggleRule(ruleId) {
    return updateRule(ruleId, { enabled: !getRules().find(function (r) { return r.id === ruleId; }).enabled });
  }

  // ─── Rule Matching Engine ─────────────────────────────────────────

  /**
   * Check if a single job matches a rule's conditions.
   * @param {Object} job - Job data
   * @param {Object} conditions - Rule conditions
   * @returns {{ matches: boolean, reasons: string[] }}
   */
  function _matchConditions(job, conditions) {
    var c = conditions || {};
    var reasons = [];
    var jobSkills = (job.skills || []).map(function (s) { return s.toLowerCase(); });
    var jobTitle = (job.title || '').toLowerCase();
    var jobDesc = (job.description || '').toLowerCase();
    var jobText = jobTitle + ' ' + jobDesc;
    var budget = job.budget || job.budgetMax || 0;

    // Required skills — ALL must be present
    if (c.requiredSkills && c.requiredSkills.length > 0) {
      var allPresent = c.requiredSkills.every(function (s) { return jobSkills.indexOf(s.toLowerCase()) !== -1; });
      if (!allPresent) return { matches: false, reasons: ['Missing required skill(s)'] };
      reasons.push('Has all required skills');
    }

    // Any skills — at least ONE must be present
    if (c.anySkills && c.anySkills.length > 0) {
      var anyPresent = c.anySkills.some(function (s) { return jobSkills.indexOf(s.toLowerCase()) !== -1; });
      if (!anyPresent) return { matches: false, reasons: ['No matching skills from anySkills list'] };
      reasons.push('Has at least one target skill');
    }

    // Exclude skills
    if (c.excludeSkills && c.excludeSkills.length > 0) {
      var excluded = c.excludeSkills.some(function (s) { return jobSkills.indexOf(s.toLowerCase()) !== -1; });
      if (excluded) return { matches: false, reasons: ['Contains excluded skill'] };
    }

    // Budget range
    if (c.minBudget && budget > 0 && budget < c.minBudget) return { matches: false, reasons: ['Budget too low'] };
    if (c.maxBudget && budget > c.maxBudget) return { matches: false, reasons: ['Budget too high'] };
    if (c.minBudget && budget >= c.minBudget) reasons.push('Budget meets minimum ($' + budget + ')');

    // Budget type
    if (c.budgetType && c.budgetType !== 'any') {
      var jobBudgetType = job.budgetType || 'fixed';
      if (jobBudgetType !== c.budgetType) return { matches: false, reasons: ['Wrong budget type'] };
    }

    // Keywords — at least one must appear in title or description
    if (c.keywords && c.keywords.length > 0) {
      var keywordMatch = c.keywords.some(function (kw) { return jobText.indexOf(kw.toLowerCase()) !== -1; });
      if (!keywordMatch) return { matches: false, reasons: ['No keyword match'] };
      reasons.push('Contains target keyword');
    }

    // Exclude keywords
    if (c.excludeKeywords && c.excludeKeywords.length > 0) {
      var excludeMatch = c.excludeKeywords.some(function (kw) { return jobText.indexOf(kw.toLowerCase()) !== -1; });
      if (excludeMatch) return { matches: false, reasons: ['Contains excluded keyword'] };
    }

    // Client rating
    if (c.minClientRating && (job.clientRating || 0) < c.minClientRating) {
      return { matches: false, reasons: ['Client rating too low'] };
    }

    // Client spend
    if (c.minClientSpent && (job.clientSpent || 0) < c.minClientSpent) {
      return { matches: false, reasons: ['Client total spend too low'] };
    }

    // Max proposals
    if (c.maxProposals && (job.proposalCount || job.proposals || 0) > c.maxProposals) {
      return { matches: false, reasons: ['Too many proposals already'] };
    }

    // Min match score (integrates with bid strategy)
    if (c.minMatchScore && job.matchScore != null && job.matchScore < c.minMatchScore) {
      return { matches: false, reasons: ['Match score too low'] };
    }

    // Category
    if (c.category && job.category && job.category.toLowerCase() !== c.category.toLowerCase()) {
      return { matches: false, reasons: ['Category mismatch'] };
    }

    reasons.push('All conditions met');
    return { matches: true, reasons: reasons };
  }

  /**
   * Apply template variable substitution.
   */
  function _applyTemplate(template, job, profile) {
    var text = template.coverLetter || '';
    text = text.replace(/\{\{job_title\}\}/g, job.title || 'your project');
    text = text.replace(/\{\{client_name\}\}/g, job.clientName || 'there');
    text = text.replace(/\{\{skills\}\}/g, (job.skills || []).join(', '));
    text = text.replace(/\{\{my_name\}\}/g, (profile && profile.name) || 'I');
    text = text.replace(/\{\{my_rate\}\}/g, '$' + (template.rate || (profile && (profile.hourlyRate || profile.rate)) || '?'));
    text = text.replace(/\{\{budget\}\}/g, '$' + (job.budget || '?'));
    text = text.replace(/\{\{category\}\}/g, job.category || 'your category');
    return text;
  }

  /**
   * Find the first matching rule for a job.
   * Rules are sorted by priority.
   * @param {Object} job
   * @param {Object} [profileData]
   * @returns {{ rule: Object, match: Object, proposal: string }|null}
   */
  function findMatchingRule(job, profileData) {
    var rules = getRules().filter(function (r) { return r.enabled; });
    for (var i = 0; i < rules.length; i++) {
      var result = _matchConditions(job, rules[i].conditions);
      if (result.matches) {
        var proposal = _applyTemplate(rules[i].template, job, profileData);
        return {
          rule: rules[i],
          match: result,
          proposal: proposal,
          rate: rules[i].template.rate || (profileData && (profileData.hourlyRate || profileData.rate)) || null,
          timeline: rules[i].template.timeline || null
        };
      }
    }
    return null;
  }

  /**
   * Evaluate all rules against a list of jobs.
   * Returns array of { job, rule, match, proposal } for matches.
   */
  function evaluateJobs(jobs, profileData) {
    var results = [];
    var rules = getRules().filter(function (r) { return r.enabled; });

    (jobs || []).forEach(function (job) {
      // Skip already-applied jobs
      if (job.url && isApplied(job.url)) return;

      for (var i = 0; i < rules.length; i++) {
        var result = _matchConditions(job, rules[i].conditions);
        if (result.matches) {
          var proposal = _applyTemplate(rules[i].template, job, profileData);

          // Update match count
          rules[i].matchCount = (rules[i].matchCount || 0) + 1;
          rules[i].lastMatchedAt = new Date().toISOString();

          results.push({
            job: job,
            rule: rules[i],
            match: result,
            proposal: proposal,
            rate: rules[i].template.rate || (profileData && (profileData.hourlyRate || profileData.rate)) || null,
            timeline: rules[i].template.timeline || null
          });
          break; // First matching rule wins
        }
      }
    });

    saveRules(rules); // persist match counts
    return results;
  }

  /**
   * Get rule performance stats.
   */
  function getRuleStats() {
    return getRules().map(function (r) {
      return {
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        matchCount: r.matchCount || 0,
        lastMatchedAt: r.lastMatchedAt,
        conditionCount: Object.keys(r.conditions || {}).filter(function (k) {
          var v = r.conditions[k];
          return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
        }).length
      };
    });
  }

  /**
   * Create common preset rules.
   */
  function createPresetRules(profileData) {
    var rate = (profileData && (profileData.hourlyRate || profileData.rate)) || 50;
    var skills = (profileData && profileData.skills) || [];

    // High-value hourly
    createRule({
      name: '💰 High-Value Hourly Jobs',
      conditions: {
        budgetType: 'hourly',
        minBudget: rate * 0.9,
        maxProposals: 15,
        minClientRating: 4.0
      },
      template: {
        coverLetter: 'Hi {{client_name}},\n\nI\'m excited about {{job_title}}. With my experience in {{skills}}, I can deliver high-quality results efficiently.\n\nI\'d love to discuss the project scope and how I can help. Available to start immediately.\n\nBest,\n{{my_name}}',
        rate: rate,
        timeline: '1 month'
      },
      priority: 10
    });

    // Skill-match
    if (skills.length >= 2) {
      createRule({
        name: '🎯 Skill-Match Jobs',
        conditions: {
          anySkills: skills.slice(0, 5),
          maxProposals: 20,
          minClientRating: 3.5
        },
        template: {
          coverLetter: 'Hi {{client_name}},\n\nYour project "{{job_title}}" caught my attention as it aligns perfectly with my skill set.\n\nI have hands-on experience with {{skills}} and have delivered similar projects successfully.\n\nLet me know if you\'d like to discuss the details!\n\nBest,\n{{my_name}}',
          rate: rate,
          timeline: '2 weeks'
        },
        priority: 5
      });
    }

    // Quick wins (low competition)
    createRule({
      name: '⚡ Quick Win — Low Competition',
      conditions: {
        maxProposals: 5,
        minClientSpent: 1000,
        minClientRating: 4.0
      },
      template: {
        coverLetter: 'Hi {{client_name}},\n\nI noticed your new posting for "{{job_title}}" and wanted to reach out quickly.\n\nI\'m confident I can deliver excellent results based on my relevant experience. Happy to discuss timeline and approach.\n\nBest,\n{{my_name}}',
        rate: rate,
        timeline: '1 week'
      },
      priority: 15
    });

    return getRules();
  }

  // ─── Legacy UI: CSS Injection ─────────────────────────────────────

  var cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent = _getCSS();
    document.head.appendChild(style);
  }

  function esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // ─── Legacy UI: Apply Button ──────────────────────────────────────

  function renderAutoApplyButton(jobCard, jobData, profileData) {
    injectCSS();
    if (!jobCard || !jobData) return;
    if (jobCard.querySelector('.aa-btn')) return;

    var footer = jobCard.querySelector('.jm-card-footer') || jobCard;
    var btn = document.createElement('button');
    btn.className = 'aa-btn';

    // Check for auto-apply rule match
    var ruleMatch = findMatchingRule(jobData, profileData);

    if (isApplied(jobData.url)) {
      btn.textContent = '✅ Applied';
      btn.classList.add('aa-btn--applied');
      btn.disabled = true;
    } else if (ruleMatch) {
      btn.textContent = '⚡ Auto-Apply';
      btn.classList.add('aa-btn--auto');
      btn.title = 'Rule: ' + ruleMatch.rule.name;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openApplyModal(jobData, profileData, ruleMatch);
      });
    } else {
      btn.textContent = '🚀 Apply Now';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openApplyModal(jobData, profileData, null);
      });
    }

    footer.appendChild(btn);
  }

  // ─── Legacy UI: Apply Modal ───────────────────────────────────────

  function openApplyModal(jobData, profileData, ruleMatch) {
    injectCSS();
    var step = ruleMatch ? 2 : 1; // Skip review if auto-matched
    var proposalText = ruleMatch ? ruleMatch.proposal : '';
    var rate = ruleMatch ? (ruleMatch.rate || '') : ((profileData && profileData.hourlyRate) ? String(profileData.hourlyRate) : '');
    var timeline = ruleMatch ? (ruleMatch.timeline || TIMELINE_OPTIONS[2]) : TIMELINE_OPTIONS[2];
    var estimatedHours = '';
    var proposalLoading = false;
    var proposalError = '';

    var overlay = document.createElement('div');
    overlay.className = 'aa-overlay';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    var modal = document.createElement('div');
    modal.className = 'aa-modal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function closeModal() {
      document.body.removeChild(overlay);
      document.body.style.overflow = '';
    }

    function render() {
      var h = '';
      h += '<div class="aa-modal-header">';
      if (ruleMatch) {
        h += '<div class="aa-rule-badge">⚡ ' + esc(ruleMatch.rule.name) + '</div>';
      }
      h += '<div class="aa-steps">';
      h += '<span class="aa-step' + (step >= 1 ? ' aa-step--active' : '') + '">1. Review</span>';
      h += '<span class="aa-step-sep">→</span>';
      h += '<span class="aa-step' + (step >= 2 ? ' aa-step--active' : '') + '">2. Customize</span>';
      h += '<span class="aa-step-sep">→</span>';
      h += '<span class="aa-step' + (step >= 3 ? ' aa-step--active' : '') + '">3. Submit</span>';
      h += '</div>';
      h += '<button class="aa-close" id="aa-close">&times;</button>';
      h += '</div>';

      h += '<div class="aa-modal-body">';
      if (step === 1) h += _renderStep1(jobData);
      else if (step === 2) h += _renderStep2(jobData, proposalText, rate, timeline, estimatedHours, proposalLoading, proposalError);
      else if (step === 3) h += _renderStep3(jobData, proposalText, rate);
      h += '</div>';

      h += '<div class="aa-modal-footer">';
      if (step > 1) h += '<button class="aa-btn-secondary" id="aa-prev">← Back</button>';
      else h += '<span></span>';
      if (step < 3) h += '<button class="aa-btn-primary" id="aa-next">' + (step === 1 ? 'Customize →' : 'Submit →') + '</button>';
      else h += '<button class="aa-btn-primary aa-btn-success" id="aa-done">✅ Mark as Applied</button>';
      h += '</div>';

      modal.innerHTML = h;

      modal.querySelector('#aa-close').addEventListener('click', closeModal);
      var prevBtn = modal.querySelector('#aa-prev');
      if (prevBtn) prevBtn.addEventListener('click', function () { step--; render(); });
      var nextBtn = modal.querySelector('#aa-next');
      if (nextBtn) nextBtn.addEventListener('click', function () {
        if (step === 2) captureStep2();
        step++;
        render();
        if (step === 2 && !proposalText && !proposalLoading) fetchProposal();
      });
      var doneBtn = modal.querySelector('#aa-done');
      if (doneBtn) doneBtn.addEventListener('click', function () {
        captureStep2();
        saveApplication({
          jobTitle: jobData.title || 'Untitled',
          jobUrl: jobData.url || '',
          appliedAt: new Date().toISOString(),
          proposalText: proposalText,
          rate: rate,
          status: 'applied',
          autoRule: ruleMatch ? ruleMatch.rule.name : null
        });
        closeModal();
        refreshAppliedBadges();
      });
    }

    function captureStep2() {
      var ta = modal.querySelector('#aa-proposal');
      if (ta) proposalText = ta.value;
      var ri = modal.querySelector('#aa-rate');
      if (ri) rate = ri.value;
      var tl = modal.querySelector('#aa-timeline');
      if (tl) timeline = tl.value;
      var eh = modal.querySelector('#aa-hours');
      if (eh) estimatedHours = eh.value;
    }

    function fetchProposal() {
      proposalLoading = true;
      render();
      fetch('/api/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: jobData, profile: profileData })
      }).then(function (res) { return res.json(); })
        .then(function (data) { proposalLoading = false; proposalText = (data && data.proposal) || ''; render(); })
        .catch(function (err) { proposalLoading = false; proposalError = err.message || 'Failed'; render(); });
    }

    render();
  }

  // ─── Step Renderers ───────────────────────────────────────────────

  function _renderStep1(jobData) {
    var h = '<h2 class="aa-job-title">' + esc(jobData.title || 'Untitled Job') + '</h2>';
    h += '<div class="aa-info-grid">';
    if (jobData.budget) h += '<div class="aa-info-item"><span class="aa-info-label">💰 Budget</span><span class="aa-info-value">' + esc(String(jobData.budget)) + '</span></div>';
    if (jobData.type || jobData.contractType) h += '<div class="aa-info-item"><span class="aa-info-label">📋 Type</span><span class="aa-info-value">' + esc(jobData.type || jobData.contractType || '') + '</span></div>';
    h += '</div>';
    if (jobData.description) h += '<div class="aa-description"><h4>Description</h4><div class="aa-desc-text">' + esc(jobData.description) + '</div></div>';
    if (jobData.skills && jobData.skills.length) {
      h += '<div class="aa-skills">';
      jobData.skills.forEach(function (s) { h += '<span class="aa-skill-tag">' + esc(s) + '</span>'; });
      h += '</div>';
    }
    return h;
  }

  function _renderStep2(jobData, proposal, rate, timeline, hours, loading, error) {
    var h = '<h2 class="aa-section-title">✍️ Customize Proposal</h2>';
    if (loading) h += '<div class="aa-loading"><div class="aa-spinner"></div><span>Generating…</span></div>';
    if (error) h += '<div class="aa-error">' + esc(error) + '</div>';
    h += '<label class="aa-label">Cover Letter</label>';
    h += '<textarea class="aa-textarea" id="aa-proposal" rows="10"' + (loading ? ' disabled' : '') + '>' + esc(proposal) + '</textarea>';
    h += '<div class="aa-form-row">';
    h += '<div class="aa-form-group"><label class="aa-label">💰 Rate ($/hr)</label><input type="number" class="aa-input" id="aa-rate" value="' + esc(rate) + '" min="1" /></div>';
    h += '<div class="aa-form-group"><label class="aa-label">📅 Timeline</label><select class="aa-select" id="aa-timeline">';
    TIMELINE_OPTIONS.forEach(function (opt) { h += '<option' + (opt === timeline ? ' selected' : '') + '>' + esc(opt) + '</option>'; });
    h += '</select></div>';
    h += '<div class="aa-form-group"><label class="aa-label">⏱️ Hours</label><input type="number" class="aa-input" id="aa-hours" value="' + esc(hours) + '" min="1" /></div>';
    h += '</div>';
    return h;
  }

  function _renderStep3(jobData, proposal, rate) {
    var h = '<h2 class="aa-section-title">🚀 Submit on Upwork</h2>';
    h += '<div class="aa-submit-actions">';
    h += '<button class="aa-btn-primary aa-btn-wide" id="aa-copy">📋 Copy Proposal</button>';
    h += '<button class="aa-btn-primary aa-btn-wide aa-btn-upwork" id="aa-open-upwork">🔗 Open on Upwork</button>';
    h += '</div>';
    h += '<div class="aa-proposal-preview"><h4>Preview</h4><div class="aa-preview-text">' + esc(proposal).replace(/\n/g, '<br>') + '</div></div>';
    return h;
  }

  // ─── Utility ──────────────────────────────────────────────────────

  function refreshAppliedBadges() {
    document.querySelectorAll('.jm-card').forEach(function (card) {
      var link = card.querySelector('.jm-card-title');
      if (!link) return;
      var url = link.getAttribute('href');
      if (url && isApplied(url)) {
        var btn = card.querySelector('.aa-btn');
        if (btn && !btn.classList.contains('aa-btn--applied')) {
          btn.textContent = '✅ Applied';
          btn.classList.add('aa-btn--applied');
          btn.disabled = true;
        }
      }
    });
  }

  function renderApplicationsDashboard(containerId) {
    injectCSS();
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    var apps = getApplications();
    var h = '<div class="aa-dashboard"><div class="aa-dash-header"><h3 class="aa-dash-title">📋 My Applications</h3>';
    h += '<span class="aa-dash-count">' + apps.length + ' total</span></div>';

    if (apps.length === 0) {
      h += '<div class="aa-dash-empty"><p>No applications yet.</p></div>';
    } else {
      h += '<div class="aa-dash-list">';
      apps.forEach(function (app) {
        var date = '';
        try { date = new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) {}
        h += '<div class="aa-dash-item"><div class="aa-dash-item-main">';
        h += '<a href="' + esc(app.jobUrl || '#') + '" target="_blank" class="aa-dash-job-title">' + esc(app.jobTitle) + '</a>';
        h += '<div class="aa-dash-meta"><span class="aa-dash-date">' + esc(date) + '</span>';
        if (app.autoRule) h += '<span style="color:#fbbf24;font-size:11px;">⚡ ' + esc(app.autoRule) + '</span>';
        if (app.rate) h += '<span class="aa-dash-rate">$' + esc(String(app.rate)) + '/hr</span>';
        h += '</div></div></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    container.innerHTML = h;
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  function _getCSS() {
    return '' +
    '.aa-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:10000;display:flex;align-items:center;justify-content:center;animation:aa-fadein .2s}' +
    '@keyframes aa-fadein{from{opacity:0}to{opacity:1}}' +
    '.aa-modal{background:#1a1a2e;color:#e0e0e0;border-radius:16px;width:90vw;max-width:720px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.6)}' +
    '.aa-modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 12px;border-bottom:1px solid #2a2a4a;flex-wrap:wrap;gap:8px}' +
    '.aa-rule-badge{background:#fbbf2420;color:#fbbf24;font-size:12px;font-weight:600;padding:4px 10px;border-radius:6px;border:1px solid #fbbf2433}' +
    '.aa-steps{display:flex;align-items:center;gap:8px;font-size:14px}' +
    '.aa-step{color:#666;font-weight:500}.aa-step--active{color:#00ff88}.aa-step-sep{color:#444;font-size:12px}' +
    '.aa-close{background:none;border:none;color:#888;font-size:24px;cursor:pointer;padding:4px 8px;border-radius:8px}' +
    '.aa-close:hover{background:#2a2a4a;color:#fff}' +
    '.aa-modal-body{flex:1;overflow-y:auto;padding:24px}' +
    '.aa-modal-footer{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-top:1px solid #2a2a4a}' +
    '.aa-btn{background:linear-gradient(135deg,#00cc6a,#00aa55);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}' +
    '.aa-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,204,106,.4)}' +
    '.aa-btn--applied{background:#2a2a4a;color:#00ff88;cursor:default;pointer-events:none}' +
    '.aa-btn--auto{background:linear-gradient(135deg,#f59e0b,#d97706)}' +
    '.aa-btn--auto:hover{box-shadow:0 4px 16px rgba(245,158,11,.4)}' +
    '.aa-btn-primary{background:linear-gradient(135deg,#00cc6a,#00aa55);color:#fff;border:none;padding:10px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}' +
    '.aa-btn-secondary{background:#2a2a4a;color:#ccc;border:1px solid #3a3a5a;padding:10px 24px;border-radius:10px;font-size:14px;cursor:pointer}' +
    '.aa-btn-wide{flex:1;text-align:center}.aa-btn-upwork{background:linear-gradient(135deg,#14a800,#108a00)}' +
    '.aa-btn-success{background:linear-gradient(135deg,#00cc6a,#00ff88);font-size:16px;padding:12px 32px}' +
    '.aa-job-title{font-size:22px;font-weight:700;margin:0 0 16px;color:#fff}' +
    '.aa-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}' +
    '.aa-info-item{background:#16213e;border-radius:10px;padding:12px 16px}' +
    '.aa-info-label{display:block;font-size:12px;color:#888;margin-bottom:4px}' +
    '.aa-info-value{font-size:16px;font-weight:600;color:#fff}' +
    '.aa-description{margin-bottom:16px}.aa-description h4{font-size:14px;color:#888;margin:0 0 8px}' +
    '.aa-desc-text{font-size:14px;line-height:1.6;color:#ccc;max-height:200px;overflow-y:auto;white-space:pre-wrap}' +
    '.aa-skills{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}' +
    '.aa-skill-tag{background:#16213e;color:#00cc6a;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:500}' +
    '.aa-section-title{font-size:20px;font-weight:700;margin:0 0 16px;color:#fff}' +
    '.aa-label{display:block;font-size:13px;color:#aaa;margin-bottom:6px;font-weight:500}' +
    '.aa-textarea{width:100%;background:#0f0f23;color:#e0e0e0;border:1px solid #2a2a4a;border-radius:10px;padding:14px;font-size:14px;line-height:1.6;resize:vertical;font-family:inherit;box-sizing:border-box}' +
    '.aa-textarea:focus{outline:none;border-color:#00cc6a}' +
    '.aa-form-row{display:flex;gap:16px;margin-top:20px;flex-wrap:wrap}' +
    '.aa-form-group{flex:1;min-width:140px}' +
    '.aa-input,.aa-select{width:100%;background:#0f0f23;color:#e0e0e0;border:1px solid #2a2a4a;border-radius:8px;padding:10px 14px;font-size:14px;font-family:inherit;box-sizing:border-box}' +
    '.aa-input:focus,.aa-select:focus{outline:none;border-color:#00cc6a}' +
    '.aa-loading{display:flex;align-items:center;gap:12px;padding:16px;background:#16213e;border-radius:10px;margin-bottom:16px}' +
    '.aa-spinner{width:24px;height:24px;border:3px solid #333;border-top-color:#00cc6a;border-radius:50%;animation:aa-spin .8s linear infinite}' +
    '@keyframes aa-spin{to{transform:rotate(360deg)}}' +
    '.aa-error{background:#2a1520;color:#ff6666;padding:12px 16px;border-radius:8px;margin-bottom:12px;font-size:13px}' +
    '.aa-submit-actions{display:flex;gap:12px;margin-bottom:24px}' +
    '.aa-proposal-preview{background:#0f0f23;border:1px solid #2a2a4a;border-radius:10px;padding:16px;margin-top:12px}' +
    '.aa-proposal-preview h4{font-size:13px;color:#666;margin:0 0 10px}' +
    '.aa-preview-text{font-size:13px;line-height:1.6;color:#aaa}' +
    '.aa-dashboard{background:#1a1a2e;border-radius:16px;padding:24px;margin-top:24px}' +
    '.aa-dash-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}' +
    '.aa-dash-title{font-size:18px;font-weight:700;color:#fff;margin:0}' +
    '.aa-dash-count{font-size:13px;color:#888;background:#16213e;padding:4px 12px;border-radius:20px}' +
    '.aa-dash-empty{text-align:center;padding:40px 20px;color:#666}' +
    '.aa-dash-list{display:flex;flex-direction:column;gap:8px}' +
    '.aa-dash-item{display:flex;align-items:center;padding:14px 16px;background:#16213e;border-radius:10px}' +
    '.aa-dash-item-main{flex:1;min-width:0}' +
    '.aa-dash-job-title{color:#00cc6a;text-decoration:none;font-weight:600;font-size:14px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.aa-dash-meta{display:flex;gap:12px;margin-top:4px;font-size:12px}' +
    '.aa-dash-date{color:#888}.aa-dash-rate{color:#888}' +
    '@media(max-width:600px){.aa-modal{width:100vw;max-width:100vw;border-radius:0;height:100vh}.aa-form-row{flex-direction:column}.aa-submit-actions{flex-direction:column}}';
  }

  // ─── Public API ───────────────────────────────────────────────────

  var api = {
    // Rules engine (CF-067)
    createRule: createRule,
    updateRule: updateRule,
    deleteRule: deleteRule,
    toggleRule: toggleRule,
    getRules: getRules,
    getRuleStats: getRuleStats,
    findMatchingRule: findMatchingRule,
    evaluateJobs: evaluateJobs,
    createPresetRules: createPresetRules,
    // Legacy UI (UW-009)
    renderAutoApplyButton: renderAutoApplyButton,
    renderApplicationsDashboard: renderApplicationsDashboard,
    getApplications: getApplications,
    isApplied: isApplied,
    refreshAppliedBadges: refreshAppliedBadges
  };

  window.CortexFreelancer.autoApply = api;
  window.CortexAutoApply = api; // Legacy compat

})();
