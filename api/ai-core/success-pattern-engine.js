/**
 * [PHASE-2] Success Pattern Learning System
 *
 * Learns from user's historical outcomes to identify patterns that lead
 * to successful projects. Uses a lightweight statistical approach:
 * - Feature correlation analysis (what factors predict success?)
 * - Cluster detection (what types of projects do you win?)
 * - Trend analysis (how is your performance changing over time?)
 * - Personalized scoring weight calibration
 */

class SuccessPatternEngine {
  constructor() {
    // Minimum data points for reliable pattern detection
    this.MIN_OUTCOMES = 5;
    this.MIN_FOR_TRENDS = 10;
  }

  /**
   * Analyze all available outcome data and extract patterns
   * @param {Array} outcomes - Array of historical project outcomes
   * @returns {object} Comprehensive pattern analysis
   */
  analyze(outcomes) {
    if (!outcomes || outcomes.length < this.MIN_OUTCOMES) {
      return {
        ready: false,
        message: `Need ${this.MIN_OUTCOMES - (outcomes || []).length} more completed projects for pattern analysis`,
        earlyInsights: outcomes ? this.getEarlyInsights(outcomes) : []
      };
    }

    const successfulOutcomes = outcomes.filter(o => o.success);
    const failedOutcomes = outcomes.filter(o => !o.success);

    return {
      ready: true,
      totalProjects: outcomes.length,
      successRate: Math.round(successfulOutcomes.length / outcomes.length * 100),
      patterns: {
        winningProfile: this.buildWinningProfile(successfulOutcomes, failedOutcomes),
        riskProfile: this.buildRiskProfile(failedOutcomes, successfulOutcomes),
        optimalConditions: this.findOptimalConditions(successfulOutcomes),
        avoidConditions: this.findAvoidConditions(failedOutcomes, successfulOutcomes),
        trends: outcomes.length >= this.MIN_FOR_TRENDS ? this.analyzeTrends(outcomes) : null,
        clusters: this.clusterProjects(outcomes),
        weightCalibration: this.calibrateWeights(outcomes)
      },
      insights: this.generateInsights(outcomes, successfulOutcomes, failedOutcomes),
      recommendations: this.generateRecommendations(outcomes, successfulOutcomes, failedOutcomes)
    };
  }

  /**
   * Build a profile of what winning projects look like
   */
  buildWinningProfile(wins, losses) {
    if (wins.length === 0) return null;

    const profile = {
      avgBudget: this.average(wins.map(w => w.budget || 0)),
      avgDuration: this.average(wins.map(w => w.durationDays || 0)),
      avgHourlyRate: this.average(wins.map(w => w.effectiveRate || 0)),
      topSkills: this.findTopItems(wins.map(w => w.skills || []).flat()),
      topClientTypes: this.findTopItems(wins.map(w => w.clientType).filter(Boolean)),
      topProjectTypes: this.findTopItems(wins.map(w => w.projectType).filter(Boolean)),
      avgClientRating: this.average(wins.map(w => w.clientRating || 0).filter(r => r > 0)),
      avgClientSpend: this.average(wins.map(w => w.clientTotalSpent || 0).filter(s => s > 0)),
      avgProposals: this.average(wins.map(w => w.competitionLevel || 0).filter(c => c > 0)),
      budgetRange: {
        min: Math.min(...wins.map(w => w.budget || 0).filter(b => b > 0)),
        max: Math.max(...wins.map(w => w.budget || 0).filter(b => b > 0))
      },
      rateRange: {
        min: Math.min(...wins.map(w => w.effectiveRate || 0).filter(r => r > 0)),
        max: Math.max(...wins.map(w => w.effectiveRate || 0).filter(r => r > 0))
      }
    };

    // Win rate by factor
    profile.winRateByClientType = this.winRateByFactor(wins, losses, 'clientType');
    profile.winRateByProjectType = this.winRateByFactor(wins, losses, 'projectType');
    profile.winRateByBudgetTier = this.winRateByBudgetTier(wins, losses);

    return profile;
  }

