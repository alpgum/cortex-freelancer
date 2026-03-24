/**
 * [CF-066] Bid Strategy Advisor — Enhanced Competition-Aware Bidding
 * Extends BidStrategy with real-time competition scoring, budget-aware
 * recommendations, win-rate learning, and visual bid cards.
 *
 * Depends on: bid-strategy.js (window.CortexFreelancer.BidStrategy)
 * Exposed on window.CortexFreelancer.BidStrategyAdvisor
 */
(function () {
  'use strict';

  var HISTORY_KEY = 'cortex_bid_advisor_history';

  // ─── Helpers ────────────────────────────────────────────────────────

  function _loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function _saveHistory(h) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-200))); } catch (e) { /* ignore */ }
  }

  function _esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ─── Competition Level Assessment ──────────────────────────────────

  function assessCompetition(job) {
    var proposals = job.proposals || job.proposalCount || 0;
    var age = _jobAgeHours(job);
    var velocity = age > 0 ? proposals / age : proposals;

    var level, score;
    if (proposals <= 5) { level = 'low'; score = 20; }
    else if (proposals <= 15) { level = 'moderate'; score = 40; }
    else if (proposals <= 30) { level = 'high'; score = 65; }
    else if (proposals <= 50) { level = 'very-high'; score = 80; }
    else { level = 'extreme'; score = 95; }

    // Adjust for velocity
    if (velocity > 5) score = Math.min(100, score + 10);
    if (velocity < 0.5 && proposals > 5) score = Math.max(0, score - 10);

    return {
      level: level,
      score: score,
      proposals: proposals,
      velocity: Math.round(velocity * 100) / 100,
      ageHours: Math.round(age),
      recommendation: _competitionRecommendation(level, score)
    };
  }

  function _jobAgeHours(job) {
    if (!job.postedAt && !job.createdAt) return 24;
    var posted = new Date(job.postedAt || job.createdAt);
    if (isNaN(posted.getTime())) return 24;
    return Math.max(1, (Date.now() - posted.getTime()) / 3.6e6);
  }

  function _competitionRecommendation(level, score) {
    var recs = {
      'low': 'Great opportunity — bid at your standard rate with a tailored proposal.',
      'moderate': 'Competitive but manageable — highlight unique skills, consider slight rate flexibility.',
      'high': 'Crowded listing — lead with results and differentiation, consider a strategic rate.',
      'very-high': 'Very crowded — only bid if strong skill match. Use a "sniper" approach with specific deliverables.',
      'extreme': 'Extremely saturated — consider skipping unless you have a clear competitive edge.'
    };
    return recs[level] || recs['moderate'];
  }

  // ─── Bid Amount Calculator ─────────────────────────────────────────

  function calculateBid(job, userProfile) {
    var budget = _effectiveBudget(job);
    var competition = assessCompetition(job);
    var winRate = _calculateWinRate(userProfile);
    var userRate = userProfile.rate || 50;

    // Base bid starts from user's rate
    var baseBid = budget > 0 ? Math.min(budget * 0.85, userRate * _estimateHours(budget, job.budgetType)) : userRate * _estimateHours(500, 'fixed');

    // Competition multiplier
    var compMultiplier = {
      'low': 1.1,
      'moderate': 1.0,
      'high': 0.9,
      'very-high': 0.8,
      'extreme': 0.7
    }[competition.level] || 1.0;

    // Win rate confidence adjustment
    var winMultiplier = 1.0;
    if (winRate.rate > 0.3) winMultiplier = 1.05;
    if (winRate.rate > 0.5) winMultiplier = 1.10;
    if (winRate.rate < 0.1 && winRate.total > 5) winMultiplier = 0.90;

    // Skill match bonus
    var skillMatch = _skillMatchScore(job, userProfile);
    var skillMultiplier = 0.95 + (skillMatch * 0.15);

    var recommendedBid = Math.round(baseBid * compMultiplier * winMultiplier * skillMultiplier);

    // Compute range
    var lowBid = Math.round(recommendedBid * 0.85);
    var highBid = Math.round(recommendedBid * 1.15);

    // Strategy selection
    var strategy = _selectStrategy(competition, winRate, skillMatch, budget);

    return {
      recommended: recommendedBid,
      range: { low: lowBid, high: highBid },
      competition: competition,
      winRate: winRate,
      skillMatch: Math.round(skillMatch * 100),
      strategy: strategy,
      factors: {
        baseBid: Math.round(baseBid),
        competitionMultiplier: compMultiplier,
        winRateMultiplier: winMultiplier,
        skillMultiplier: Math.round(skillMultiplier * 100) / 100,
        budget: budget
      },
      confidence: _bidConfidence(competition, skillMatch, winRate, budget)
    };
  }

  function _effectiveBudget(job) {
    if (job.budget && job.budget > 0) return job.budget;
    if (job.budgetMax && job.budgetMax > 0) return ((job.budgetMin || 0) + job.budgetMax) / 2;
    if (job.budgetMin && job.budgetMin > 0) return job.budgetMin;
    return 0;
  }

  function _estimateHours(budget, type) {
    if (type === 'hourly') return 1;
    if (budget <= 100) return 4;
    if (budget <= 500) return 16;
    if (budget <= 2000) return 60;
    if (budget <= 5000) return 120;
    return 200;
  }

  function _calculateWinRate(userProfile) {
    var history = _loadHistory();
    var total = history.length;
    var won = history.filter(function (h) { return h.outcome === 'won'; }).length;
    var rate = total > 0 ? won / total : 0;

    // Recent win rate (last 20)
    var recent = history.slice(-20);
    var recentWon = recent.filter(function (h) { return h.outcome === 'won'; }).length;
    var recentRate = recent.length > 0 ? recentWon / recent.length : 0;

    return {
      rate: Math.round(rate * 100) / 100,
      total: total,
      won: won,
      recentRate: Math.round(recentRate * 100) / 100,
      recentTotal: recent.length,
      trend: recentRate > rate ? 'improving' : recentRate < rate ? 'declining' : 'stable'
    };
  }

  function _skillMatchScore(job, userProfile) {
    var jobSkills = (job.skills || []).map(function (s) { return s.toLowerCase(); });
    var userSkills = (userProfile.skills || []).map(function (s) { return s.toLowerCase(); });
    if (jobSkills.length === 0) return 0.5;

    var matches = jobSkills.filter(function (s) { return userSkills.indexOf(s) !== -1; }).length;
    return matches / jobSkills.length;
  }

  function _selectStrategy(competition, winRate, skillMatch, budget) {
    if (skillMatch > 0.8 && competition.level === 'low') {
      return { name: 'Premium', description: 'Strong match + low competition — bid at or above standard rate.', icon: '💎' };
    }
    if (skillMatch > 0.6 && (competition.level === 'low' || competition.level === 'moderate')) {
      return { name: 'Standard', description: 'Good positioning — bid at your normal rate with tailored proposal.', icon: '🎯' };
    }
    if (competition.level === 'high' || competition.level === 'very-high') {
      if (skillMatch > 0.7) {
        return { name: 'Competitive', description: 'Crowded but qualified — emphasize unique value, slight rate flexibility.', icon: '⚡' };
      }
      return { name: 'Aggressive', description: 'High competition, moderate match — consider lower bid with upsell potential.', icon: '🔥' };
    }
    if (competition.level === 'extreme') {
      return { name: 'Sniper', description: 'Ultra-competitive — only bid with precise, specific deliverables.', icon: '🎯' };
    }
    return { name: 'Standard', description: 'Balanced approach at your standard rate.', icon: '🎯' };
  }

  function _bidConfidence(competition, skillMatch, winRate, budget) {
    var score = 50;
    score += skillMatch * 20;
    score -= competition.score * 0.2;
    score += winRate.rate * 15;
    if (budget > 0) score += 10;
    return {
      score: clamp(Math.round(score), 10, 95),
      label: score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low'
    };
  }

  // ─── History Tracking ───────────────────────────────────────────────

  function recordBid(jobId, bidAmount, outcome) {
    var history = _loadHistory();
    history.push({
      jobId: jobId,
      bidAmount: bidAmount,
      outcome: outcome || 'pending',
      timestamp: new Date().toISOString()
    });
    _saveHistory(history);
  }

  function updateBidOutcome(jobId, outcome) {
    var history = _loadHistory();
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].jobId === jobId) {
        history[i].outcome = outcome;
        _saveHistory(history);
        return true;
      }
    }
    return false;
  }

  function getBidHistory() {
    return _loadHistory();
  }

  // ─── Rendering ──────────────────────────────────────────────────────

  function renderBidCard(containerId, job, userProfile) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var result = calculateBid(job, userProfile);
    var comp = result.competition;

    var compColor = { 'low': '#10b981', 'moderate': '#f59e0b', 'high': '#ef4444', 'very-high': '#dc2626', 'extreme': '#7c2d12' }[comp.level] || '#6b7280';
    var confColor = result.confidence.label === 'High' ? '#10b981' : result.confidence.label === 'Medium' ? '#f59e0b' : '#ef4444';

    var html = '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;max-width:480px;">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h3 style="margin:0;font-size:16px;">' + result.strategy.icon + ' Bid Strategy: ' + _esc(result.strategy.name) + '</h3>';
    html += '<span style="font-size:12px;background:' + confColor + '20;color:' + confColor + ';padding:4px 10px;border-radius:12px;font-weight:600;">' + result.confidence.label + ' confidence</span>';
    html += '</div>';

    // Recommended bid
    html += '<div style="text-align:center;padding:16px;background:#f0f9ff;border-radius:10px;margin-bottom:16px;">';
    html += '<div style="font-size:12px;color:#6b7280;">Recommended Bid</div>';
    html += '<div style="font-size:32px;font-weight:700;color:#1d4ed8;">$' + result.recommended + '</div>';
    html += '<div style="font-size:13px;color:#374151;">Range: $' + result.range.low + ' – $' + result.range.high + '</div>';
    html += '</div>';

    // Competition meter
    html += '<div style="margin-bottom:16px;">';
    html += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">';
    html += '<span>Competition</span><span style="color:' + compColor + ';font-weight:600;">' + comp.level.replace('-', ' ') + ' (' + comp.proposals + ' proposals)</span>';
    html += '</div>';
    html += '<div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">';
    html += '<div style="background:' + compColor + ';height:100%;width:' + comp.score + '%;border-radius:4px;transition:width .3s;"></div>';
    html += '</div></div>';

    // Factors
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">';
    html += '<div style="background:#f9fafb;border-radius:8px;padding:10px;text-align:center;">';
    html += '<div style="font-size:11px;color:#6b7280;">Skill Match</div>';
    html += '<div style="font-size:18px;font-weight:600;">' + result.skillMatch + '%</div></div>';
    html += '<div style="background:#f9fafb;border-radius:8px;padding:10px;text-align:center;">';
    html += '<div style="font-size:11px;color:#6b7280;">Win Rate</div>';
    html += '<div style="font-size:18px;font-weight:600;">' + Math.round(result.winRate.rate * 100) + '%</div></div>';
    html += '</div>';

    // Strategy note
    html += '<div style="font-size:13px;color:#374151;padding:10px;background:#f9fafb;border-radius:8px;">';
    html += _esc(result.strategy.description);
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Init ───────────────────────────────────────────────────────────

  function init() {
    console.log('[BidStrategyAdvisor] Initialized');
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.BidStrategyAdvisor = {
    init: init,
    assessCompetition: assessCompetition,
    calculateBid: calculateBid,
    recordBid: recordBid,
    updateBidOutcome: updateBidOutcome,
    getBidHistory: getBidHistory,
    renderBidCard: renderBidCard
  };
})();
