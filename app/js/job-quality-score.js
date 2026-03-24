/**
 * [CF-019] Job Quality Scoring Algorithm
 * Scores jobs 1-10 based on: budget/hour ratio, client history,
 * description clarity, and competition level.
 *
 * window.CortexFreelancer.JobQualityScore
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Weights (sum = 1.0) ────────────────────────────────────────────
  var WEIGHTS = {
    budgetRatio: 0.25,
    clientHistory: 0.30,
    descriptionClarity: 0.25,
    competition: 0.20
  };

  // ─── Budget/Hour Ratio Scorer ──────────────────────────────────────
  function scoreBudgetRatio(job) {
    var budget = parseMoney(job.budget);
    if (budget <= 0) return { score: 5, detail: 'No budget info' };

    var type = detectBudgetType(job);
    var hourlyRate;

    if (type === 'hourly') {
      hourlyRate = budget;
    } else {
      var estimatedHours = estimateHours(job);
      hourlyRate = estimatedHours > 0 ? budget / estimatedHours : budget / 40;
    }

    if (hourlyRate >= 75) return { score: 10, detail: '$' + Math.round(hourlyRate) + '/hr — excellent' };
    if (hourlyRate >= 50) return { score: 9, detail: '$' + Math.round(hourlyRate) + '/hr — great' };
    if (hourlyRate >= 35) return { score: 8, detail: '$' + Math.round(hourlyRate) + '/hr — good' };
    if (hourlyRate >= 25) return { score: 7, detail: '$' + Math.round(hourlyRate) + '/hr — fair' };
    if (hourlyRate >= 15) return { score: 5, detail: '$' + Math.round(hourlyRate) + '/hr — below average' };
    if (hourlyRate >= 8) return { score: 3, detail: '$' + Math.round(hourlyRate) + '/hr — low' };
    return { score: 1, detail: '$' + Math.round(hourlyRate) + '/hr — very low' };
  }

  // ─── Client History Scorer ─────────────────────────────────────────
  function scoreClientHistory(job) {
    var points = 0;
    var details = [];

    var spent = parseMoney(job.clientTotalSpent || job.clientSpent || job.totalSpent);
    if (spent >= 100000) { points += 3; details.push('$' + formatNum(spent) + ' spent'); }
    else if (spent >= 10000) { points += 2.5; details.push('$' + formatNum(spent) + ' spent'); }
    else if (spent >= 1000) { points += 1.5; details.push('$' + formatNum(spent) + ' spent'); }
    else if (spent > 0) { points += 0.5; details.push('$' + formatNum(spent) + ' spent'); }

    var hireRate = parseFloat(job.clientHireRate || job.hireRate || 0);
    if (hireRate >= 80) { points += 2; details.push(hireRate + '% hire rate'); }
    else if (hireRate >= 50) { points += 1.5; details.push(hireRate + '% hire rate'); }
    else if (hireRate >= 20) { points += 1; details.push(hireRate + '% hire rate'); }
    else if (hireRate > 0) { points += 0.5; details.push(hireRate + '% hire rate'); }

    var hires = parseInt(job.clientHires || job.hires || 0, 10);
    if (hires >= 20) { points += 2; details.push(hires + ' hires'); }
    else if (hires >= 5) { points += 1.5; details.push(hires + ' hires'); }
    else if (hires >= 1) { points += 1; details.push(hires + ' hire(s)'); }

    var hours = parseFloat(job.clientHoursBilled || job.hoursBilled || 0);
    if (hours >= 1000) { points += 1.5; details.push(Math.round(hours) + ' hrs billed'); }
    else if (hours >= 100) { points += 1; details.push(Math.round(hours) + ' hrs billed'); }

    if (job.paymentVerified || job.clientPaymentVerified) {
      points += 1;
      details.push('Payment verified');
    }

    var rating = parseFloat(job.clientRating || job.rating || 0);
    if (rating >= 4.5) { points += 0.5; }

    var score = Math.min(Math.round(points), 10);
    if (details.length === 0) details.push('No client history');

    return { score: Math.max(score, 1), detail: details.join(', ') };
  }

  // ─── Description Clarity Scorer ────────────────────────────────────
  function scoreDescriptionClarity(job) {
    var desc = job.description || '';
    if (!desc.trim()) return { score: 1, detail: 'No description' };

    var points = 0;
    var details = [];
    var wordCount = desc.trim().split(/\s+/).length;

    if (wordCount >= 100 && wordCount <= 500) { points += 2; details.push('Good length (' + wordCount + ' words)'); }
    else if (wordCount >= 50) { points += 1.5; details.push(wordCount + ' words'); }
    else if (wordCount >= 20) { points += 1; details.push('Short (' + wordCount + ' words)'); }
    else { points += 0.5; details.push('Very short'); }

    if (/\b(require|must have|should have|need|looking for)\b/i.test(desc)) { points += 1.5; details.push('Has requirements'); }
    if (/\b(deliver|milestone|deadline|timeline|phase|scope)\b/i.test(desc)) { points += 1; details.push('Has deliverables'); }
    if (/\b(experience|expertise|skill|proficient|knowledge)\b/i.test(desc)) { points += 1; details.push('Lists skills needed'); }

    var hasNumbers = /\d+/.test(desc);
    if (hasNumbers) { points += 1; details.push('Contains specifics'); }

    var paragraphs = desc.split(/\n\s*\n/).filter(function (p) { return p.trim().length > 0; }).length;
    var hasBullets = /[-•*]\s|^\d+[.)]\s/m.test(desc);
    if (paragraphs >= 3 || hasBullets) { points += 1; details.push('Well structured'); }

    if (/\b(asap|urgent|immediately|right now)\b/i.test(desc)) { points -= 0.5; }
    if (/\b(simple|easy|quick|just need)\b/i.test(desc) && wordCount < 50) { points -= 1; details.push('Vague description'); }

    var capsRatio = (desc.match(/[A-Z]/g) || []).length / desc.length;
    if (capsRatio > 0.3 && desc.length > 50) { points -= 0.5; }

    var score = Math.round(Math.max(1, Math.min(10, points)));
    return { score: score, detail: details.join(', ') };
  }

  // ─── Competition Level Scorer ──────────────────────────────────────
  function scoreCompetition(job) {
    var proposals = parseInt(job.proposals || job.applicants || job.bids || 0, 10);

    if (proposals === 0) return { score: 8, detail: 'No proposals yet' };
    if (proposals <= 5) return { score: 9, detail: proposals + ' proposals — low competition' };
    if (proposals <= 10) return { score: 7, detail: proposals + ' proposals — moderate' };
    if (proposals <= 20) return { score: 5, detail: proposals + ' proposals — competitive' };
    if (proposals <= 30) return { score: 3, detail: proposals + ' proposals — high competition' };
    return { score: 1, detail: proposals + ' proposals — very competitive' };
  }

  // ─── Main Score ────────────────────────────────────────────────────
  function scoreJob(job, options) {
    var opts = options || {};
    var weights = opts.weights || WEIGHTS;

    var budget = scoreBudgetRatio(job);
    var client = scoreClientHistory(job);
    var description = scoreDescriptionClarity(job);
    var competition = scoreCompetition(job);

    var weighted =
      budget.score * (weights.budgetRatio || 0.25) +
      client.score * (weights.clientHistory || 0.30) +
      description.score * (weights.descriptionClarity || 0.25) +
      competition.score * (weights.competition || 0.20);

    var overall = Math.round(Math.max(1, Math.min(10, weighted)) * 10) / 10;

    var label;
    if (overall >= 8) label = 'Excellent';
    else if (overall >= 6.5) label = 'Good';
    else if (overall >= 5) label = 'Average';
    else if (overall >= 3.5) label = 'Below Average';
    else label = 'Poor';

    return {
      overall: overall,
      label: label,
      factors: {
        budgetRatio: budget,
        clientHistory: client,
        descriptionClarity: description,
        competition: competition
      },
      weights: weights
    };
  }

  // ─── Batch Score ───────────────────────────────────────────────────
  function scoreJobs(jobs, options) {
    if (!jobs || !jobs.length) return [];
    return jobs.map(function (job) {
      var result = scoreJob(job, options);
      return { job: job, score: result };
    }).sort(function (a, b) {
      return b.score.overall - a.score.overall;
    });
  }

  // ─── Render Score Badge ────────────────────────────────────────────
  function renderScoreBadge(score) {
    var color;
    if (score.overall >= 8) color = '#22c55e';
    else if (score.overall >= 6.5) color = '#84cc16';
    else if (score.overall >= 5) color = '#eab308';
    else if (score.overall >= 3.5) color = '#f97316';
    else color = '#ef4444';

    return '<span style="display:inline-flex;align-items:center;gap:6px;background:' + color + '20;color:' + color + ';' +
      'padding:4px 10px;border-radius:8px;font-size:13px;font-weight:700;font-family:-apple-system,sans-serif;">' +
      score.overall.toFixed(1) + '/10 <span style="font-weight:400;font-size:11px;opacity:.8">' + score.label + '</span></span>';
  }

  // ─── Render Detailed Breakdown ─────────────────────────────────────
  function renderBreakdown(score) {
    var factors = [
      { name: 'Budget/Rate', data: score.factors.budgetRatio, weight: score.weights.budgetRatio },
      { name: 'Client History', data: score.factors.clientHistory, weight: score.weights.clientHistory },
      { name: 'Description', data: score.factors.descriptionClarity, weight: score.weights.descriptionClarity },
      { name: 'Competition', data: score.factors.competition, weight: score.weights.competition }
    ];

    var h = '<div style="background:#111;border:1px solid #222;border-radius:10px;padding:14px 16px;font-family:-apple-system,sans-serif;">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
    h += '<span style="color:#e0e0e0;font-size:15px;font-weight:700;">Quality Score</span>';
    h += renderScoreBadge(score);
    h += '</div>';

    for (var i = 0; i < factors.length; i++) {
      var f = factors[i];
      var pct = (f.data.score / 10) * 100;
      var barColor;
      if (f.data.score >= 7) barColor = '#22c55e';
      else if (f.data.score >= 5) barColor = '#eab308';
      else barColor = '#ef4444';

      h += '<div style="margin-bottom:10px;">';
      h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">';
      h += '<span style="color:#888;">' + f.name + ' <span style="color:#555;">(' + Math.round(f.weight * 100) + '%)</span></span>';
      h += '<span style="color:' + barColor + ';font-weight:600;">' + f.data.score + '/10</span>';
      h += '</div>';
      h += '<div style="background:#222;border-radius:4px;height:6px;overflow:hidden;">';
      h += '<div style="background:' + barColor + ';height:100%;width:' + pct + '%;border-radius:4px;transition:width .3s;"></div>';
      h += '</div>';
      h += '<div style="color:#555;font-size:11px;margin-top:2px;">' + (f.data.detail || '') + '</div>';
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

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
    return String(Math.round(n));
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

  function estimateHours(job) {
    var raw = String(job.projectLength || job.duration || '').toLowerCase();
    if (/less\s+than\s+(a\s+)?week|<\s*1\s*w|few\s+days/.test(raw)) return 20;
    if (/1[\s-]*(to|-)?\s*4\s*week/.test(raw)) return 60;
    if (/1[\s-]*(to|-)?\s*3\s*month/.test(raw)) return 200;
    if (/3[\s-]*(to|-)?\s*6\s*month/.test(raw)) return 500;
    if (/6\+?\s*month|ongoing|long[\s-]*term/.test(raw)) return 1000;
    return 40;
  }

  // ─── Public API ────────────────────────────────────────────────────
  window.CortexFreelancer.JobQualityScore = {
    scoreJob: scoreJob,
    scoreJobs: scoreJobs,
    renderScoreBadge: renderScoreBadge,
    renderBreakdown: renderBreakdown,
    scoreBudgetRatio: scoreBudgetRatio,
    scoreClientHistory: scoreClientHistory,
    scoreDescriptionClarity: scoreDescriptionClarity,
    scoreCompetition: scoreCompetition,
    WEIGHTS: WEIGHTS,
    version: '1.0.0'
  };

})();