  /**
   * Build a profile of what failing projects look like
   */
  buildRiskProfile(losses, wins) {
    if (losses.length === 0) return { riskFactors: ['No failures recorded — great track record!'] };

    const riskFactors = [];

    // Budget pattern
    const avgLossBudget = this.average(losses.map(l => l.budget || 0));
    const avgWinBudget = wins.length > 0 ? this.average(wins.map(w => w.budget || 0)) : 0;
    if (avgLossBudget > 0 && avgWinBudget > 0 && avgLossBudget < avgWinBudget * 0.6) {
      riskFactors.push({
        factor: 'Low budget projects',
        detail: `Failed projects averaged $${Math.round(avgLossBudget)} vs $${Math.round(avgWinBudget)} for successful ones`,
        actionable: 'Set a minimum project budget threshold'
      });
    }

    // Client quality pattern
    const avgLossClientRating = this.average(losses.map(l => l.clientRating || 0).filter(r => r > 0));
    const avgWinClientRating = this.average(wins.map(w => w.clientRating || 0).filter(r => r > 0));
    if (avgLossClientRating > 0 && avgWinClientRating > 0 && avgLossClientRating < avgWinClientRating - 0.5) {
      riskFactors.push({
        factor: 'Low-rated clients',
        detail: `Failed projects had ${avgLossClientRating.toFixed(1)} avg client rating vs ${avgWinClientRating.toFixed(1)} for successes`,
        actionable: 'Filter for clients with 4.0+ ratings'
      });
    }

    // Skill mismatch pattern
    const lossSkills = this.findTopItems(losses.map(l => l.skills || []).flat());
    const winSkills = this.findTopItems(wins.map(w => w.skills || []).flat());
    const riskySkills = lossSkills.filter(s => !winSkills.includes(s));
    if (riskySkills.length > 0) {
      riskFactors.push({
        factor: 'Skill mismatch projects',
        detail: `Projects involving ${riskySkills.slice(0, 3).join(', ')} tend to fail more often`,
        actionable: 'Strengthen these skills or avoid projects requiring them'
      });
    }

    // Duration pattern
    const avgLossDuration = this.average(losses.map(l => l.durationDays || 0).filter(d => d > 0));
    if (avgLossDuration > 60) {
      riskFactors.push({
        factor: 'Long-duration projects',
        detail: `Failed projects averaged ${Math.round(avgLossDuration)} days`,
        actionable: 'Break long projects into phases with checkpoints'
      });
    }

    // Failure reasons
    const failureReasons = this.findTopItems(losses.map(l => l.failureReason).filter(Boolean));

    return { riskFactors, failureReasons, lossCount: losses.length };
  }

  /**
   * Find conditions most correlated with success
   */
  findOptimalConditions(wins) {
    if (wins.length < 3) return [];

    const conditions = [];

    // Budget sweet spot
    const budgets = wins.map(w => w.budget || 0).filter(b => b > 0).sort((a, b) => a - b);
    if (budgets.length >= 3) {
      const q1 = budgets[Math.floor(budgets.length * 0.25)];
      const q3 = budgets[Math.floor(budgets.length * 0.75)];
      conditions.push({
        factor: 'Budget sweet spot',
        range: `$${Math.round(q1)} - $${Math.round(q3)}`,
        confidence: Math.min(wins.length * 10, 90)
      });
    }

    // Rate sweet spot
    const rates = wins.map(w => w.effectiveRate || 0).filter(r => r > 0).sort((a, b) => a - b);
    if (rates.length >= 3) {
      const q1 = rates[Math.floor(rates.length * 0.25)];
      const q3 = rates[Math.floor(rates.length * 0.75)];
      conditions.push({
        factor: 'Rate sweet spot',
        range: `$${Math.round(q1)} - $${Math.round(q3)}/hr`,
        confidence: Math.min(wins.length * 10, 90)
      });
    }

    // Best project duration
    const durations = wins.map(w => w.durationDays || 0).filter(d => d > 0).sort((a, b) => a - b);
    if (durations.length >= 3) {
      const median = durations[Math.floor(durations.length / 2)];
      conditions.push({
        factor: 'Ideal project duration',
        range: `~${Math.round(median)} days`,
        confidence: Math.min(wins.length * 8, 85)
      });
    }

    // Best competition level
    const competitions = wins.map(w => w.competitionLevel || 0).filter(c => c > 0);
    if (competitions.length >= 3) {
      const avg = this.average(competitions);
      conditions.push({
        factor: 'Optimal competition level',
        range: `<${Math.round(avg * 1.2)} proposals`,
        confidence: Math.min(wins.length * 8, 80)
      });
    }

    return conditions;
  }

