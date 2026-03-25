/**
 * [CF3-003] Proposal Success Metrics Tracker
 * Tracks proposal outcomes, analyzes win patterns, and provides
 * data-driven recommendations for future proposals.
 *
 * window.CortexFreelancer.ProposalSuccessMetrics
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_proposal_success_metrics';
  var CSS_INJECTED = false;

  // ─── Data Model ─────────────────────────────────────────────

  function getMetrics() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { proposals: [], summary: null };
    } catch (e) { return { proposals: [], summary: null }; }
  }

  function saveMetrics(metrics) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics)); } catch (e) { /* ignore */ }
  }

  // ─── Record Proposal Submission ─────────────────────────────

  function recordSubmission(data) {
    var metrics = getMetrics();
    var entry = {
      id: 'psm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      submittedAt: new Date().toISOString(),
      status: 'submitted', // submitted, viewed, shortlisted, interview, hired, rejected
      // Job context
      jobTitle: (data.jobTitle || '').substring(0, 150),
      jobCategory: data.jobCategory || null,
      clientType: data.clientType || null,
      industry: data.industry || null,
      budgetTier: data.budgetTier || null,
      // Proposal context
      tone: data.tone || 'professional',
      source: data.source || 'ai', // ai, template, manual
      wordCount: data.wordCount || 0,
      score: data.score || null,
      usedClientResearch: data.usedClientResearch || false,
      personalizedHooks: data.personalizedHooks || 0,
      keywordCoverage: data.keywordCoverage || null,
      // Outcome (updated later)
      outcome: null,
      responseTime: null, // days until client responded
      hiredAt: null,
      contractValue: null,
      notes: data.notes || '',
    };

    metrics.proposals.unshift(entry);
    if (metrics.proposals.length > 500) metrics.proposals = metrics.proposals.slice(0, 500);
    metrics.summary = null; // Invalidate cached summary
    saveMetrics(metrics);
    return entry;
  }

  // ─── Update Proposal Status ─────────────────────────────────

  function updateStatus(proposalId, newStatus, extra) {
    var metrics = getMetrics();
    var found = false;
    for (var i = 0; i < metrics.proposals.length; i++) {
      if (metrics.proposals[i].id === proposalId) {
        metrics.proposals[i].status = newStatus;
        if (extra) {
          if (extra.responseTime !== undefined) metrics.proposals[i].responseTime = extra.responseTime;
          if (extra.contractValue !== undefined) metrics.proposals[i].contractValue = extra.contractValue;
          if (extra.notes !== undefined) metrics.proposals[i].notes = extra.notes;
        }
        if (newStatus === 'hired') {
          metrics.proposals[i].outcome = 'won';
          metrics.proposals[i].hiredAt = new Date().toISOString();
        } else if (newStatus === 'rejected') {
          metrics.proposals[i].outcome = 'lost';
        }
        found = true;
        break;
      }
    }
    if (found) {
      metrics.summary = null;
      saveMetrics(metrics);
    }
    return found;
  }

  // ─── Compute Summary Analytics ──────────────────────────────

  function computeSummary() {
    var metrics = getMetrics();
    var proposals = metrics.proposals;
    if (!proposals.length) return null;

    var total = proposals.length;
    var won = 0;
    var lost = 0;
    var pending = 0;
    var totalValue = 0;

    var byTone = {};
    var byCategory = {};
    var byClientType = {};
    var byIndustry = {};
    var bySource = {};
    var byResearch = { with: { total: 0, won: 0 }, without: { total: 0, won: 0 } };

    var responseTimesWon = [];
    var responseTimesLost = [];
    var scoresWon = [];
    var scoresLost = [];

    for (var i = 0; i < proposals.length; i++) {
      var p = proposals[i];

      if (p.outcome === 'won') {
        won++;
        if (p.contractValue) totalValue += p.contractValue;
        if (p.responseTime) responseTimesWon.push(p.responseTime);
        if (p.score) scoresWon.push(p.score);
      } else if (p.outcome === 'lost') {
        lost++;
        if (p.responseTime) responseTimesLost.push(p.responseTime);
        if (p.score) scoresLost.push(p.score);
      } else {
        pending++;
      }

      // Dimension breakdown
      _incDim(byTone, p.tone, p.outcome);
      _incDim(byCategory, p.jobCategory, p.outcome);
      _incDim(byClientType, p.clientType, p.outcome);
      _incDim(byIndustry, p.industry, p.outcome);
      _incDim(bySource, p.source, p.outcome);

      // Research impact
      if (p.usedClientResearch) {
        byResearch.with.total++;
        if (p.outcome === 'won') byResearch.with.won++;
      } else {
        byResearch.without.total++;
        if (p.outcome === 'won') byResearch.without.won++;
      }
    }

    var decided = won + lost;
    var winRate = decided > 0 ? Math.round((won / decided) * 100) : 0;

    var summary = {
      total: total,
      won: won,
      lost: lost,
      pending: pending,
      winRate: winRate,
      totalContractValue: totalValue,
      avgResponseTimeWon: _avg(responseTimesWon),
      avgResponseTimeLost: _avg(responseTimesLost),
      avgScoreWon: _avg(scoresWon),
      avgScoreLost: _avg(scoresLost),
      byTone: _computeWinRates(byTone),
      byCategory: _computeWinRates(byCategory),
      byClientType: _computeWinRates(byClientType),
      byIndustry: _computeWinRates(byIndustry),
      bySource: _computeWinRates(bySource),
      researchImpact: {
        withResearchWinRate: byResearch.with.total > 0 ? Math.round((byResearch.with.won / byResearch.with.total) * 100) : null,
        withoutResearchWinRate: byResearch.without.total > 0 ? Math.round((byResearch.without.won / byResearch.without.total) * 100) : null,
        lift: null,
      },
      insights: [],
      computedAt: new Date().toISOString(),
    };

    // Compute research lift
    if (summary.researchImpact.withResearchWinRate !== null && summary.researchImpact.withoutResearchWinRate !== null) {
      summary.researchImpact.lift = summary.researchImpact.withResearchWinRate - summary.researchImpact.withoutResearchWinRate;
    }

    // Generate insights
    summary.insights = _generateInsights(summary);

    // Cache
    metrics.summary = summary;
    saveMetrics(metrics);

    return summary;
  }

  function _incDim(obj, key, outcome) {
    var k = key || 'unknown';
    if (!obj[k]) obj[k] = { total: 0, won: 0, lost: 0 };
    obj[k].total++;
    if (outcome === 'won') obj[k].won++;
    else if (outcome === 'lost') obj[k].lost++;
  }

  function _computeWinRates(dimObj) {
    var result = {};
    for (var key in dimObj) {
      if (!dimObj.hasOwnProperty(key)) continue;
      var d = dimObj[key];
      var decided = d.won + d.lost;
      result[key] = {
        total: d.total,
        won: d.won,
        lost: d.lost,
        winRate: decided > 0 ? Math.round((d.won / decided) * 100) : null,
      };
    }
    return result;
  }

  function _avg(arr) {
    if (!arr.length) return null;
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += arr[i];
    return Math.round((sum / arr.length) * 10) / 10;
  }

  // ─── Insight Generation ─────────────────────────────────────

  function _generateInsights(summary) {
    var insights = [];

    // Best performing tone
    var bestTone = _bestDimension(summary.byTone);
    if (bestTone) {
      insights.push({
        type: 'tone',
        icon: 'target',
        text: 'Your "' + bestTone.key + '" tone proposals win ' + bestTone.winRate + '% of the time (' + bestTone.won + '/' + (bestTone.won + bestTone.lost) + ').',
        priority: bestTone.won >= 3 ? 'high' : 'medium',
      });
    }

    // Best category
    var bestCat = _bestDimension(summary.byCategory);
    if (bestCat && bestCat.key !== 'unknown') {
      insights.push({
        type: 'category',
        icon: 'chart',
        text: 'You win most in "' + bestCat.key.replace(/-/g, ' ') + '" projects (' + bestCat.winRate + '% win rate).',
        priority: 'medium',
      });
    }

    // Research impact
    if (summary.researchImpact.lift !== null && summary.researchImpact.lift > 0) {
      insights.push({
        type: 'research',
        icon: 'research',
        text: 'Proposals using client research win ' + summary.researchImpact.lift + 'pp more often (' + summary.researchImpact.withResearchWinRate + '% vs ' + summary.researchImpact.withoutResearchWinRate + '%).',
        priority: 'high',
      });
    } else if (summary.researchImpact.lift !== null && summary.researchImpact.lift <= 0) {
      insights.push({
        type: 'research',
        icon: 'research',
        text: 'Client research hasn\'t improved win rate yet. Keep using it — patterns emerge after 15+ proposals.',
        priority: 'low',
      });
    }

    // Score correlation
    if (summary.avgScoreWon && summary.avgScoreLost && summary.avgScoreWon > summary.avgScoreLost) {
      insights.push({
        type: 'quality',
        icon: 'star',
        text: 'Winning proposals score ' + summary.avgScoreWon + ' vs losing proposals at ' + summary.avgScoreLost + '. Quality matters.',
        priority: 'medium',
      });
    }

    // AI vs template
    var aiStats = summary.bySource['ai'];
    var tplStats = summary.bySource['template'];
    if (aiStats && tplStats && aiStats.winRate !== null && tplStats.winRate !== null) {
      if (aiStats.winRate > tplStats.winRate) {
        insights.push({ type: 'source', icon: 'robot', text: 'AI-generated proposals outperform templates (' + aiStats.winRate + '% vs ' + tplStats.winRate + '%).', priority: 'medium' });
      } else if (tplStats.winRate > aiStats.winRate) {
        insights.push({ type: 'source', icon: 'template', text: 'Template proposals outperform AI-generated ones (' + tplStats.winRate + '% vs ' + aiStats.winRate + '%). Consider fine-tuning AI prompts.', priority: 'medium' });
      }
    }

    // Volume recommendation
    if (summary.total >= 10 && summary.winRate < 10) {
      insights.push({ type: 'strategy', icon: 'warning', text: 'Win rate is below 10%. Focus on fewer, higher-quality proposals targeting your strongest categories.', priority: 'high' });
    }

    return insights;
  }

  function _bestDimension(dimObj) {
    var best = null;
    for (var key in dimObj) {
      if (!dimObj.hasOwnProperty(key) || key === 'unknown') continue;
      var d = dimObj[key];
      if (d.winRate === null || (d.won + d.lost) < 2) continue;
      if (!best || d.winRate > best.winRate || (d.winRate === best.winRate && d.won > best.won)) {
        best = { key: key, winRate: d.winRate, won: d.won, lost: d.lost, total: d.total };
      }
    }
    return best;
  }

  // ─── Get Recommendations for Next Proposal ──────────────────

  function getRecommendations(jobCategory, clientType, industry) {
    var summary = computeSummary();
    if (!summary) return { tone: 'professional', tips: [] };

    var tips = [];

    // Recommend best tone for this category/client combo
    var bestToneForCat = null;
    if (jobCategory && summary.byCategory[jobCategory]) {
      bestToneForCat = summary.byCategory[jobCategory];
    }

    // Find the best performing tone overall
    var recommendedTone = 'professional';
    var bestTone = _bestDimension(summary.byTone);
    if (bestTone) {
      recommendedTone = bestTone.key;
      tips.push('Your best tone is "' + bestTone.key + '" (' + bestTone.winRate + '% win rate).');
    }

    // Category-specific tip
    if (jobCategory && summary.byCategory[jobCategory]) {
      var catStats = summary.byCategory[jobCategory];
      if (catStats.winRate !== null) {
        tips.push('Your win rate in ' + jobCategory.replace(/-/g, ' ') + ': ' + catStats.winRate + '% (' + catStats.won + ' wins).');
      }
    }

    // Client type tip
    if (clientType && summary.byClientType[clientType]) {
      var ctStats = summary.byClientType[clientType];
      if (ctStats.winRate !== null) {
        tips.push('With ' + clientType + ' clients: ' + ctStats.winRate + '% win rate.');
      }
    }

    // Research recommendation
    if (summary.researchImpact.lift && summary.researchImpact.lift > 5) {
      tips.push('Use client research — it adds +' + summary.researchImpact.lift + 'pp to your win rate.');
    }

    // Score target
    if (summary.avgScoreWon) {
      tips.push('Aim for proposal score above ' + Math.round(summary.avgScoreWon) + ' (your winning average).');
    }

    return {
      tone: recommendedTone,
      tips: tips,
      winRate: summary.winRate,
      totalWins: summary.won,
      totalProposals: summary.total,
    };
  }

  // ─── Render: Success Dashboard ──────────────────────────────

  function renderDashboard(containerId) {
    _injectCSS();
    var container = document.getElementById(containerId);
    if (!container) return;

    var summary = computeSummary();
    if (!summary || summary.total === 0) {
      container.innerHTML = '<div class="psm-panel"><div class="psm-empty">No proposal data yet. Submit proposals and track outcomes to see analytics.</div></div>';
      return;
    }

    var h = '<div class="psm-panel">';

    // Header stats
    h += '<div class="psm-header"><span class="psm-title">Success Metrics</span></div>';
    h += '<div class="psm-stats-row">';
    h += _statCard('Win Rate', summary.winRate + '%', summary.winRate >= 20 ? '#22c55e' : summary.winRate >= 10 ? '#eab308' : '#ef4444');
    h += _statCard('Total', String(summary.total), '#60a5fa');
    h += _statCard('Won', String(summary.won), '#22c55e');
    h += _statCard('Lost', String(summary.lost), '#ef4444');
    if (summary.totalContractValue > 0) {
      h += _statCard('Revenue', '$' + _formatNum(summary.totalContractValue), '#a78bfa');
    }
    h += '</div>';

    // Insights
    if (summary.insights.length) {
      h += '<div class="psm-section"><div class="psm-section-label">Insights</div>';
      for (var i = 0; i < summary.insights.length; i++) {
        var ins = summary.insights[i];
        var priorityClass = ins.priority === 'high' ? 'psm-insight-high' : ins.priority === 'low' ? 'psm-insight-low' : '';
        h += '<div class="psm-insight ' + priorityClass + '">' + _escapeHtml(ins.text) + '</div>';
      }
      h += '</div>';
    }

    // Research impact
    if (summary.researchImpact.withResearchWinRate !== null) {
      h += '<div class="psm-section"><div class="psm-section-label">Client Research Impact</div>';
      h += '<div class="psm-compare">';
      h += '<div class="psm-compare-item"><span class="psm-compare-label">With Research</span><span class="psm-compare-value" style="color:#22c55e;">' + summary.researchImpact.withResearchWinRate + '%</span></div>';
      h += '<div class="psm-compare-item"><span class="psm-compare-label">Without</span><span class="psm-compare-value" style="color:#ef4444;">' + summary.researchImpact.withoutResearchWinRate + '%</span></div>';
      if (summary.researchImpact.lift !== null) {
        var liftColor = summary.researchImpact.lift > 0 ? '#22c55e' : '#ef4444';
        h += '<div class="psm-compare-item"><span class="psm-compare-label">Lift</span><span class="psm-compare-value" style="color:' + liftColor + ';">' + (summary.researchImpact.lift > 0 ? '+' : '') + summary.researchImpact.lift + 'pp</span></div>';
      }
      h += '</div></div>';
    }

    // Tone breakdown
    h += _renderDimensionBreakdown('Win Rate by Tone', summary.byTone);
    h += _renderDimensionBreakdown('Win Rate by Category', summary.byCategory);

    h += '</div>';
    container.innerHTML = h;
  }

  function _statCard(label, value, color) {
    return '<div class="psm-stat"><span class="psm-stat-value" style="color:' + color + ';">' + value + '</span><span class="psm-stat-label">' + label + '</span></div>';
  }

  function _renderDimensionBreakdown(title, dimObj) {
    var keys = Object.keys(dimObj).filter(function (k) { return k !== 'unknown' && dimObj[k].winRate !== null; });
    if (!keys.length) return '';

    keys.sort(function (a, b) { return (dimObj[b].winRate || 0) - (dimObj[a].winRate || 0); });

    var h = '<div class="psm-section"><div class="psm-section-label">' + _escapeHtml(title) + '</div>';
    for (var i = 0; i < Math.min(keys.length, 6); i++) {
      var k = keys[i];
      var d = dimObj[k];
      var barWidth = Math.max(d.winRate || 0, 3);
      var color = (d.winRate || 0) >= 20 ? '#22c55e' : (d.winRate || 0) >= 10 ? '#eab308' : '#ef4444';
      h += '<div class="psm-bar-row">';
      h += '<span class="psm-bar-label">' + _escapeHtml(k.replace(/-/g, ' ')) + '</span>';
      h += '<div class="psm-bar-track"><div class="psm-bar-fill" style="width:' + barWidth + '%;background:' + color + ';"></div></div>';
      h += '<span class="psm-bar-value">' + (d.winRate || 0) + '% (' + d.won + '/' + (d.won + d.lost) + ')</span>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function _formatNum(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  // ─── CSS ────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.psm-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;margin-bottom:12px}',
      '.psm-header{padding:12px 16px;border-bottom:1px solid #222;background:#151515}',
      '.psm-title{font-size:14px;font-weight:700;color:#e0e0e0}',
      '.psm-stats-row{display:flex;gap:4px;padding:12px 16px;border-bottom:1px solid #1a1a1a;flex-wrap:wrap}',
      '.psm-stat{flex:1;min-width:60px;text-align:center;padding:8px 4px}',
      '.psm-stat-value{display:block;font-size:20px;font-weight:800;line-height:1}',
      '.psm-stat-label{display:block;font-size:10px;font-weight:600;color:#666;text-transform:uppercase;margin-top:4px;letter-spacing:.3px}',
      '.psm-section{padding:12px 16px;border-bottom:1px solid #1a1a1a}',
      '.psm-section:last-child{border-bottom:none}',
      '.psm-section-label{font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}',
      '.psm-insight{font-size:12px;color:#ccc;padding:6px 8px;border-radius:6px;background:#1a1a1a;margin-bottom:4px;line-height:1.4}',
      '.psm-insight-high{background:#7c3aed10;border-left:2px solid #7c3aed}',
      '.psm-insight-low{opacity:.7}',
      '.psm-compare{display:flex;gap:16px;flex-wrap:wrap}',
      '.psm-compare-item{display:flex;flex-direction:column;align-items:center;gap:2px}',
      '.psm-compare-label{font-size:10px;font-weight:600;color:#666;text-transform:uppercase}',
      '.psm-compare-value{font-size:18px;font-weight:800}',
      '.psm-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
      '.psm-bar-label{font-size:11px;color:#888;min-width:80px;text-transform:capitalize}',
      '.psm-bar-track{flex:1;height:6px;background:#1a1a1a;border-radius:3px;overflow:hidden}',
      '.psm-bar-fill{height:100%;border-radius:3px;transition:width .3s}',
      '.psm-bar-value{font-size:11px;color:#888;min-width:80px;text-align:right}',
      '.psm-empty{padding:20px;color:#666;font-size:13px;text-align:center}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function _escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Public API ─────────────────────────────────────────────

  CF.ProposalSuccessMetrics = {
    recordSubmission: recordSubmission,
    updateStatus: updateStatus,
    computeSummary: computeSummary,
    getRecommendations: getRecommendations,
    getMetrics: getMetrics,
    renderDashboard: renderDashboard,
    version: '1.0.0'
  };

})();
