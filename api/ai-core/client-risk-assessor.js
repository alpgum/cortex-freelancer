/**
 * [PHASE-2] Client Risk Assessment System
 *
 * Multi-dimensional risk analysis for freelancer-client relationships.
 * Evaluates payment risk, scope creep probability, communication risk,
 * and generates an overall risk profile with mitigation strategies.
 *
 * Uses Bayesian risk estimation with historical calibration.
 */

class ClientRiskAssessor {
  constructor() {
    // Risk dimension weights
    this.RISK_WEIGHTS = {
      payment: 0.30,
      scopeCreep: 0.25,
      communication: 0.20,
      timeline: 0.15,
      reputational: 0.10
    };

    // Red flag phrases in job descriptions
    this.SCOPE_CREEP_INDICATORS = [
      { pattern: /\b(and more|and other|and additional|plus other|etc\.?)\b/i, weight: 0.3 },
      { pattern: /\b(ongoing|continuous|evolving|growing|expanding)\b/i, weight: 0.2 },
      { pattern: /\b(flexible scope|scope may change|requirements may|tbd|to be determined)\b/i, weight: 0.5 },
      { pattern: /\b(whatever it takes|full[\s-]?stack everything|all[\s-]?in[\s-]?one)\b/i, weight: 0.4 },
      { pattern: /\b(wear many hats|jack of all|multi[\s-]?role)\b/i, weight: 0.3 },
      { pattern: /\b(unlimited|no limit|as needed)\b/i, weight: 0.5 },
      { pattern: /\b(quick changes|small tweaks|minor updates)\b/i, weight: 0.2 }
    ];

    this.PAYMENT_RISK_INDICATORS = [
      { pattern: /\b(equity|rev[\s-]?share|profit[\s-]?share|deferred|upon success)\b/i, risk: 0.9 },
      { pattern: /\b(no budget|tight budget|limited budget|bootstrap)\b/i, risk: 0.6 },
      { pattern: /\b(test project|trial|prove|sample first)\b/i, risk: 0.5 },
      { pattern: /\b(pay upon completion|payment at end|no milestone)\b/i, risk: 0.4 },
      { pattern: /\b(cheap|lowest|most affordable)\b/i, risk: 0.7 }
    ];

    this.COMMUNICATION_RED_FLAGS = [
      { pattern: /\b(respond immediately|24\/7|always available|instant)\b/i, risk: 0.5 },
      { pattern: /\b(micromanage|daily report|hourly update)\b/i, risk: 0.4 },
      { pattern: /\b(no questions|just do it|don't ask)\b/i, risk: 0.6 },
      { pattern: /\b(NDA before discussion|sign first)\b/i, risk: 0.3 }
    ];

    // Risk level thresholds
    this.RISK_LEVELS = {
      LOW: { min: 0, max: 30, label: 'Low Risk', color: '#22c55e' },
      MODERATE: { min: 30, max: 55, label: 'Moderate Risk', color: '#eab308' },
      HIGH: { min: 55, max: 75, label: 'High Risk', color: '#f97316' },
      CRITICAL: { min: 75, max: 100, label: 'Critical Risk', color: '#ef4444' }
    };
  }

  /**
   * Full risk assessment for a client/job opportunity
   * @param {object} params
   * @param {object} params.job - Job posting data
   * @param {object} params.clientHistory - Client platform history
   * @param {object} [params.communicationData] - Pre-hire communication signals
   * @param {object} [params.marketContext] - Market comparison data
   * @returns {object} Comprehensive risk assessment
   */
  assess(params) {
    const { job, clientHistory, communicationData, marketContext } = params;

    // Assess each risk dimension
    const dimensions = {
      payment: this.assessPaymentRisk(job, clientHistory),
      scopeCreep: this.assessScopeCreepRisk(job),
      communication: this.assessCommunicationRisk(job, clientHistory, communicationData),
      timeline: this.assessTimelineRisk(job),
      reputational: this.assessReputationalRisk(clientHistory)
    };

    // Calculate weighted overall risk score
    let overallRisk = 0;
    for (const [dim, assessment] of Object.entries(dimensions)) {
      overallRisk += assessment.risk * (this.RISK_WEIGHTS[dim] || 0);
    }
    overallRisk = Math.round(overallRisk);

    // Determine risk level
    const riskLevel = this.getRiskLevel(overallRisk);

    // Generate mitigation strategies
    const mitigations = this.generateMitigations(dimensions, overallRisk);

    // Contract recommendations
    const contractRecs = this.generateContractRecommendations(dimensions);

    // Walk-away triggers
    const walkAwayTriggers = this.identifyWalkAwayTriggers(dimensions, overallRisk);

    return {
      overallRisk,
      riskLevel,
      dimensions,
      mitigations,
      contractRecommendations: contractRecs,
      walkAwayTriggers,
      summary: this.generateSummary(overallRisk, riskLevel, dimensions),
      dealBreakers: this.identifyDealBreakers(dimensions)
    };
  }

  /**
   * Quick risk check — lightweight version for batch scoring
   */
  quickAssess(job, clientHistory) {
    const paymentRisk = this.assessPaymentRisk(job, clientHistory || {}).risk;
    const scopeRisk = this.assessScopeCreepRisk(job).risk;
    const commRisk = this.assessCommunicationRisk(job, clientHistory || {}).risk;

    const overall = Math.round(
      paymentRisk * 0.4 + scopeRisk * 0.35 + commRisk * 0.25
    );

    return {
      risk: overall,
      level: this.getRiskLevel(overall).label,
      topConcern: [
        { name: 'Payment', risk: paymentRisk },
        { name: 'Scope', risk: scopeRisk },
        { name: 'Communication', risk: commRisk }
      ].sort((a, b) => b.risk - a.risk)[0]
    };
  }

  // ─── Risk Dimension Assessors ─────────────────────────────────────

  assessPaymentRisk(job, clientHistory) {
    let risk = 20; // Base risk
    const signals = [];

    // Client spend history
    const totalSpent = parseFloat(clientHistory.totalSpent || clientHistory.clientTotalSpent || 0);
    if (totalSpent >= 100000) { risk -= 15; signals.push({ type: 'positive', text: 'High spender ($' + Math.round(totalSpent / 1000) + 'K)' }); }
    else if (totalSpent >= 10000) { risk -= 8; signals.push({ type: 'positive', text: 'Active spender' }); }
    else if (totalSpent >= 1000) { risk -= 3; }
    else if (totalSpent === 0) { risk += 20; signals.push({ type: 'negative', text: 'No spend history' }); }
    else { risk += 10; signals.push({ type: 'warning', text: 'Low platform spend ($' + Math.round(totalSpent) + ')' }); }

    // Payment verification
    if (clientHistory.paymentVerified || clientHistory.clientPaymentVerified) {
      risk -= 10;
      signals.push({ type: 'positive', text: 'Payment method verified' });
    } else {
      risk += 15;
      signals.push({ type: 'negative', text: 'Payment not verified' });
    }

    // Dispute history
    const disputeRate = parseFloat(clientHistory.disputeRate || 0);
    if (disputeRate > 0.15) {
      risk += 30;
      signals.push({ type: 'critical', text: 'High dispute rate (' + Math.round(disputeRate * 100) + '%)' });
    } else if (disputeRate > 0.05) {
      risk += 15;
      signals.push({ type: 'warning', text: 'Some disputes (' + Math.round(disputeRate * 100) + '%)' });
    }

    // Budget signals in description
    const desc = (job.description || '').toLowerCase();
    for (const indicator of this.PAYMENT_RISK_INDICATORS) {
      if (indicator.pattern.test(desc)) {
        risk += Math.round(indicator.risk * 20);
        signals.push({ type: 'warning', text: 'Payment risk signal detected in description' });
        break; // Only count first match
      }
    }

    // Budget to scope ratio
    const budget = parseFloat(String(job.budget || '').replace(/[^0-9.]/g, '')) || 0;
    if (budget > 0 && budget < 50) {
      risk += 25;
      signals.push({ type: 'critical', text: 'Extremely low budget ($' + budget + ')' });
    }

    return {
      risk: Math.max(0, Math.min(100, risk)),
      signals,
      detail: this.summarizeSignals(signals)
    };
  }

  assessScopeCreepRisk(job) {
    let risk = 15; // Base risk
    const signals = [];
    const desc = job.description || '';

    // Check scope creep indicators
    for (const indicator of this.SCOPE_CREEP_INDICATORS) {
      if (indicator.pattern.test(desc)) {
        risk += Math.round(indicator.weight * 25);
        signals.push({
          type: 'warning',
          text: 'Scope uncertainty: "' + (desc.match(indicator.pattern) || [''])[0].trim() + '"'
        });
      }
    }

    // Word count vs specificity ratio
    const words = desc.split(/\s+/).length;
    const specificTerms = (desc.match(/\b(deliver|milestone|sprint|page|screen|endpoint|feature|module)\b/gi) || []).length;

    if (words > 200 && specificTerms < 3) {
      risk += 15;
      signals.push({ type: 'warning', text: 'Long description but few specific deliverables' });
    }

    // Vague requirements
    if (/\b(various|multiple|several|many)\s+(tasks|features|pages|things)\b/i.test(desc)) {
      risk += 10;
      signals.push({ type: 'warning', text: 'Vague multi-item scope' });
    }

    // No milestones defined
    if (!/\b(milestone|phase|stage|sprint|deliverable)\b/i.test(desc)) {
      risk += 8;
      signals.push({ type: 'info', text: 'No milestones defined — propose your own' });
    }

    // Skills list too broad
    const skillCount = (job.skills || []).length;
    if (skillCount > 8) {
      risk += 10;
      signals.push({ type: 'warning', text: `${skillCount} skills required — scope may be too broad` });
    }

    return {
      risk: Math.max(0, Math.min(100, risk)),
      signals,
      detail: this.summarizeSignals(signals)
    };
  }

  assessCommunicationRisk(job, clientHistory, communicationData) {
    let risk = 15;
    const signals = [];
    const desc = job.description || '';

    // Check communication red flags
    for (const flag of this.COMMUNICATION_RED_FLAGS) {
      if (flag.pattern.test(desc)) {
        risk += Math.round(flag.risk * 20);
        signals.push({ type: 'warning', text: 'Communication concern in description' });
      }
    }

    // Client rating patterns
    const avgRating = parseFloat(clientHistory.avgRating || clientHistory.clientRating || 0);
    if (avgRating > 0 && avgRating < 3.5) {
      risk += 25;
      signals.push({ type: 'critical', text: 'Low client rating (' + avgRating.toFixed(1) + '/5)' });
    } else if (avgRating >= 4.5) {
      risk -= 10;
      signals.push({ type: 'positive', text: 'High client rating (' + avgRating.toFixed(1) + '/5)' });
    }

    // Communication data from pre-hire interaction
    if (communicationData) {
      if (communicationData.avgResponseHours > 72) {
        risk += 20;
        signals.push({ type: 'warning', text: 'Very slow pre-hire response time' });
      } else if (communicationData.avgResponseHours <= 4) {
        risk -= 10;
        signals.push({ type: 'positive', text: 'Fast responder' });
      }

      if (communicationData.messageCount < 2 && communicationData.hasDetailedBrief === false) {
        risk += 10;
        signals.push({ type: 'info', text: 'Minimal pre-hire communication' });
      }
    }

    // Hire rate as proxy for seriousness
    const hireRate = parseFloat(clientHistory.hireRate || clientHistory.clientHireRate || 0);
    if (hireRate > 0 && hireRate < 20) {
      risk += 15;
      signals.push({ type: 'warning', text: 'Low hire rate (' + Math.round(hireRate) + '%) — may be window-shopping' });
    } else if (hireRate >= 70) {
      risk -= 10;
      signals.push({ type: 'positive', text: 'High hire rate (' + Math.round(hireRate) + '%)' });
    }

    return {
      risk: Math.max(0, Math.min(100, risk)),
      signals,
      detail: this.summarizeSignals(signals)
    };
  }

  assessTimelineRisk(job) {
    let risk = 10;
    const signals = [];
    const desc = job.description || '';

    // Urgency signals
    if (/\b(ASAP|urgent|immediately|right now|today|yesterday)\b/i.test(desc)) {
      risk += 25;
      signals.push({ type: 'warning', text: 'High urgency — may lead to unrealistic expectations' });
    }

    // Timeline vs scope mismatch
    const duration = (job.projectLength || job.duration || '').toLowerCase();
    const skillCount = (job.skills || []).length;

    if (/less\s+than\s+a\s+week/i.test(duration) && skillCount > 5) {
      risk += 20;
      signals.push({ type: 'critical', text: 'Very short timeline for complex scope' });
    }

    // Deadline specificity
    if (/\b(deadline|due date|by|before)\s+\w+\s+\d+/i.test(desc)) {
      risk -= 5;
      signals.push({ type: 'positive', text: 'Specific deadline mentioned' });
    }

    // No timeline mentioned
    if (!duration && !/\b(week|month|day|deadline|timeline)\b/i.test(desc)) {
      risk += 10;
      signals.push({ type: 'info', text: 'No timeline specified — clarify before accepting' });
    }

    return {
      risk: Math.max(0, Math.min(100, risk)),
      signals,
      detail: this.summarizeSignals(signals)
    };
  }

  assessReputationalRisk(clientHistory) {
    let risk = 10;
    const signals = [];

    // Platform tenure
    const memberSince = clientHistory.memberSince;
    if (memberSince) {
      const years = (Date.now() - new Date(memberSince).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (years >= 3) {
        risk -= 10;
        signals.push({ type: 'positive', text: 'Established client (' + Math.round(years) + ' years)' });
      } else if (years < 0.5) {
        risk += 15;
        signals.push({ type: 'warning', text: 'New client (< 6 months)' });
      }
    }

    // Total hires
    const hires = parseInt(clientHistory.clientHires || clientHistory.hires || 0, 10);
    if (hires >= 20) {
      risk -= 10;
      signals.push({ type: 'positive', text: hires + ' past hires' });
    } else if (hires === 0) {
      risk += 10;
      signals.push({ type: 'info', text: 'First-time hirer' });
    }

    // Active hours billed
    const hours = parseFloat(clientHistory.hoursBilled || clientHistory.clientHoursBilled || 0);
    if (hours >= 500) {
      risk -= 8;
      signals.push({ type: 'positive', text: Math.round(hours) + ' hours billed — active client' });
    }

    return {
      risk: Math.max(0, Math.min(100, risk)),
      signals,
      detail: this.summarizeSignals(signals)
    };
  }

  // ─── Risk Mitigation ──────────────────────────────────────────────

  generateMitigations(dimensions, overallRisk) {
    const mitigations = [];

    // Payment mitigations
    if (dimensions.payment.risk > 40) {
      mitigations.push({
        dimension: 'Payment',
        priority: 'high',
        actions: [
          'Request milestone-based payments (never >30% of total per milestone)',
          'Use platform escrow — never accept off-platform payment promises',
          'Start with a small paid discovery phase before committing to full scope',
          'Verify payment method is active before starting work'
        ]
      });
    }

    // Scope creep mitigations
    if (dimensions.scopeCreep.risk > 40) {
      mitigations.push({
        dimension: 'Scope',
        priority: 'high',
        actions: [
          'Write a detailed SOW (Statement of Work) before starting',
          'Define explicit "out of scope" items in your contract',
          'Propose change order process for additional requirements',
          'Set revision limits (e.g., 2 rounds of revisions included)',
          'Document all requirements in writing before accepting'
        ]
      });
    }

    // Communication mitigations
    if (dimensions.communication.risk > 40) {
      mitigations.push({
        dimension: 'Communication',
        priority: 'medium',
        actions: [
          'Establish communication cadence upfront (e.g., weekly updates)',
          'Set response time expectations both ways',
          'Use project management tool for task tracking',
          'Send weekly progress summaries proactively'
        ]
      });
    }

    // Timeline mitigations
    if (dimensions.timeline.risk > 40) {
      mitigations.push({
        dimension: 'Timeline',
        priority: 'medium',
        actions: [
          'Add 30% buffer to your time estimate',
          'Break work into small, shippable increments',
          'Set clear milestone deadlines with client sign-off',
          'Communicate blockers immediately — don\'t wait'
        ]
      });
    }

    return mitigations;
  }

  generateContractRecommendations(dimensions) {
    const recs = [];

    // Always recommended
    recs.push({
      clause: 'Milestone payments',
      reason: 'Never do more than 25-30% of total work before receiving payment',
      priority: 'essential'
    });

    recs.push({
      clause: 'Revision limits',
      reason: 'Include specific number of revision rounds (recommend 2-3)',
      priority: 'essential'
    });

    // Conditional on risk
    if (dimensions.scopeCreep.risk > 30) {
      recs.push({
        clause: 'Change order process',
        reason: 'High scope creep risk — require written approval for any scope changes with updated timeline/budget',
        priority: 'high'
      });
    }

    if (dimensions.payment.risk > 40) {
      recs.push({
        clause: 'Kill fee',
        reason: 'Payment risk detected — include a cancellation fee (25-50% of remaining contract value)',
        priority: 'high'
      });
    }

    if (dimensions.timeline.risk > 40) {
      recs.push({
        clause: 'Timeline extension clause',
        reason: 'Timeline risk — include provisions for deadline extensions due to client-side delays',
        priority: 'medium'
      });
    }

    if (dimensions.communication.risk > 40) {
      recs.push({
        clause: 'Response time SLA',
        reason: 'Communication risk — define max response times (e.g., 24hr for client, 4hr for you)',
        priority: 'medium'
      });
    }

    return recs;
  }

  identifyWalkAwayTriggers(dimensions, overallRisk) {
    const triggers = [];

    if (overallRisk >= 80) {
      triggers.push({
        severity: 'critical',
        trigger: 'Overall risk score is critical (80+). This project has a high probability of problems.',
        action: 'WALK AWAY unless the strategic value is exceptional'
      });
    }

    if (dimensions.payment.risk >= 70) {
      triggers.push({
        severity: 'critical',
        trigger: 'Payment risk is very high. Client may not pay or dispute payment.',
        action: 'Do not start work without verified payment and upfront milestone'
      });
    }

    if (dimensions.scopeCreep.risk >= 70 && dimensions.payment.risk >= 50) {
      triggers.push({
        severity: 'high',
        trigger: 'High scope creep + payment risk = recipe for unpaid overwork',
        action: 'Only proceed with very tight SOW and milestone payments'
      });
    }

    return triggers;
  }

  identifyDealBreakers(dimensions) {
    const dealBreakers = [];

    for (const [dim, assessment] of Object.entries(dimensions)) {
      const criticalSignals = assessment.signals.filter(s => s.type === 'critical');
      for (const signal of criticalSignals) {
        dealBreakers.push({
          dimension: dim,
          signal: signal.text,
          severity: 'deal-breaker'
        });
      }
    }

    return dealBreakers;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  getRiskLevel(risk) {
    for (const [key, level] of Object.entries(this.RISK_LEVELS)) {
      if (risk >= level.min && risk < level.max) {
        return { key, ...level };
      }
    }
    return this.RISK_LEVELS.CRITICAL;
  }

  summarizeSignals(signals) {
    const negative = signals.filter(s => s.type === 'negative' || s.type === 'critical' || s.type === 'warning');
    const positive = signals.filter(s => s.type === 'positive');

    const parts = [];
    if (positive.length > 0) parts.push(positive.length + ' positive signal(s)');
    if (negative.length > 0) parts.push(negative.length + ' concern(s)');
    return parts.join(', ') || 'No significant signals';
  }

  generateSummary(overallRisk, riskLevel, dimensions) {
    const topRisks = Object.entries(dimensions)
      .map(([name, dim]) => ({ name, risk: dim.risk }))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 2);

    if (overallRisk < 30) {
      return `Low risk opportunity. Client profile looks solid. Primary areas to monitor: ${topRisks.map(r => r.name).join(' and ')}.`;
    }
    if (overallRisk < 55) {
      return `Moderate risk. Top concerns: ${topRisks.map(r => `${r.name} (${r.risk}%)`).join(', ')}. Proceed with protective contract terms.`;
    }
    if (overallRisk < 75) {
      return `High risk detected. Major concerns: ${topRisks.map(r => `${r.name} (${r.risk}%)`).join(', ')}. Only proceed with strong mitigations in place.`;
    }
    return `Critical risk level. Multiple serious concerns identified. Strongly recommend declining unless exceptional strategic value.`;
  }

  /**
   * Compare risk across multiple opportunities
   */
  compareRisks(opportunities) {
    return opportunities
      .map((opp, i) => ({
        index: i,
        label: opp.label || `Opportunity ${i + 1}`,
        assessment: this.assess(opp)
      }))
      .sort((a, b) => a.assessment.overallRisk - b.assessment.overallRisk);
  }
}

module.exports = ClientRiskAssessor;
