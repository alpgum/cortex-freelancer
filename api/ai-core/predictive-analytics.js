/**
 * [PHASE-2] Predictive Analytics Engine
 *
 * Forecasts project outcomes, revenue trajectories, and career milestones.
 * Uses statistical modeling from historical data to predict:
 * - Project success probability
 * - Revenue forecasting (weekly/monthly/quarterly)
 * - Optimal pricing recommendations
 * - Career trajectory projection
 * - Market demand shifts
 */

class PredictiveAnalytics {
  constructor() {
    // Prediction confidence thresholds
    this.CONFIDENCE_THRESHOLDS = {
      HIGH: 75,
      MEDIUM: 50,
      LOW: 25
    };
  }

  /**
   * Predict the probability of project success
   * @param {object} project - Project parameters
   * @param {object} userProfile - User profile data
   * @param {Array} [historicalOutcomes] - Past outcomes for calibration
   * @returns {object} Success probability with contributing factors
   */
  predictProjectSuccess(project, userProfile, historicalOutcomes = []) {
    const factors = {};

    // Factor 1: Skill alignment (0-1)
    factors.skillAlignment = this.computeSkillAlignment(project, userProfile);

    // Factor 2: Budget adequacy (0-1)
    factors.budgetAdequacy = this.computeBudgetAdequacy(project, userProfile);

    // Factor 3: Client reliability (0-1)
    factors.clientReliability = this.computeClientReliability(project.clientHistory || {});

    // Factor 4: Scope manageability (0-1)
    factors.scopeManageability = this.computeScopeManageability(project);

    // Factor 5: Market timing (0-1)
    factors.marketTiming = this.computeMarketTiming(project);

    // Factor 6: Historical calibration (0-1)
    factors.historicalCalibration = this.computeHistoricalCalibration(project, historicalOutcomes);

    // Weighted combination
    const weights = {
      skillAlignment: 0.25,
      budgetAdequacy: 0.20,
      clientReliability: 0.20,
      scopeManageability: 0.15,
      marketTiming: 0.05,
      historicalCalibration: 0.15
    };

    let successProbability = 0;
    for (const [factor, value] of Object.entries(factors)) {
      successProbability += value * (weights[factor] || 0);
    }

    const probability = Math.round(successProbability * 100);
    const confidence = this.calculatePredictionConfidence(factors, historicalOutcomes.length);

    return {
      probability,
      confidence,
      verdict: this.getVerdict(probability),
      factors: Object.entries(factors).map(([name, value]) => ({
        name: this.formatFactorName(name),
        score: Math.round(value * 100),
        weight: Math.round((weights[name] || 0) * 100),
        contribution: Math.round(value * (weights[name] || 0) * 100)
      })).sort((a, b) => b.contribution - a.contribution),
      risks: this.identifyTopRisks(factors),
      recommendation: this.generateProjectRecommendation(probability, factors)
    };
  }

  /**
   * Forecast revenue for upcoming periods
   * @param {Array} revenueHistory - Array of {date, amount, source}
   * @param {object} options - Forecast options
   * @returns {object} Revenue forecast
   */
  forecastRevenue(revenueHistory, options = {}) {
    if (!revenueHistory || revenueHistory.length < 3) {
      return {
        ready: false,
        message: 'Need at least 3 months of revenue data for forecasting'
      };
    }

    // Aggregate by month
    const monthly = this.aggregateMonthly(revenueHistory);
    const periods = options.periods || 3; // Default: forecast next 3 months

    // Calculate trend using simple linear regression
    const trend = this.linearRegression(monthly.map((m, i) => [i, m.amount]));

    // Calculate seasonality (if enough data)
    const seasonality = monthly.length >= 12 ? this.detectSeasonality(monthly) : null;

    // Generate forecasts
    const forecasts = [];
    const lastMonth = monthly[monthly.length - 1];
    const lastIndex = monthly.length - 1;

    for (let i = 1; i <= periods; i++) {
      const trendValue = trend.slope * (lastIndex + i) + trend.intercept;
      const seasonalAdjustment = seasonality ? seasonality[(lastMonth.monthIndex + i) % 12] : 1;
      const forecastAmount = Math.max(0, Math.round(trendValue * seasonalAdjustment));

      const forecastDate = new Date(lastMonth.date);
      forecastDate.setMonth(forecastDate.getMonth() + i);

      forecasts.push({
        period: forecastDate.toISOString().slice(0, 7),
        predicted: forecastAmount,
        low: Math.round(forecastAmount * 0.7),  // 30% lower bound
        high: Math.round(forecastAmount * 1.3),  // 30% upper bound
        confidence: Math.max(30, 80 - (i * 10)) // Decreasing confidence
      });
    }

    // Calculate summary stats
    const avgMonthly = Math.round(this.average(monthly.map(m => m.amount)));
    const totalForecasted = forecasts.reduce((sum, f) => sum + f.predicted, 0);
    const growthRate = trend.slope > 0
      ? Math.round((trend.slope / avgMonthly) * 100)
      : 0;

    return {
      ready: true,
      historical: {
        months: monthly.length,
        avgMonthly,
        totalRevenue: monthly.reduce((sum, m) => sum + m.amount, 0),
        bestMonth: monthly.reduce((best, m) => m.amount > best.amount ? m : best),
        worstMonth: monthly.reduce((worst, m) => m.amount < worst.amount ? m : worst)
      },
      trend: {
        direction: trend.slope > 0 ? 'growing' : trend.slope < 0 ? 'declining' : 'stable',
        monthlyGrowth: growthRate,
        rSquared: Math.round(trend.rSquared * 100)
      },
      forecasts,
      totalForecasted,
      annualProjection: Math.round(avgMonthly * 12 * (1 + growthRate / 100)),
      milestones: this.projectMilestones(avgMonthly, growthRate)
    };
  }

