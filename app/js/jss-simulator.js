/**
 * CF-007: JSS (Job Success Score) Simulator
 * Lets users input parameters and simulate their estimated JSS
 * with factor-level impact analysis and recommendations.
 */
(function () {
  'use strict';

  /**
   * JSS factor weights (Upwork's formula is proprietary; these are
   * community-researched approximations).
   */
  const FACTORS = {
    clientFeedback: { weight: 0.30, label: 'Client Feedback' },
    longTermRelationships: { weight: 0.15, label: 'Long-term Relationships' },
    completionRate: { weight: 0.20, label: 'Job Completion Rate' },
    clientSatisfaction: { weight: 0.15, label: 'Client Satisfaction (no disputes)' },
    responsiveness: { weight: 0.10, label: 'Responsiveness' },
    rehireRate: { weight: 0.10, label: 'Rehire Rate' }
  };

  /**
   * Simulate JSS based on user-provided parameters.
   * @param {{completedJobs?: number, feedbackScores?: number[], disputes?: number, longTermContracts?: number, totalContracts?: number, avgResponseHours?: number, rehires?: number, cancelledJobs?: number}} params
   * @returns {{estimatedJSS: number, factors: {name: string, impact: number, recommendation: string}[]}}
   */
  function simulateJSS(params) {
    const p = params || {};
    const completedJobs = p.completedJobs || 0;
    const feedbackScores = p.feedbackScores || [];
    const disputes = p.disputes || 0;
    const longTermContracts = p.longTermContracts || 0;
    const totalContracts = p.totalContracts || completedJobs;
    const avgResponseHours = p.avgResponseHours || 24;
    const rehires = p.rehires || 0;
    const cancelledJobs = p.cancelledJobs || 0;

    const factors = [];

    // 1. Client Feedback (avg rating → 0-100 scale)
    let feedbackScore = 0;
    if (feedbackScores.length > 0) {
      const avg = feedbackScores.reduce((s, v) => s + v, 0) / feedbackScores.length;
      // 5.0 → 100, 4.0 → 70, 3.0 → 40, below → 10
      feedbackScore = Math.min(100, Math.max(0, (avg - 1) * 25));
    }
    factors.push({
      name: FACTORS.clientFeedback.label,
      impact: Math.round(feedbackScore * FACTORS.clientFeedback.weight),
      recommendation: feedbackScore >= 90
        ? 'Excellent feedback — keep delivering quality work'
        : feedbackScore >= 70
          ? 'Good feedback. Ask satisfied clients to leave detailed 5-star reviews'
          : 'Prioritize client satisfaction — communicate proactively and exceed expectations'
    });

    // 2. Long-term relationships
    let longTermScore = 0;
    if (totalContracts > 0) {
      const ratio = longTermContracts / totalContracts;
      longTermScore = Math.min(100, ratio * 200); // 50%+ LT contracts = 100
    }
    factors.push({
      name: FACTORS.longTermRelationships.label,
      impact: Math.round(longTermScore * FACTORS.longTermRelationships.weight),
      recommendation: longTermScore >= 80
        ? 'Strong long-term client base — this boosts JSS significantly'
        : 'Aim for retainer/ongoing contracts. Offer maintenance packages to one-time clients'
    });

    // 3. Completion rate
    let completionScore = 100;
    if (totalContracts > 0) {
      completionScore = ((totalContracts - cancelledJobs) / totalContracts) * 100;
    }
    factors.push({
      name: FACTORS.completionRate.label,
      impact: Math.round(completionScore * FACTORS.completionRate.weight),
      recommendation: completionScore >= 95
        ? 'Near-perfect completion rate — well done'
        : completionScore >= 80
          ? 'Avoid cancelling contracts. If a project isn\'t right, negotiate scope changes instead'
          : 'High cancellation rate is hurting your JSS. Only accept projects you can complete'
    });

    // 4. Client satisfaction (disputes penalty)
    let satisfactionScore = 100;
    if (totalContracts > 0) {
      const disputeRatio = disputes / totalContracts;
      satisfactionScore = Math.max(0, 100 - (disputeRatio * 500)); // Each dispute costs ~5% of score
    }
    factors.push({
      name: FACTORS.clientSatisfaction.label,
      impact: Math.round(satisfactionScore * FACTORS.clientSatisfaction.weight),
      recommendation: disputes === 0
        ? 'No disputes — this strongly supports your JSS'
        : `${disputes} dispute(s) detected. Each dispute severely impacts JSS. Use milestones and clear scope to prevent future issues`
    });

    // 5. Responsiveness
    let responsivenessScore = 0;
    if (avgResponseHours <= 1) responsivenessScore = 100;
    else if (avgResponseHours <= 4) responsivenessScore = 90;
    else if (avgResponseHours <= 12) responsivenessScore = 70;
    else if (avgResponseHours <= 24) responsivenessScore = 50;
    else responsivenessScore = 25;
    factors.push({
      name: FACTORS.responsiveness.label,
      impact: Math.round(responsivenessScore * FACTORS.responsiveness.weight),
      recommendation: responsivenessScore >= 80
        ? 'Fast response time — clients value quick communication'
        : 'Respond to messages within 4 hours during business hours to improve this factor'
    });

    // 6. Rehire rate
    let rehireScore = 0;
    if (totalContracts > 0) {
      rehireScore = Math.min(100, (rehires / totalContracts) * 300); // ~33% rehire = 100
    }
    factors.push({
      name: FACTORS.rehireRate.label,
      impact: Math.round(rehireScore * FACTORS.rehireRate.weight),
      recommendation: rehireScore >= 70
        ? 'Strong rehire rate — clients trust you for repeat work'
        : 'Follow up with past clients after 2-4 weeks. Offer a returning-client discount'
    });

    // Calculate estimated JSS
    const estimatedJSS = Math.min(100, Math.max(0,
      Math.round(factors.reduce((sum, f) => sum + f.impact, 0))
    ));

    // Minimum jobs threshold warning
    if (completedJobs < 5) {
      factors.push({
        name: 'Minimum Jobs Threshold',
        impact: 0,
        recommendation: 'JSS requires at least 5 completed jobs to calculate. Focus on completing your first projects with excellent ratings.'
      });
    }

    return { estimatedJSS, factors };
  }

  // Export
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.JSSSimulator = {
    simulateJSS: simulateJSS,
    FACTORS: FACTORS
  };
})();
