/**
 * CortexProposalTracker — Track submitted proposals
 * Stores proposal data in localStorage. Provides analytics on win rate,
 * response times, and category performance.
 *
 * window.CortexProposalTracker
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_proposal_tracker';
  var VALID_STATUSES = ['sent', 'viewed', 'shortlisted', 'hired', 'rejected'];

  /* ── Storage helpers ─────────────────────────────────────── */

  function loadProposals() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveProposals(proposals) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals));
  }

  function generateId() {
    return 'prop_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /* ── CRUD ────────────────────────────────────────────────── */

  /**
   * Add a new proposal to the tracker
   * @param {Object} data - Proposal data
   * @param {string} data.jobTitle - Title of the job
   * @param {string} data.clientName - Client's name
   * @param {number} data.bidAmount - Bid amount in USD
   * @param {string} [data.category] - Job category
   * @param {string} [data.jobUrl] - Link to the job posting
   * @param {string} [data.notes] - Additional notes
   * @returns {Object} The created proposal record
   */
  function addProposal(data) {
    if (!data || !data.jobTitle) {
      throw new Error('jobTitle is required');
    }

    var proposals = loadProposals();
    var proposal = {
      id: generateId(),
      jobTitle: data.jobTitle,
      clientName: data.clientName || '',
      bidAmount: parseFloat(data.bidAmount) || 0,
      category: data.category || 'uncategorized',
      jobUrl: data.jobUrl || '',
      notes: data.notes || '',
      status: 'sent',
      sentDate: new Date().toISOString(),
      responseDate: null,
      statusHistory: [
        { status: 'sent', date: new Date().toISOString() }
      ]
    };

    proposals.push(proposal);
    saveProposals(proposals);
    return proposal;
  }

  /**
   * Update the status of an existing proposal
   * @param {string} id - Proposal ID
   * @param {string} status - New status: sent, viewed, shortlisted, hired, rejected
   * @returns {Object|null} Updated proposal or null if not found
   */
  function updateProposalStatus(id, status) {
    if (VALID_STATUSES.indexOf(status) === -1) {
      throw new Error('Invalid status. Must be one of: ' + VALID_STATUSES.join(', '));
    }

    var proposals = loadProposals();
    var proposal = null;

    for (var i = 0; i < proposals.length; i++) {
      if (proposals[i].id === id) {
        proposal = proposals[i];
        proposal.status = status;
        proposal.statusHistory.push({ status: status, date: new Date().toISOString() });

        if (status !== 'sent' && !proposal.responseDate) {
          proposal.responseDate = new Date().toISOString();
        }
        break;
      }
    }

    if (proposal) {
      saveProposals(proposals);
    }
    return proposal;
  }

  /**
   * Get proposals with optional filters
   * @param {Object} [filters] - Filter criteria
   * @param {string} [filters.status] - Filter by status
   * @param {string} [filters.category] - Filter by category
   * @param {string} [filters.clientName] - Filter by client name (partial match)
   * @param {string} [filters.dateFrom] - Filter by sent date (ISO string, inclusive)
   * @param {string} [filters.dateTo] - Filter by sent date (ISO string, inclusive)
   * @returns {Object[]} Array of matching proposals, sorted by sentDate desc
   */
  function getProposals(filters) {
    var proposals = loadProposals();

    if (filters) {
      proposals = proposals.filter(function (p) {
        if (filters.status && p.status !== filters.status) return false;
        if (filters.category && p.category !== filters.category) return false;
        if (filters.clientName && p.clientName.toLowerCase().indexOf(filters.clientName.toLowerCase()) === -1) return false;
        if (filters.dateFrom && p.sentDate < filters.dateFrom) return false;
        if (filters.dateTo && p.sentDate > filters.dateTo) return false;
        return true;
      });
    }

    proposals.sort(function (a, b) {
      return b.sentDate.localeCompare(a.sentDate);
    });

    return proposals;
  }

  /**
   * Delete a proposal by ID
   * @param {string} id - Proposal ID
   * @returns {boolean} True if deleted
   */
  function deleteProposal(id) {
    var proposals = loadProposals();
    var len = proposals.length;
    proposals = proposals.filter(function (p) { return p.id !== id; });
    if (proposals.length < len) {
      saveProposals(proposals);
      return true;
    }
    return false;
  }

  /**
   * Get proposal analytics
   * @returns {Object} Stats object with win rate, avg response time, and category breakdown
   */
  function getProposalStats() {
    var proposals = loadProposals();
    var total = proposals.length;

    if (total === 0) {
      return {
        totalProposals: 0,
        winRate: 0,
        avgResponseTimeHours: 0,
        statusBreakdown: {},
        bestCategories: [],
        avgBidAmount: 0,
        totalBidValue: 0
      };
    }

    // Status breakdown
    var statusBreakdown = {};
    VALID_STATUSES.forEach(function (s) { statusBreakdown[s] = 0; });
    proposals.forEach(function (p) {
      statusBreakdown[p.status] = (statusBreakdown[p.status] || 0) + 1;
    });

    // Win rate (hired / proposals with final status)
    var decided = statusBreakdown.hired + statusBreakdown.rejected;
    var winRate = decided > 0 ? Math.round((statusBreakdown.hired / decided) * 100) : 0;

    // Average response time
    var responseTimes = [];
    proposals.forEach(function (p) {
      if (p.responseDate && p.sentDate) {
        var diff = new Date(p.responseDate) - new Date(p.sentDate);
        if (diff > 0) responseTimes.push(diff);
      }
    });
    var avgResponseTimeHours = responseTimes.length > 0
      ? Math.round(responseTimes.reduce(function (a, b) { return a + b; }, 0) / responseTimes.length / 3600000)
      : 0;

    // Category performance
    var catMap = {};
    proposals.forEach(function (p) {
      var cat = p.category || 'uncategorized';
      if (!catMap[cat]) catMap[cat] = { total: 0, hired: 0 };
      catMap[cat].total++;
      if (p.status === 'hired') catMap[cat].hired++;
    });
    var bestCategories = Object.keys(catMap).map(function (cat) {
      return {
        category: cat,
        total: catMap[cat].total,
        hired: catMap[cat].hired,
        winRate: catMap[cat].total > 0 ? Math.round((catMap[cat].hired / catMap[cat].total) * 100) : 0
      };
    }).sort(function (a, b) { return b.winRate - a.winRate || b.total - a.total; });

    // Bid amounts
    var bids = proposals.filter(function (p) { return p.bidAmount > 0; });
    var totalBidValue = bids.reduce(function (s, p) { return s + p.bidAmount; }, 0);
    var avgBidAmount = bids.length > 0 ? Math.round(totalBidValue / bids.length) : 0;

    return {
      totalProposals: total,
      winRate: winRate,
      avgResponseTimeHours: avgResponseTimeHours,
      statusBreakdown: statusBreakdown,
      bestCategories: bestCategories,
      avgBidAmount: avgBidAmount,
      totalBidValue: Math.round(totalBidValue)
    };
  }

  /* ── Public API ──────────────────────────────────────────── */

  window.CortexProposalTracker = {
    addProposal: addProposal,
    updateProposalStatus: updateProposalStatus,
    getProposals: getProposals,
    deleteProposal: deleteProposal,
    getProposalStats: getProposalStats,
    VALID_STATUSES: VALID_STATUSES
  };

})();
