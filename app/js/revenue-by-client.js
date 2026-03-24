/**
 * [CF-054] Revenue by Client
 * Visualize revenue distribution across clients, flag over-dependency
 * on a single client using Herfindahl index for concentration measurement.
 * Reads from localStorage 'cortex_earnings'.
 * Exposed on window.CortexFreelancer.revenueByClient
 */
(function () {
  'use strict';

  var EARNINGS_KEY = 'cortex_earnings';
  var DEPENDENCY_THRESHOLD = 0.40; // 40% — warn if single client exceeds this

  /* ── Storage Helpers ── */

  /**
   * Load earnings data from localStorage
   * @returns {Array}
   */
  function loadEarnings() {
    try {
      var raw = localStorage.getItem(EARNINGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /* ── Core Functions ── */

  /**
   * Get revenue distribution across all clients
   * @param {object} [options]
   * @param {string} [options.startDate] - Filter start date (ISO string)
   * @param {string} [options.endDate] - Filter end date (ISO string)
   * @returns {object} Distribution data
   */
  function getClientDistribution(options) {
    var opts = options || {};
    var earnings = loadEarnings();
    var startDate = opts.startDate ? new Date(opts.startDate) : null;
    var endDate = opts.endDate ? new Date(opts.endDate) : null;

    // Filter by date if specified
    var filtered = [];
    for (var i = 0; i < earnings.length; i++) {
      var e = earnings[i];
      var d = new Date(e.date || e.createdAt || e.endDate);
      if (startDate && d < startDate) continue;
      if (endDate && d > endDate) continue;
      filtered.push(e);
    }

    // Aggregate by client
    var clientTotals = {};
    var totalRevenue = 0;

    for (var j = 0; j < filtered.length; j++) {
      var entry = filtered[j];
      var client = entry.source || entry.client || entry.clientName || 'Unknown';
      var amount = entry.amount || entry.earnings || 0;
      clientTotals[client] = (clientTotals[client] || 0) + amount;
      totalRevenue += amount;
    }

    // Build sorted distribution array
    var clients = [];
    var names = Object.keys(clientTotals);
    for (var k = 0; k < names.length; k++) {
      var name = names[k];
      var revenue = clientTotals[name];
      clients.push({
        client: name,
        revenue: Math.round(revenue * 100) / 100,
        percentage: totalRevenue > 0
          ? Math.round((revenue / totalRevenue) * 10000) / 100
          : 0,
        isOverDependency: totalRevenue > 0 && (revenue / totalRevenue) > DEPENDENCY_THRESHOLD
      });
    }

    // Sort by revenue descending
    clients.sort(function (a, b) { return b.revenue - a.revenue; });

    return {
      clients: clients,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalClients: clients.length,
      topClient: clients.length > 0 ? clients[0] : null
    };
  }

  /**
   * Assess dependency risk across client portfolio
   * @param {object} [options] - Same date filter options as getClientDistribution
   * @returns {object} Dependency risk assessment
   */
  function getDependencyRisk(options) {
    var dist = getClientDistribution(options);
    var clients = dist.clients;

    if (clients.length === 0) {
      return {
        riskLevel: 'unknown',
        message: 'No earnings data available to assess dependency risk.',
        warnings: [],
        diversificationScore: 0,
        clientCount: 0
      };
    }

    var warnings = [];
    var highRiskClients = [];

    for (var i = 0; i < clients.length; i++) {
      if (clients[i].isOverDependency) {
        highRiskClients.push(clients[i]);
        warnings.push(
          clients[i].client + ' accounts for ' + clients[i].percentage +
          '% of revenue (threshold: ' + (DEPENDENCY_THRESHOLD * 100) + '%)'
        );
      }
    }

    // Single client risk
    if (clients.length === 1) {
      warnings.push('All revenue comes from a single client. This is extremely risky.');
    } else if (clients.length <= 3 && dist.totalRevenue > 0) {
      warnings.push('Revenue spread across only ' + clients.length + ' clients. Consider diversifying.');
    }

    // Determine risk level
    var riskLevel = 'low';
    if (highRiskClients.length > 0 || clients.length === 1) {
      riskLevel = 'high';
    } else if (clients.length <= 3) {
      riskLevel = 'medium';
    }

    // Simple diversification score: 0-100
    // Perfect = many clients with equal share; worst = one client with all revenue
    var diversificationScore = 0;
    if (clients.length > 1) {
      var topPct = clients[0].percentage / 100;
      var idealPct = 1 / clients.length;
      diversificationScore = Math.round(
        Math.max(0, Math.min(100, (1 - (topPct - idealPct)) * 100))
      );
    }

    return {
      riskLevel: riskLevel,
      message: riskLevel === 'low'
        ? 'Revenue is well diversified across clients.'
        : riskLevel === 'medium'
          ? 'Client portfolio could use more diversification.'
          : 'Revenue concentration is dangerously high. Diversify immediately.',
      warnings: warnings,
      highRiskClients: highRiskClients,
      diversificationScore: diversificationScore,
      clientCount: clients.length
    };
  }

  /**
   * Calculate Herfindahl-Hirschman Index (HHI) for revenue concentration
   * HHI ranges from 1/N (perfect diversity) to 1 (monopoly)
   * Normalized to 0-10000 scale (standard HHI)
   * @param {object} [options] - Same date filter options
   * @returns {object} HHI analysis
   */
  function getConcentrationIndex(options) {
    var dist = getClientDistribution(options);
    var clients = dist.clients;

    if (clients.length === 0) {
      return {
        hhi: 0,
        normalizedHhi: 0,
        interpretation: 'No data available.',
        marketType: 'unknown',
        clients: []
      };
    }

    // HHI = sum of squared market shares (as percentages)
    var hhi = 0;
    var shares = [];
    for (var i = 0; i < clients.length; i++) {
      var share = clients[i].percentage;
      hhi += share * share;
      shares.push({
        client: clients[i].client,
        share: share,
        squaredShare: Math.round(share * share * 100) / 100
      });
    }

    hhi = Math.round(hhi * 100) / 100;

    // Normalized HHI: (HHI - 1/N) / (1 - 1/N) mapped to 0-10000
    var n = clients.length;
    var minHhi = n > 1 ? 10000 / n : 10000;
    var normalizedHhi = n > 1
      ? Math.round(((hhi - minHhi) / (10000 - minHhi)) * 10000)
      : 10000;
    normalizedHhi = Math.max(0, Math.min(10000, normalizedHhi));

    // Interpretation using standard DOJ thresholds (adapted for freelancer context)
    var interpretation = '';
    var marketType = '';
    if (hhi < 1500) {
      interpretation = 'Revenue is well-diversified across clients. Low concentration risk.';
      marketType = 'diversified';
    } else if (hhi < 2500) {
      interpretation = 'Moderate concentration. A few clients dominate revenue. Consider expanding client base.';
      marketType = 'moderate';
    } else {
      interpretation = 'High concentration. Revenue is heavily dependent on few clients. This is a significant business risk.';
      marketType = 'concentrated';
    }

    return {
      hhi: hhi,
      normalizedHhi: normalizedHhi,
      interpretation: interpretation,
      marketType: marketType,
      clientCount: n,
      shares: shares,
      thresholds: {
        diversified: '< 1500',
        moderate: '1500 - 2500',
        concentrated: '> 2500',
        maximum: '10000 (single client)'
      }
    };
  }

  /**
   * Get a full revenue-by-client report combining all analyses
   * @param {object} [options] - Date filter options
   * @returns {object} Complete report
   */
  function getFullReport(options) {
    return {
      distribution: getClientDistribution(options),
      dependencyRisk: getDependencyRisk(options),
      concentrationIndex: getConcentrationIndex(options),
      generatedAt: new Date().toISOString()
    };
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.revenueByClient = {
    getClientDistribution: getClientDistribution,
    getDependencyRisk: getDependencyRisk,
    getConcentrationIndex: getConcentrationIndex,
    getFullReport: getFullReport
  };
})();
