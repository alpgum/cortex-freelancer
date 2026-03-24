/**
 * [CF-067] Auto-Apply Rules Engine — Enhanced
 * Configure rules to auto-apply to jobs matching specific criteria with
 * pre-approved proposal templates. Extends auto-apply.js with advanced
 * matching, scheduling, dry-run mode, and rule analytics.
 *
 * Depends on: auto-apply.js (window.CortexFreelancer.AutoApply)
 * Exposed on window.CortexFreelancer.AutoApplyRules
 */
(function () {
  'use strict';

  var RULES_KEY = 'cortex_auto_apply_rules_v2';
  var TEMPLATES_KEY = 'cortex_auto_apply_templates';
  var LOG_KEY = 'cortex_auto_apply_rules_log';

  // ─── Persistence ────────────────────────────────────────────────────

  function _loadRules() {
    try { return JSON.parse(localStorage.getItem(RULES_KEY)) || []; } catch (e) { return []; }
  }

  function _saveRules(rules) {
    try { localStorage.setItem(RULES_KEY, JSON.stringify(rules)); } catch (e) { /* ignore */ }
  }

  function _loadTemplates() {
    try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || []; } catch (e) { return []; }
  }

  function _saveTemplates(templates) {
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates)); } catch (e) { /* ignore */ }
  }

  function _loadLog() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; }
  }

  function _saveLog(log) {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-500))); } catch (e) { /* ignore */ }
  }

  function _genId(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  function _esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // ─── Rule CRUD ──────────────────────────────────────────────────────

  function createRule(config) {
    if (!config || !config.name) throw new Error('Rule name is required');

    var rules = _loadRules();
    var rule = {
      id: _genId('rule'),
      name: config.name,
      enabled: config.enabled !== false,
      priority: config.priority || 0,
      criteria: {
        keywords: config.keywords || [],
        excludeKeywords: config.excludeKeywords || [],
        skills: config.skills || [],
        minBudget: config.minBudget || null,
        maxBudget: config.maxBudget || null,
        budgetType: config.budgetType || null, // 'fixed', 'hourly', or null for any
        maxProposals: config.maxProposals || null,
        clientMinSpent: config.clientMinSpent || null,
        clientMinRating: config.clientMinRating || null,
        categories: config.categories || [],
        experienceLevel: config.experienceLevel || null // 'entry', 'intermediate', 'expert'
      },
      templateId: config.templateId || null,
      bidStrategy: config.bidStrategy || 'auto', // 'auto', 'fixed', 'percentage'
      fixedBidAmount: config.fixedBidAmount || null,
      bidPercentage: config.bidPercentage || null, // percentage of budget
      maxAppliesPerDay: config.maxAppliesPerDay || 10,
      schedule: {
        activeHoursStart: config.activeHoursStart || 0,
        activeHoursEnd: config.activeHoursEnd || 24,
        activeDays: config.activeDays || [0, 1, 2, 3, 4, 5, 6]
      },
      dryRun: !!config.dryRun,
      stats: { matched: 0, applied: 0, skipped: 0, lastMatchedAt: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    rules.push(rule);
    _saveRules(rules);
    return rule;
  }

  function updateRule(ruleId, updates) {
    var rules = _loadRules();
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].id === ruleId) {
        Object.keys(updates).forEach(function (key) {
          if (key === 'criteria') {
            Object.keys(updates.criteria).forEach(function (ck) {
              rules[i].criteria[ck] = updates.criteria[ck];
            });
          } else if (key === 'schedule') {
            Object.keys(updates.schedule).forEach(function (sk) {
              rules[i].schedule[sk] = updates.schedule[sk];
            });
          } else if (key !== 'id' && key !== 'createdAt' && key !== 'stats') {
            rules[i][key] = updates[key];
          }
        });
        rules[i].updatedAt = new Date().toISOString();
        _saveRules(rules);
        return rules[i];
      }
    }
    return null;
  }

  function deleteRule(ruleId) {
    var rules = _loadRules();
    var filtered = rules.filter(function (r) { return r.id !== ruleId; });
    if (filtered.length === rules.length) return false;
    _saveRules(filtered);
    return true;
  }

  function getRules() { return _loadRules(); }

  function getRule(ruleId) {
    return _loadRules().filter(function (r) { return r.id === ruleId; })[0] || null;
  }

  function toggleRule(ruleId, enabled) {
    return updateRule(ruleId, { enabled: enabled });
  }

  // ─── Template Management ────────────────────────────────────────────

  function createTemplate(config) {
    if (!config || !config.name || !config.body) throw new Error('Template name and body are required');

    var templates = _loadTemplates();
    var template = {
      id: _genId('tmpl'),
      name: config.name,
      body: config.body,
      variables: _extractVariables(config.body),
      coverLetterIntro: config.coverLetterIntro || '',
      createdAt: new Date().toISOString()
    };

    templates.push(template);
    _saveTemplates(templates);
    return template;
  }

  function getTemplates() { return _loadTemplates(); }

  function deleteTemplate(templateId) {
    var templates = _loadTemplates();
    _saveTemplates(templates.filter(function (t) { return t.id !== templateId; }));
    return true;
  }

  function _extractVariables(body) {
    var matches = body.match(/\{\{(\w+)\}\}/g) || [];
    return matches.map(function (m) { return m.replace(/\{\{|\}\}/g, ''); });
  }

  function fillTemplate(templateId, variables) {
    var template = getTemplates().filter(function (t) { return t.id === templateId; })[0];
    if (!template) return null;

    var filled = template.body;
    Object.keys(variables || {}).forEach(function (key) {
      filled = filled.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), variables[key] || '');
    });
    return filled;
  }

  // ─── Job Matching Engine ────────────────────────────────────────────

  function matchJob(job) {
    var rules = _loadRules().filter(function (r) { return r.enabled; });
    rules.sort(function (a, b) { return b.priority - a.priority; });

    var matches = [];

    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];

      // Check schedule
      if (!_isWithinSchedule(rule.schedule)) continue;

      var result = _evaluateRule(rule, job);
      if (result.matched) {
        matches.push({
          rule: rule,
          score: result.score,
          matchedCriteria: result.matchedCriteria,
          failedCriteria: result.failedCriteria
        });
      }
    }

    return matches;
  }

  function _evaluateRule(rule, job) {
    var criteria = rule.criteria;
    var passed = [];
    var failed = [];
    var score = 0;
    var totalChecks = 0;

    // Keyword match
    if (criteria.keywords && criteria.keywords.length > 0) {
      totalChecks++;
      var text = ((job.title || '') + ' ' + (job.description || '')).toLowerCase();
      var keywordMatch = criteria.keywords.some(function (kw) {
        return text.indexOf(kw.toLowerCase()) !== -1;
      });
      if (keywordMatch) { passed.push('keywords'); score += 25; }
      else { failed.push('keywords'); }
    }

    // Exclude keywords
    if (criteria.excludeKeywords && criteria.excludeKeywords.length > 0) {
      var text2 = ((job.title || '') + ' ' + (job.description || '')).toLowerCase();
      var excluded = criteria.excludeKeywords.some(function (kw) {
        return text2.indexOf(kw.toLowerCase()) !== -1;
      });
      if (excluded) { failed.push('excludeKeywords'); return { matched: false, score: 0, matchedCriteria: passed, failedCriteria: failed }; }
    }

    // Skills match
    if (criteria.skills && criteria.skills.length > 0) {
      totalChecks++;
      var jobSkills = (job.skills || []).map(function (s) { return s.toLowerCase(); });
      var matchCount = criteria.skills.filter(function (s) {
        return jobSkills.indexOf(s.toLowerCase()) !== -1;
      }).length;
      if (matchCount > 0) {
        passed.push('skills');
        score += Math.round((matchCount / criteria.skills.length) * 25);
      } else {
        failed.push('skills');
      }
    }

    // Budget range
    var budget = (job.budget || job.budgetMax || job.budgetMin || 0);
    if (criteria.minBudget && budget > 0) {
      totalChecks++;
      if (budget >= criteria.minBudget) { passed.push('minBudget'); score += 15; }
      else { failed.push('minBudget'); }
    }
    if (criteria.maxBudget && budget > 0) {
      totalChecks++;
      if (budget <= criteria.maxBudget) { passed.push('maxBudget'); score += 10; }
      else { failed.push('maxBudget'); }
    }

    // Budget type
    if (criteria.budgetType) {
      totalChecks++;
      if ((job.budgetType || job.type || '').toLowerCase() === criteria.budgetType) {
        passed.push('budgetType'); score += 10;
      } else { failed.push('budgetType'); }
    }

    // Max proposals (competition)
    if (criteria.maxProposals) {
      totalChecks++;
      var proposals = job.proposals || job.proposalCount || 0;
      if (proposals <= criteria.maxProposals) { passed.push('maxProposals'); score += 10; }
      else { failed.push('maxProposals'); }
    }

    // Client quality filters
    if (criteria.clientMinSpent) {
      totalChecks++;
      if ((job.clientSpent || job.clientTotalSpent || 0) >= criteria.clientMinSpent) {
        passed.push('clientMinSpent'); score += 5;
      } else { failed.push('clientMinSpent'); }
    }
    if (criteria.clientMinRating) {
      totalChecks++;
      if ((job.clientRating || 0) >= criteria.clientMinRating) {
        passed.push('clientMinRating'); score += 5;
      } else { failed.push('clientMinRating'); }
    }

    // Must pass all hard criteria (keywords, skills, budget type, exclude)
    var hardFails = failed.filter(function (f) {
      return ['keywords', 'skills', 'budgetType', 'excludeKeywords'].indexOf(f) !== -1;
    });
    var matched = hardFails.length === 0 && passed.length > 0;

    return { matched: matched, score: score, matchedCriteria: passed, failedCriteria: failed };
  }

  function _isWithinSchedule(schedule) {
    if (!schedule) return true;
    var now = new Date();
    var hour = now.getHours();
    var day = now.getDay();

    if (schedule.activeDays && schedule.activeDays.indexOf(day) === -1) return false;
    if (schedule.activeHoursStart != null && schedule.activeHoursEnd != null) {
      if (hour < schedule.activeHoursStart || hour >= schedule.activeHoursEnd) return false;
    }
    return true;
  }

  // ─── Auto-Apply Execution ──────────────────────────────────────────

  function processJob(job, userProfile) {
    var matches = matchJob(job);
    if (matches.length === 0) return { action: 'skip', reason: 'No matching rules' };

    var bestMatch = matches[0]; // Already sorted by priority
    var rule = bestMatch.rule;

    // Check daily limit
    var log = _loadLog();
    var todayStr = new Date().toISOString().split('T')[0];
    var todayCount = log.filter(function (l) {
      return l.ruleId === rule.id && l.timestamp.startsWith(todayStr) && l.action === 'applied';
    }).length;

    if (todayCount >= rule.maxAppliesPerDay) {
      _logAction(rule.id, job, 'skipped', 'Daily limit reached (' + rule.maxAppliesPerDay + ')');
      return { action: 'skip', reason: 'Daily limit reached', rule: rule };
    }

    // Build proposal
    var proposal = null;
    if (rule.templateId) {
      proposal = fillTemplate(rule.templateId, {
        jobTitle: job.title || '',
        clientName: job.clientName || 'there',
        skills: (job.skills || []).join(', '),
        budget: (job.budget || 'N/A').toString()
      });
    }

    // Determine bid amount
    var bidAmount = null;
    if (rule.bidStrategy === 'fixed' && rule.fixedBidAmount) {
      bidAmount = rule.fixedBidAmount;
    } else if (rule.bidStrategy === 'percentage' && rule.bidPercentage) {
      var budget = job.budget || job.budgetMax || 0;
      bidAmount = Math.round(budget * (rule.bidPercentage / 100));
    } else if (window.CortexFreelancer.BidStrategyAdvisor && userProfile) {
      var bidResult = window.CortexFreelancer.BidStrategyAdvisor.calculateBid(job, userProfile);
      bidAmount = bidResult.recommended;
    }

    if (rule.dryRun) {
      _logAction(rule.id, job, 'dry-run', 'Would apply with bid $' + bidAmount);
      _updateRuleStats(rule.id, 'matched');
      return {
        action: 'dry-run',
        rule: rule,
        proposal: proposal,
        bidAmount: bidAmount,
        matchScore: bestMatch.score
      };
    }

    _logAction(rule.id, job, 'applied', 'Applied with bid $' + bidAmount);
    _updateRuleStats(rule.id, 'applied');

    return {
      action: 'apply',
      rule: rule,
      proposal: proposal,
      bidAmount: bidAmount,
      matchScore: bestMatch.score
    };
  }

  function _logAction(ruleId, job, action, detail) {
    var log = _loadLog();
    log.push({
      ruleId: ruleId,
      jobId: job.id || job.title || 'unknown',
      jobTitle: job.title || '',
      action: action,
      detail: detail || '',
      timestamp: new Date().toISOString()
    });
    _saveLog(log);
  }

  function _updateRuleStats(ruleId, type) {
    var rules = _loadRules();
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].id === ruleId) {
        rules[i].stats[type] = (rules[i].stats[type] || 0) + 1;
        rules[i].stats.lastMatchedAt = new Date().toISOString();
        _saveRules(rules);
        return;
      }
    }
  }

  // ─── Batch Processing ──────────────────────────────────────────────

  function processJobs(jobs, userProfile) {
    return (jobs || []).map(function (job) {
      return { job: job, result: processJob(job, userProfile) };
    });
  }

  // ─── Analytics ──────────────────────────────────────────────────────

  function getRuleAnalytics(ruleId) {
    var rule = getRule(ruleId);
    if (!rule) return null;

    var log = _loadLog().filter(function (l) { return l.ruleId === ruleId; });
    var applied = log.filter(function (l) { return l.action === 'applied'; }).length;
    var dryRun = log.filter(function (l) { return l.action === 'dry-run'; }).length;
    var skipped = log.filter(function (l) { return l.action === 'skipped'; }).length;

    return {
      rule: rule,
      totalActions: log.length,
      applied: applied,
      dryRun: dryRun,
      skipped: skipped,
      recentActivity: log.slice(-10).reverse()
    };
  }

  function getActivityLog(limit) {
    return _loadLog().slice(-(limit || 50)).reverse();
  }

  // ─── Rendering ──────────────────────────────────────────────────────

  function renderRulesDashboard(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var rules = getRules();
    var log = _loadLog();

    var html = '<div class="aar-dashboard">';

    // Summary
    var activeCount = rules.filter(function (r) { return r.enabled; }).length;
    var todayStr = new Date().toISOString().split('T')[0];
    var todayApplied = log.filter(function (l) { return l.action === 'applied' && l.timestamp.startsWith(todayStr); }).length;

    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">';
    html += '<div style="background:#f0f9ff;border-radius:10px;padding:14px;text-align:center;">';
    html += '<div style="font-size:24px;font-weight:700;color:#1d4ed8;">' + rules.length + '</div>';
    html += '<div style="font-size:12px;color:#6b7280;">Total Rules</div></div>';
    html += '<div style="background:#f0fdf4;border-radius:10px;padding:14px;text-align:center;">';
    html += '<div style="font-size:24px;font-weight:700;color:#16a34a;">' + activeCount + '</div>';
    html += '<div style="font-size:12px;color:#6b7280;">Active</div></div>';
    html += '<div style="background:#fefce8;border-radius:10px;padding:14px;text-align:center;">';
    html += '<div style="font-size:24px;font-weight:700;color:#ca8a04;">' + todayApplied + '</div>';
    html += '<div style="font-size:12px;color:#6b7280;">Applied Today</div></div>';
    html += '</div>';

    // Rule cards
    if (rules.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:#6b7280;">';
      html += '<p>No auto-apply rules configured yet.</p></div>';
    } else {
      rules.forEach(function (rule) {
        var borderColor = rule.enabled ? '#10b981' : '#d1d5db';
        html += '<div style="background:#fff;border:1px solid #e5e7eb;border-left:4px solid ' + borderColor + ';border-radius:10px;padding:16px;margin-bottom:12px;">';

        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
        html += '<strong style="font-size:14px;">' + _esc(rule.name) + '</strong>';
        html += '<div>';
        if (rule.dryRun) html += '<span style="font-size:11px;background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:10px;margin-right:4px;">Dry Run</span>';
        html += '<span style="font-size:11px;background:' + (rule.enabled ? '#d1fae5' : '#f3f4f6') + ';color:' + (rule.enabled ? '#065f46' : '#6b7280') + ';padding:2px 8px;border-radius:10px;">' + (rule.enabled ? 'Active' : 'Paused') + '</span>';
        html += '</div></div>';

        // Criteria summary
        var criteria = [];
        if (rule.criteria.keywords.length) criteria.push('Keywords: ' + rule.criteria.keywords.join(', '));
        if (rule.criteria.skills.length) criteria.push('Skills: ' + rule.criteria.skills.join(', '));
        if (rule.criteria.minBudget) criteria.push('Min budget: $' + rule.criteria.minBudget);
        if (rule.criteria.maxProposals) criteria.push('Max proposals: ' + rule.criteria.maxProposals);

        if (criteria.length) {
          html += '<div style="font-size:12px;color:#374151;margin-bottom:8px;">' + criteria.map(function (c) { return _esc(c); }).join(' · ') + '</div>';
        }

        // Stats
        html += '<div style="font-size:11px;color:#6b7280;">';
        html += 'Matched: ' + (rule.stats.matched || 0) + ' · Applied: ' + (rule.stats.applied || 0) + ' · Limit: ' + rule.maxAppliesPerDay + '/day';
        html += '</div>';

        html += '</div>';
      });
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Init ───────────────────────────────────────────────────────────

  function init() {
    console.log('[AutoApplyRules] Initialized — ' + _loadRules().filter(function (r) { return r.enabled; }).length + ' active rules');
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.AutoApplyRules = {
    init: init,
    createRule: createRule,
    updateRule: updateRule,
    deleteRule: deleteRule,
    getRules: getRules,
    getRule: getRule,
    toggleRule: toggleRule,
    createTemplate: createTemplate,
    getTemplates: getTemplates,
    deleteTemplate: deleteTemplate,
    fillTemplate: fillTemplate,
    matchJob: matchJob,
    processJob: processJob,
    processJobs: processJobs,
    getRuleAnalytics: getRuleAnalytics,
    getActivityLog: getActivityLog,
    renderRulesDashboard: renderRulesDashboard
  };
})();
