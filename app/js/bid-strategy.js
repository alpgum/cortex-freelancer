/**
 * [CF-066] Bid Strategy Advisor
 * Recommend bid amount based on job competition, client budget, user's win rate.
 * Decision engine with reasoning. Enhanced with competition-level strategy,
 * historical learning, and confidence intervals.
 *
 * Exposed on window.CortexFreelancer.BidStrategy AND window.CortexBidStrategy (legacy)
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ── Constants ── */
  var STORAGE_KEY = 'cortex_bid_history';
  var STRATEGY_KEY = 'cortex_bid_strategy_config';

  /* ── Helpers ── */

  function hoursFromNow(dateStr) {
    if (!dateStr) return 48;
    var posted = new Date(dateStr);
    if (isNaN(posted.getTime())) return 48;
    return Math.max(0, (Date.now() - posted.getTime()) / 3.6e6);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function estimateHours(budget, budgetType) {
    if (budgetType === 'hourly') return 1;
    if (budget <= 100) return 4;
    if (budget <= 500) return 16;
    if (budget <= 2000) return 60;
    if (budget <= 5000) return 120;
    return 200;
  }

  function effectiveBudget(job) {
    if (job.budget && job.budget > 0) return job.budget;
    if (job.budgetMax && job.budgetMax > 0) return ((job.budgetMin || 0) + job.budgetMax) / 2 || job.budgetMax;
    if (job.budgetMin && job.budgetMin > 0) return job.budgetMin;
    return 0;
  }

  /* ── Storage ── */

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; }
  }

  function saveHistory(history) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (e) {}
  }

  function loadConfig() {
    try { return JSON.parse(localStorage.getItem(STRATEGY_KEY)) || {}; } catch (e) { return {}; }
  }

  function saveConfig(config) {
    try { localStorage.setItem(STRATEGY_KEY, JSON.stringify(config)); } catch (e) {}
  }

  /* ── Competition Level Classification ── */

  function classifyCompetition(job) {
    var proposalCount = job.proposalCount || job.proposals || null;
    var ageHours = hoursFromNow(job.postedAt);

    var level, intensity, velocityScore;

    if (proposalCount !== null) {
      // Velocity: proposals per hour
      var velocity = ageHours > 0 ? proposalCount / ageHours : proposalCount;

      if (proposalCount < 5) { level = 'low'; intensity = 1; }
      else if (proposalCount < 10) { level = 'moderate'; intensity = 2; }
      else if (proposalCount < 20) { level = 'high'; intensity = 3; }
      else if (proposalCount < 50) { level = 'very-high'; intensity = 4; }
      else { level = 'extreme'; intensity = 5; }

      velocityScore = velocity > 5 ? 5 : velocity > 2 ? 4 : velocity > 1 ? 3 : velocity > 0.5 ? 2 : 1;
    } else {
      // Estimate from age
      if (ageHours < 1) { level = 'low'; intensity = 1; velocityScore = 1; }
      else if (ageHours < 6) { level = 'moderate'; intensity = 2; velocityScore = 2; }
      else if (ageHours < 24) { level = 'high'; intensity = 3; velocityScore = 3; }
      else if (ageHours < 72) { level = 'very-high'; intensity = 4; velocityScore = 4; }
      else { level = 'extreme'; intensity = 5; velocityScore = 5; }
    }

    return {
      level: level,
      intensity: intensity,
      proposalCount: proposalCount,
      ageHours: Math.round(ageHours * 10) / 10,
      velocityScore: velocityScore,
      isEarlyBird: ageHours < 2 && (proposalCount === null || proposalCount < 5)
    };
  }

  /* ── Core Analysis ── */

  function analyzeBid(job, profileData) {
    job = job || {};
    profileData = profileData || {};

    var profileSkills = (profileData.skills || []).map(function (s) { return s.toLowerCase().trim(); });
    var jobSkills = (job.skills || []).map(function (s) { return s.toLowerCase().trim(); });
    var profileRate = profileData.hourlyRate || profileData.rate || 50;
    var userWinRate = profileData.winRate || profileData.proposalWinRate || null;

    // Competition analysis
    var competition = classifyCompetition(job);

    // 1. Skill Match (25%)
    var skillScore = 50;
    var matchedSkills = [];
    var missingSkills = [];
    if (jobSkills.length > 0 && profileSkills.length > 0) {
      jobSkills.forEach(function (js) {
        if (profileSkills.indexOf(js) !== -1) matchedSkills.push(js);
        else missingSkills.push(js);
      });
      skillScore = Math.round((matchedSkills.length / jobSkills.length) * 100);
    }

    // 2. Budget Fit (20%)
    var budget = effectiveBudget(job);
    var budgetType = job.budgetType || 'fixed';
    var estHours = estimateHours(budget, budgetType);
    var budgetScore = 50;
    if (budget > 0) {
      if (budgetType === 'hourly') {
        budgetScore = clamp(Math.round((budget / profileRate) * 60), 0, 100);
      } else {
        var effectiveRate = budget / estHours;
        budgetScore = clamp(Math.round((effectiveRate / profileRate) * 60), 0, 100);
      }
    }

    // 3. Competition (20%) - enhanced
    var competitionScore;
    if (competition.intensity === 1) competitionScore = 95;
    else if (competition.intensity === 2) competitionScore = 70;
    else if (competition.intensity === 3) competitionScore = 45;
    else if (competition.intensity === 4) competitionScore = 25;
    else competitionScore = 10;

    // Early bird bonus
    if (competition.isEarlyBird) competitionScore = Math.min(100, competitionScore + 10);

    // 4. Client Quality (15%)
    var clientScore = 50;
    if (job.clientRating && job.clientRating > 0) {
      clientScore = clamp(Math.round((job.clientRating / 5) * 100), 0, 100);
    }
    if (job.clientHireRate && job.clientHireRate > 0) {
      clientScore = Math.round((clientScore + clamp(job.clientHireRate, 0, 100)) / 2);
    }
    if (job.clientSpent && job.clientSpent > 10000) clientScore = Math.min(100, clientScore + 10);

    // 5. ROI (10%)
    var roiScore = 50;
    if (budget > 0) {
      var effRate = budgetType === 'hourly' ? budget : budget / estHours;
      roiScore = clamp(Math.round((effRate / profileRate) * 50), 0, 100);
    }

    // 6. Win Rate Adjustment (10%)
    var winRateScore = 50;
    if (userWinRate !== null) {
      winRateScore = clamp(Math.round(userWinRate * 1.5), 0, 100);
    }

    // Weighted total
    var totalScore = Math.round(
      skillScore * 0.25 +
      budgetScore * 0.20 +
      competitionScore * 0.20 +
      clientScore * 0.15 +
      roiScore * 0.10 +
      winRateScore * 0.10
    );
    totalScore = clamp(totalScore, 0, 100);

    // Historical learning adjustment
    var historyBoost = getHistoricalAdjustment(job, profileData);
    totalScore = clamp(totalScore + historyBoost, 0, 100);

    // Decision
    var decision;
    if (totalScore >= 75) decision = 'strong-bid';
    else if (totalScore >= 55) decision = 'bid';
    else if (totalScore >= 35) decision = 'maybe';
    else decision = 'skip';

    // Reasons
    var reasons = [];
    if (skillScore >= 80) reasons.push('Strong skill match (' + matchedSkills.length + '/' + jobSkills.length + ')');
    else if (skillScore >= 50) reasons.push('Partial skill match (' + matchedSkills.length + '/' + jobSkills.length + ')');
    else if (jobSkills.length > 0) reasons.push('Low skill overlap (' + matchedSkills.length + '/' + jobSkills.length + ')');

    if (budgetScore >= 70) reasons.push('Budget aligns well with your rate');
    else if (budgetScore < 35 && budget > 0) reasons.push('Budget may be below your rate');

    if (competition.isEarlyBird) reasons.push('🐦 Early bird — you\'re among the first applicants');
    else if (competitionScore >= 70) reasons.push('Low competition — great timing');
    else if (competitionScore <= 30) reasons.push('High competition (' + (competition.proposalCount || 'many') + ' proposals)');

    if (clientScore >= 70) reasons.push('Client has good track record');
    else if (clientScore < 35) reasons.push('Client quality unclear or low');

    if (userWinRate !== null) {
      if (userWinRate >= 30) reasons.push('Your win rate (' + userWinRate + '%) is strong');
      else if (userWinRate < 15) reasons.push('Low win rate (' + userWinRate + '%) — be selective');
    }

    if (historyBoost > 3) reasons.push('Historical data suggests good fit');
    else if (historyBoost < -3) reasons.push('Similar past bids had low success');

    // ─── Recommended Bid Amount ─────────────────────────────────────
    var recommendedBid = _calculateRecommendedBid(job, profileData, {
      skillScore: skillScore,
      competitionScore: competitionScore,
      budgetScore: budgetScore,
      totalScore: totalScore,
      competition: competition
    });

    // ─── Competition-based strategy ─────────────────────────────────
    var strategy = generateCompetitionStrategy(competition, {
      skillScore: skillScore,
      budgetScore: budgetScore,
      matchedSkills: matchedSkills,
      missingSkills: missingSkills,
      budget: budget,
      profileRate: profileRate
    });

    // Recommendation text
    var recommendation;
    switch (decision) {
      case 'strong-bid':
        recommendation = 'Strongly recommended. Bid at ' + _formatRate(recommendedBid, budgetType) + '. Highlight your ' + matchedSkills.length + ' matching skills.';
        break;
      case 'bid':
        recommendation = 'Worth bidding at ' + _formatRate(recommendedBid, budgetType) + '. Tailor your proposal to stand out.';
        break;
      case 'maybe':
        recommendation = 'Marginal. If bidding, go at ' + _formatRate(recommendedBid, budgetType) + '. Only if workload is light.';
        break;
      default:
        recommendation = 'Skip this one. Better opportunities likely available.';
    }

    return {
      decision: decision,
      score: totalScore,
      recommendedBid: recommendedBid,
      competition: competition,
      strategy: strategy,
      breakdown: {
        skillMatch:    { score: skillScore,       weight: 25, weighted: Math.round(skillScore * 0.25) },
        budgetFit:     { score: budgetScore,      weight: 20, weighted: Math.round(budgetScore * 0.20) },
        competition:   { score: competitionScore, weight: 20, weighted: Math.round(competitionScore * 0.20) },
        clientQuality: { score: clientScore,      weight: 15, weighted: Math.round(clientScore * 0.15) },
        roi:           { score: roiScore,         weight: 10, weighted: Math.round(roiScore * 0.10) },
        winRate:       { score: winRateScore,     weight: 10, weighted: Math.round(winRateScore * 0.10) }
      },
      reasons: reasons,
      recommendation: recommendation,
      matchedSkills: matchedSkills,
      missingSkills: missingSkills
    };
  }

  /* ── Competition Strategy Generator ── */

  function generateCompetitionStrategy(competition, context) {
    var tips = [];
    var approach;
    var urgency;

    switch (competition.level) {
      case 'low':
        approach = 'premium';
        urgency = 'low';
        tips.push('Low competition — bid at or above your standard rate.');
        tips.push('Take time to craft a thorough, detailed proposal.');
        if (context.skillScore >= 70) tips.push('Lead with your matching skills: ' + context.matchedSkills.slice(0, 3).join(', ') + '.');
        break;

      case 'moderate':
        approach = 'standard';
        urgency = 'medium';
        tips.push('Moderate competition — bid near market rate with strong differentiation.');
        tips.push('Open with a specific insight about the project to stand out.');
        break;

      case 'high':
        approach = 'competitive';
        urgency = 'high';
        tips.push('High competition — lead with your strongest credential or case study.');
        tips.push('Keep proposal concise and scannable — clients are reviewing many proposals.');
        tips.push('Consider bidding slightly below your standard rate to increase chances.');
        break;

      case 'very-high':
        approach = 'aggressive';
        urgency = 'very-high';
        tips.push('Very high competition — only bid if you have a clear advantage.');
        tips.push('Focus on speed: mention fast turnaround and availability.');
        tips.push('Offer a small free discovery call or audit to differentiate.');
        break;

      case 'extreme':
        approach = 'sniper';
        urgency = 'critical';
        tips.push('Extreme competition — consider skipping unless you\'re a perfect match.');
        tips.push('If bidding: ultra-concise proposal, unique angle only.');
        tips.push('Lower rate significantly or offer fixed-price guarantee.');
        break;
    }

    // Early bird advantage
    if (competition.isEarlyBird) {
      tips.unshift('🐦 Early bird advantage — your proposal will be among the first seen.');
    }

    // Missing skills warning
    if (context.missingSkills.length > 0 && context.missingSkills.length <= 2) {
      tips.push('Address missing skill' + (context.missingSkills.length > 1 ? 's' : '') + ' (' + context.missingSkills.join(', ') + ') by mentioning related experience.');
    }

    return {
      approach: approach,
      urgency: urgency,
      competitionLevel: competition.level,
      tips: tips
    };
  }

  /* ── Historical Learning ── */

  function recordOutcome(jobId, bidAmount, outcome) {
    // outcome: 'won', 'lost', 'no_response', 'interview'
    var history = loadHistory();
    history.push({
      jobId: jobId,
      bidAmount: bidAmount,
      outcome: outcome,
      timestamp: new Date().toISOString()
    });
    // Keep last 200
    if (history.length > 200) history = history.slice(-200);
    saveHistory(history);
  }

  function getHistoricalAdjustment(job, profile) {
    var history = loadHistory();
    if (history.length < 5) return 0;

    var wins = history.filter(function (h) { return h.outcome === 'won' || h.outcome === 'interview'; }).length;
    var total = history.length;
    var historicalWinRate = wins / total;

    // Compare to expected — slight boost if doing well, slight penalty if not
    var expectedWinRate = 0.2;
    var diff = historicalWinRate - expectedWinRate;
    return Math.round(diff * 20); // -4 to +4 range typically
  }

  function getWinRateByCompetition() {
    var history = loadHistory();
    var buckets = {};
    history.forEach(function (h) {
      var level = h.competitionLevel || 'unknown';
      if (!buckets[level]) buckets[level] = { wins: 0, total: 0 };
      buckets[level].total++;
      if (h.outcome === 'won') buckets[level].wins++;
    });
    return buckets;
  }

  /* ── Recommended Bid Calculator (Enhanced) ── */

  function _calculateRecommendedBid(job, profile, scores) {
    var profileRate = profile.hourlyRate || profile.rate || 50;
    var budget = effectiveBudget(job);
    var budgetType = job.budgetType || 'fixed';
    var competition = scores.competition || classifyCompetition(job);

    // Start from profile rate
    var bid = profileRate;

    // Competition-based adjustment (more granular)
    switch (competition.level) {
      case 'low':       bid *= 1.12; break;
      case 'moderate':  bid *= 1.03; break;
      case 'high':      bid *= 0.95; break;
      case 'very-high': bid *= 0.88; break;
      case 'extreme':   bid *= 0.80; break;
    }

    // Early bird premium
    if (competition.isEarlyBird) bid *= 1.05;

    // Skill match adjustment
    if (scores.skillScore >= 90) bid *= 1.08;
    else if (scores.skillScore >= 70) bid *= 1.03;
    else if (scores.skillScore < 40) bid *= 0.92;

    // Budget constraint
    if (budget > 0 && budgetType === 'hourly') {
      bid = Math.min(bid, budget * 1.2);
      bid = Math.max(bid, budget * 0.75);
    }

    // Confidence interval (±15%)
    var bidLow = Math.round(bid * 0.85);
    var bidHigh = Math.round(bid * 1.15);

    // For fixed, convert to project bid
    if (budgetType === 'fixed' && budget > 0) {
      var estHours = estimateHours(budget, budgetType);
      var projectBid = Math.round(bid * estHours);
      projectBid = Math.min(projectBid, Math.round(budget * 1.3));
      projectBid = Math.max(projectBid, Math.round(budget * 0.7));
      return {
        type: 'fixed',
        amount: projectBid,
        hourlyEquivalent: Math.round(bid),
        range: { low: Math.round(projectBid * 0.85), high: Math.round(projectBid * 1.15) }
      };
    }

    return {
      type: 'hourly',
      amount: Math.round(bid),
      hourlyEquivalent: Math.round(bid),
      range: { low: bidLow, high: bidHigh }
    };
  }

  function _formatRate(bid, budgetType) {
    if (!bid) return 'your standard rate';
    if (bid.type === 'fixed') return '$' + bid.amount + ' fixed ($' + bid.hourlyEquivalent + '/hr effective)';
    return '$' + bid.amount + '/hr';
  }

  /* ── Batch Analysis ── */

  function batchAnalyze(jobs, profileData) {
    return (jobs || []).map(function (job) {
      var result = analyzeBid(job, profileData);
      result.job = job;
      return result;
    }).sort(function (a, b) { return b.score - a.score; });
  }

  function getBatchSummary(analyzedJobs) {
    var total = analyzedJobs.length;
    if (total === 0) return { total: 0, strongBids: 0, bids: 0, maybes: 0, skips: 0, avgScore: 0 };

    var counts = { 'strong-bid': 0, 'bid': 0, 'maybe': 0, 'skip': 0 };
    var totalScore = 0;
    var competitionBreakdown = {};
    analyzedJobs.forEach(function (a) {
      counts[a.decision] = (counts[a.decision] || 0) + 1;
      totalScore += a.score;
      var cl = a.competition.level;
      competitionBreakdown[cl] = (competitionBreakdown[cl] || 0) + 1;
    });

    return {
      total: total,
      strongBids: counts['strong-bid'],
      bids: counts['bid'],
      maybes: counts['maybe'],
      skips: counts['skip'],
      avgScore: Math.round(totalScore / total),
      competitionBreakdown: competitionBreakdown,
      topPick: analyzedJobs[0] || null
    };
  }

  /* ── Badge Renderer ── */

  function renderBidBadge(job, profileData) {
    var result = analyzeBid(job, profileData);
    var emoji, color, bg;
    switch (result.decision) {
      case 'strong-bid': emoji = '🟢'; color = '#4ade80'; bg = 'rgba(74,222,128,0.12)'; break;
      case 'bid':        emoji = '🟢'; color = '#86efac'; bg = 'rgba(134,239,172,0.10)'; break;
      case 'maybe':      emoji = '🟡'; color = '#facc15'; bg = 'rgba(250,204,21,0.10)'; break;
      default:           emoji = '🔴'; color = '#f87171'; bg = 'rgba(248,113,113,0.10)'; break;
    }
    var label = result.decision.replace('-', ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    return '<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;' +
      'border-radius:6px;font-size:13px;font-weight:600;background:' + bg +
      ';color:' + color + ';border:1px solid ' + color + '33;">' +
      emoji + ' ' + label + ' <span style="opacity:0.7;font-weight:400;">(' + result.score + ')</span></span>';
  }

  /* ── Detail Panel Renderer (Enhanced) ── */

  function renderBidDetail(job, profileData, container) {
    var result = analyzeBid(job, profileData);
    var factors = [
      { key: 'skillMatch',    label: 'Skill Match',    icon: '🎯' },
      { key: 'budgetFit',     label: 'Budget Fit',     icon: '💰' },
      { key: 'competition',   label: 'Competition',    icon: '⏱️' },
      { key: 'clientQuality', label: 'Client Quality', icon: '⭐' },
      { key: 'roi',           label: 'ROI',            icon: '📈' },
      { key: 'winRate',       label: 'Win Rate',       icon: '🏆' }
    ];

    function barColor(score) {
      if (score >= 70) return '#4ade80';
      if (score >= 45) return '#facc15';
      return '#f87171';
    }

    var dc = { 'strong-bid': { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' }, 'bid': { color: '#86efac', bg: 'rgba(134,239,172,0.08)' }, 'maybe': { color: '#facc15', bg: 'rgba(250,204,21,0.08)' }, 'skip': { color: '#f87171', bg: 'rgba(248,113,113,0.08)' } }[result.decision] || { color: '#f87171', bg: 'rgba(248,113,113,0.08)' };

    var html = '';
    html += '<div style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e2e8f0;max-width:480px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<div style="font-size:15px;font-weight:700;color:#f1f5f9;">Bid Analysis</div>';
    html += '<div style="padding:4px 12px;border-radius:8px;font-size:13px;font-weight:700;background:' + dc.bg + ';color:' + dc.color + ';border:1px solid ' + dc.color + '33;">';
    html += result.decision.replace('-', ' ').toUpperCase() + ' · ' + result.score + '/100</div></div>';

    // Competition level badge
    var compColors = { low: '#4ade80', moderate: '#a3e635', high: '#facc15', 'very-high': '#fb923c', extreme: '#f87171' };
    var compColor = compColors[result.competition.level] || '#94a3b8';
    html += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">';
    html += '<span style="background:rgba(0,0,0,0.2);color:' + compColor + ';padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid ' + compColor + '33;">⚔️ ' + result.competition.level.replace('-', ' ').toUpperCase() + ' competition</span>';
    if (result.competition.isEarlyBird) {
      html += '<span style="background:rgba(74,222,128,0.12);color:#4ade80;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;">🐦 Early Bird</span>';
    }
    if (result.competition.proposalCount !== null) {
      html += '<span style="background:rgba(148,163,184,0.1);color:#94a3b8;padding:4px 10px;border-radius:6px;font-size:12px;">' + result.competition.proposalCount + ' proposals</span>';
    }
    html += '</div>';

    // Recommended bid with range
    if (result.recommendedBid && result.decision !== 'skip') {
      html += '<div style="background:#16213e;border-radius:8px;padding:14px;margin-bottom:16px;text-align:center;">';
      html += '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Recommended Bid</div>';
      html += '<div style="font-size:28px;font-weight:700;color:#4ade80;margin-top:4px;">$' + result.recommendedBid.amount + (result.recommendedBid.type === 'hourly' ? '/hr' : '') + '</div>';
      if (result.recommendedBid.range) {
        html += '<div style="font-size:12px;color:#64748b;margin-top:2px;">Range: $' + result.recommendedBid.range.low + ' – $' + result.recommendedBid.range.high + '</div>';
      }
      if (result.recommendedBid.type === 'fixed') {
        html += '<div style="font-size:12px;color:#94a3b8;margin-top:2px;">≈ $' + result.recommendedBid.hourlyEquivalent + '/hr effective</div>';
      }
      html += '</div>';
    }

    // Factor bars
    factors.forEach(function (f) {
      var data = result.breakdown[f.key];
      if (!data) return;
      var bc = barColor(data.score);
      html += '<div style="margin-bottom:10px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">';
      html += '<span style="font-size:12px;color:#94a3b8;">' + f.icon + ' ' + f.label + ' <span style="opacity:0.5;">(' + data.weight + '%)</span></span>';
      html += '<span style="font-size:12px;font-weight:600;color:' + bc + ';">' + data.score + '</span></div>';
      html += '<div style="height:6px;background:#2a2a4a;border-radius:3px;overflow:hidden;">';
      html += '<div style="height:100%;width:' + data.score + '%;background:' + bc + ';border-radius:3px;"></div></div></div>';
    });

    // Strategy tips
    if (result.strategy && result.strategy.tips.length > 0) {
      html += '<div style="margin-top:14px;padding:12px;background:rgba(99,102,241,0.08);border-radius:8px;border:1px solid rgba(99,102,241,0.15);">';
      html += '<div style="font-size:12px;font-weight:600;color:#a5b4fc;margin-bottom:8px;">💡 Strategy: ' + result.strategy.approach.charAt(0).toUpperCase() + result.strategy.approach.slice(1) + ' Approach</div>';
      result.strategy.tips.forEach(function (tip) {
        html += '<div style="font-size:12px;color:#94a3b8;padding:2px 0;">• ' + tip + '</div>';
      });
      html += '</div>';
    }

    // Reasons
    if (result.reasons.length > 0) {
      html += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #2a2a4a;">';
      html += '<div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:6px;">Key Factors</div>';
      result.reasons.forEach(function (r) {
        html += '<div style="font-size:12px;color:#cbd5e1;padding:2px 0;">• ' + r + '</div>';
      });
      html += '</div>';
    }

    // Recommendation
    html += '<div style="margin-top:14px;padding:10px 12px;background:' + dc.bg + ';border-radius:8px;border:1px solid ' + dc.color + '22;">';
    html += '<div style="font-size:12px;font-weight:600;color:' + dc.color + ';margin-bottom:2px;">Recommendation</div>';
    html += '<div style="font-size:12px;color:#e2e8f0;">' + result.recommendation + '</div></div>';

    html += '</div>';

    if (container) {
      var el = typeof container === 'string' ? (document.getElementById(container) || document.querySelector(container)) : container;
      if (el && el.innerHTML !== undefined) el.innerHTML = html;
    }
    return html;
  }

  /* ── Init & Render ── */

  function init(options) {
    options = options || {};
    if (options.config) saveConfig(options.config);
  }

  function render(containerId, options) {
    options = options || {};
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    var job = options.job || {};
    var profile = options.profile || {};
    renderBidDetail(job, profile, container);
  }

  /* ── Expose ── */

  window.CortexFreelancer.BidStrategy = {
    init: init,
    render: render,
    analyzeBid: analyzeBid,
    batchAnalyze: batchAnalyze,
    getBatchSummary: getBatchSummary,
    classifyCompetition: classifyCompetition,
    recordOutcome: recordOutcome,
    getWinRateByCompetition: getWinRateByCompetition,
    renderBidBadge: renderBidBadge,
    renderBidDetail: renderBidDetail
  };

  // Legacy compat
  window.CortexFreelancer.bidStrategy = window.CortexFreelancer.BidStrategy;
  window.CortexBidStrategy = {
    analyzeBid: analyzeBid,
    renderBidBadge: renderBidBadge,
    renderBidDetail: renderBidDetail,
    classifyCompetition: classifyCompetition
  };

})();