  /**
   * Find conditions to avoid
   */
  findAvoidConditions(losses, wins) {
    if (losses.length < 2) return [];

    const conditions = [];

    // Check each factor for significant loss correlation
    const allOutcomes = [...wins.map(w => ({ ...w, _success: true })), ...losses.map(l => ({ ...l, _success: false }))];

    // Budget threshold — what budget level has highest failure rate
    const budgetGroups = this.groupByBuckets(allOutcomes, 'budget', [100, 500, 1000, 5000, 10000, 50000]);
    for (const [range, items] of Object.entries(budgetGroups)) {
      if (items.length >= 3) {
        const failRate = items.filter(i => !i._success).length / items.length;
        if (failRate >= 0.6) {
          conditions.push({
            factor: 'Budget range',
            avoid: range,
            failRate: Math.round(failRate * 100),
            sampleSize: items.length
          });
        }
      }
    }

    return conditions;
  }

  /**
   * Analyze performance trends over time
   */
  analyzeTrends(outcomes) {
    if (outcomes.length < this.MIN_FOR_TRENDS) return null;

    // Sort by date
    const sorted = [...outcomes].sort((a, b) =>
      new Date(a.completedDate || a.date || 0).getTime() - new Date(b.completedDate || b.date || 0).getTime()
    );

    // Split into halves for comparison
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    const firstSuccessRate = firstHalf.filter(o => o.success).length / firstHalf.length;
    const secondSuccessRate = secondHalf.filter(o => o.success).length / secondHalf.length;

    const firstAvgRate = this.average(firstHalf.map(o => o.effectiveRate || 0).filter(r => r > 0));
    const secondAvgRate = this.average(secondHalf.map(o => o.effectiveRate || 0).filter(r => r > 0));

    const firstAvgBudget = this.average(firstHalf.map(o => o.budget || 0).filter(b => b > 0));
    const secondAvgBudget = this.average(secondHalf.map(o => o.budget || 0).filter(b => b > 0));

    // Rolling success rate (last 5 projects)
    const recentOutcomes = sorted.slice(-5);
    const recentSuccessRate = recentOutcomes.filter(o => o.success).length / recentOutcomes.length;

    return {
      successRateTrend: {
        early: Math.round(firstSuccessRate * 100),
        recent: Math.round(secondSuccessRate * 100),
        direction: secondSuccessRate > firstSuccessRate ? 'improving' : secondSuccessRate < firstSuccessRate ? 'declining' : 'stable'
      },
      rateTrend: {
        early: Math.round(firstAvgRate),
        recent: Math.round(secondAvgRate),
        direction: secondAvgRate > firstAvgRate * 1.1 ? 'increasing' : secondAvgRate < firstAvgRate * 0.9 ? 'decreasing' : 'stable'
      },
      budgetTrend: {
        early: Math.round(firstAvgBudget),
        recent: Math.round(secondAvgBudget),
        direction: secondAvgBudget > firstAvgBudget * 1.1 ? 'increasing' : 'stable'
      },
      rollingSuccessRate: Math.round(recentSuccessRate * 100),
      momentum: recentSuccessRate >= 0.8 ? 'strong' : recentSuccessRate >= 0.6 ? 'good' : recentSuccessRate >= 0.4 ? 'mixed' : 'struggling'
    };
  }

