/**
 * [CF-070] Contract Negotiation Advisor
 * AI tool to help freelancers negotiate rates, milestones, and terms
 * with suggested counter-offers. Decision tree + templates.
 * Exposed as window.CortexFreelancer.ContractNegotiation
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ══════════════════════════════════════════════
   * RATE BENCHMARKS BY CATEGORY & EXPERIENCE
   * ══════════════════════════════════════════════ */
  const RATE_BENCHMARKS = {
    'Web Development': { junior: { min: 25, mid: 40, max: 60 }, mid: { min: 50, mid: 75, max: 100 }, senior: { min: 85, mid: 120, max: 175 } },
    'Mobile Development': { junior: { min: 30, mid: 45, max: 65 }, mid: { min: 55, mid: 80, max: 110 }, senior: { min: 90, mid: 130, max: 200 } },
    'UI/UX Design': { junior: { min: 25, mid: 40, max: 55 }, mid: { min: 45, mid: 70, max: 95 }, senior: { min: 80, mid: 110, max: 160 } },
    'Data Science': { junior: { min: 35, mid: 50, max: 70 }, mid: { min: 60, mid: 90, max: 120 }, senior: { min: 100, mid: 140, max: 200 } },
    'Copywriting': { junior: { min: 20, mid: 30, max: 45 }, mid: { min: 35, mid: 55, max: 75 }, senior: { min: 60, mid: 85, max: 125 } },
    'Marketing': { junior: { min: 20, mid: 35, max: 50 }, mid: { min: 40, mid: 60, max: 85 }, senior: { min: 70, mid: 100, max: 150 } },
    'Project Management': { junior: { min: 25, mid: 40, max: 55 }, mid: { min: 45, mid: 65, max: 90 }, senior: { min: 75, mid: 105, max: 150 } },
    'Video Production': { junior: { min: 20, mid: 35, max: 50 }, mid: { min: 40, mid: 60, max: 85 }, senior: { min: 70, mid: 100, max: 140 } },
    'DevOps': { junior: { min: 35, mid: 50, max: 70 }, mid: { min: 60, mid: 85, max: 115 }, senior: { min: 95, mid: 135, max: 190 } },
    'AI/ML Engineering': { junior: { min: 40, mid: 60, max: 80 }, mid: { min: 70, mid: 100, max: 140 }, senior: { min: 120, mid: 160, max: 250 } },
  };

  /* ══════════════════════════════════════════════
   * CONTRACT TERM TEMPLATES
   * ══════════════════════════════════════════════ */
  const TERM_TEMPLATES = {
    payment: {
      milestone: {
        label: 'Milestone-Based Payment',
        description: 'Payment released upon completion of each milestone',
        template: 'Payment will be made in {count} milestones: {milestones}. Each milestone payment is released within {days} business days of approval.',
        pros: ['Predictable cash flow', 'Clear deliverables', 'Reduced risk for both parties'],
        cons: ['Requires upfront planning', 'Less flexible for scope changes'],
      },
      hourly: {
        label: 'Hourly Rate',
        description: 'Payment based on tracked hours',
        template: 'Work will be billed at ${rate}/hr with weekly invoicing. Maximum {maxHours} hours/week unless pre-approved.',
        pros: ['Fair for scope changes', 'No scope-creep risk', 'Flexible'],
        cons: ['Client may worry about efficiency', 'Income less predictable'],
      },
      retainer: {
        label: 'Monthly Retainer',
        description: 'Fixed monthly fee for ongoing availability',
        template: 'A monthly retainer of ${amount} covers up to {hours} hours. Additional hours billed at ${overageRate}/hr.',
        pros: ['Stable income', 'Client gets priority access', 'Long-term relationship'],
        cons: ['May underutilize hours', 'Harder to scale up quickly'],
      },
      valueFixed: {
        label: 'Value-Based Fixed Price',
        description: 'Single project fee based on deliverable value',
        template: 'Project fee of ${amount} with {revisions} revision rounds included. 50% upfront, 50% on completion.',
        pros: ['High earning potential', 'Client knows total cost', 'Rewards efficiency'],
        cons: ['Scope creep risk', 'Requires accurate estimation'],
      },
    },
    scope: {
      standard: 'This agreement covers: {deliverables}. Any work outside this scope requires a separate agreement or change order.',
      withRevisions: 'Includes {count} rounds of revisions per deliverable. Additional revisions billed at ${rate}/hr.',
      withExclusions: 'Explicitly excluded: {exclusions}. These can be added via change order at additional cost.',
    },
    timeline: {
      standard: 'Project duration: {duration}. Start date: {startDate}. Delivery date: {endDate}.',
      withBuffer: 'Estimated {duration} with a {buffer} buffer for unforeseen issues. Client delays extend the timeline proportionally.',
      rush: 'Rush delivery in {duration} at {multiplier}× standard rate. Standard timeline would be {standardDuration}.',
    },
    revisions: {
      limited: '{count} revision rounds included. Additional revisions at ${rate}/hr or ${flatRate} per round.',
      unlimited: 'Unlimited minor revisions within scope. Major direction changes treated as new scope.',
      timeboxed: 'Revisions accepted within {days} days of each deliverable. After this window, revisions are billed separately.',
    },
    ip: {
      fullTransfer: 'All intellectual property transfers to Client upon final payment. Freelancer retains right to display work in portfolio.',
      license: 'Client receives an exclusive, perpetual license. Freelancer retains ownership for portfolio use only.',
      shared: 'Client owns the deliverables. Freelancer retains rights to underlying tools, templates, and methodologies.',
    },
    cancellation: {
      standard: 'Either party may cancel with {days} days written notice. Work completed to date is billable.',
      killFee: 'Client may cancel at any time. A kill fee of {percentage}% of remaining project value applies.',
      noRefund: 'Deposits and milestone payments for completed work are non-refundable.',
    },
  };

  /* ══════════════════════════════════════════════
   * NEGOTIATION DECISION TREE
   * ══════════════════════════════════════════════ */
  const DECISION_TREE = {
    rateNegotiation: {
      clientSaysRate: function (offeredRate, yourRate, benchmark) {
        const ratio = offeredRate / yourRate;
        if (ratio >= 0.95) return { action: 'accept', confidence: 'high', message: 'This is very close to your rate. Accept or make a small counter.' };
        if (ratio >= 0.80) return { action: 'counter', confidence: 'medium', message: 'Reasonable starting point. Counter with justification.' };
        if (ratio >= 0.60) return { action: 'counter_strong', confidence: 'medium', message: 'Significantly below your rate. Present value proposition.' };
        return { action: 'walk_away', confidence: 'high', message: 'This rate is too far below market. Consider declining politely.' };
      },
      generateCounterOffer: function (offeredRate, yourRate, context) {
        var counterRate = Math.round((offeredRate + yourRate) / 2);
        var strategies = [];

        if (context.hasPortfolio) strategies.push('Reference specific portfolio pieces relevant to their project');
        if (context.hasTestimonials) strategies.push('Share client testimonials demonstrating ROI');
        if (context.yearsExperience > 3) strategies.push('Emphasize your ' + context.yearsExperience + ' years of specialized experience');
        if (context.jss > 90) strategies.push('Highlight your ' + context.jss + '% Job Success Score');

        strategies.push('Offer a small scope reduction at their price to anchor your real rate');
        strategies.push('Propose a trial milestone at a middle rate to demonstrate value');

        return {
          suggestedRate: counterRate,
          message: buildCounterMessage(offeredRate, counterRate, yourRate, context),
          strategies: strategies,
          alternatives: [
            { type: 'rate_reduction', rate: Math.round(yourRate * 0.9), condition: 'For a 3+ month commitment' },
            { type: 'scope_reduction', rate: offeredRate, condition: 'With reduced scope (remove: ' + (context.lowestPriorityDeliverable || 'non-critical features') + ')' },
            { type: 'hybrid', rate: Math.round((offeredRate + yourRate * 0.85) / 2), condition: 'Lower rate + performance bonus on milestone delivery' },
          ],
        };
      },
    },
    scopeNegotiation: {
      evaluateScope: function (deliverables, timeline, rate) {
        var estimatedHours = deliverables.reduce(function (sum, d) { return sum + (d.estimatedHours || 8); }, 0);
        var totalValue = estimatedHours * rate;
        var timelineWeeks = timeline / 7;
        var hoursPerWeek = estimatedHours / timelineWeeks;

        var feasibility = 'feasible';
        var warnings = [];

        if (hoursPerWeek > 50) { feasibility = 'risky'; warnings.push('Over 50 hrs/week required — unsustainable pace'); }
        else if (hoursPerWeek > 40) { feasibility = 'tight'; warnings.push('40+ hrs/week — little room for iteration'); }

        if (deliverables.length > 5 && timeline < 30) { warnings.push('Many deliverables in a short timeline — prioritize ruthlessly'); }

        return {
          estimatedHours: estimatedHours,
          totalValue: totalValue,
          hoursPerWeek: Math.round(hoursPerWeek * 10) / 10,
          feasibility: feasibility,
          warnings: warnings,
          recommendation: feasibility === 'risky'
            ? 'Negotiate for more time or reduced scope'
            : feasibility === 'tight'
              ? 'Add a buffer clause for timeline extensions'
              : 'Scope is manageable — proceed with confidence',
        };
      },
    },
    milestoneNegotiation: {
      suggestMilestones: function (deliverables, totalBudget) {
        if (!deliverables.length) return [];
        var totalEffort = deliverables.reduce(function (s, d) { return s + (d.estimatedHours || 8); }, 0);
        var milestones = [];
        var runningPct = 0;

        // Always suggest upfront deposit
        milestones.push({
          name: 'Project Kickoff & Discovery',
          percentage: 20,
          amount: Math.round(totalBudget * 0.2),
          deliverables: ['Project plan', 'Requirements finalized', 'Timeline confirmed'],
          trigger: 'Upon signing',
        });
        runningPct = 20;

        var remainingPct = 80;
        var perDeliverable = Math.round(remainingPct / deliverables.length);

        deliverables.forEach(function (d, i) {
          var pct = i === deliverables.length - 1 ? (100 - runningPct) : perDeliverable;
          milestones.push({
            name: d.name || ('Deliverable ' + (i + 1)),
            percentage: pct,
            amount: Math.round(totalBudget * pct / 100),
            deliverables: d.subTasks || [d.name || 'Deliverable ' + (i + 1)],
            trigger: 'Upon approval of ' + (d.name || 'deliverable ' + (i + 1)),
          });
          runningPct += pct;
        });

        return milestones;
      },
    },
  };

  /* ══════════════════════════════════════════════
   * COUNTER-OFFER MESSAGE BUILDER
   * ══════════════════════════════════════════════ */
  function buildCounterMessage(offeredRate, counterRate, yourRate, context) {
    var lines = [];
    lines.push('Thank you for the opportunity! I\'ve reviewed the project details and I\'m excited about this work.');
    lines.push('');
    lines.push('Based on the scope and my experience, I\'d like to propose a rate of $' + counterRate + '/hr.');
    lines.push('');

    if (context.yearsExperience) {
      lines.push('Here\'s why this rate reflects the value I bring:');
      lines.push('• ' + context.yearsExperience + ' years of specialized experience in this exact area');
    }
    if (context.jss) {
      lines.push('• ' + context.jss + '% Job Success Score — reliability you can count on');
    }
    if (context.completedProjects) {
      lines.push('• ' + context.completedProjects + ' similar projects completed successfully');
    }
    if (context.hasPortfolio) {
      lines.push('• Relevant portfolio work I\'d love to walk you through');
    }

    lines.push('');
    lines.push('I\'m confident I can deliver exceptional results. Would you be open to discussing this further?');

    return lines.join('\n');
  }

  /* ══════════════════════════════════════════════
   * RED FLAG DETECTOR
   * ══════════════════════════════════════════════ */
  function detectRedFlags(projectDescription, clientData) {
    var flags = [];
    var desc = (projectDescription || '').toLowerCase();
    var patterns = [
      { pattern: /unpaid\s*(test|trial|sample)/i, flag: 'Unpaid test work requested', severity: 'high', advice: 'Offer a small paid pilot instead. Your time has value.' },
      { pattern: /equity\s*(only|instead|in\s*lieu)/i, flag: 'Equity-only compensation', severity: 'high', advice: 'Require at least partial cash payment. Equity alone is high risk.' },
      { pattern: /asap|urgent|yesterday|emergency/i, flag: 'Urgency pressure', severity: 'medium', advice: 'Rush work deserves rush rates (1.5-2×). Set clear expectations.' },
      { pattern: /simple|easy|quick|just\s*a?\s*(small|little)/i, flag: 'Scope minimization language', severity: 'low', advice: 'If it\'s "simple," they shouldn\'t mind paying market rate. Clarify scope carefully.' },
      { pattern: /exposure|portfolio\s*piece|great\s*for\s*your/i, flag: '"Paying in exposure"', severity: 'high', advice: 'Exposure doesn\'t pay rent. Politely decline or set your real rate.' },
      { pattern: /no\s*contract|handshake|trust/i, flag: 'Resistance to formal agreement', severity: 'high', advice: 'Always use a contract. No exceptions. This protects both parties.' },
      { pattern: /unlimited\s*revisions/i, flag: 'Unlimited revisions expected', severity: 'medium', advice: 'Set clear revision limits. Unlimited = indefinite scope creep.' },
      { pattern: /nda.*before.*details|sign.*first/i, flag: 'NDA before project details', severity: 'low', advice: 'Review the NDA carefully. Don\'t sign overly broad or restrictive NDAs.' },
    ];

    patterns.forEach(function (p) {
      if (p.pattern.test(desc)) {
        flags.push({ flag: p.flag, severity: p.severity, advice: p.advice });
      }
    });

    if (clientData) {
      if (clientData.hireRate !== undefined && clientData.hireRate < 20) {
        flags.push({ flag: 'Low hire rate (' + clientData.hireRate + '%)', severity: 'medium', advice: 'Client rarely hires from proposals. Manage expectations.' });
      }
      if (clientData.avgRating !== undefined && clientData.avgRating < 3.5) {
        flags.push({ flag: 'Low client rating (' + clientData.avgRating + '/5)', severity: 'medium', advice: 'Other freelancers had issues. Proceed with caution and clear terms.' });
      }
      if (clientData.totalSpent !== undefined && clientData.totalSpent < 100) {
        flags.push({ flag: 'New/low-spending client ($' + clientData.totalSpent + ' total)', severity: 'low', advice: 'New client — use escrow/milestones to protect yourself.' });
      }
    }

    return flags.sort(function (a, b) {
      var sev = { high: 3, medium: 2, low: 1 };
      return (sev[b.severity] || 0) - (sev[a.severity] || 0);
    });
  }

  /* ══════════════════════════════════════════════
   * CONTRACT GENERATOR
   * ══════════════════════════════════════════════ */
  function generateContractOutline(config) {
    var sections = [];

    // Payment terms
    var paymentType = config.paymentType || 'milestone';
    var paymentTemplate = TERM_TEMPLATES.payment[paymentType];
    if (paymentTemplate) {
      var text = paymentTemplate.template;
      if (config.rate) text = text.replace(/\{rate\}/g, config.rate);
      if (config.amount) text = text.replace(/\{amount\}/g, config.amount);
      if (config.milestones) text = text.replace(/\{milestones\}/g, config.milestones.map(function (m) { return m.name + ' ($' + m.amount + ')'; }).join(', '));
      if (config.milestoneCount) text = text.replace(/\{count\}/g, config.milestoneCount);
      text = text.replace(/\{days\}/g, config.paymentDays || '5');
      text = text.replace(/\{maxHours\}/g, config.maxHours || '40');
      text = text.replace(/\{hours\}/g, config.retainerHours || '20');
      text = text.replace(/\{overageRate\}/g, config.overageRate || Math.round((config.rate || 50) * 1.25));
      text = text.replace(/\{revisions\}/g, config.revisionRounds || '2');
      sections.push({ title: 'Payment Terms', content: text, type: paymentTemplate.label });
    }

    // Scope
    var scopeType = config.hasExclusions ? 'withExclusions' : config.revisionRounds ? 'withRevisions' : 'standard';
    var scopeText = TERM_TEMPLATES.scope[scopeType];
    if (config.deliverables) scopeText = scopeText.replace(/\{deliverables\}/g, config.deliverables.map(function (d) { return d.name || d; }).join(', '));
    if (config.exclusions) scopeText = scopeText.replace(/\{exclusions\}/g, config.exclusions.join(', '));
    if (config.revisionRounds) scopeText = scopeText.replace(/\{count\}/g, config.revisionRounds);
    if (config.rate) scopeText = scopeText.replace(/\{rate\}/g, config.rate);
    sections.push({ title: 'Scope of Work', content: scopeText });

    // Timeline
    var timelineType = config.isRush ? 'rush' : config.hasBuffer ? 'withBuffer' : 'standard';
    var timeText = TERM_TEMPLATES.timeline[timelineType];
    timeText = timeText.replace(/\{duration\}/g, config.duration || 'TBD');
    timeText = timeText.replace(/\{startDate\}/g, config.startDate || 'TBD');
    timeText = timeText.replace(/\{endDate\}/g, config.endDate || 'TBD');
    timeText = timeText.replace(/\{buffer\}/g, config.buffer || '1-week');
    timeText = timeText.replace(/\{multiplier\}/g, config.rushMultiplier || '1.5');
    timeText = timeText.replace(/\{standardDuration\}/g, config.standardDuration || 'TBD');
    sections.push({ title: 'Timeline', content: timeText });

    // Revisions
    var revType = config.unlimitedRevisions ? 'unlimited' : config.timeboxedRevisions ? 'timeboxed' : 'limited';
    var revText = TERM_TEMPLATES.revisions[revType];
    revText = revText.replace(/\{count\}/g, config.revisionRounds || '2');
    revText = revText.replace(/\{rate\}/g, config.rate || '50');
    revText = revText.replace(/\{flatRate\}/g, config.revisionFlatRate || '150');
    revText = revText.replace(/\{days\}/g, config.revisionWindow || '7');
    sections.push({ title: 'Revisions', content: revText });

    // IP
    var ipType = config.ipType || 'fullTransfer';
    sections.push({ title: 'Intellectual Property', content: TERM_TEMPLATES.ip[ipType] });

    // Cancellation
    var cancelType = config.killFee ? 'killFee' : config.noRefund ? 'noRefund' : 'standard';
    var cancelText = TERM_TEMPLATES.cancellation[cancelType];
    cancelText = cancelText.replace(/\{days\}/g, config.cancellationDays || '14');
    cancelText = cancelText.replace(/\{percentage\}/g, config.killFeePercentage || '25');
    sections.push({ title: 'Cancellation', content: cancelText });

    return {
      sections: sections,
      markdown: sections.map(function (s) { return '## ' + s.title + '\n\n' + s.content; }).join('\n\n'),
      summary: 'Contract outline with ' + sections.length + ' sections covering ' + (paymentTemplate ? paymentTemplate.label : 'payment') + ', scope, timeline, revisions, IP, and cancellation.',
    };
  }

  /* ══════════════════════════════════════════════
   * RATE ADVISOR
   * ══════════════════════════════════════════════ */
  function adviseRate(category, experienceLevel, context) {
    var benchmarks = RATE_BENCHMARKS[category];
    if (!benchmarks) {
      // Fallback to general average
      benchmarks = { junior: { min: 25, mid: 40, max: 60 }, mid: { min: 50, mid: 75, max: 100 }, senior: { min: 85, mid: 120, max: 175 } };
    }

    var level = benchmarks[experienceLevel] || benchmarks.mid;
    var recommended = level.mid;

    // Adjustments
    var adjustments = [];
    if (context && context.jss > 95) { recommended = Math.round(recommended * 1.10); adjustments.push('+10% for 95%+ JSS'); }
    else if (context && context.jss > 90) { recommended = Math.round(recommended * 1.05); adjustments.push('+5% for 90%+ JSS'); }

    if (context && context.completedProjects > 50) { recommended = Math.round(recommended * 1.08); adjustments.push('+8% for 50+ completed projects'); }
    else if (context && context.completedProjects > 20) { recommended = Math.round(recommended * 1.04); adjustments.push('+4% for 20+ completed projects'); }

    if (context && context.specialization) { recommended = Math.round(recommended * 1.10); adjustments.push('+10% for niche specialization'); }
    if (context && context.isRush) { recommended = Math.round(recommended * 1.50); adjustments.push('+50% rush premium'); }

    return {
      category: category,
      level: experienceLevel,
      range: level,
      recommended: recommended,
      adjustments: adjustments,
      floorRate: Math.round(level.min * 0.9),
      ceilingRate: Math.round(level.max * 1.15),
      advice: recommended >= level.max
        ? 'Your profile justifies premium rates. Don\'t undervalue yourself.'
        : recommended >= level.mid
          ? 'Solid mid-range positioning. Room to grow as you build reputation.'
          : 'Start here to build reviews, then raise rates after 5-10 successful projects.',
    };
  }

  /* ══════════════════════════════════════════════
   * RENDER (UI)
   * ══════════════════════════════════════════════ */
  function render(container, options) {
    if (!container) return;
    options = options || {};

    var profileData = options.profileData || {};
    var projectDesc = options.projectDescription || '';
    var clientData = options.clientData || {};
    var offeredRate = options.offeredRate || 0;

    var category = profileData.category || 'Web Development';
    var expLevel = profileData.experienceLevel || 'mid';
    var rate = profileData.rate || 50;

    // Run analysis
    var rateAdvice = adviseRate(category, expLevel, {
      jss: profileData.jss,
      completedProjects: profileData.completedProjects,
      specialization: profileData.specialization,
      isRush: options.isRush,
    });

    var redFlags = detectRedFlags(projectDesc, clientData);
    var negotiation = offeredRate ? DECISION_TREE.rateNegotiation.clientSaysRate(offeredRate, rate, rateAdvice) : null;
    var counterOffer = (negotiation && negotiation.action !== 'accept')
      ? DECISION_TREE.rateNegotiation.generateCounterOffer(offeredRate, rate, {
          hasPortfolio: !!profileData.portfolioCount,
          hasTestimonials: !!profileData.testimonialCount,
          yearsExperience: profileData.yearsExperience || 0,
          jss: profileData.jss,
          completedProjects: profileData.completedProjects,
        })
      : null;

    var html = '<div class="cn-root" style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:720px;">';

    // Rate Advisor Card
    html += '<div class="cn-card" style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 12px;color:#7c83ff;font-size:16px;">💰 Rate Advisor</h3>';
    html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;">';
    html += '<div style="flex:1;min-width:140px;background:#1a1a2e;border-radius:8px;padding:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Market Range</div>';
    html += '<div style="font-size:20px;font-weight:700;color:#e0e0e0;margin-top:4px;">$' + rateAdvice.range.min + '–$' + rateAdvice.range.max + '</div>';
    html += '</div>';
    html += '<div style="flex:1;min-width:140px;background:#1a1a2e;border-radius:8px;padding:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Recommended</div>';
    html += '<div style="font-size:24px;font-weight:700;color:#00d4aa;margin-top:4px;">$' + rateAdvice.recommended + '/hr</div>';
    html += '</div>';
    html += '</div>';
    if (rateAdvice.adjustments.length) {
      html += '<div style="font-size:12px;color:#9ca3af;">' + rateAdvice.adjustments.map(function (a) { return '• ' + a; }).join('<br>') + '</div>';
    }
    html += '<p style="font-size:13px;color:#d1d5db;margin:8px 0 0;">' + esc(rateAdvice.advice) + '</p>';
    html += '</div>';

    // Negotiation Decision (if offered rate)
    if (negotiation) {
      var actionColors = { accept: '#00d4aa', counter: '#fbbf24', counter_strong: '#f97316', walk_away: '#ef4444' };
      var actionLabels = { accept: '✅ Accept', counter: '🤝 Counter', counter_strong: '💪 Strong Counter', walk_away: '🚪 Walk Away' };
      html += '<div class="cn-card" style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="margin:0 0 12px;color:#7c83ff;font-size:16px;">🎯 Negotiation Decision</h3>';
      html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
      html += '<span style="background:' + (actionColors[negotiation.action] || '#888') + ';color:#0d0d1a;padding:4px 12px;border-radius:6px;font-weight:600;font-size:13px;">' + (actionLabels[negotiation.action] || negotiation.action) + '</span>';
      html += '<span style="font-size:13px;color:#d1d5db;">' + esc(negotiation.message) + '</span>';
      html += '</div>';

      if (counterOffer) {
        html += '<div style="background:#1a1a2e;border-radius:8px;padding:16px;margin-top:8px;">';
        html += '<div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Suggested Counter: $' + counterOffer.suggestedRate + '/hr</div>';
        html += '<pre style="background:#0d0d1a;border-radius:6px;padding:12px;font-size:12px;color:#d1d5db;white-space:pre-wrap;margin:0 0 12px;max-height:200px;overflow:auto;">' + esc(counterOffer.message) + '</pre>';
        html += '<div style="font-size:12px;color:#9ca3af;margin-bottom:8px;"><strong>Strategies:</strong></div>';
        html += '<ul style="margin:0;padding-left:16px;font-size:12px;color:#9ca3af;">';
        counterOffer.strategies.forEach(function (s) { html += '<li style="margin-bottom:4px;">' + esc(s) + '</li>'; });
        html += '</ul>';
        if (counterOffer.alternatives.length) {
          html += '<div style="font-size:12px;color:#9ca3af;margin-top:12px;"><strong>Alternatives:</strong></div>';
          counterOffer.alternatives.forEach(function (alt) {
            html += '<div style="font-size:12px;background:#12121f;border-radius:6px;padding:8px;margin-top:6px;display:flex;justify-content:space-between;">';
            html += '<span style="color:#d1d5db;">$' + alt.rate + '/hr — ' + esc(alt.condition) + '</span>';
            html += '</div>';
          });
        }
        html += '</div>';
      }
      html += '</div>';
    }

    // Red Flags
    if (redFlags.length) {
      html += '<div class="cn-card" style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
      html += '<h3 style="margin:0 0 12px;color:#ef4444;font-size:16px;">🚩 Red Flags (' + redFlags.length + ')</h3>';
      redFlags.forEach(function (f) {
        var sevColors = { high: '#ef4444', medium: '#f97316', low: '#fbbf24' };
        html += '<div style="background:#1a1a2e;border-left:3px solid ' + (sevColors[f.severity] || '#888') + ';border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px;">';
        html += '<div style="font-size:13px;font-weight:600;color:#e0e0e0;">' + esc(f.flag) + ' <span style="font-size:11px;color:' + (sevColors[f.severity] || '#888') + ';text-transform:uppercase;">' + f.severity + '</span></div>';
        html += '<div style="font-size:12px;color:#9ca3af;margin-top:4px;">💡 ' + esc(f.advice) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    return {
      rateAdvice: rateAdvice,
      negotiation: negotiation,
      counterOffer: counterOffer,
      redFlags: redFlags,
    };
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.ContractNegotiation = {
    adviseRate: adviseRate,
    detectRedFlags: detectRedFlags,
    generateContractOutline: generateContractOutline,
    decisionTree: DECISION_TREE,
    templates: TERM_TEMPLATES,
    benchmarks: RATE_BENCHMARKS,
    render: render,
    version: '1.0.0',
  };

})();