  /**
   * Recommend optimal pricing based on data
   */
  recommendPricing(userProfile, marketData, historicalOutcomes = []) {
    const currentRate = userProfile.hourlyRate || userProfile.rate || 0;

    // Market positioning
    const marketBenchmarks = marketData || {};
    const marketMedian = marketBenchmarks.median || currentRate;
    const marketP75 = marketBenchmarks.p75 || marketMedian * 1.3;
    const marketP25 = marketBenchmarks.p25 || marketMedian * 0.7;

    // Historical win rate at different price points
    const pricePoints = this.analyzePricePoints(historicalOutcomes);

    // Success rate vs rate relationship
    const optimalRange = this.findOptimalPriceRange(pricePoints);

    // Experience premium
    const experienceMultiplier = this.calculateExperienceMultiplier(userProfile);

    // Calculate recommendation
    const baseRecommendation = optimalRange
      ? Math.round((optimalRange.min + optimalRange.max) / 2)
      : Math.round(marketMedian * experienceMultiplier);

    return {
      currentRate,
      recommended: baseRecommendation,
      range: {
        min: optimalRange ? optimalRange.min : Math.round(marketP25 * experienceMultiplier),
        max: optimalRange ? optimalRange.max : Math.round(marketP75 * experienceMultiplier)
      },
      marketPosition: {
        percentile: currentRate > 0 ? this.estimatePercentile(currentRate, marketMedian) : null,
        vsMedian: currentRate > 0 ? Math.round((currentRate / marketMedian - 1) * 100) : null
      },
      experienceMultiplier: Math.round(experienceMultiplier * 100) / 100,
      strategy: this.generatePricingStrategy(currentRate, baseRecommendation, userProfile),
      pricePoints: pricePoints.length > 0 ? pricePoints : null
    };
  }

  /**
   * Project career trajectory milestones
   */
  projectCareerTrajectory(userProfile, outcomes, revenueHistory) {
    const currentLevel = this.assessCurrentLevel(userProfile, outcomes);
    const trajectory = [];

    // Revenue milestones
    const totalRevenue = (revenueHistory || []).reduce((sum, r) => sum + (r.amount || 0), 0);
    const monthlyAvg = revenueHistory && revenueHistory.length > 0
      ? totalRevenue / revenueHistory.length
      : 0;

    const revenueMilestones = [10000, 25000, 50000, 100000, 250000, 500000];
    for (const milestone of revenueMilestones) {
      if (totalRevenue < milestone && monthlyAvg > 0) {
        const monthsToReach = Math.ceil((milestone - totalRevenue) / monthlyAvg);
        trajectory.push({
          type: 'revenue',
          milestone: `$${(milestone / 1000)}K total earnings`,
          estimatedMonths: monthsToReach,
          confidence: monthsToReach <= 6 ? 'high' : monthsToReach <= 12 ? 'medium' : 'low'
        });
      }
    }

    // Rate milestones
    const currentRate = userProfile.hourlyRate || 0;
    const rateMilestones = [25, 50, 75, 100, 150, 200];
    for (const milestone of rateMilestones) {
      if (currentRate < milestone && currentRate > 0) {
        // Estimate months based on typical rate growth (5-10% per quarter)
        const quarterlyGrowth = 0.075;
        const quartersNeeded = Math.log(milestone / currentRate) / Math.log(1 + quarterlyGrowth);
        trajectory.push({
          type: 'rate',
          milestone: `$${milestone}/hr rate`,
          estimatedMonths: Math.ceil(quartersNeeded * 3),
          confidence: quartersNeeded <= 4 ? 'high' : quartersNeeded <= 8 ? 'medium' : 'low'
        });
      }
    }

    // Badge milestones
    const successRate = outcomes && outcomes.length > 0
      ? outcomes.filter(o => o.success).length / outcomes.length
      : 0;

    if (successRate < 0.9) {
      trajectory.push({
        type: 'badge',
        milestone: 'Top Rated status (90%+ JSS)',
        estimatedMonths: Math.ceil((0.9 - successRate) * 100 / 5), // ~5% improvement per month
        confidence: 'medium'
      });
    }

    return {
      currentLevel,
      trajectory: trajectory.sort((a, b) => a.estimatedMonths - b.estimatedMonths),
      nextMilestone: trajectory[0] || null
    };
  }

