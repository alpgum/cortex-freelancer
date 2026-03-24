/**
 * [CF-021] Job Red Flag Detector with Explanations
 * Detect: unrealistic expectations, pay below market, scope creep signals,
 * new client with no history. Returns flags with severity and explanations.
 *
 * window.CortexFreelancer.JobRedFlags
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Flag Definitions ──────────────────────────────────────────────
  var FLAG_DEFS = {
    lowPay: {
      id: 'lowPay',
      label: 'Below Market Pay',
      icon: '💸',
      severity: 'high'
    },
    unrealisticExpectations: {
      id: 'unrealisticExpectations',
      label: 'Unrealistic Expectations',
      icon: '⚠️',
      severity: 'high'
    },
    scopeCreep: {
      id: 'scopeCreep',
      label: 'Scope Creep Risk',
      icon: '📐',
      severity: 'medium'
    },
    newClientNoHistory: {
      id: 'newClientNoHistory',
      label: 'New Client — No History',
      icon: '👤',
      severity: 'low'
    },
    vagueDescription: {
      id: 'vagueDescription',
      label: 'Vague Description',
      icon: '❓',
      severity: 'medium'
    },
    urgentPressure: {
      id: 'urgentPressure',
      label: 'Urgent / Pressure Tactics',
      icon: '🔥',
      severity: 'medium'
    },
    unpaidWork: {
      id: 'unpaidWork',
      label: 'Unpaid Work Request',
      icon: '🚫',
      severity: 'high'
    },
    tooManySkills: {
      id: 'tooManySkills',
      label: 'Excessive Skill Requirements',
      icon: '📋',
      severity: 'medium'
    },
    lowBudgetHighScope: {
      id: 'lowBudgetHighScope',
      label: 'Low Budget, High Scope',
      icon: '⚖️',
      severity: 'high'
    },
    noPaymentVerification: {
      id: 'noPaymentVerification',
      label: 'Payment Not Verified',
      icon: '💳',
      severity: 'low'
    },
    highCompetition: {
      id: 'highCompetition',
      label: 'Very High Competition',
      icon: '🏁',
      severity: 'low'
    },
    specWork: {
      id: 'specWork',
      label: 'Spec Work / Free Sample',
      icon: '🎨',
      severity: 'high'
    }
  };

  var SEVERITY_SCORES = { high: 3, medium: 2, low: 1 };

  // ─── Detectors ─────────────────────────────────────────────────────
  function detectLowPay(job) {
    var budget = parseMoney(job.budget);
    if (budget <= 0) return null;

    var type = detectBudgetType(job);
    if (type === 'hourly' && budget < 10) {
      return {
        flag: FLAG_DEFS.lowPay,
        explanation: 'Hourly rate of $' + budget + '/hr is significantly below market rates for most skilled work. Consider whether this aligns with your minimum rate.',
        data: { rate: budget, type: 'hourly' }
      };
    }

    if (type === 'fixed' && budget < 50) {
      return {
        flag: FLAG_DEFS.lowPay,
        explanation: 'Fixed budget of $' + budget + ' is very low and may indicate the client undervalues the work or has unrealistic expectations.',
        data: { budget: budget, type: 'fixed' }
      };
    }

    return null;
  }

  function detectUnrealisticExpectations(job) {
    var desc = (job.description || '').toLowerCase();
    var patterns = [
      { re: /\b(full[\s-]*stack|end[\s-]*to[\s-]*end)\b.*\b(app|application|platform|system)\b/i, msg: 'Requesting a full-stack application' },
      { re: /\b(build|create|develop)\b.*\b(like|similar to|clone)\b.*\b(uber|airbnb|facebook|amazon|netflix|instagram|tiktok|spotify)\b/i, msg: 'Asking for a clone of a major platform' },
      { re: /\b(expert|guru|ninja|rockstar|wizard)\b.*\b(all|every|multiple)\b/i, msg: 'Seeking unrealistic expertise across multiple areas' },
      { re: /\b24\s*\/\s*7\b|\bround[\s-]*the[\s-]*clock\b|\balways[\s-]*available\b/i, msg: 'Expecting 24/7 availability' }
    ];

    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].re.test(desc)) {
        var budget = parseMoney(job.budget);
        if (budget > 0 && budget < 5000) {
          return {
            flag: FLAG_DEFS.unrealisticExpectations,
            explanation: patterns[i].msg + ' with a budget of $' + budget + '. This scope typically requires significantly more investment.',
            data: { pattern: patterns[i].msg, budget: budget }
          };
        }
      }
    }

    return null;
  }

  function detectScopeCreep(job) {
    var desc = (job.description || '').toLowerCase();
    var signals = [];

    if (/\band\s+more\b|\betc\.?\b|\band\s+other\s+tasks\b|\bvarious\s+tasks\b/.test(desc)) {
      signals.push('Open-ended task list ("and more", "etc")');
    }
    if (/\bas\s+needed\b|\bwhenever\b|\bwhat(ever|\'s)\s+needed\b|\bflexible\s+scope\b/.test(desc)) {
      signals.push('Undefined scope ("as needed", "whatever is needed")');
    }
    if (/\bongoing\b.*\b(tasks|work|projects)\b|\bmany\s+projects\b|\bmultiple\s+tasks\b/.test(desc)) {
      signals.push('Bundled multiple projects into one');
    }
    if (/\bwe\'ll\s+(figure|decide|determine)\b|\btbd\b|\bto\s+be\s+determined\b/.test(desc)) {
      signals.push('Requirements not yet defined');
    }

    if (signals.length > 0) {
      return {
        flag: FLAG_DEFS.scopeCreep,
        explanation: 'This job shows scope creep risk: ' + signals.join('; ') + '. Ensure clear deliverables are defined before starting.',
        data: { signals: signals }
      };
    }

    return null;
  }

  function detectNewClient(job) {
    var spent = parseMoney(job.clientTotalSpent || job.clientSpent || job.totalSpent);
    var hires = parseInt(job.clientHires || job.hires || 0, 10);
    var hours = parseFloat(job.clientHoursBilled || job.hoursBilled || 0);

    if (spent === 0 && hires === 0 && hours === 0) {
      return {
        flag: FLAG_DEFS.newClientNoHistory,
        explanation: 'This client has no spending history, no prior hires, and no hours billed. New clients can be fine but carry more risk — consider asking for a milestone-based structure.',
        data: { spent: 0, hires: 0, hours: 0 }
      };
    }

    return null;
  }

  function detectVagueDescription(job) {
    var desc = (job.description || '').trim();
    var wordCount = desc ? desc.split(/\s+/).length : 0;

    if (wordCount < 15) {
      return {
        flag: FLAG_DEFS.vagueDescription,
        explanation: 'The job description has only ' + wordCount + ' words. Very short descriptions often lead to misunderstandings and scope issues. Request clarification before applying.',
        data: { wordCount: wordCount }
      };
    }

    if (wordCount < 40 && !/\b(require|need|must|should|deliver|build|create)\b/i.test(desc)) {
      return {
        flag: FLAG_DEFS.vagueDescription,
        explanation: 'The description lacks specific requirements or deliverables. This can result in misaligned expectations.',
        data: { wordCount: wordCount }
      };
    }

    return null;
  }

  function detectUrgentPressure(job) {
    var desc = (job.description || '').toLowerCase();
    var title = (job.title || '').toLowerCase();
    var text = title + ' ' + desc;

    var urgentPatterns = [
      /\b(asap|a\.s\.a\.p)\b/,
      /\bstart\s+(immediately|today|now|right\s+away)\b/,
      /\b(very\s+)?urgent(ly)?\b/,
      /\bdeadline\s+(is\s+)?(today|tomorrow|tonight)\b/,
      /\bneed(ed)?\s+(it\s+)?(done\s+)?(today|tonight|by\s+tomorrow|within\s+hours?)\b/,
      /\brush\s+(job|project|order)\b/
    ];

    for (var i = 0; i < urgentPatterns.length; i++) {
      if (urgentPatterns[i].test(text)) {
        return {
          flag: FLAG_DEFS.urgentPressure,
          explanation: 'This job uses urgent/pressure language. Rush projects often have hidden complexity, unclear specs, or unreasonable expectations. Price accordingly.',
          data: {}
        };
      }
    }

    return null;
  }

  function detectUnpaidWork(job) {
    var desc = (job.description || '').toLowerCase();

    var patterns = [
      /\b(free|unpaid)\s+(trial|test|sample|work)\b/,
      /\bwork\s+for\s+free\b/,
      /\bno\s+(pay|payment|budget)\b.*\b(initially|first|start)\b/,
      /\bequity\s+only\b|\bfor\s+equity\b/,
      /\bexposure\b.*\b(payment|pay|compensation)\b/,
      /\btest\s+task\b.*\b(unpaid|free|no\s+pay)\b/
    ];

    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].test(desc)) {
        return {
          flag: FLAG_DEFS.unpaidWork,
          explanation: 'This job appears to request unpaid or "trial" work. Legitimate clients pay for all work, including test tasks. Avoid unless the test task is very small and clearly scoped.',
          data: {}
        };
      }
    }

    return null;
  }

  function detectTooManySkills(job) {
    var skills = job.skills || job.requiredSkills || [];
    if (skills.length >= 10) {
      return {
        flag: FLAG_DEFS.tooManySkills,
        explanation: 'This job requires ' + skills.length + ' different skills. Excessively broad requirements often indicate the client wants one person to do the work of an entire team.',
        data: { skillCount: skills.length, skills: skills }
      };
    }
    return null;
  }

  function detectLowBudgetHighScope(job) {
    var desc = (job.description || '').toLowerCase();
    var budget = parseMoney(job.budget);
    if (budget <= 0) return null;

    var wordCount = desc.split(/\s+/).length;
    var complexityIndicators = 0;

    if (/\b(api|database|backend|frontend|full[\s-]*stack)\b/i.test(desc)) complexityIndicators++;
    if (/\b(design|ui\/ux|responsive|mobile)\b/i.test(desc)) complexityIndicators++;
    if (/\b(auth|login|register|payment|stripe|paypal)\b/i.test(desc)) complexityIndicators++;
    if (/\b(deploy|hosting|server|aws|cloud)\b/i.test(desc)) complexityIndicators++;
    if (/\b(testing|tests|qa|quality)\b/i.test(desc)) complexityIndicators++;
    if (/\b(admin\s+panel|dashboard|cms|crm)\b/i.test(desc)) complexityIndicators++;

    if (complexityIndicators >= 3 && budget < 1000) {
      return {
        flag: FLAG_DEFS.lowBudgetHighScope,
        explanation: 'This job mentions ' + complexityIndicators + ' complex technical areas but has a budget of only $' + budget + '. The scope likely exceeds the budget by a significant margin.',
        data: { complexity: complexityIndicators, budget: budget }
      };
    }

    return null;
  }

  function detectNoPaymentVerification(job) {
    if (job.paymentVerified === false || job.clientPaymentVerified === false) {
      return {
        flag: FLAG_DEFS.noPaymentVerification,
        explanation: 'The client has not verified their payment method. While not always a dealbreaker, verified payment adds a layer of trust.',
        data: {}
      };
    }
    return null;
  }

  function detectHighCompetition(job) {
    var proposals = parseInt(job.proposals || job.applicants || job.bids || 0, 10);
    if (proposals >= 40) {
      return {
        flag: FLAG_DEFS.highCompetition,
        explanation: 'This job has ' + proposals + ' proposals. High competition reduces your chances and may indicate the client is shopping for the cheapest option.',
        data: { proposals: proposals }
      };
    }
    return null;
  }

  function detectSpecWork(job) {
    var desc = (job.description || '').toLowerCase();

    var patterns = [
      /\b(send|submit|provide)\s+(me\s+)?(a\s+)?(sample|mock[\s-]*up|design|prototype|demo)\b.*\b(before|prior|first|to\s+consider)\b/,
      /\bspec\s+work\b/,
      /\bdesign\s+contest\b/,
      /\bsubmit\s+your\s+(best|work|design|solution)\b.*\b(select|choose|pick)\b/
    ];

    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].test(desc)) {
        return {
          flag: FLAG_DEFS.specWork,
          explanation: 'This job appears to request spec work or a free sample before hiring. This is often used to get free work from multiple freelancers.',
          data: {}
        };
      }
    }
    return null;
  }

  // ─── Main Analyze ──────────────────────────────────────────────────
  function analyze(job) {
    if (!job) return { flags: [], riskScore: 0, riskLevel: 'unknown', summary: 'No job data' };

    var detectors = [
      detectLowPay,
      detectUnrealisticExpectations,
      detectScopeCreep,
      detectNewClient,
      detectVagueDescription,
      detectUrgentPressure,
      detectUnpaidWork,
      detectTooManySkills,
      detectLowBudgetHighScope,
      detectNoPaymentVerification,
      detectHighCompetition,
      detectSpecWork
    ];

    var flags = [];
    for (var i = 0; i < detectors.length; i++) {
      var result = detectors[i](job);
      if (result) flags.push(result);
    }

    // Calculate risk score (0-100, higher = more risky)
    var totalSeverity = 0;
    var maxPossible = detectors.length * 3;
    for (var j = 0; j < flags.length; j++) {
      totalSeverity += SEVERITY_SCORES[flags[j].flag.severity] || 1;
    }
    var riskScore = Math.min(100, Math.round((totalSeverity / maxPossible) * 100 * 2));

    var riskLevel;
    if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';
    else if (riskScore > 0) riskLevel = 'low';
    else riskLevel = 'none';

    var summary;
    if (flags.length === 0) summary = 'No red flags detected. This job looks safe.';
    else if (riskLevel === 'high') summary = flags.length + ' red flag(s) found — proceed with extreme caution.';
    else if (riskLevel === 'medium') summary = flags.length + ' flag(s) found — review carefully before applying.';
    else summary = flags.length + ' minor flag(s) — generally safe but worth noting.';

    return {
      flags: flags,
      flagCount: flags.length,
      riskScore: riskScore,
      riskLevel: riskLevel,
      summary: summary
    };
  }

  // ─── Batch Analyze ─────────────────────────────────────────────────
  function analyzeJobs(jobs) {
    if (!jobs || !jobs.length) return [];
    return jobs.map(function (job) {
      return { job: job, analysis: analyze(job) };
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────
  function renderFlags(analysis) {
    if (!analysis || !analysis.flags.length) {
      return '<div style="background:#065f46;color:#34d399;padding:10px 14px;border-radius:8px;font-size:13px;font-family:-apple-system,sans-serif;">✅ No red flags detected</div>';
    }

    var riskColor;
    if (analysis.riskLevel === 'high') riskColor = '#ef4444';
    else if (analysis.riskLevel === 'medium') riskColor = '#f97316';
    else riskColor = '#eab308';

    var h = '<div style="background:#111;border:1px solid #222;border-radius:10px;padding:14px 16px;font-family:-apple-system,sans-serif;">';

    // Header
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
    h += '<span style="color:#e0e0e0;font-size:15px;font-weight:700;">🚩 Red Flags</span>';
    h += '<span style="background:' + riskColor + '20;color:' + riskColor + ';padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;">';
    h += 'Risk: ' + analysis.riskScore + '/100</span>';
    h += '</div>';

    // Summary
    h += '<div style="color:#888;font-size:13px;margin-bottom:12px;">' + analysis.summary + '</div>';

    // Flags
    for (var i = 0; i < analysis.flags.length; i++) {
      var f = analysis.flags[i];
      var sevColor;
      if (f.flag.severity === 'high') sevColor = '#ef4444';
      else if (f.flag.severity === 'medium') sevColor = '#f97316';
      else sevColor = '#eab308';

      h += '<div style="background:#151515;border:1px solid #222;border-left:3px solid ' + sevColor + ';border-radius:8px;padding:10px 14px;margin-bottom:8px;">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
      h += '<span>' + f.flag.icon + '</span>';
      h += '<span style="color:#e0e0e0;font-size:13px;font-weight:600;">' + f.flag.label + '</span>';
      h += '<span style="background:' + sevColor + '20;color:' + sevColor + ';font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;text-transform:uppercase;">' + f.flag.severity + '</span>';
      h += '</div>';
      h += '<div style="color:#888;font-size:12px;line-height:1.5;">' + f.explanation + '</div>';
      h += '</div>';
    }

    h += '</div>';
    return h;
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function parseMoney(val) {
    if (val == null) return 0;
    var s = String(val).replace(/[^0-9.kmKM]/g, '');
    var num = parseFloat(s);
    if (isNaN(num)) return 0;
    var raw = String(val).toLowerCase();
    if (raw.indexOf('m') !== -1) num *= 1000000;
    else if (raw.indexOf('k') !== -1) num *= 1000;
    return num;
  }

  function detectBudgetType(job) {
    var b = String(job.budget || job.budgetType || '').toLowerCase();
    if (b.indexOf('hour') !== -1 || b.indexOf('/hr') !== -1) return 'hourly';
    if (job.budgetType) {
      var t = String(job.budgetType).toLowerCase();
      if (t.indexOf('hour') !== -1) return 'hourly';
    }
    return 'fixed';
  }

  // ─── Public API ────────────────────────────────────────────────────
  window.CortexFreelancer.JobRedFlags = {
    analyze: analyze,
    analyzeJobs: analyzeJobs,
    renderFlags: renderFlags,
    FLAG_DEFS: FLAG_DEFS,
    version: '1.0.0'
  };

})();
