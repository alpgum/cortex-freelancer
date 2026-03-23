/**
 * CortexBidStrategy — Bid Strategy Calculator
 * Analyzes freelance jobs and recommends bid decisions.
 * [UX-007]
 */
(function () {
  'use strict';

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
    if (job.budgetMax && job.budgetMax > 0) return (job.budgetMin || 0 + job.budgetMax) / 2 || job.budgetMax;
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

    // 1. Skill Match (25%)
    var skillScore = 50; // neutral default
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
        var ratio = budget / profileRate;
        budgetScore = clamp(Math.round(ratio * 60), 0, 100);
      } else {
        var effectiveRate = budget / estHours;
        var rateRatio = effectiveRate / profileRate;
        budgetScore = clamp(Math.round(rateRatio * 60), 0, 100);
      }
    }

    // 3. Competition (20%) — estimated from job age
    var ageHours = hoursFromNow(job.postedAt);
    var competitionScore;
    if (ageHours < 1) competitionScore = 90;
    else if (ageHours < 6) competitionScore = 70;
    else if (ageHours < 24) competitionScore = 40;
    else competitionScore = 20;

    // 4. Client Quality (15%)
    var clientScore = 50;
    if (job.clientRating && job.clientRating > 0) {
      clientScore = clamp(Math.round((job.clientRating / 5) * 100), 0, 100);
    }
    if (job.clientHireRate && job.clientHireRate > 0) {
      clientScore = Math.round((clientScore + clamp(job.clientHireRate, 0, 100)) / 2);
    }

    // 5. ROI (10%)
    var roiScore = 50;
    if (budget > 0) {
      var effRate = budgetType === 'hourly' ? budget : budget / estHours;
      var roiRatio = effRate / profileRate;
      roiScore = clamp(Math.round(roiRatio * 50), 0, 100);
    }

    // 6. Strategic (10%) — neutral default, extensible
    var strategicScore = 50;

    // Weighted total
    var totalScore = Math.round(
      skillScore * 0.25 +
      budgetScore * 0.20 +
      competitionScore * 0.20 +
      clientScore * 0.15 +
      roiScore * 0.10 +
      strategicScore * 0.10
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

    if (competitionScore >= 70) reasons.push('Early opportunity — low competition');
    else if (competitionScore <= 30) reasons.push('Job is old — high competition expected');

    if (clientScore >= 70) reasons.push('Client has good hiring track record');
    else if (clientScore < 35) reasons.push('Client quality unclear or low');

    if (roiScore >= 70) reasons.push('Good ROI potential');
    else if (roiScore < 30) reasons.push('ROI below target');

    // Recommendation
    var recommendation;
    switch (decision) {
      case 'strong-bid':
        recommendation = 'Strongly recommended. Submit a competitive bid highlighting your matching skills.';
        break;
      case 'bid':
        recommendation = 'Worth bidding. Tailor your proposal to stand out from competition.';
        break;
      case 'maybe':
        recommendation = 'Marginal opportunity. Bid only if workload is light or you want portfolio diversity.';
        break;
      default:
        recommendation = 'Skip this one. Better opportunities likely available.';
    }

    return {
      decision: decision,
      score: totalScore,
      breakdown: {
        skillMatch:   { score: skillScore,       weight: 25, weighted: Math.round(skillScore * 0.25) },
        budgetFit:    { score: budgetScore,      weight: 20, weighted: Math.round(budgetScore * 0.20) },
        competition:  { score: competitionScore, weight: 20, weighted: Math.round(competitionScore * 0.20) },
        clientQuality:{ score: clientScore,      weight: 15, weighted: Math.round(clientScore * 0.15) },
        roi:          { score: roiScore,         weight: 10, weighted: Math.round(roiScore * 0.10) },
        strategic:    { score: strategicScore,   weight: 10, weighted: Math.round(strategicScore * 0.10) }
      },
      reasons: reasons,
      recommendation: recommendation
    };
  }

  /* ── Badge Renderer ── */

  function renderBidBadge(job, profileData) {
    var result = analyzeBid(job, profileData);
    var emoji, color, bg;
    switch (result.decision) {
      case 'strong-bid':
        emoji = '🟢'; color = '#4ade80'; bg = 'rgba(74,222,128,0.12)'; break;
      case 'bid':
        emoji = '🟢'; color = '#86efac'; bg = 'rgba(134,239,172,0.10)'; break;
      case 'maybe':
        emoji = '🟡'; color = '#facc15'; bg = 'rgba(250,204,21,0.10)'; break;
      default:
        emoji = '🔴'; color = '#f87171'; bg = 'rgba(248,113,113,0.10)'; break;
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
      { key: 'skillMatch',    label: 'Skill Match',     icon: '🎯' },
      { key: 'budgetFit',     label: 'Budget Fit',      icon: '💰' },
      { key: 'competition',   label: 'Competition',     icon: '⏱️' },
      { key: 'clientQuality', label: 'Client Quality',  icon: '⭐' },
      { key: 'roi',           label: 'ROI',             icon: '📈' },
      { key: 'strategic',     label: 'Strategic',       icon: '🧭' }
    ];

    function barColor(score) {
      if (score >= 70) return '#4ade80';
      if (score >= 45) return '#facc15';
      return '#f87171';
    }

    var decisionColors = {
      'strong-bid': { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
      'bid':        { color: '#86efac', bg: 'rgba(134,239,172,0.08)' },
      'maybe':      { color: '#facc15', bg: 'rgba(250,204,21,0.08)' },
      'skip':       { color: '#f87171', bg: 'rgba(248,113,113,0.08)' }
    };
    var dc = decisionColors[result.decision] || decisionColors['skip'];

    var html = '';
    html += '<div style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:20px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;color:#e2e8f0;max-width:420px;">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<div style="font-size:15px;font-weight:700;color:#f1f5f9;">Bid Analysis</div>';
    html += '<div style="padding:4px 12px;border-radius:8px;font-size:13px;font-weight:700;background:' + dc.bg + ';color:' + dc.color + ';border:1px solid ' + dc.color + '33;">';
    html += result.decision.replace('-', ' ').toUpperCase() + ' · ' + result.score + '/100';
    html += '</div></div>';

    // Factor bars
    factors.forEach(function (f) {
      var data = result.breakdown[f.key];
      var bc = barColor(data.score);
      html += '<div style="margin-bottom:10px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">';
      html += '<span style="font-size:12px;color:#94a3b8;">' + f.icon + ' ' + f.label + ' <span style="opacity:0.5;">(' + data.weight + '%)</span></span>';
      html += '<span style="font-size:12px;font-weight:600;color:' + bc + ';">' + data.score + '</span>';
      html += '</div>';
      html += '<div style="height:6px;background:#2a2a4a;border-radius:3px;overflow:hidden;">';
      html += '<div style="height:100%;width:' + data.score + '%;background:' + bc + ';border-radius:3px;transition:width 0.3s;"></div>';
      html += '</div></div>';
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
    html += '<div style="font-size:12px;color:#e2e8f0;">' + result.recommendation + '</div>';
    html += '</div>';

    html += '</div>';

    if (container) {
      if (typeof container === 'string') {
        var el = document.getElementById(container) || document.querySelector(container);
        if (el) el.innerHTML = html;
      } else if (container.innerHTML !== undefined) {
        container.innerHTML = html;
      }
    }

    return html;
  }

  /* ── Expose ── */

  window.CortexBidStrategy = {
    analyzeBid: analyzeBid,
    renderBidBadge: renderBidBadge,
    renderBidDetail: renderBidDetail
  };

})();
