/**
 * [CF-066] Bid Strategy Advisor
 * Recommend bid amount based on job competition, client budget, user's win rate.
 * Decision engine with reasoning.
 *
 * Exposed on window.CortexFreelancer.bidStrategy AND window.CortexBidStrategy (legacy)
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

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

  /* ── Core Analysis ── */

  function analyzeBid(job, profileData) {
    job = job || {};
    profileData = profileData || {};

    var profileSkills = (profileData.skills || []).map(function (s) { return s.toLowerCase().trim(); });
    var jobSkills = (job.skills || []).map(function (s) { return s.toLowerCase().trim(); });
    var profileRate = profileData.hourlyRate || profileData.rate || 50;
    var userWinRate = profileData.winRate || profileData.proposalWinRate || null; // 0-100

    // 1. Skill Match (25%)
    var skillScore = 50;
    var matchedSkills = [];
    if (jobSkills.length > 0 && profileSkills.length > 0) {
      jobSkills.forEach(function (js) {
        if (profileSkills.indexOf(js) !== -1) matchedSkills.push(js);
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

    // 3. Competition (20%)
    var competitionScore;
    var proposalCount = job.proposalCount || job.proposals || null;
    if (proposalCount !== null) {
      // Direct proposal count available
      if (proposalCount < 5) competitionScore = 95;
      else if (proposalCount < 10) competitionScore = 75;
      else if (proposalCount < 20) competitionScore = 50;
      else if (proposalCount < 50) competitionScore = 25;
      else competitionScore = 10;
    } else {
      var ageHours = hoursFromNow(job.postedAt);
      if (ageHours < 1) competitionScore = 90;
      else if (ageHours < 6) competitionScore = 70;
      else if (ageHours < 24) competitionScore = 40;
      else competitionScore = 20;
    }

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

    if (competitionScore >= 70) reasons.push('Low competition — great timing');
    else if (competitionScore <= 30) reasons.push('High competition (' + (proposalCount || 'many') + ' proposals)');

    if (clientScore >= 70) reasons.push('Client has good track record');
    else if (clientScore < 35) reasons.push('Client quality unclear or low');

    if (userWinRate !== null) {
      if (userWinRate >= 30) reasons.push('Your win rate (' + userWinRate + '%) is strong');
      else if (userWinRate < 15) reasons.push('Low win rate (' + userWinRate + '%) — be selective');
    }

    // ─── Recommended Bid Amount ─────────────────────────────────────
    var recommendedBid = _calculateRecommendedBid(job, profileData, {
      skillScore: skillScore,
      competitionScore: competitionScore,
      budgetScore: budgetScore,
      totalScore: totalScore
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
      breakdown: {
        skillMatch:    { score: skillScore,       weight: 25, weighted: Math.round(skillScore * 0.25) },
        budgetFit:     { score: budgetScore,      weight: 20, weighted: Math.round(budgetScore * 0.20) },
        competition:   { score: competitionScore, weight: 20, weighted: Math.round(competitionScore * 0.20) },
        clientQuality: { score: clientScore,      weight: 15, weighted: Math.round(clientScore * 0.15) },
        roi:           { score: roiScore,         weight: 10, weighted: Math.round(roiScore * 0.10) },
        winRate:       { score: winRateScore,     weight: 10, weighted: Math.round(winRateScore * 0.10) }
      },
      reasons: reasons,
      recommendation: recommendation
    };
  }

  /* ── Recommended Bid Calculator ── */

  function _calculateRecommendedBid(job, profile, scores) {
    var profileRate = profile.hourlyRate || profile.rate || 50;
    var budget = effectiveBudget(job);
    var budgetType = job.budgetType || 'fixed';

    // Start from profile rate
    var bid = profileRate;

    // Adjust for competition: low competition → bid higher; high → bid lower
    if (scores.competitionScore >= 80) bid *= 1.10;       // Low competition, premium
    else if (scores.competitionScore >= 60) bid *= 1.05;
    else if (scores.competitionScore <= 20) bid *= 0.90;  // High competition, competitive
    else if (scores.competitionScore <= 35) bid *= 0.95;

    // Adjust for skill match: strong match → justify higher rate
    if (scores.skillScore >= 90) bid *= 1.08;
    else if (scores.skillScore >= 70) bid *= 1.03;
    else if (scores.skillScore < 40) bid *= 0.92;

    // Adjust for budget: don't wildly exceed client budget
    if (budget > 0 && budgetType === 'hourly') {
      // For hourly, bid within 80-120% of their range
      bid = Math.min(bid, budget * 1.2);
      bid = Math.max(bid, budget * 0.8);
    }

    // For fixed, convert to project bid
    if (budgetType === 'fixed' && budget > 0) {
      var estHours = estimateHours(budget, budgetType);
      var projectBid = Math.round(bid * estHours);
      // Keep within 70-130% of their budget
      projectBid = Math.min(projectBid, Math.round(budget * 1.3));
      projectBid = Math.max(projectBid, Math.round(budget * 0.7));
      return { type: 'fixed', amount: projectBid, hourlyEquivalent: Math.round(bid) };
    }

    return { type: 'hourly', amount: Math.round(bid), hourlyEquivalent: Math.round(bid) };
  }

  function _formatRate(bid, budgetType) {
    if (!bid) return 'your standard rate';
    if (bid.type === 'fixed') return '$' + bid.amount + ' fixed ($' + bid.hourlyEquivalent + '/hr effective)';
    return '$' + bid.amount + '/hr';
  }

  /* ── Batch Analysis ── */

  /**
   * Analyze multiple jobs at once, return sorted by score.
   */
  function batchAnalyze(jobs, profileData) {
    return (jobs || []).map(function (job) {
      var result = analyzeBid(job, profileData);
      result.job = job;
      return result;
    }).sort(function (a, b) { return b.score - a.score; });
  }

  /**
   * Get bid strategy summary for a batch of analyzed jobs.
   */
  function getBatchSummary(analyzedJobs) {
    var total = analyzedJobs.length;
    if (total === 0) return { total: 0, strongBids: 0, bids: 0, maybes: 0, skips: 0, avgScore: 0 };

    var counts = { 'strong-bid': 0, 'bid': 0, 'maybe': 0, 'skip': 0 };
    var totalScore = 0;
    analyzedJobs.forEach(function (a) {
      counts[a.decision] = (counts[a.decision] || 0) + 1;
      totalScore += a.score;
    });

    return {
      total: total,
      strongBids: counts['strong-bid'],
      bids: counts['bid'],
      maybes: counts['maybe'],
      skips: counts['skip'],
      avgScore: Math.round(totalScore / total),
      topPick: analyzedJobs[0] || null
    };
  }

  /* ── Badge Renderer (legacy compat) ── */

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

  /* ── Detail Panel Renderer ── */

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
    html += '<div style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e2e8f0;max-width:420px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<div style="font-size:15px;font-weight:700;color:#f1f5f9;">Bid Analysis</div>';
    html += '<div style="padding:4px 12px;border-radius:8px;font-size:13px;font-weight:700;background:' + dc.bg + ';color:' + dc.color + ';border:1px solid ' + dc.color + '33;">';
    html += result.decision.replace('-', ' ').toUpperCase() + ' · ' + result.score + '/100</div></div>';

    // Recommended bid
    if (result.recommendedBid && result.decision !== 'skip') {
      html += '<div style="background:#16213e;border-radius:8px;padding:12px;margin-bottom:16px;text-align:center;">';
      html += '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Recommended Bid</div>';
      html += '<div style="font-size:24px;font-weight:700;color:#4ade80;margin-top:4px;">$' + result.recommendedBid.amount + (result.recommendedBid.type === 'hourly' ? '/hr' : '') + '</div>';
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

  /* ── Expose ── */

  window.CortexFreelancer.bidStrategy = {
    analyzeBid: analyzeBid,
    batchAnalyze: batchAnalyze,
    getBatchSummary: getBatchSummary,
    renderBidBadge: renderBidBadge,
    renderBidDetail: renderBidDetail
  };

  // Legacy compat
  window.CortexBidStrategy = {
    analyzeBid: analyzeBid,
    renderBidBadge: renderBidBadge,
    renderBidDetail: renderBidDetail
  };

})();
