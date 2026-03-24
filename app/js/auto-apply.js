/**
 * [CF-067] Auto-Apply Rules Engine + One-Click Apply Flow
 *
 * Two systems in one:
 * 1. Rules Engine: Configure criteria-based auto-apply rules with pre-approved proposal templates
 * 2. Apply Flow: Renders "🚀 Apply Now" buttons, 3-step modal (Review → Customize → Submit),
 *    application tracking, and "My Applications" dashboard.
 *
 * Exposed as window.CortexFreelancer.AutoApply AND window.CortexAutoApply (legacy)
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────
  var STORAGE_KEY = 'cortex_applications';
  var RULES_KEY = 'cortex_auto_apply_rules';
  var TEMPLATES_KEY = 'cortex_proposal_templates';
  var RULES_LOG_KEY = 'cortex_auto_apply_log';
  var TIMELINE_OPTIONS = ['1 week', '2 weeks', '1 month', '3 months', 'Ongoing'];

  // ─── Inject CSS (once) ────────────────────────────────────────────
  var cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent = getCSS();
    document.head.appendChild(style);
  }

  // ─── HTML escape ──────────────────────────────────────────────────
  function esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // ─── localStorage helpers ─────────────────────────────────────────
  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function saveJSON(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
  }

  function getApplications() { return loadJSON(STORAGE_KEY) || []; }

  function saveApplication(entry) {
    var apps = getApplications();
    apps.unshift(entry);
    saveJSON(STORAGE_KEY, apps);
  }

  function isApplied(jobUrl) {
    return getApplications().some(function (a) { return a.jobUrl === jobUrl; });
  }

  // ════════════════════════════════════════════════════════════════════
  //  RULES ENGINE
  // ════════════════════════════════════════════════════════════════════

  /* ── Rule CRUD ── */

  function getRules() { return loadJSON(RULES_KEY) || []; }
  function saveRules(rules) { saveJSON(RULES_KEY, rules); }

  function createRule(rule) {
    var rules = getRules();
    rule.id = rule.id || 'rule_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
    rule.enabled = rule.enabled !== false;
    rule.createdAt = new Date().toISOString();
    rule.matchCount = 0;
    rule.applyCount = 0;

    // Normalize criteria
    rule.criteria = normalizeCriteria(rule.criteria || {});

    rules.push(rule);
    saveRules(rules);
    return rule;
  }

  function updateRule(ruleId, updates) {
    var rules = getRules();
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].id === ruleId) {
        Object.keys(updates).forEach(function (k) { rules[i][k] = updates[k]; });
        if (updates.criteria) rules[i].criteria = normalizeCriteria(updates.criteria);
        rules[i].updatedAt = new Date().toISOString();
        break;
      }
    }
    saveRules(rules);
  }

  function deleteRule(ruleId) {
    var rules = getRules().filter(function (r) { return r.id !== ruleId; });
    saveRules(rules);
  }

  function toggleRule(ruleId) {
    var rules = getRules();
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].id === ruleId) {
        rules[i].enabled = !rules[i].enabled;
        break;
      }
    }
    saveRules(rules);
  }

  function normalizeCriteria(c) {
    return {
      // Skill matching
      requiredSkills: (c.requiredSkills || []).map(function (s) { return s.toLowerCase().trim(); }),
      minSkillMatch: c.minSkillMatch || 0, // 0-100 percentage

      // Budget
      minBudget: c.minBudget || 0,
      maxBudget: c.maxBudget || Infinity,
      budgetType: c.budgetType || null, // 'hourly', 'fixed', or null (any)
      minHourlyRate: c.minHourlyRate || 0,

      // Client quality
      minClientRating: c.minClientRating || 0,
      minClientSpent: c.minClientSpent || 0,
      minClientHireRate: c.minClientHireRate || 0,

      // Job freshness
      maxAgeHours: c.maxAgeHours || null,
      maxProposals: c.maxProposals || null,

      // Keywords
      titleKeywords: (c.titleKeywords || []).map(function (k) { return k.toLowerCase().trim(); }),
      excludeKeywords: (c.excludeKeywords || []).map(function (k) { return k.toLowerCase().trim(); }),

      // Category / type
      categories: c.categories || [],

      // Bid strategy integration
      minBidScore: c.minBidScore || 0 // minimum bid strategy score to apply
    };
  }

  /* ── Rule Matching ── */

  function matchJobToRules(job, profileData) {
    var rules = getRules().filter(function (r) { return r.enabled; });
    var matches = [];

    rules.forEach(function (rule) {
      var result = evaluateRule(rule, job, profileData);
      if (result.matched) {
        matches.push({
          rule: rule,
          matchResult: result,
          templateId: rule.templateId || null
        });
      }
    });

    return matches;
  }

  function evaluateRule(rule, job, profileData) {
    var c = rule.criteria;
    var reasons = [];
    var passed = true;

    // Skill match
    if (c.requiredSkills.length > 0) {
      var jobSkills = (job.skills || []).map(function (s) { return s.toLowerCase().trim(); });
      var matched = c.requiredSkills.filter(function (s) { return jobSkills.indexOf(s) !== -1; });
      var matchPct = (matched.length / c.requiredSkills.length) * 100;

      if (c.minSkillMatch > 0 && matchPct < c.minSkillMatch) {
        passed = false;
        reasons.push('Skill match ' + Math.round(matchPct) + '% < required ' + c.minSkillMatch + '%');
      } else if (matched.length > 0) {
        reasons.push('Skill match: ' + matched.length + '/' + c.requiredSkills.length);
      }
    }

    // Budget
    var budget = job.budget || job.budgetMax || 0;
    if (c.minBudget > 0 && budget > 0 && budget < c.minBudget) {
      passed = false;
      reasons.push('Budget $' + budget + ' < min $' + c.minBudget);
    }
    if (c.maxBudget < Infinity && budget > c.maxBudget) {
      passed = false;
      reasons.push('Budget $' + budget + ' > max $' + c.maxBudget);
    }

    // Budget type
    if (c.budgetType && job.budgetType && job.budgetType !== c.budgetType) {
      passed = false;
      reasons.push('Budget type ' + job.budgetType + ' ≠ required ' + c.budgetType);
    }

    // Hourly rate
    if (c.minHourlyRate > 0 && job.budgetType === 'hourly' && budget > 0 && budget < c.minHourlyRate) {
      passed = false;
      reasons.push('Hourly rate $' + budget + ' < min $' + c.minHourlyRate);
    }

    // Client quality
    if (c.minClientRating > 0 && job.clientRating > 0 && job.clientRating < c.minClientRating) {
      passed = false;
      reasons.push('Client rating ' + job.clientRating + ' < min ' + c.minClientRating);
    }
    if (c.minClientSpent > 0 && job.clientSpent >= 0 && job.clientSpent < c.minClientSpent) {
      passed = false;
      reasons.push('Client spent $' + job.clientSpent + ' < min $' + c.minClientSpent);
    }

    // Freshness
    if (c.maxAgeHours && job.postedAt) {
      var ageHours = (Date.now() - new Date(job.postedAt).getTime()) / 3.6e6;
      if (ageHours > c.maxAgeHours) {
        passed = false;
        reasons.push('Job is ' + Math.round(ageHours) + 'h old > max ' + c.maxAgeHours + 'h');
      }
    }

    // Max proposals
    if (c.maxProposals && job.proposalCount > c.maxProposals) {
      passed = false;
      reasons.push(job.proposalCount + ' proposals > max ' + c.maxProposals);
    }

    // Title keywords (must contain at least one)
    if (c.titleKeywords.length > 0) {
      var titleLower = (job.title || '').toLowerCase();
      var hasKeyword = c.titleKeywords.some(function (k) { return titleLower.indexOf(k) !== -1; });
      if (!hasKeyword) {
        passed = false;
        reasons.push('Title missing required keywords');
      }
    }

    // Exclude keywords
    if (c.excludeKeywords.length > 0) {
      var fullText = ((job.title || '') + ' ' + (job.description || '')).toLowerCase();
      var hasExcluded = c.excludeKeywords.find(function (k) { return fullText.indexOf(k) !== -1; });
      if (hasExcluded) {
        passed = false;
        reasons.push('Contains excluded keyword: "' + hasExcluded + '"');
      }
    }

    // Bid strategy score
    if (c.minBidScore > 0 && profileData) {
      var bidModule = window.CortexFreelancer.BidStrategy || window.CortexFreelancer.bidStrategy;
      if (bidModule && bidModule.analyzeBid) {
        var bidResult = bidModule.analyzeBid(job, profileData);
        if (bidResult.score < c.minBidScore) {
          passed = false;
          reasons.push('Bid score ' + bidResult.score + ' < min ' + c.minBidScore);
        } else {
          reasons.push('Bid score: ' + bidResult.score);
        }
      }
    }

    return { matched: passed, reasons: reasons };
  }

  /* ── Auto-Apply Execution ── */

  function processJobs(jobs, profileData, options) {
    options = options || {};
    var dryRun = options.dryRun !== false; // Default to dry run for safety
    var results = [];

    jobs.forEach(function (job) {
      if (isApplied(job.url)) {
        results.push({ job: job, action: 'skipped', reason: 'Already applied' });
        return;
      }

      var matches = matchJobToRules(job, profileData);
      if (matches.length === 0) {
        results.push({ job: job, action: 'no-match', reason: 'No rules matched' });
        return;
      }

      var bestMatch = matches[0]; // Use first matching rule
      var template = bestMatch.templateId ? getTemplate(bestMatch.templateId) : null;

      if (dryRun) {
        results.push({
          job: job,
          action: 'would-apply',
          rule: bestMatch.rule,
          template: template,
          matchResult: bestMatch.matchResult
        });
      } else {
        // Record application
        saveApplication({
          jobTitle: job.title || 'Untitled',
          jobUrl: job.url || '',
          appliedAt: new Date().toISOString(),
          proposalText: template ? template.body : '',
          rate: profileData.hourlyRate || profileData.rate || '',
          status: 'applied',
          autoApplied: true,
          ruleId: bestMatch.rule.id,
          ruleName: bestMatch.rule.name
        });

        // Update rule stats
        updateRule(bestMatch.rule.id, {
          matchCount: (bestMatch.rule.matchCount || 0) + 1,
          applyCount: (bestMatch.rule.applyCount || 0) + 1
        });

        // Log
        logAutoApply(job, bestMatch.rule);

        results.push({
          job: job,
          action: 'applied',
          rule: bestMatch.rule,
          template: template
        });
      }
    });

    return {
      total: jobs.length,
      applied: results.filter(function (r) { return r.action === 'applied' || r.action === 'would-apply'; }).length,
      skipped: results.filter(function (r) { return r.action === 'skipped'; }).length,
      noMatch: results.filter(function (r) { return r.action === 'no-match'; }).length,
      dryRun: dryRun,
      results: results
    };
  }

  function logAutoApply(job, rule) {
    var log = loadJSON(RULES_LOG_KEY) || [];
    log.unshift({
      jobTitle: job.title,
      jobUrl: job.url,
      ruleId: rule.id,
      ruleName: rule.name,
      timestamp: new Date().toISOString()
    });
    if (log.length > 500) log = log.slice(0, 500);
    saveJSON(RULES_LOG_KEY, log);
  }

  function getAutoApplyLog() {
    return loadJSON(RULES_LOG_KEY) || [];
  }

  /* ── Proposal Templates ── */

  function getTemplates() { return loadJSON(TEMPLATES_KEY) || []; }
  function saveTemplates(templates) { saveJSON(TEMPLATES_KEY, templates); }

  function getTemplate(templateId) {
    return getTemplates().find(function (t) { return t.id === templateId; }) || null;
  }

  function createTemplate(template) {
    var templates = getTemplates();
    template.id = template.id || 'tpl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
    template.createdAt = new Date().toISOString();
    template.useCount = 0;
    templates.push(template);
    saveTemplates(templates);
    return template;
  }

  function updateTemplate(templateId, updates) {
    var templates = getTemplates();
    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === templateId) {
        Object.keys(updates).forEach(function (k) { templates[i][k] = updates[k]; });
        break;
      }
    }
    saveTemplates(templates);
  }

  function deleteTemplate(templateId) {
    saveTemplates(getTemplates().filter(function (t) { return t.id !== templateId; }));
  }

  /**
   * Fill template variables: {{name}}, {{rate}}, {{skills}}, {{jobTitle}}, etc.
   */
  function fillTemplate(template, job, profileData) {
    var body = template.body || '';
    var vars = {
      name: profileData.name || 'there',
      rate: profileData.hourlyRate || profileData.rate || '??',
      skills: (profileData.skills || []).join(', '),
      jobTitle: job.title || 'your project',
      clientName: job.clientName || 'there',
      matchedSkills: '',
      experience: profileData.experience || ''
    };

    // Compute matched skills if possible
    var profileSkills = (profileData.skills || []).map(function (s) { return s.toLowerCase().trim(); });
    var jobSkills = (job.skills || []).map(function (s) { return s.toLowerCase().trim(); });
    var matched = jobSkills.filter(function (s) { return profileSkills.indexOf(s) !== -1; });
    vars.matchedSkills = matched.join(', ');

    Object.keys(vars).forEach(function (key) {
      body = body.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), vars[key]);
    });

    return body;
  }

  // ════════════════════════════════════════════════════════════════════
  //  APPLY FLOW (One-Click UI)
  // ════════════════════════════════════════════════════════════════════

  function renderAutoApplyButton(jobCard, jobData, profileData) {
    injectCSS();
    if (!jobCard || !jobData) return;
    if (jobCard.querySelector('.aa-btn')) return;

    var footer = jobCard.querySelector('.jm-card-footer') || jobCard;
    var btn = document.createElement('button');
    btn.className = 'aa-btn';

    if (isApplied(jobData.url)) {
      btn.textContent = '✅ Applied';
      btn.classList.add('aa-btn--applied');
      btn.disabled = true;
    } else {
      // Check if auto-apply rules match
      var ruleMatches = matchJobToRules(jobData, profileData);
      if (ruleMatches.length > 0) {
        btn.textContent = '⚡ Auto-Apply';
        btn.title = 'Matched rule: ' + (ruleMatches[0].rule.name || 'Auto');
        btn.classList.add('aa-btn--auto');
      } else {
        btn.textContent = '🚀 Apply Now';
      }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openApplyModal(jobData, profileData);
      });
    }

    footer.appendChild(btn);
  }

  function openApplyModal(jobData, profileData) {
    injectCSS();
    var step = 1;
    var proposalText = '';
    var rate = '';
    var timeline = TIMELINE_OPTIONS[2];
    var estimatedHours = '';
    var proposalLoading = false;
    var proposalError = '';

    // Pre-fill from matched template
    var ruleMatches = matchJobToRules(jobData, profileData);
    if (ruleMatches.length > 0 && ruleMatches[0].templateId) {
      var tpl = getTemplate(ruleMatches[0].templateId);
      if (tpl) proposalText = fillTemplate(tpl, jobData, profileData);
    }

    if (profileData && profileData.hourlyRate) {
      rate = String(profileData.hourlyRate).replace(/[^0-9.]/g, '');
    }

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
      h += '  <div class="aa-steps">';
      h += '    <span class="aa-step' + (step >= 1 ? ' aa-step--active' : '') + '">1. Review</span>';
      h += '    <span class="aa-step-sep">→</span>';
      h += '    <span class="aa-step' + (step >= 2 ? ' aa-step--active' : '') + '">2. Customize</span>';
      h += '    <span class="aa-step-sep">→</span>';
      h += '    <span class="aa-step' + (step >= 3 ? ' aa-step--active' : '') + '">3. Submit</span>';
      h += '  </div>';
      h += '  <button class="aa-close" id="aa-close">&times;</button>';
      h += '</div>';

      h += '<div class="aa-modal-body">';
      if (step === 1) h += renderStep1(jobData);
      else if (step === 2) h += renderStep2(jobData, proposalText, rate, timeline, estimatedHours, proposalLoading, proposalError);
      else if (step === 3) h += renderStep3(jobData, proposalText, rate);
      h += '</div>';

      h += '<div class="aa-modal-footer">';
      if (step > 1) h += '<button class="aa-btn-secondary" id="aa-prev">← Back</button>';
      else h += '<span></span>';
      if (step < 3) h += '<button class="aa-btn-primary" id="aa-next">' + (step === 1 ? 'Customize Proposal →' : 'Continue to Submit →') + '</button>';
      else h += '<button class="aa-btn-primary aa-btn-success" id="aa-done">✅ Mark as Applied</button>';
      h += '</div>';

      modal.innerHTML = h;

      modal.querySelector('#aa-close').addEventListener('click', closeModal);

      var prevBtn = modal.querySelector('#aa-prev');
      if (prevBtn) prevBtn.addEventListener('click', function () { step--; render(); });

      var nextBtn = modal.querySelector('#aa-next');
      if (nextBtn) nextBtn.addEventListener('click', function () {
        if (step === 1) { step = 2; render(); if (!proposalText && !proposalLoading) fetchProposal(); }
        else if (step === 2) { captureStep2(); step = 3; render(); }
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
          status: 'applied'
        });
        closeModal();
        refreshAppliedBadges();
      });

      if (step === 2) bindStep2();
      if (step === 3) bindStep3();
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
      proposalError = '';
      render();
      fetch('/api/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: jobData, profile: profileData })
      }).then(function (res) { return res.json(); })
        .then(function (data) {
          proposalLoading = false;
          proposalText = (data && data.proposal) || 'Could not generate proposal. Please write your own.';
          render();
        }).catch(function (err) {
          proposalLoading = false;
          proposalError = 'Failed to generate proposal: ' + (err.message || 'Unknown error');
          proposalText = '';
          render();
        });
    }

    function bindStep2() {
      var regen = modal.querySelector('#aa-regenerate');
      if (regen) regen.addEventListener('click', function () { fetchProposal(); });

      // Template selector
      var tplSelect = modal.querySelector('#aa-template-select');
      if (tplSelect) {
        tplSelect.addEventListener('change', function () {
          var tplId = tplSelect.value;
          if (tplId) {
            var tpl = getTemplate(tplId);
            if (tpl) {
              proposalText = fillTemplate(tpl, jobData, profileData);
              var ta = modal.querySelector('#aa-proposal');
              if (ta) ta.value = proposalText;
            }
          }
        });
      }
    }

    function bindStep3() {
      var copyBtn = modal.querySelector('#aa-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          navigator.clipboard.writeText(proposalText).then(function () {
            copyBtn.textContent = '✅ Copied!';
            copyBtn.classList.add('aa-btn--copied');
            var chk = modal.querySelector('#aa-chk-copied');
            if (chk) chk.checked = true;
          }).catch(function () {
            var ta = document.createElement('textarea');
            ta.value = proposalText;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            copyBtn.textContent = '✅ Copied!';
            copyBtn.classList.add('aa-btn--copied');
          });
        });
      }
      var openBtn = modal.querySelector('#aa-open-upwork');
      if (openBtn) {
        openBtn.addEventListener('click', function () { window.open(jobData.url || '#', '_blank'); });
      }
    }

    render();
  }

  // ─── Step renderers ───────────────────────────────────────────────
  function renderStep1(jobData) {
    var h = '';
    h += '<h2 class="aa-job-title">' + esc(jobData.title || 'Untitled Job') + '</h2>';

    if (window.CortexRedFlagDetector) {
      try {
        var flags = window.CortexRedFlagDetector.detect ? window.CortexRedFlagDetector.detect(jobData) : null;
        if (flags && flags.length > 0) {
          h += '<div class="aa-red-flags"><span class="aa-flag-badge">🚩 Red Flags Detected</span>';
          flags.forEach(function (f) {
            h += '<div class="aa-flag-item">⚠️ ' + esc(typeof f === 'string' ? f : f.message || f.flag || JSON.stringify(f)) + '</div>';
          });
          h += '</div>';
        }
      } catch (e) {}
    }

    // Show matched rules
    var ruleMatches = matchJobToRules(jobData, {});
    if (ruleMatches.length > 0) {
      h += '<div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:10px;padding:12px 16px;margin-bottom:16px;">';
      h += '<span style="color:#4ade80;font-weight:600;font-size:13px;">⚡ Auto-Apply Rule Matched</span>';
      h += '<div style="color:#94a3b8;font-size:12px;margin-top:4px;">' + esc(ruleMatches[0].rule.name || 'Unnamed Rule') + '</div>';
      h += '</div>';
    }

    h += '<div class="aa-info-grid">';
    if (jobData.budget) h += '<div class="aa-info-item"><span class="aa-info-label">💰 Budget</span><span class="aa-info-value">' + esc(String(jobData.budget)) + '</span></div>';
    if (jobData.type || jobData.contractType) h += '<div class="aa-info-item"><span class="aa-info-label">📋 Type</span><span class="aa-info-value">' + esc(jobData.type || jobData.contractType || '') + '</span></div>';
    if (jobData.postedAt || jobData.posted) h += '<div class="aa-info-item"><span class="aa-info-label">🕐 Posted</span><span class="aa-info-value">' + esc(jobData.postedAt || jobData.posted || '') + '</span></div>';
    if (jobData.matchScore != null) h += '<div class="aa-info-item"><span class="aa-info-label">🎯 Match</span><span class="aa-info-value">' + jobData.matchScore + '%</span></div>';
    h += '</div>';

    if (jobData.description) {
      h += '<div class="aa-description"><h4>Job Description</h4><div class="aa-desc-text">' + esc(jobData.description) + '</div></div>';
    }

    if (jobData.skills && jobData.skills.length) {
      h += '<div class="aa-skills">';
      jobData.skills.forEach(function (s) { h += '<span class="aa-skill-tag">' + esc(s) + '</span>'; });
      h += '</div>';
    }

    return h;
  }

  function renderStep2(jobData, proposal, rate, timeline, hours, loading, error) {
    var h = '';
    h += '<h2 class="aa-section-title">✍️ Customize Your Proposal</h2>';
    h += '<p class="aa-subtitle">for <strong>' + esc(jobData.title || '') + '</strong></p>';

    // Template selector
    var templates = getTemplates();
    if (templates.length > 0) {
      h += '<div style="margin-bottom:12px;">';
      h += '<label class="aa-label" for="aa-template-select">📋 Load Template</label>';
      h += '<select class="aa-select" id="aa-template-select">';
      h += '<option value="">— Select template —</option>';
      templates.forEach(function (t) {
        h += '<option value="' + esc(t.id) + '">' + esc(t.name || 'Unnamed') + '</option>';
      });
      h += '</select></div>';
    }

    if (loading) {
      h += '<div class="aa-loading"><div class="aa-spinner"></div><span>Generating proposal with AI…</span></div>';
    }
    if (error) h += '<div class="aa-error">' + esc(error) + '</div>';

    h += '<label class="aa-label" for="aa-proposal">Cover Letter</label>';
    h += '<textarea class="aa-textarea" id="aa-proposal" rows="10" placeholder="Your proposal…"' + (loading ? ' disabled' : '') + '>' + esc(proposal) + '</textarea>';
    h += '<button class="aa-btn-secondary aa-btn-small" id="aa-regenerate" ' + (loading ? 'disabled' : '') + '>🔄 Regenerate</button>';

    h += '<div class="aa-form-row">';
    h += '<div class="aa-form-group"><label class="aa-label" for="aa-rate">💰 Your Rate ($/hr)</label>';
    h += '<input type="number" class="aa-input" id="aa-rate" value="' + esc(rate) + '" placeholder="e.g. 65" min="1" /></div>';
    h += '<div class="aa-form-group"><label class="aa-label" for="aa-timeline">📅 Timeline</label>';
    h += '<select class="aa-select" id="aa-timeline">';
    TIMELINE_OPTIONS.forEach(function (opt) { h += '<option value="' + esc(opt) + '"' + (opt === timeline ? ' selected' : '') + '>' + esc(opt) + '</option>'; });
    h += '</select></div>';
    h += '<div class="aa-form-group"><label class="aa-label" for="aa-hours">⏱️ Est. Hours</label>';
    h += '<input type="number" class="aa-input" id="aa-hours" value="' + esc(hours) + '" placeholder="e.g. 40" min="1" /></div>';
    h += '</div>';

    return h;
  }

  function renderStep3(jobData, proposal, rate) {
    var h = '';
    h += '<h2 class="aa-section-title">🚀 Submit on Upwork</h2>';
    h += '<p class="aa-subtitle">Almost done! Follow these steps:</p>';

    h += '<div class="aa-submit-actions">';
    h += '<button class="aa-btn-primary aa-btn-wide" id="aa-copy">📋 Copy Proposal</button>';
    h += '<button class="aa-btn-primary aa-btn-wide aa-btn-upwork" id="aa-open-upwork">🔗 Open on Upwork</button>';
    h += '</div>';

    h += '<div class="aa-instructions">';
    h += '<p>1. Click <strong>Copy Proposal</strong> above</p>';
    h += '<p>2. Click <strong>Open on Upwork</strong> to go to the job page</p>';
    h += '<p>3. Paste your proposal on Upwork and submit</p>';
    h += '</div>';

    h += '<div class="aa-checklist">';
    h += '<label class="aa-check-item"><input type="checkbox" id="aa-chk-copied" /> Proposal copied</label>';
    h += '<label class="aa-check-item"><input type="checkbox" /> Rate set to $' + esc(rate || '?') + '/hr</label>';
    h += '<label class="aa-check-item"><input type="checkbox" /> Cover letter personalized</label>';
    h += '</div>';

    h += '<div class="aa-proposal-preview"><h4>Proposal Preview</h4>';
    h += '<div class="aa-preview-text">' + esc(proposal).replace(/\n/g, '<br>') + '</div></div>';

    return h;
  }

  // ─── Refresh applied badges ───────────────────────────────────────
  function refreshAppliedBadges() {
    document.querySelectorAll('.jm-card').forEach(function (card) {
      var link = card.querySelector('.jm-card-title');
      if (!link) return;
      var url = link.getAttribute('href');
      if (url && isApplied(url)) {
        var aaBtn = card.querySelector('.aa-btn');
        if (aaBtn && !aaBtn.classList.contains('aa-btn--applied')) {
          aaBtn.textContent = '✅ Applied';
          aaBtn.classList.add('aa-btn--applied');
          aaBtn.disabled = true;
        }
      }
    });
  }

  // ─── Applications Dashboard ───────────────────────────────────────
  function renderApplicationsDashboard(containerId) {
    injectCSS();
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) {
      container = document.createElement('div');
      container.id = 'cortex-applications';
      var main = document.querySelector('.dashboard-content, .main-content, main, body');
      if (main) main.appendChild(container);
    }

    var apps = getApplications();

    var h = '';
    h += '<div class="aa-dashboard">';
    h += '<div class="aa-dash-header"><h3 class="aa-dash-title">📋 My Applications</h3>';
    h += '<span class="aa-dash-count">' + apps.length + ' total</span></div>';

    if (apps.length === 0) {
      h += '<div class="aa-dash-empty"><p>No applications yet. Find a job match and hit 🚀 Apply Now!</p></div>';
    } else {
      h += '<div class="aa-dash-list">';
      apps.forEach(function (app, idx) {
        var date = '';
        try { date = new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { date = app.appliedAt || ''; }

        h += '<div class="aa-dash-item">';
        h += '<div class="aa-dash-item-main">';
        h += '<a href="' + esc(app.jobUrl || '#') + '" target="_blank" rel="noopener" class="aa-dash-job-title">' + esc(app.jobTitle) + '</a>';
        h += '<div class="aa-dash-meta">';
        h += '<span class="aa-dash-date">' + esc(date) + '</span>';
        h += '<span class="aa-dash-status aa-status-' + esc(app.status || 'applied') + '">' + statusLabel(app.status) + '</span>';
        if (app.rate) h += '<span class="aa-dash-rate">$' + esc(String(app.rate)) + '/hr</span>';
        if (app.autoApplied) h += '<span style="color:#a78bfa;font-size:11px;">⚡ Auto</span>';
        h += '</div></div>';
        h += '<div class="aa-dash-item-actions"><button class="aa-btn-secondary aa-btn-small aa-followup-btn" data-idx="' + idx + '">📩 Follow Up</button></div>';
        h += '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    container.innerHTML = h;

    container.querySelectorAll('.aa-followup-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
        var app = apps[idx];
        if (app) showFollowUpModal(app);
      });
    });
  }

  function statusLabel(status) {
    switch (status) {
      case 'applied': return '✅ Applied';
      case 'interviewing': return '🗣️ Interviewing';
      case 'hired': return '🎉 Hired';
      case 'rejected': return '❌ Rejected';
      case 'withdrawn': return '🚫 Withdrawn';
      default: return '✅ Applied';
    }
  }

  // ─── Follow-up modal ─────────────────────────────────────────────
  function showFollowUpModal(app) {
    var overlay = document.createElement('div');
    overlay.className = 'aa-overlay';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    var modal = document.createElement('div');
    modal.className = 'aa-modal aa-modal--small';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function close() { document.body.removeChild(overlay); document.body.style.overflow = ''; }

    var daysSince = Math.floor((Date.now() - new Date(app.appliedAt).getTime()) / 86400000);
    var followUpMsg = generateFollowUp(app, daysSince);

    var h = '';
    h += '<div class="aa-modal-header"><h3>📩 Follow Up — ' + esc(app.jobTitle) + '</h3>';
    h += '<button class="aa-close" id="aa-fu-close">&times;</button></div>';
    h += '<div class="aa-modal-body">';
    h += '<p class="aa-subtitle">Applied ' + daysSince + ' day' + (daysSince !== 1 ? 's' : '') + ' ago</p>';
    h += '<textarea class="aa-textarea" id="aa-fu-text" rows="8">' + esc(followUpMsg) + '</textarea>';
    h += '</div>';
    h += '<div class="aa-modal-footer"><span></span>';
    h += '<button class="aa-btn-primary" id="aa-fu-copy">📋 Copy Follow-Up</button></div>';

    modal.innerHTML = h;
    modal.querySelector('#aa-fu-close').addEventListener('click', close);
    modal.querySelector('#aa-fu-copy').addEventListener('click', function () {
      var text = modal.querySelector('#aa-fu-text').value;
      navigator.clipboard.writeText(text).then(function () {
        var btn = modal.querySelector('#aa-fu-copy');
        btn.textContent = '✅ Copied!';
        btn.classList.add('aa-btn--copied');
      }).catch(function () {});
    });
  }

  function generateFollowUp(app, daysSince) {
    return 'Hi there,\n\n' +
      'I wanted to follow up on my proposal for "' + (app.jobTitle || 'your project') + '" that I submitted ' +
      daysSince + ' day' + (daysSince !== 1 ? 's' : '') + ' ago.\n\n' +
      'I\'m still very interested in this project and available to start right away. ' +
      'I\'d love to discuss how I can help bring your vision to life.\n\n' +
      'Would you be available for a quick chat this week?\n\n' +
      'Best regards';
  }

  // ════════════════════════════════════════════════════════════════════
  //  RULES ENGINE RENDER
  // ════════════════════════════════════════════════════════════════════

  function renderRulesManager(containerId) {
    injectCSS();
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    var rules = getRules();
    var templates = getTemplates();

    var html = '';
    html += '<div style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:16px;padding:24px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e2e8f0;">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
    html += '<div>';
    html += '<h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">⚡ Auto-Apply Rules</h2>';
    html += '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">' + rules.length + ' rule' + (rules.length !== 1 ? 's' : '') + ' configured</p>';
    html += '</div></div>';

    if (rules.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:#64748b;">';
      html += '<p style="font-size:48px;margin:0;">⚡</p>';
      html += '<p style="font-size:16px;margin:12px 0;">No auto-apply rules yet</p>';
      html += '<p style="font-size:13px;">Create rules to automatically match jobs with your criteria.</p>';
      html += '</div>';
    } else {
      rules.forEach(function (rule) {
        var enabled = rule.enabled;
        var statusColor = enabled ? '#4ade80' : '#64748b';
        html += '<div style="background:#16213e;border:1px solid ' + (enabled ? '#2a2a4a' : '#1e1e3a') + ';border-radius:12px;padding:16px;margin-bottom:10px;opacity:' + (enabled ? '1' : '0.6') + ';">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div>';
        html += '<span style="font-size:14px;font-weight:600;color:#f1f5f9;">' + esc(rule.name || 'Unnamed Rule') + '</span>';
        html += '<span style="margin-left:8px;font-size:11px;color:' + statusColor + ';">' + (enabled ? '● Active' : '○ Paused') + '</span>';
        html += '</div>';
        html += '<div style="font-size:12px;color:#64748b;">';
        html += 'Matched: ' + (rule.matchCount || 0) + ' | Applied: ' + (rule.applyCount || 0);
        html += '</div></div>';

        // Criteria summary
        var c = rule.criteria || {};
        var crits = [];
        if (c.requiredSkills && c.requiredSkills.length > 0) crits.push('Skills: ' + c.requiredSkills.join(', '));
        if (c.minBudget > 0) crits.push('Min budget: $' + c.minBudget);
        if (c.maxAgeHours) crits.push('Max age: ' + c.maxAgeHours + 'h');
        if (c.maxProposals) crits.push('Max proposals: ' + c.maxProposals);
        if (c.minClientRating > 0) crits.push('Min client rating: ' + c.minClientRating + '⭐');
        if (c.titleKeywords && c.titleKeywords.length > 0) crits.push('Keywords: ' + c.titleKeywords.join(', '));
        if (c.excludeKeywords && c.excludeKeywords.length > 0) crits.push('Exclude: ' + c.excludeKeywords.join(', '));
        if (c.minBidScore > 0) crits.push('Min bid score: ' + c.minBidScore);

        if (crits.length > 0) {
          html += '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">';
          crits.forEach(function (cr) {
            html += '<span style="background:#0f0f23;color:#94a3b8;padding:3px 8px;border-radius:4px;font-size:11px;">' + esc(cr) + '</span>';
          });
          html += '</div>';
        }

        html += '</div>';
      });
    }

    // Templates section
    html += '<div style="margin-top:24px;padding-top:20px;border-top:1px solid #2a2a4a;">';
    html += '<h3 style="font-size:16px;font-weight:600;color:#f1f5f9;margin:0 0 12px;">📝 Proposal Templates</h3>';
    if (templates.length === 0) {
      html += '<p style="color:#64748b;font-size:13px;">No templates yet. Create templates to auto-fill proposals.</p>';
    } else {
      templates.forEach(function (tpl) {
        html += '<div style="background:#16213e;border-radius:8px;padding:12px;margin-bottom:8px;">';
        html += '<div style="font-size:13px;font-weight:600;color:#f1f5f9;">' + esc(tpl.name || 'Unnamed') + '</div>';
        html += '<div style="font-size:12px;color:#64748b;margin-top:4px;">' + esc((tpl.body || '').substring(0, 100)) + '…</div>';
        html += '<div style="font-size:11px;color:#64748b;margin-top:4px;">Used ' + (tpl.useCount || 0) + ' times</div>';
        html += '</div>';
      });
    }
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Dark theme CSS ──────────────────────────────────────────────
  function getCSS() {
    return '' +
    '.aa-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:10000;display:flex;align-items:center;justify-content:center;animation:aa-fadein .2s ease}' +
    '@keyframes aa-fadein{from{opacity:0}to{opacity:1}}' +
    '.aa-modal{background:#1a1a2e;color:#e0e0e0;border-radius:16px;width:90vw;max-width:720px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.6);animation:aa-slideup .25s ease}' +
    '.aa-modal--small{max-width:520px}' +
    '@keyframes aa-slideup{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}' +
    '.aa-modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 12px;border-bottom:1px solid #2a2a4a}' +
    '.aa-steps{display:flex;align-items:center;gap:8px;font-size:14px}' +
    '.aa-step{color:#666;font-weight:500;transition:color .2s}' +
    '.aa-step--active{color:#00ff88}' +
    '.aa-step-sep{color:#444;font-size:12px}' +
    '.aa-close{background:none;border:none;color:#888;font-size:24px;cursor:pointer;padding:4px 8px;border-radius:8px;transition:all .15s}' +
    '.aa-close:hover{background:#2a2a4a;color:#fff}' +
    '.aa-modal-body{flex:1;overflow-y:auto;padding:24px;scrollbar-width:thin;scrollbar-color:#333 transparent}' +
    '.aa-modal-body::-webkit-scrollbar{width:6px}.aa-modal-body::-webkit-scrollbar-thumb{background:#333;border-radius:3px}' +
    '.aa-modal-footer{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-top:1px solid #2a2a4a}' +
    '.aa-btn{background:linear-gradient(135deg,#00cc6a,#00aa55);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}' +
    '.aa-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,204,106,.4)}' +
    '.aa-btn--applied{background:#2a2a4a;color:#00ff88;cursor:default;pointer-events:none}' +
    '.aa-btn--applied:hover{transform:none;box-shadow:none}' +
    '.aa-btn--auto{background:linear-gradient(135deg,#7c3aed,#6d28d9)}' +
    '.aa-btn--auto:hover{box-shadow:0 4px 16px rgba(124,58,237,.4)}' +
    '.aa-btn-primary{background:linear-gradient(135deg,#00cc6a,#00aa55);color:#fff;border:none;padding:10px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}' +
    '.aa-btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,204,106,.4)}' +
    '.aa-btn-secondary{background:#2a2a4a;color:#ccc;border:1px solid #3a3a5a;padding:10px 24px;border-radius:10px;font-size:14px;cursor:pointer;transition:all .15s}' +
    '.aa-btn-secondary:hover{background:#3a3a5a;color:#fff}' +
    '.aa-btn-small{padding:6px 14px;font-size:12px;border-radius:6px}' +
    '.aa-btn-wide{flex:1;text-align:center}' +
    '.aa-btn-upwork{background:linear-gradient(135deg,#14a800,#108a00)}' +
    '.aa-btn-upwork:hover{box-shadow:0 4px 16px rgba(20,168,0,.4)}' +
    '.aa-btn-success{background:linear-gradient(135deg,#00cc6a,#00ff88);font-size:16px;padding:12px 32px}' +
    '.aa-btn--copied{background:#2a2a4a!important;color:#00ff88!important;border:1px solid #00ff88!important}' +
    '.aa-job-title{font-size:22px;font-weight:700;margin:0 0 16px;color:#fff}' +
    '.aa-red-flags{background:#2a1520;border:1px solid #ff4444;border-radius:10px;padding:12px 16px;margin-bottom:16px}' +
    '.aa-flag-badge{color:#ff4444;font-weight:700;font-size:14px}' +
    '.aa-flag-item{color:#ff8888;font-size:13px;margin-top:6px}' +
    '.aa-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}' +
    '.aa-info-item{background:#16213e;border-radius:10px;padding:12px 16px}' +
    '.aa-info-label{display:block;font-size:12px;color:#888;margin-bottom:4px}' +
    '.aa-info-value{font-size:16px;font-weight:600;color:#fff}' +
    '.aa-description{margin-bottom:16px}.aa-description h4{font-size:14px;color:#888;margin:0 0 8px;font-weight:500}' +
    '.aa-desc-text{font-size:14px;line-height:1.6;color:#ccc;max-height:200px;overflow-y:auto;white-space:pre-wrap}' +
    '.aa-skills{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}' +
    '.aa-skill-tag{background:#16213e;color:#00cc6a;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:500}' +
    '.aa-section-title{font-size:20px;font-weight:700;margin:0 0 4px;color:#fff}' +
    '.aa-subtitle{font-size:14px;color:#888;margin:0 0 20px}' +
    '.aa-label{display:block;font-size:13px;color:#aaa;margin-bottom:6px;font-weight:500}' +
    '.aa-textarea{width:100%;background:#0f0f23;color:#e0e0e0;border:1px solid #2a2a4a;border-radius:10px;padding:14px;font-size:14px;line-height:1.6;resize:vertical;font-family:inherit;box-sizing:border-box;transition:border-color .2s}' +
    '.aa-textarea:focus{outline:none;border-color:#00cc6a}.aa-textarea:disabled{opacity:.5}' +
    '.aa-form-row{display:flex;gap:16px;margin-top:20px;flex-wrap:wrap}' +
    '.aa-form-group{flex:1;min-width:140px}' +
    '.aa-input,.aa-select{width:100%;background:#0f0f23;color:#e0e0e0;border:1px solid #2a2a4a;border-radius:8px;padding:10px 14px;font-size:14px;font-family:inherit;box-sizing:border-box;transition:border-color .2s}' +
    '.aa-input:focus,.aa-select:focus{outline:none;border-color:#00cc6a}' +
    '.aa-select{appearance:auto}' +
    '.aa-loading{display:flex;align-items:center;gap:12px;padding:16px;background:#16213e;border-radius:10px;margin-bottom:16px}' +
    '.aa-spinner{width:24px;height:24px;border:3px solid #333;border-top-color:#00cc6a;border-radius:50%;animation:aa-spin .8s linear infinite}' +
    '@keyframes aa-spin{to{transform:rotate(360deg)}}' +
    '.aa-error{background:#2a1520;color:#ff6666;padding:12px 16px;border-radius:8px;margin-bottom:12px;font-size:13px}' +
    '.aa-submit-actions{display:flex;gap:12px;margin-bottom:24px}' +
    '.aa-instructions{background:#16213e;border-radius:10px;padding:16px 20px;margin-bottom:20px}' +
    '.aa-instructions p{margin:6px 0;font-size:14px;color:#ccc}' +
    '.aa-checklist{margin-bottom:20px}' +
    '.aa-check-item{display:flex;align-items:center;gap:8px;padding:8px 0;font-size:14px;color:#ccc;cursor:pointer}' +
    '.aa-check-item input[type=checkbox]{accent-color:#00cc6a;width:18px;height:18px}' +
    '.aa-proposal-preview{background:#0f0f23;border:1px solid #2a2a4a;border-radius:10px;padding:16px;margin-top:12px}' +
    '.aa-proposal-preview h4{font-size:13px;color:#666;margin:0 0 10px;font-weight:500}' +
    '.aa-preview-text{font-size:13px;line-height:1.6;color:#aaa;max-height:150px;overflow-y:auto}' +
    '.aa-dashboard{background:#1a1a2e;border-radius:16px;padding:24px;margin-top:24px}' +
    '.aa-dash-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}' +
    '.aa-dash-title{font-size:18px;font-weight:700;color:#fff;margin:0}' +
    '.aa-dash-count{font-size:13px;color:#888;background:#16213e;padding:4px 12px;border-radius:20px}' +
    '.aa-dash-empty{text-align:center;padding:40px 20px;color:#666}' +
    '.aa-dash-list{display:flex;flex-direction:column;gap:8px}' +
    '.aa-dash-item{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#16213e;border-radius:10px;transition:background .15s}' +
    '.aa-dash-item:hover{background:#1c2745}' +
    '.aa-dash-item-main{flex:1;min-width:0}' +
    '.aa-dash-job-title{color:#00cc6a;text-decoration:none;font-weight:600;font-size:14px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.aa-dash-job-title:hover{color:#00ff88}' +
    '.aa-dash-meta{display:flex;gap:12px;margin-top:4px;font-size:12px}' +
    '.aa-dash-date{color:#888}.aa-dash-status{font-weight:500}' +
    '.aa-status-applied{color:#00cc6a}.aa-status-interviewing{color:#ffaa00}.aa-status-hired{color:#00ff88}.aa-status-rejected{color:#ff4444}' +
    '.aa-dash-rate{color:#888}.aa-dash-item-actions{flex-shrink:0;margin-left:12px}' +
    '@media(max-width:600px){.aa-modal{width:100vw;max-width:100vw;max-height:100vh;border-radius:0;height:100vh}.aa-form-row{flex-direction:column}.aa-submit-actions{flex-direction:column}.aa-info-grid{grid-template-columns:1fr 1fr}}';
  }

  // ─── Init ─────────────────────────────────────────────────────────
  function init(options) {
    options = options || {};
    if (options.rules) {
      options.rules.forEach(function (r) { createRule(r); });
    }
    if (options.templates) {
      options.templates.forEach(function (t) { createTemplate(t); });
    }
  }

  // ─── Render (rules manager view) ──────────────────────────────────
  function render(containerId, options) {
    renderRulesManager(containerId);
  }

  // ─── Public API ───────────────────────────────────────────────────
  var api = {
    // Init & Render
    init: init,
    render: render,

    // Rules Engine
    createRule: createRule,
    updateRule: updateRule,
    deleteRule: deleteRule,
    toggleRule: toggleRule,
    getRules: getRules,
    matchJobToRules: matchJobToRules,
    evaluateRule: evaluateRule,
    processJobs: processJobs,
    getAutoApplyLog: getAutoApplyLog,
    renderRulesManager: renderRulesManager,

    // Templates
    createTemplate: createTemplate,
    updateTemplate: updateTemplate,
    deleteTemplate: deleteTemplate,
    getTemplates: getTemplates,
    getTemplate: getTemplate,
    fillTemplate: fillTemplate,

    // Apply Flow
    renderAutoApplyButton: renderAutoApplyButton,
    renderApplicationsDashboard: renderApplicationsDashboard,
    getApplications: getApplications,
    isApplied: isApplied,
    refreshAppliedBadges: refreshAppliedBadges
  };

  window.CortexFreelancer.AutoApply = api;

  // Legacy compat
  window.CortexAutoApply = {
    renderAutoApplyButton: renderAutoApplyButton,
    renderApplicationsDashboard: renderApplicationsDashboard,
    getApplications: getApplications,
    isApplied: isApplied,
    refreshAppliedBadges: refreshAppliedBadges
  };

})();