  // ─── Factor Computation ───────────────────────────────────────────

  computeSkillAlignment(project, userProfile) {
    const projectSkills = (project.skills || []).map(s => s.toLowerCase());
    const userSkills = (userProfile.skills || []).map(s => s.toLowerCase());

    if (projectSkills.length === 0) return 0.5;

    const matched = projectSkills.filter(ps =>
      userSkills.some(us => us.includes(ps) || ps.includes(us))
    ).length;

    return matched / projectSkills.length;
  }

  computeBudgetAdequacy(project, userProfile) {
    const rate = userProfile.hourlyRate || 0;
    const budget = parseFloat(String(project.budget || '').replace(/[^0-9.]/g, '')) || 0;

    if (!rate || !budget) return 0.5;

    // Estimate hours from duration
    const duration = (project.duration || project.projectLength || '').toLowerCase();
    let estimatedHours = 40;
    if (/less\s+than\s+a\s+week/i.test(duration)) estimatedHours = 15;
    else if (/1.*4\s*week/i.test(duration)) estimatedHours = 60;
    else if (/1.*3\s*month/i.test(duration)) estimatedHours = 200;
    else if (/3.*6\s*month/i.test(duration)) estimatedHours = 500;

    const effectiveRate = budget / estimatedHours;
    const ratio = effectiveRate / rate;

    if (ratio >= 1.2) return 1.0;
    if (ratio >= 1.0) return 0.9;
    if (ratio >= 0.8) return 0.7;
    if (ratio >= 0.6) return 0.4;
    return 0.2;
  }

  computeClientReliability(clientHistory) {
    let score = 0.5;

    const spent = parseFloat(clientHistory.totalSpent || 0);
    if (spent >= 50000) score += 0.2;
    else if (spent >= 10000) score += 0.15;
    else if (spent >= 1000) score += 0.05;
    else if (spent === 0) score -= 0.15;

    const rating = parseFloat(clientHistory.avgRating || 0);
    if (rating >= 4.8) score += 0.15;
    else if (rating >= 4.5) score += 0.1;
    else if (rating > 0 && rating < 3.5) score -= 0.2;

    if (clientHistory.paymentVerified) score += 0.1;

    const disputeRate = parseFloat(clientHistory.disputeRate || 0);
    if (disputeRate > 0.1) score -= 0.2;
    else if (disputeRate > 0.05) score -= 0.1;

    return Math.max(0, Math.min(1, score));
  }

  computeScopeManageability(project) {
    let score = 0.7; // Base score
    const desc = project.description || '';

    // Clear deliverables
    if (/\b(deliverable|milestone|phase|sprint)\b/i.test(desc)) score += 0.1;

    // Specific requirements
    const reqCount = (desc.match(/\b(require|must|should|need)\b/gi) || []).length;
    if (reqCount >= 3 && reqCount <= 8) score += 0.1;
    else if (reqCount > 12) score -= 0.15; // Too many requirements

    // Skill count as scope proxy
    const skillCount = (project.skills || []).length;
    if (skillCount > 8) score -= 0.15;
    else if (skillCount <= 4) score += 0.05;

    // Vague language
    if (/\b(and more|etc|tbd|as needed|flexible scope)\b/i.test(desc)) score -= 0.15;

    return Math.max(0, Math.min(1, score));
  }

  computeMarketTiming(project) {
    // Basic timing analysis
    const posted = project.postedDate || project.createdAt;
    if (!posted) return 0.5;

    const postedDate = new Date(posted);
    const dayOfWeek = postedDate.getDay(); // 0=Sun, 6=Sat

    // Jobs posted on weekdays tend to be more serious
    if (dayOfWeek >= 1 && dayOfWeek <= 5) return 0.6;
    return 0.4;
  }

