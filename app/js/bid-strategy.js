/**
 * Cortex Freelancer — Bid Strategy Calculator
 * [UX-007] Smart "bid or skip" decision engine
 *
 * Analyzes each job listing against profile data and competition estimates
 * to produce a clear bid/skip recommendation with ROI projections.
 *
 * Expose: window.CortexBidStrategy
 */

(function () {
  'use strict';

  // ─── Constants & Weights ────────────────────────────────────────────

  var WEIGHTS = {
    skillMatch:   0.25,
    budgetFit:    0.20,
    competition:  0.20,
    clientQuality: 0.15,
    roi:          0.10,
    strategic:    0.10
  };

  var DECISION_THRESHOLDS = {
    strongBid: 75,
    bid:       55,
    maybe:     35
    // below 35 → skip
  };

  // Connects cost per bid (Upwork standard)
  var CONNECTS_PER_BID = {
    small:  2,   // < $100
    medium: 4,   // $100–$500
    large:  6,   // $500–$5k
    enterprise: 8 // $5k+
  };

  var CONNECT_PRICE_USD = 0.15; // per connect

  // ─── 1. Skill Match Score (0–100) ──────────────────────────────────

  function scoreSkillMatch(job, profile) {
    var jobSkills = (job.skills || []).map(function (s) {
      return s.toLowerCase().trim();
    });
    var userSkills = (profile.skills || []).map(function (s) {
      return s.toLowerCase().trim();
    });

    if (jobSkills.length === 0) return { score: 50, detail: 'No skills listed on job' };

    var matched = 0;
    var matchedList = [];
    var missingList = [];

    jobSkills.forEach(function (sk) {
      var found = userSkills.some(function (us) {
        return us === sk || us.indexOf(sk) !== -1 || sk.indexOf(us) !== -1;
      });
      if (found) {
        matched++;
        matchedList.push(sk);
      } else {
        missingList.push(sk);
      }
    });

    var ratio = matched / jobSkills.length;
    // Bonus: if user has MORE skills than required → slight boost
    var bonusSkills = Math.min(userSkills.length - matched, 5);
    var bonus = bonusSkills > 0 ? bonusSkills * 2 : 0;

    var score = Math.min(100, Math.round(ratio * 90 + bonus));

    return {
      score: score,
      matched: matchedList,
      missing: missingList,
      detail: matched + '/' + jobSkills.length + ' skills match'
    };
  }

  // ─── 2. Budget Fit Score (0–100) ───────────────────────────────────

  function scoreBudgetFit(job, profile) {
    var userRate = profile.hourlyRate || 50;
    var estimatedHours = job.estimatedHours || guessHours(job);
    var budget = extractBudget(job);

    if (!budget || budget <= 0) {
      return { score: 50, detail: 'No budget info available', effectiveRate: null };
    }

    var effectiveRate = budget / estimatedHours;
    var rateRatio = effectiveRate / userRate;

    var score;
    if (rateRatio >= 1.5) score = 100;       // paying 50%+ above rate
    else if (rateRatio >= 1.2) score = 90;    // 20%+ above
    else if (rateRatio >= 1.0) score = 80;    // at rate
    else if (rateRatio >= 0.8) score = 60;    // 20% below — acceptable
    else if (rateRatio >= 0.6) score = 40;    // 40% below — stretch
    else if (rateRatio >= 0.4) score = 20;    // not worth it
    else score = 5;

    return {
      score: score,
      effectiveRate: Math.round(effectiveRate),
      estimatedHours: estimatedHours,
      budget: budget,
      detail: '$' + Math.round(effectiveRate) + '/hr effective (your rate: $' + userRate + '/hr)'
    };
  }

  function extractBudget(job) {
    if (job.budget && typeof job.budget === 'number') return job.budget;
    if (job.budgetMax) return job.budgetMax;
    if (job.budgetMin && job.budgetMax) return (job.budgetMin + job.budgetMax) / 2;
    if (job.budgetMin) return job.budgetMin;
    // Try parsing from string
    if (job.budgetRange && typeof job.budgetRange === 'string') {
      var nums = job.budgetRange.match(/[\d,]+/g);
      if (nums && nums.length >= 2) {
        return (parseFloat(nums[0].replace(/,/g, '')) + parseFloat(nums[1].replace(/,/g, ''))) / 2;
      }
      if (nums && nums.length === 1) return parseFloat(nums[0].replace(/,/g, ''));
    }
    // Hourly jobs
    if (job.hourlyBudgetMax) return job.hourlyBudgetMax * (job.estimatedHours || 40);
    return null;
  }

  function guessHours(job) {
    var budget = extractBudget(job);
    if (!budget) return 20; // default guess
    if (budget < 100) return 5;
    if (budget < 500) return 15;
    if (budget < 2000) return 40;
    if (budget < 5000) return 80;
    return 160;
  }

  // ─── 3. Competition Level Score (0–100, higher = less competition) ─

  function scoreCompetition(job) {
    var factors = [];
    var totalScore = 0;
    var count = 0;

    // Factor A: Proposals count
    if (job.proposals || job.proposalCount) {
      var proposals = parseProposals(job.proposals || job.proposalCount);
      var pScore;
      if (proposals <= 5) { pScore = 95; factors.push('Very few proposals (' + proposals + ')'); }
      else if (proposals <= 10) { pScore = 75; factors.push('Low proposals (5–10)'); }
      else if (proposals <= 20) { pScore = 50; factors.push('Medium proposals (10–20)'); }
      else if (proposals <= 50) { pScore = 20; factors.push('High proposals (20–50)'); }
      else { pScore = 5; factors.push('Oversaturated (50+) — consider skipping'); }
      totalScore += pScore;
      count++;
    }

    // Factor B: Job age
    if (job.postedAt || job.postedDate || job.timePosted) {
      var ageHours = getJobAgeHours(job);
      var aScore;
      if (ageHours < 1) { aScore = 100; factors.push('Just posted (<1h) — first-mover advantage'); }
      else if (ageHours < 6) { aScore = 75; factors.push('Fresh (' + Math.round(ageHours) + 'h ago)'); }
      else if (ageHours < 24) { aScore = 45; factors.push('Posted ' + Math.round(ageHours) + 'h ago'); }
      else { aScore = 15; factors.push('Old posting (' + Math.round(ageHours / 24) + 'd) — many applicants likely'); }
      totalScore += aScore;
      count++;
    }

    // Factor C: Budget-based competition estimate
    var budget = extractBudget(job);
    if (budget !== null) {
      var bScore;
      if (budget < 100) { bScore = 15; factors.push('Sub-$100 jobs attract mass applicants'); }
      else if (budget < 500) { bScore = 45; factors.push('Mid-range budget'); }
      else if (budget < 2000) { bScore = 70; factors.push('Higher budget filters out low-effort bids'); }
      else { bScore = 90; factors.push('Premium budget — fewer qualified competitors'); }
      totalScore += bScore;
      count++;
    }

    // Factor D: Job type
    if (job.type === 'hourly' || job.contractType === 'hourly') {
      totalScore += 70;
      count++;
      factors.push('Hourly jobs have less competition than fixed');
    } else if (budget && budget < 100) {
      totalScore += 10;
      count++;
    }

    if (count === 0) return { score: 50, detail: 'No competition data', factors: [] };

    return {
      score: Math.round(totalScore / count),
      detail: factors[0] || 'Competition assessed',
      factors: factors
    };
  }

  function parseProposals(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      // "5 to 10" or "5-10" or "Less than 5" or "50+"
      if (val.indexOf('50+') !== -1 || val.indexOf('50 +') !== -1) return 55;
      if (val.indexOf('Less than 5') !== -1) return 3;
      var nums = val.match(/\d+/g);
      if (nums && nums.length >= 2) return (parseInt(nums[0]) + parseInt(nums[1])) / 2;
      if (nums && nums.length === 1) return parseInt(nums[0]);
    }
    return 15; // default medium
  }

  function getJobAgeHours(job) {
    var posted = job.postedAt || job.postedDate || job.timePosted;
    if (!posted) return 12; // default
    try {
      var d = new Date(posted);
      if (isNaN(d.getTime())) return 12;
      return Math.max(0, (Date.now() - d.getTime()) / 3600000);
    } catch (e) {
      return 12;
    }
  }

  // ─── 4. Client Quality Score (0–100) ──────────────────────────────

  function scoreClientQuality(job) {
    var client = job.client || {};
    var score = 50; // base
    var factors = [];

    // Total spent
    var spent = client.totalSpent || client.amountSpent || 0;
    if (typeof spent === 'string') {
      spent = parseFloat(spent.replace(/[$,kK]/g, function (m) { return m === 'k' || m === 'K' ? '000' : ''; })) || 0;
    }
    if (spent >= 100000) { score += 20; factors.push('$' + formatCurrency(spent) + ' spent — serious buyer'); }
    else if (spent >= 10000) { score += 15; factors.push('$' + formatCurrency(spent) + ' spent — established client'); }
    else if (spent >= 1000) { score += 8; factors.push('$' + formatCurrency(spent) + ' spent'); }
    else if (spent > 0) { score += 2; factors.push('Low spend history'); }
    else { score -= 10; factors.push('No spend history — new or unproven client'); }

    // Rating
    var rating = client.rating || client.score || 0;
    if (rating >= 4.8) { score += 15; factors.push('⭐ ' + rating + ' rating — excellent'); }
    else if (rating >= 4.5) { score += 10; factors.push('⭐ ' + rating + ' rating — good'); }
    else if (rating >= 4.0) { score += 5; factors.push('⭐ ' + rating + ' rating — decent'); }
    else if (rating > 0) { score -= 5; factors.push('⚠️ ' + rating + ' rating — below average'); }

    // Hire rate
    var hireRate = client.hireRate || client.hiringRate || 0;
    if (hireRate >= 70) { score += 10; factors.push(hireRate + '% hire rate'); }
    else if (hireRate >= 40) { score += 5; }
    else if (hireRate > 0) { score -= 5; factors.push('Low hire rate (' + hireRate + '%) — may waste your time'); }

    // Payment verified
    if (client.verified || client.paymentVerified) {
      score += 5;
      factors.push('Payment verified ✓');
    } else {
      score -= 10;
      factors.push('Payment NOT verified — red flag');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      detail: factors[0] || 'Client quality assessed',
      factors: factors
    };
  }

  function formatCurrency(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'k';
    return n.toString();
  }

  // ─── 5. ROI Score (0–100) ─────────────────────────────────────────

  function scoreROI(job, profile) {
    var budget = extractBudget(job);
    var hours = job.estimatedHours || guessHours(job);
    var userRate = profile.hourlyRate || 50;

    if (!budget) return { score: 50, detail: 'Cannot calculate ROI without budget', effectiveRate: null };

    var effectiveRate = budget / hours;
    var profitMargin = (effectiveRate - userRate * 0.8) / effectiveRate; // 0.8 = minimum acceptable

    var score;
    if (profitMargin >= 0.5) score = 100;
    else if (profitMargin >= 0.3) score = 85;
    else if (profitMargin >= 0.15) score = 70;
    else if (profitMargin >= 0) score = 50;
    else if (profitMargin >= -0.2) score = 30;
    else score = 10;

    return {
      score: score,
      effectiveRate: Math.round(effectiveRate),
      profitMargin: Math.round(profitMargin * 100),
      detail: '$' + Math.round(effectiveRate) + '/hr (' + (profitMargin >= 0 ? '+' : '') + Math.round(profitMargin * 100) + '% margin)'
    };
  }

  // ─── 6. Strategic Fit Score (0–100) ────────────────────────────────

  function scoreStrategicFit(job, profile) {
    var targetNiches = (profile.targetNiches || profile.niches || []).map(function (n) {
      return n.toLowerCase();
    });
    var focusSkills = (profile.focusSkills || profile.targetSkills || []).map(function (s) {
      return s.toLowerCase();
    });

    if (targetNiches.length === 0 && focusSkills.length === 0) {
      return { score: 50, detail: 'No target niche configured' };
    }

    var score = 30; // base
    var factors = [];

    // Check job category/niche match
    var jobCategory = (job.category || job.subcategory || '').toLowerCase();
    var jobTitle = (job.title || '').toLowerCase();
    var jobDesc = (job.description || '').toLowerCase().substring(0, 500);

    targetNiches.forEach(function (niche) {
      if (jobCategory.indexOf(niche) !== -1 || jobTitle.indexOf(niche) !== -1) {
        score += 25;
        factors.push('Matches target niche: ' + niche);
      } else if (jobDesc.indexOf(niche) !== -1) {
        score += 15;
        factors.push('Description mentions niche: ' + niche);
      }
    });

    // Check focus skill alignment
    var jobSkills = (job.skills || []).map(function (s) { return s.toLowerCase(); });
    var focusMatches = 0;
    focusSkills.forEach(function (fs) {
      if (jobSkills.some(function (js) { return js.indexOf(fs) !== -1 || fs.indexOf(js) !== -1; })) {
        focusMatches++;
      }
    });
    if (focusMatches > 0) {
      score += Math.min(30, focusMatches * 15);
      factors.push(focusMatches + ' focus skill(s) match');
    }

    // Portfolio-building potential
    if (job.isLongTerm || (job.duration && job.duration.indexOf('long') !== -1)) {
      score += 10;
      factors.push('Long-term — builds portfolio');
    }

    return {
      score: Math.min(100, score),
      detail: factors[0] || 'Limited strategic alignment',
      factors: factors
    };
  }

  // ─── Main Engine: analyzeBid ──────────────────────────────────────

  function analyzeBid(job, profileData) {
    var profile = profileData || {};

    var skillResult = scoreSkillMatch(job, profile);
    var budgetResult = scoreBudgetFit(job, profile);
    var competitionResult = scoreCompetition(job);
    var clientResult = scoreClientQuality(job);
    var roiResult = scoreROI(job, profile);
    var strategicResult = scoreStrategicFit(job, profile);

    // Weighted total
    var totalScore = Math.round(
      skillResult.score * WEIGHTS.skillMatch +
      budgetResult.score * WEIGHTS.budgetFit +
      competitionResult.score * WEIGHTS.competition +
      clientResult.score * WEIGHTS.clientQuality +
      roiResult.score * WEIGHTS.roi +
      strategicResult.score * WEIGHTS.strategic
    );

    // Decision
    var decision;
    if (totalScore >= DECISION_THRESHOLDS.strongBid) decision = 'strong-bid';
    else if (totalScore >= DECISION_THRESHOLDS.bid) decision = 'bid';
    else if (totalScore >= DECISION_THRESHOLDS.maybe) decision = 'maybe';
    else decision = 'skip';

    // Hard overrides
    if (clientResult.score <= 20 && decision !== 'skip') {
      decision = 'maybe';
      totalScore = Math.min(totalScore, 45);
    }
    if (competitionResult.score <= 10 && decision === 'strong-bid') {
      decision = 'bid';
    }

    // Build reasons
    var reasons = buildReasons(skillResult, budgetResult, competitionResult, clientResult, roiResult, strategicResult, decision);

    // ROI estimate
    var estimatedROI = calculateROI(job, totalScore);

    // Recommendation text
    var recommendation = buildRecommendation(decision, reasons, estimatedROI, competitionResult);

    return {
      decision: decision,
      score: totalScore,
      breakdown: {
        skillMatch: skillResult,
        budgetFit: budgetResult,
        competition: competitionResult,
        clientQuality: clientResult,
        roi: roiResult,
        strategic: strategicResult
      },
      reasons: reasons,
      estimatedROI: estimatedROI,
      recommendation: recommendation
    };
  }

  function buildReasons(skill, budget, comp, client, roi, strategic, decision) {
    var reasons = [];

    // Positive signals
    if (skill.score >= 80 && comp.score >= 70) {
      reasons.push('High skill match + low competition = great opportunity');
    } else if (skill.score >= 80) {
      reasons.push('Strong skill match (' + (skill.matched || []).length + ' skills overlap)');
    }
    if (comp.score >= 80) reasons.push('Low competition — early mover advantage');
    if (budget.score >= 80) reasons.push('Budget aligns well with your rate');
    if (client.score >= 80) reasons.push('High-quality client with strong history');
    if (roi.score >= 80) reasons.push('Excellent ROI potential');
    if (strategic.score >= 70) reasons.push('Builds your portfolio in target niche');

    // Negative signals
    if (skill.score < 40) reasons.push('Skill gap — ' + (skill.missing || []).join(', '));
    if (comp.score < 30) reasons.push('Very high competition — consider skipping');
    if (budget.score < 30) reasons.push('Budget too low for your rate');
    if (client.score < 30) reasons.push('Client has red flags — proceed with caution');
    if (roi.score < 30) reasons.push('Poor return on time investment');

    // Decision-specific
    if (decision === 'strong-bid' && reasons.length === 0) {
      reasons.push('All factors align well — strong opportunity');
    }
    if (decision === 'skip' && reasons.length === 0) {
      reasons.push('Multiple weak signals — not worth the connects');
    }

    return reasons.length > 0 ? reasons : ['Mixed signals — review manually'];
  }

  function calculateROI(job, score) {
    var budget = extractBudget(job) || 0;
    var connectsNeeded;

    if (budget < 100) connectsNeeded = CONNECTS_PER_BID.small;
    else if (budget < 500) connectsNeeded = CONNECTS_PER_BID.medium;
    else if (budget < 5000) connectsNeeded = CONNECTS_PER_BID.large;
    else connectsNeeded = CONNECTS_PER_BID.enterprise;

    // Boosted bids cost more
    if (job.boosted || job.featured) connectsNeeded *= 2;

    var connectsCost = connectsNeeded * CONNECT_PRICE_USD;

    // Win probability based on score
    var winProbability;
    if (score >= 80) winProbability = 0.25;
    else if (score >= 65) winProbability = 0.15;
    else if (score >= 50) winProbability = 0.08;
    else if (score >= 35) winProbability = 0.04;
    else winProbability = 0.02;

    var expectedValue = budget * winProbability - connectsCost;

    return {
      connectsCost: Math.round(connectsCost * 100) / 100,
      connectsNeeded: connectsNeeded,
      winProbability: Math.round(winProbability * 100),
      expectedValue: Math.round(expectedValue * 100) / 100,
      evPerConnect: connectsCost > 0 ? Math.round((expectedValue / connectsCost) * 100) / 100 : 0
    };
  }

  function buildRecommendation(decision, reasons, roi, comp) {
    var urgency = '';
    if (comp.score >= 80) urgency = ' Apply within 1 hour.';
    else if (comp.score >= 60) urgency = ' Apply within 2 hours.';
    else if (comp.score >= 40) urgency = ' Apply today if interested.';

    switch (decision) {
      case 'strong-bid':
        return '🟢 Strong bid — ' + (reasons[0] || 'great opportunity') + '.' + urgency +
          ' Expected value: $' + roi.expectedValue + ' per bid.';
      case 'bid':
        return '🟡 Worth bidding — ' + (reasons[0] || 'decent match') + '.' + urgency;
      case 'maybe':
        return '🟠 Maybe — ' + (reasons[0] || 'mixed signals') + '. Only bid if pipeline is thin.';
      case 'skip':
        return '🔴 Skip — ' + (reasons[0] || 'not worth the connects') + '.';
      default:
        return 'Review manually.';
    }
  }

  // ─── Renderer ─────────────────────────────────────────────────────

  function renderBidStrategy(job, profileData, container) {
    var result = analyzeBid(job, profileData);
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return result;

    var badge = getBadge(result.decision);
    var expanded = false;

    var wrapper = document.createElement('div');
    wrapper.className = 'cbs-wrapper cbs-' + result.decision;
    wrapper.innerHTML = buildBadgeHTML(badge, result) +
      buildBreakdownHTML(result) +
      buildReasonsHTML(result) +
      buildROIHTML(result);

    el.appendChild(wrapper);

    // Toggle breakdown
    var toggle = wrapper.querySelector('.cbs-toggle');
    var panel = wrapper.querySelector('.cbs-breakdown-panel');
    if (toggle && panel) {
      toggle.addEventListener('click', function () {
        expanded = !expanded;
        panel.style.display = expanded ? 'block' : 'none';
        toggle.querySelector('.cbs-arrow').textContent = expanded ? '▾' : '▸';
      });
    }

    injectStyles();
    return result;
  }

  function getBadge(decision) {
    switch (decision) {
      case 'strong-bid': return { emoji: '🟢', label: 'Strong Bid', color: '#00ff88' };
      case 'bid':        return { emoji: '🟡', label: 'Bid', color: '#ffaa00' };
      case 'maybe':      return { emoji: '🟠', label: 'Maybe', color: '#ff8844' };
      case 'skip':       return { emoji: '🔴', label: 'Skip', color: '#ff4444' };
      default:           return { emoji: '⚪', label: 'Unknown', color: '#888' };
    }
  }

  function buildBadgeHTML(badge, result) {
    return '<div class="cbs-badge" style="border-left:3px solid ' + badge.color + '">' +
      '<span class="cbs-badge-emoji">' + badge.emoji + '</span>' +
      '<span class="cbs-badge-label" style="color:' + badge.color + '">' + badge.label + '</span>' +
      '<span class="cbs-badge-score">' + result.score + '/100</span>' +
      '<button class="cbs-toggle"><span class="cbs-arrow">▸</span> Details</button>' +
      '</div>';
  }

  function buildBreakdownHTML(result) {
    var b = result.breakdown;
    var factors = [
      { key: 'Skill Match',     val: b.skillMatch,     weight: '25%' },
      { key: 'Budget Fit',      val: b.budgetFit,      weight: '20%' },
      { key: 'Competition',     val: b.competition,    weight: '20%' },
      { key: 'Client Quality',  val: b.clientQuality,  weight: '15%' },
      { key: 'ROI',             val: b.roi,            weight: '10%' },
      { key: 'Strategic Fit',   val: b.strategic,      weight: '10%' }
    ];

    var html = '<div class="cbs-breakdown-panel" style="display:none">';
    factors.forEach(function (f) {
      var color = barColor(f.val.score);
      html += '<div class="cbs-factor">' +
        '<div class="cbs-factor-header">' +
          '<span class="cbs-factor-name">' + f.key + ' <span class="cbs-factor-weight">(' + f.weight + ')</span></span>' +
          '<span class="cbs-factor-score" style="color:' + color + '">' + f.val.score + '</span>' +
        '</div>' +
        '<div class="cbs-bar-track"><div class="cbs-bar-fill" style="width:' + f.val.score + '%;background:' + color + '"></div></div>' +
        '<div class="cbs-factor-detail">' + (f.val.detail || '') + '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function buildReasonsHTML(result) {
    if (!result.reasons || result.reasons.length === 0) return '';
    var html = '<div class="cbs-reasons"><div class="cbs-reasons-title">Why?</div><ul>';
    result.reasons.forEach(function (r) {
      html += '<li>' + r + '</li>';
    });
    html += '</ul></div>';
    return html;
  }

  function buildROIHTML(result) {
    var roi = result.estimatedROI;
    if (!roi) return '';
    var evColor = roi.expectedValue >= 0 ? '#00ff88' : '#ff4444';
    return '<div class="cbs-roi">' +
      '<span class="cbs-roi-label">Expected value:</span> ' +
      '<span class="cbs-roi-value" style="color:' + evColor + '">$' + roi.expectedValue + '</span>' +
      '<span class="cbs-roi-sub"> per ' + roi.connectsNeeded + ' connects ($' + roi.connectsCost + ') · ' +
      roi.winProbability + '% win prob.</span>' +
      '</div>';
  }

  function barColor(score) {
    if (score >= 75) return '#00ff88';
    if (score >= 55) return '#ffaa00';
    if (score >= 35) return '#ff8844';
    return '#ff4444';
  }

  // ─── Styles (injected once) ───────────────────────────────────────

  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;

    var css = [
      '.cbs-wrapper{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#1a1a2e;border-radius:12px;padding:16px;margin:12px 0;color:#e0e0e0;font-size:14px}',
      '.cbs-badge{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#0f0f1a;border-radius:8px;margin-bottom:8px}',
      '.cbs-badge-emoji{font-size:20px}',
      '.cbs-badge-label{font-weight:700;font-size:16px}',
      '.cbs-badge-score{margin-left:auto;font-size:13px;color:#888;font-weight:600}',
      '.cbs-toggle{background:none;border:1px solid #333;color:#aaa;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;margin-left:8px;transition:all .2s}',
      '.cbs-toggle:hover{border-color:#555;color:#fff}',
      '.cbs-arrow{font-size:10px}',
      '.cbs-breakdown-panel{padding:12px 0}',
      '.cbs-factor{margin-bottom:12px}',
      '.cbs-factor-header{display:flex;justify-content:space-between;margin-bottom:4px}',
      '.cbs-factor-name{font-weight:600;font-size:13px;color:#ccc}',
      '.cbs-factor-weight{font-weight:400;color:#666;font-size:11px}',
      '.cbs-factor-score{font-weight:700;font-size:13px}',
      '.cbs-bar-track{height:6px;background:#222;border-radius:3px;overflow:hidden}',
      '.cbs-bar-fill{height:100%;border-radius:3px;transition:width .6s ease-out}',
      '.cbs-factor-detail{font-size:11px;color:#777;margin-top:3px}',
      '.cbs-reasons{margin-top:8px;padding:10px 12px;background:#0f0f1a;border-radius:8px}',
      '.cbs-reasons-title{font-weight:700;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}',
      '.cbs-reasons ul{margin:0;padding-left:18px;list-style:disc}',
      '.cbs-reasons li{font-size:13px;color:#bbb;margin-bottom:3px;line-height:1.4}',
      '.cbs-roi{margin-top:8px;padding:8px 12px;background:#0a0a18;border-radius:8px;font-size:13px}',
      '.cbs-roi-label{color:#888}',
      '.cbs-roi-value{font-weight:700;font-size:15px}',
      '.cbs-roi-sub{color:#666;font-size:11px}',
      '.cbs-strong-bid .cbs-badge{border-left-color:#00ff88}',
      '.cbs-bid .cbs-badge{border-left-color:#ffaa00}',
      '.cbs-maybe .cbs-badge{border-left-color:#ff8844}',
      '.cbs-skip .cbs-badge{border-left-color:#ff4444}'
    ];

    var style = document.createElement('style');
    style.id = 'cortex-bid-strategy-styles';
    style.textContent = css.join('\n');
    document.head.appendChild(style);
  }

  // ─── Expose API ───────────────────────────────────────────────────

  window.CortexBidStrategy = {
    analyze: analyzeBid,
    render: renderBidStrategy,
    // Expose sub-scorers for testing/integration
    _scorers: {
      skillMatch: scoreSkillMatch,
      budgetFit: scoreBudgetFit,
      competition: scoreCompetition,
      clientQuality: scoreClientQuality,
      roi: scoreROI,
      strategicFit: scoreStrategicFit
    }
  };

})();
