/**
 * [CF-059] Payment Milestone Tracker
 * Track payment milestones per active contract.
 * Exposed on window.CortexFreelancer.paymentMilestoneTracker
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_payment_milestones';

  /** @type {string[]} */
  var VALID_STATUSES = ['pending', 'funded', 'submitted', 'approved', 'released', 'disputed'];

  /**
   * Read all contracts from localStorage.
   * @returns {Array<{id: string, client: string, title: string, totalAmount: number, milestones: Array<{title: string, amount: number, dueDate: string, status: string}>, createdAt: string, updatedAt: string}>}
   */
  function readContracts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[CF-059] Failed to read milestones:', e);
      return [];
    }
  }

  /**
   * Persist contracts to localStorage.
   * @param {Array} contracts
   * @returns {boolean}
   */
  function writeContracts(contracts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
      return true;
    } catch (e) {
      console.warn('[CF-059] Failed to write milestones:', e);
      return false;
    }
  }

  /**
   * Add a new contract with milestones.
   * @param {{id: string, client: string, title: string, totalAmount: number, milestones: Array<{title: string, amount: number, dueDate: string}>}} contract
   * @returns {{success: boolean, contract: Object|null, error: string|null}}
   */
  function addContract(contract) {
    if (!contract || !contract.id || !contract.client || !contract.title) {
      return { success: false, contract: null, error: 'Missing required fields: id, client, title' };
    }

    var contracts = readContracts();
    var existing = contracts.find(function (c) { return c.id === contract.id; });
    if (existing) {
      return { success: false, contract: null, error: 'Contract with id "' + contract.id + '" already exists' };
    }

    var milestones = (contract.milestones || []).map(function (m) {
      return {
        title: m.title || 'Untitled Milestone',
        amount: m.amount || 0,
        dueDate: m.dueDate || null,
        status: 'pending'
      };
    });

    var now = new Date().toISOString();
    var newContract = {
      id: contract.id,
      client: contract.client,
      title: contract.title,
      totalAmount: contract.totalAmount || 0,
      milestones: milestones,
      createdAt: now,
      updatedAt: now
    };

    contracts.push(newContract);
    var saved = writeContracts(contracts);

    return {
      success: saved,
      contract: saved ? newContract : null,
      error: saved ? null : 'Failed to save to localStorage'
    };
  }

  /**
   * Update a milestone's status within a contract.
   * @param {string} contractId
   * @param {number} milestoneIndex - Zero-based index of the milestone.
   * @param {string} status - One of: pending, funded, submitted, approved, released, disputed.
   * @returns {{success: boolean, milestone: Object|null, error: string|null}}
   */
  function updateMilestone(contractId, milestoneIndex, status) {
    if (VALID_STATUSES.indexOf(status) === -1) {
      return { success: false, milestone: null, error: 'Invalid status. Must be one of: ' + VALID_STATUSES.join(', ') };
    }

    var contracts = readContracts();
    var contract = null;
    var contractIdx = -1;

    for (var i = 0; i < contracts.length; i++) {
      if (contracts[i].id === contractId) {
        contract = contracts[i];
        contractIdx = i;
        break;
      }
    }

    if (!contract) {
      return { success: false, milestone: null, error: 'Contract not found: ' + contractId };
    }

    if (milestoneIndex < 0 || milestoneIndex >= contract.milestones.length) {
      return { success: false, milestone: null, error: 'Milestone index out of range: ' + milestoneIndex };
    }

    contracts[contractIdx].milestones[milestoneIndex].status = status;
    contracts[contractIdx].updatedAt = new Date().toISOString();

    var saved = writeContracts(contracts);
    return {
      success: saved,
      milestone: saved ? contracts[contractIdx].milestones[milestoneIndex] : null,
      error: saved ? null : 'Failed to save to localStorage'
    };
  }

  /**
   * Get all contracts that have at least one non-released milestone.
   * @returns {Array<Object>}
   */
  function getActiveContracts() {
    var contracts = readContracts();
    return contracts.filter(function (c) {
      return c.milestones.some(function (m) {
        return m.status !== 'released';
      });
    });
  }

  /**
   * Get all milestones that are past their due date and not yet released.
   * @returns {Array<{contractId: string, contractTitle: string, client: string, milestoneIndex: number, milestone: Object, daysOverdue: number}>}
   */
  function getOverdueMilestones() {
    var contracts = readContracts();
    var now = new Date();
    var overdue = [];

    for (var i = 0; i < contracts.length; i++) {
      var contract = contracts[i];
      for (var j = 0; j < contract.milestones.length; j++) {
        var m = contract.milestones[j];
        if (m.status === 'released' || !m.dueDate) continue;

        var dueDate = new Date(m.dueDate);
        if (dueDate.getTime() < now.getTime()) {
          var diffMs = now.getTime() - dueDate.getTime();
          var daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          overdue.push({
            contractId: contract.id,
            contractTitle: contract.title,
            client: contract.client,
            milestoneIndex: j,
            milestone: m,
            daysOverdue: daysOverdue
          });
        }
      }
    }

    overdue.sort(function (a, b) { return b.daysOverdue - a.daysOverdue; });
    return overdue;
  }

  /**
   * Get milestones with due dates within the next N days that are not yet released.
   * @param {number} [days=7] - Number of days to look ahead.
   * @returns {Array<{contractId: string, contractTitle: string, client: string, milestoneIndex: number, milestone: Object, daysUntilDue: number}>}
   */
  function getUpcomingPayments(days) {
    var lookAhead = days || 7;
    var contracts = readContracts();
    var now = new Date();
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + lookAhead);

    var upcoming = [];

    for (var i = 0; i < contracts.length; i++) {
      var contract = contracts[i];
      for (var j = 0; j < contract.milestones.length; j++) {
        var m = contract.milestones[j];
        if (m.status === 'released' || !m.dueDate) continue;

        var dueDate = new Date(m.dueDate);
        if (dueDate.getTime() >= now.getTime() && dueDate.getTime() <= cutoff.getTime()) {
          var diffMs = dueDate.getTime() - now.getTime();
          var daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          upcoming.push({
            contractId: contract.id,
            contractTitle: contract.title,
            client: contract.client,
            milestoneIndex: j,
            milestone: m,
            daysUntilDue: daysUntilDue
          });
        }
      }
    }

    upcoming.sort(function (a, b) { return a.daysUntilDue - b.daysUntilDue; });
    return upcoming;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.paymentMilestoneTracker = {
    addContract: addContract,
    updateMilestone: updateMilestone,
    getActiveContracts: getActiveContracts,
    getOverdueMilestones: getOverdueMilestones,
    getUpcomingPayments: getUpcomingPayments
  };
})();