  computeHistoricalCalibration(project, outcomes) {
    if (outcomes.length < 5) return 0.5; // Neutral without data

    // Find similar past projects
    const projectSkills = new Set((project.skills || []).map(s => s.toLowerCase()));
    const similar = outcomes.filter(o => {
      const oSkills = (o.skills || []).map(s => s.toLowerCase());
      return oSkills.some(s => projectSkills.has(s));
    });

    if (similar.length < 2) return 0.5;

    return similar.filter(s => s.success).length / similar.length;
  }

  // ─── Revenue Helpers ──────────────────────────────────────────────

  aggregateMonthly(revenueHistory) {
    const monthMap = {};

    for (const entry of revenueHistory) {
      const date = new Date(entry.date);
      if (isNaN(date.getTime())) continue;

      const key = date.toISOString().slice(0, 7); // YYYY-MM
      if (!monthMap[key]) {
        monthMap[key] = {
          period: key,
          date: date,
          monthIndex: date.getMonth(),
          amount: 0,
          count: 0
        };
      }
      monthMap[key].amount += entry.amount || 0;
      monthMap[key].count++;
    }

    return Object.values(monthMap).sort((a, b) => a.date - b.date);
  }

  linearRegression(points) {
    const n = points.length;
    if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (const [x, y] of points) {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R-squared
    const meanY = sumY / n;
    let ssRes = 0, ssTot = 0;
    for (const [x, y] of points) {
      const predicted = slope * x + intercept;
      ssRes += (y - predicted) ** 2;
      ssTot += (y - meanY) ** 2;
    }
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, rSquared: Math.max(0, rSquared) };
  }

  detectSeasonality(monthly) {
    if (monthly.length < 12) return null;

    // Calculate average for each month-of-year
    const monthAvgs = {};
    const monthCounts = {};

    for (const m of monthly) {
      const mi = m.monthIndex;
      monthAvgs[mi] = (monthAvgs[mi] || 0) + m.amount;
      monthCounts[mi] = (monthCounts[mi] || 0) + 1;
    }

    const overallAvg = this.average(monthly.map(m => m.amount));
    const seasonality = {};

    for (let i = 0; i < 12; i++) {
      if (monthCounts[i]) {
        seasonality[i] = (monthAvgs[i] / monthCounts[i]) / (overallAvg || 1);
      } else {
        seasonality[i] = 1;
      }
    }

    return seasonality;
  }

  projectMilestones(monthlyAvg, growthRate) {
    if (monthlyAvg <= 0) return [];

    const milestones = [];
    const targets = [5000, 10000, 15000, 25000, 50000];

    for (const target of targets) {
      if (monthlyAvg < target) {
        // Months to reach target at current growth rate
        if (growthRate > 0) {
          const months = Math.log(target / monthlyAvg) / Math.log(1 + growthRate / 100);
          milestones.push({
            target: `$${(target / 1000)}K/month`,
            estimatedMonths: Math.ceil(months),
            achievable: months <= 24
          });
        }
      }
    }

    return milestones;
  }

  // ─── Pricing Helpers ──────────────────────────────────────────────

  analyzePricePoints(outcomes) {
    if (outcomes.length < 5) return [];

    // Group by rate tiers
    const tiers = {};
    for (const o of outcomes) {
      const rate = o.effectiveRate || o.rate || 0;
      if (rate <= 0) continue;

      const tier = Math.round(rate / 10) * 10; // Round to nearest $10
      if (!tiers[tier]) tiers[tier] = { wins: 0, total: 0, rate: tier };
      tiers[tier].total++;
      if (o.success) tiers[tier].wins++;
    }

    return Object.values(tiers)
      .filter(t => t.total >= 2)
      .map(t => ({
        rate: t.rate,
        winRate: Math.round(t.wins / t.total * 100),
        sampleSize: t.total
      }))
      .sort((a, b) => a.rate - b.rate);
  }

  findOptimalPriceRange(pricePoints) {
    if (pricePoints.length < 2) return null;

    // Find range with highest win rate (minimum 2 samples)
    const sorted = pricePoints
      .filter(p => p.sampleSize >= 2)
      .sort((a, b) => b.winRate - a.winRate);

    if (sorted.length === 0) return null;

    const best = sorted[0];
    const secondBest = sorted.length > 1 ? sorted[1] : best;

    return {
      min: Math.min(best.rate, secondBest.rate),
      max: Math.max(best.rate, secondBest.rate),
      bestWinRate: best.winRate
    };
  }