  /**
   * Cluster projects into groups based on characteristics
   */
  clusterProjects(outcomes) {
    if (outcomes.length < 5) return [];

    // Simple clustering by project type + budget tier
    const clusters = {};

    for (const outcome of outcomes) {
      const budgetTier = this.getBudgetTier(outcome.budget || 0);
      const type = outcome.projectType || 'unknown';
      const key = `${type}_${budgetTier}`;

      if (!clusters[key]) {
        clusters[key] = {
          type,
          budgetTier,
          projects: [],
          wins: 0,
          losses: 0
        };
      }

      clusters[key].projects.push(outcome);
      if (outcome.success) clusters[key].wins++;
      else clusters[key].losses++;
    }

    // Convert to sorted array with win rates
    return Object.values(clusters)
      .filter(c => c.projects.length >= 2)
      .map(c => ({
        type: c.type,
        budgetTier: c.budgetTier,
        count: c.projects.length,
        winRate: Math.round(c.wins / c.projects.length * 100),
        avgBudget: Math.round(this.average(c.projects.map(p => p.budget || 0))),
        avgRate: Math.round(this.average(c.projects.map(p => p.effectiveRate || 0).filter(r => r > 0))),
        label: `${c.type} (${c.budgetTier})`
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  /**
   * Calibrate ML Job Scorer weights based on actual outcomes
   */
  calibrateWeights(outcomes) {
    if (outcomes.length < this.MIN_OUTCOMES) return null;

    const wins = outcomes.filter(o => o.success);
    const losses = outcomes.filter(o => !o.success);

    // Calculate correlation between each factor and success
    const factors = ['skillMatchScore', 'budgetFitScore', 'clientQualityScore', 'scopeClarityScore', 'competitionScore'];
    const correlations = {};

    for (const factor of factors) {
      const winAvg = this.average(wins.map(w => w[factor] || 0.5));
      const lossAvg = this.average(losses.map(l => l[factor] || 0.5));
      const diff = winAvg - lossAvg;

      correlations[factor] = {
        winAvg: Math.round(winAvg * 100),
        lossAvg: Math.round(lossAvg * 100),
        predictiveStrength: Math.round(Math.abs(diff) * 100),
        direction: diff > 0 ? 'positive' : 'negative'
      };
    }

    // Generate weight adjustments
    const weightAdjustments = {};
    const factorToWeight = {
      skillMatchScore: 'skillMatch',
      budgetFitScore: 'budgetFit',
      clientQualityScore: 'clientQuality',
      scopeClarityScore: 'scopeClarity',
      competitionScore: 'competitionLevel'
    };

    for (const [factor, correlation] of Object.entries(correlations)) {
      const weightKey = factorToWeight[factor];
      if (weightKey && correlation.predictiveStrength > 10) {
        // Increase weight for factors with high predictive strength
        weightAdjustments[weightKey] = correlation.direction === 'positive'
          ? correlation.predictiveStrength / 500   // Small positive nudge
          : -correlation.predictiveStrength / 500;  // Small negative nudge
      }
    }

    return {
      correlations,
      weightAdjustments,
      sampleSize: outcomes.length,
      confidence: Math.min(outcomes.length * 5, 90)
    };
  }

  // ─── Insight Generation ───────────────────────────────────────────

  generateInsights(outcomes, wins, losses) {
    const insights = [];

    // Success rate insight
    const successRate = Math.round(wins.length / outcomes.length * 100);
    if (successRate >= 80) {
      insights.push({ type: 'strength', text: `${successRate}% success rate — you\'re in the top tier of freelancers` });
    } else if (successRate >= 60) {
      insights.push({ type: 'info', text: `${successRate}% success rate — room to improve by being more selective` });
    } else {
      insights.push({ type: 'warning', text: `${successRate}% success rate — consider tightening your job selection criteria` });
    }

    // Most profitable skill combination
    const winSkillCombos = wins.map(w => (w.skills || []).sort().join('+'));
    const topCombo = this.findTopItems(winSkillCombos)[0];
    if (topCombo) {
      insights.push({ type: 'opportunity', text: `Your strongest skill combo: ${topCombo.replace(/\+/g, ' + ')}` });
    }

    // Revenue trend
    const totalRevenue = outcomes.reduce((sum, o) => sum + (o.revenue || o.budget || 0), 0);
    if (totalRevenue > 0) {
      insights.push({ type: 'info', text: `Total tracked revenue: $${Math.round(totalRevenue).toLocaleString()}` });
    }

    // Client type insight
    const winClientTypes = this.findTopItems(wins.map(w => w.clientType).filter(Boolean));
    if (winClientTypes.length > 0) {
      insights.push({ type: 'opportunity', text: `You perform best with ${winClientTypes[0]} clients` });
    }

    return insights;
  }

  generateRecommendations(outcomes, wins, losses) {
    const recs = [];

    // Based on win rate
    const successRate = wins.length / outcomes.length;
    if (successRate < 0.6) {
      recs.push({
        priority: 'high',
        text: 'Be more selective — apply to fewer, better-matched jobs',
        detail: 'Focus on your winning project profile and decline opportunities that don\'t fit'
      });
    }

    // Based on patterns
    const optimalConditions = this.findOptimalConditions(wins);
    if (optimalConditions.length > 0) {
      const budgetCondition = optimalConditions.find(c => c.factor === 'Budget sweet spot');
      if (budgetCondition) {
        recs.push({
          priority: 'medium',
          text: `Target projects in your budget sweet spot: ${budgetCondition.range}`,
          detail: 'Historical data shows highest success in this range'
        });
      }
    }

    // Skill development
    const riskProfile = this.buildRiskProfile(losses, wins);
    if (riskProfile.riskFactors.length > 0) {
      const topRisk = riskProfile.riskFactors[0];
      if (topRisk.actionable) {
        recs.push({
          priority: 'high',
          text: topRisk.actionable,
          detail: topRisk.detail
        });
      }
    }

    return recs;
  }

  getEarlyInsights(outcomes) {
    const insights = [];
    if (outcomes.length > 0) {
      const wins = outcomes.filter(o => o.success);
      insights.push(`${outcomes.length} projects tracked, ${wins.length} successful`);
    }
    return insights;
  }

  // ─── Utility Methods ──────────────────────────────────────────────

  average(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  findTopItems(arr, limit = 5) {
    const counts = {};
    for (const item of arr) {
      if (item) counts[item] = (counts[item] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item]) => item);
  }

  winRateByFactor(wins, losses, factor) {
    const rates = {};
    const allOutcomes = [...wins.map(w => ({ ...w, _success: true })), ...losses.map(l => ({ ...l, _success: false }))];

    for (const outcome of allOutcomes) {
      const value = outcome[factor];
      if (!value) continue;
      if (!rates[value]) rates[value] = { wins: 0, total: 0 };
      rates[value].total++;
      if (outcome._success) rates[value].wins++;
    }

    return Object.entries(rates)
      .filter(([, data]) => data.total >= 2)
      .map(([value, data]) => ({
        value,
        winRate: Math.round(data.wins / data.total * 100),
        sampleSize: data.total
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  winRateByBudgetTier(wins, losses) {
    const tiers = {};
    const allOutcomes = [...wins.map(w => ({ ...w, _success: true })), ...losses.map(l => ({ ...l, _success: false }))];

    for (const outcome of allOutcomes) {
      const tier = this.getBudgetTier(outcome.budget || 0);
      if (!tiers[tier]) tiers[tier] = { wins: 0, total: 0 };
      tiers[tier].total++;
      if (outcome._success) tiers[tier].wins++;
    }

    return Object.entries(tiers)
      .filter(([, data]) => data.total >= 2)
      .map(([tier, data]) => ({
        tier,
        winRate: Math.round(data.wins / data.total * 100),
        sampleSize: data.total
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  getBudgetTier(budget) {
    if (budget >= 10000) return '$10K+';
    if (budget >= 5000) return '$5K-10K';
    if (budget >= 1000) return '$1K-5K';
    if (budget >= 500) return '$500-1K';
    if (budget > 0) return '<$500';
    return 'Unknown';
  }

  groupByBuckets(items, field, buckets) {
    const groups = {};
    for (const item of items) {
      const val = item[field] || 0;
      let label = 'Unknown';
      for (let i = 0; i < buckets.length; i++) {
        if (val < buckets[i]) {
          label = i === 0 ? `<$${buckets[i]}` : `$${buckets[i - 1]}-$${buckets[i]}`;
          break;
        }
        if (i === buckets.length - 1) {
          label = `$${buckets[i]}+`;
        }
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }
    return groups;
  }
}

module.exports = SuccessPatternEngine;