  calculateExperienceMultiplier(userProfile) {
    let multiplier = 1.0;

    const successRate = userProfile.successMetrics?.proposalWinRate || 0;
    if (successRate >= 0.8) multiplier += 0.15;
    else if (successRate >= 0.6) multiplier += 0.08;

    const totalEarnings = userProfile.totalEarnings || 0;
    if (totalEarnings >= 100000) multiplier += 0.2;
    else if (totalEarnings >= 50000) multiplier += 0.1;
    else if (totalEarnings >= 10000) multiplier += 0.05;

    const skills = (userProfile.skills || []).length;
    if (skills >= 10) multiplier += 0.1;

    return Math.min(multiplier, 1.5);
  }

  estimatePercentile(rate, median) {
    // Simplified percentile estimate based on normal distribution
    const ratio = rate / median;
    if (ratio >= 2.0) return 95;
    if (ratio >= 1.5) return 85;
    if (ratio >= 1.2) return 70;
    if (ratio >= 1.0) return 55;
    if (ratio >= 0.8) return 35;
    if (ratio >= 0.6) return 20;
    return 10;
  }

  generatePricingStrategy(currentRate, recommended, userProfile) {
    if (recommended > currentRate * 1.2) {
      return {
        action: 'Increase rate gradually',
        steps: [
          `Raise to $${Math.round(currentRate * 1.1)}/hr for new clients`,
          'Keep current rate for repeat clients',
          `Target $${recommended}/hr within 2-3 months as you build reviews at new rate`
        ]
      };
    }
    if (recommended < currentRate * 0.8) {
      return {
        action: 'Consider market alignment',
        steps: [
          'Your rate may be above market — verify with competitors',
          'If win rate is low, test a slightly lower rate on a few proposals',
          'Focus on building portfolio pieces that justify premium pricing'
        ]
      };
    }
    return {
      action: 'Rate is well-positioned',
      steps: [
        'Continue at current rate',
        'Focus on increasing volume and win rate',
        'Re-evaluate quarterly based on performance data'
      ]
    };
  }

  // ─── General Helpers ──────────────────────────────────────────────

  assessCurrentLevel(userProfile, outcomes) {
    const totalEarnings = userProfile.totalEarnings || 0;
    const successRate = outcomes && outcomes.length > 0
      ? outcomes.filter(o => o.success).length / outcomes.length
      : 0;
    const rate = userProfile.hourlyRate || 0;

    if (totalEarnings >= 100000 && successRate >= 0.9 && rate >= 75) return 'Expert';
    if (totalEarnings >= 50000 && successRate >= 0.8 && rate >= 50) return 'Senior';
    if (totalEarnings >= 10000 && successRate >= 0.7) return 'Intermediate';
    if (totalEarnings >= 1000) return 'Junior';
    return 'Beginner';
  }

  calculatePredictionConfidence(factors, historicalCount) {
    let confidence = 40;

    // Data completeness
    const definedFactors = Object.values(factors).filter(v => v !== 0.5).length;
    confidence += definedFactors * 5;

    // Historical data boost
    confidence += Math.min(historicalCount * 2, 20);

    return Math.min(95, confidence);
  }

  getVerdict(probability) {
    if (probability >= 80) return { label: 'High Success Likelihood', emoji: 'strong' };
    if (probability >= 60) return { label: 'Good Prospects', emoji: 'positive' };
    if (probability >= 40) return { label: 'Mixed Signals', emoji: 'caution' };
    if (probability >= 20) return { label: 'Risky', emoji: 'warning' };
    return { label: 'High Risk', emoji: 'danger' };
  }

  formatFactorName(name) {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  identifyTopRisks(factors) {
    return Object.entries(factors)
      .filter(([, v]) => v < 0.4)
      .map(([name, value]) => ({
        factor: this.formatFactorName(name),
        severity: value < 0.2 ? 'critical' : 'warning',
        score: Math.round(value * 100)
      }))
      .sort((a, b) => a.score - b.score);
  }

  generateProjectRecommendation(probability, factors) {
    if (probability >= 80) {
      return 'Strong match — proceed with confidence. Focus proposal on your relevant experience.';
    }
    if (probability >= 60) {
      const weakest = Object.entries(factors).sort((a, b) => a[1] - b[1])[0];
      return `Good potential with room for improvement. Address ${this.formatFactorName(weakest[0]).toLowerCase()} in your proposal.`;
    }
    if (probability >= 40) {
      return 'Mixed signals. Only proceed if the project offers strategic value (portfolio piece, new skill, repeat client potential).';
    }
    return 'Low success probability. Consider spending your connects on better-matched opportunities.';
  }

  average(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

module.exports = PredictiveAnalytics;
