/**
 * [CF-039] Client Communication Tracker
 * Track communication history per client with response time analytics.
 * All data stored in localStorage. Integrates with CortexClientCRM.
 *
 * window.CortexFreelancer.ClientCommunication
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_client_comms';
  var VALID_TYPES = ['message', 'email', 'call', 'meeting', 'proposal', 'milestone', 'other'];
  var VALID_DIRECTIONS = ['outbound', 'inbound'];

  /* ── Storage ───────────────────────────────────────────── */

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function generateId() {
    return 'comm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /* ── CRUD ──────────────────────────────────────────────── */

  /**
   * Log a communication event with a client.
   * @param {string} clientId - Client identifier (CRM ID or name)
   * @param {Object} entry - Communication details
   * @param {string} entry.type - Type: message, email, call, meeting, proposal, milestone, other
   * @param {string} entry.direction - Direction: outbound or inbound
   * @param {string} entry.summary - Brief description
   * @param {string} [entry.channel] - Platform/channel (upwork, email, slack, etc.)
   * @param {string} [entry.date] - ISO date string (defaults to now)
   * @returns {Object} The created communication record
   */
  function logCommunication(clientId, entry) {
    if (!clientId) throw new Error('clientId is required');
    if (!entry || !entry.type || !entry.summary) {
      throw new Error('type and summary are required');
    }
    if (VALID_TYPES.indexOf(entry.type) === -1) {
      throw new Error('Invalid type. Must be one of: ' + VALID_TYPES.join(', '));
    }

    var data = loadAll();
    if (!data[clientId]) data[clientId] = [];

    var record = {
      id: generateId(),
      type: entry.type,
      direction: VALID_DIRECTIONS.indexOf(entry.direction) !== -1 ? entry.direction : 'outbound',
      summary: entry.summary,
      channel: entry.channel || '',
      date: entry.date || new Date().toISOString()
    };

    data[clientId].push(record);
    saveAll(data);

    // Also sync to CRM if available
    if (window.CortexClientCRM && typeof window.CortexClientCRM.addCommunication === 'function') {
      try {
        window.CortexClientCRM.addCommunication(clientId, {
          type: record.type,
          summary: record.summary,
          direction: record.direction
        });
      } catch (e) { /* CRM sync is best-effort */ }
    }

    return record;
  }

  /**
   * Get all communications for a client.
   * @param {string} clientId - Client identifier
   * @param {Object} [filters] - Optional filters
   * @param {string} [filters.type] - Filter by type
   * @param {string} [filters.direction] - Filter by direction
   * @param {string} [filters.dateFrom] - ISO date, inclusive
   * @param {string} [filters.dateTo] - ISO date, inclusive
   * @returns {Object[]} Communications sorted by date desc
   */
  function getCommunications(clientId, filters) {
    var data = loadAll();
    var comms = data[clientId] || [];

    if (filters) {
      comms = comms.filter(function (c) {
        if (filters.type && c.type !== filters.type) return false;
        if (filters.direction && c.direction !== filters.direction) return false;
        if (filters.dateFrom && c.date < filters.dateFrom) return false;
        if (filters.dateTo && c.date > filters.dateTo) return false;
        return true;
      });
    }

    comms.sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });

    return comms;
  }

  /**
   * Delete a communication record.
   * @param {string} clientId - Client identifier
   * @param {string} commId - Communication record ID
   * @returns {boolean} True if deleted
   */
  function deleteCommunication(clientId, commId) {
    var data = loadAll();
    if (!data[clientId]) return false;

    var len = data[clientId].length;
    data[clientId] = data[clientId].filter(function (c) { return c.id !== commId; });

    if (data[clientId].length < len) {
      saveAll(data);
      return true;
    }
    return false;
  }

  /* ── Response Time Analytics ───────────────────────────── */

  /**
   * Analyze response times for a specific client.
   * Pairs outbound→inbound messages to calculate response delays.
   * @param {string} clientId - Client identifier
   * @returns {Object} Response time analytics
   */
  function getResponseTimeAnalytics(clientId) {
    var comms = getCommunications(clientId);
    if (comms.length === 0) {
      return { avgResponseHours: null, medianResponseHours: null, responsePairs: 0, totalComms: 0 };
    }

    // Sort chronologically for pairing
    var sorted = comms.slice().sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });

    var responseTimes = [];
    var lastOutbound = null;

    for (var i = 0; i < sorted.length; i++) {
      var c = sorted[i];
      if (c.direction === 'outbound') {
        lastOutbound = c;
      } else if (c.direction === 'inbound' && lastOutbound) {
        var diff = new Date(c.date) - new Date(lastOutbound.date);
        if (diff > 0) {
          responseTimes.push(diff / 3600000); // hours
        }
        lastOutbound = null;
      }
    }

    var avgHours = null;
    var medianHours = null;
    var fastestHours = null;
    var slowestHours = null;

    if (responseTimes.length > 0) {
      var sum = 0;
      for (var j = 0; j < responseTimes.length; j++) sum += responseTimes[j];
      avgHours = Math.round(sum / responseTimes.length * 10) / 10;

      var sortedTimes = responseTimes.slice().sort(function (a, b) { return a - b; });
      var mid = Math.floor(sortedTimes.length / 2);
      medianHours = sortedTimes.length % 2 === 0
        ? Math.round((sortedTimes[mid - 1] + sortedTimes[mid]) / 2 * 10) / 10
        : Math.round(sortedTimes[mid] * 10) / 10;

      fastestHours = Math.round(sortedTimes[0] * 10) / 10;
      slowestHours = Math.round(sortedTimes[sortedTimes.length - 1] * 10) / 10;
    }

    // Responsiveness rating
    var rating;
    if (avgHours === null) rating = 'unknown';
    else if (avgHours <= 2) rating = 'excellent';
    else if (avgHours <= 8) rating = 'good';
    else if (avgHours <= 24) rating = 'average';
    else if (avgHours <= 72) rating = 'slow';
    else rating = 'very-slow';

    return {
      avgResponseHours: avgHours,
      medianResponseHours: medianHours,
      fastestResponseHours: fastestHours,
      slowestResponseHours: slowestHours,
      responsePairs: responseTimes.length,
      totalComms: sorted.length,
      outboundCount: sorted.filter(function (c) { return c.direction === 'outbound'; }).length,
      inboundCount: sorted.filter(function (c) { return c.direction === 'inbound'; }).length,
      rating: rating
    };
  }

  /**
   * Get communication analytics across all clients.
   * @returns {Object} Aggregated analytics
   */
  function getOverallAnalytics() {
    var data = loadAll();
    var clientIds = Object.keys(data);
    var totalComms = 0;
    var allResponseTimes = [];
    var clientStats = [];

    for (var i = 0; i < clientIds.length; i++) {
      var clientId = clientIds[i];
      var comms = data[clientId] || [];
      totalComms += comms.length;

      var analytics = getResponseTimeAnalytics(clientId);
      if (analytics.avgResponseHours !== null) {
        allResponseTimes.push(analytics.avgResponseHours);
      }

      clientStats.push({
        clientId: clientId,
        totalComms: comms.length,
        avgResponseHours: analytics.avgResponseHours,
        rating: analytics.rating
      });
    }

    // Sort clients by communication count desc
    clientStats.sort(function (a, b) { return b.totalComms - a.totalComms; });

    var overallAvg = null;
    if (allResponseTimes.length > 0) {
      var sum = 0;
      for (var j = 0; j < allResponseTimes.length; j++) sum += allResponseTimes[j];
      overallAvg = Math.round(sum / allResponseTimes.length * 10) / 10;
    }

    // Communication volume by type
    var typeBreakdown = {};
    for (var k = 0; k < clientIds.length; k++) {
      var entries = data[clientIds[k]] || [];
      for (var l = 0; l < entries.length; l++) {
        var t = entries[l].type || 'other';
        typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
      }
    }

    return {
      totalClients: clientIds.length,
      totalCommunications: totalComms,
      overallAvgResponseHours: overallAvg,
      typeBreakdown: typeBreakdown,
      clientStats: clientStats
    };
  }

  /**
   * Get the last communication date with a client.
   * @param {string} clientId - Client identifier
   * @returns {string|null} ISO date string or null
   */
  function getLastContactDate(clientId) {
    var comms = getCommunications(clientId);
    return comms.length > 0 ? comms[0].date : null;
  }

  /**
   * Get clients with no communication in the last N days.
   * @param {number} [days=14] - Inactivity threshold in days
   * @returns {Object[]} Array of { clientId, lastContact, daysSilent }
   */
  function getSilentClients(days) {
    if (days === undefined) days = 14;
    var data = loadAll();
    var clientIds = Object.keys(data);
    var threshold = Date.now() - days * 86400000;
    var silent = [];

    for (var i = 0; i < clientIds.length; i++) {
      var comms = data[clientIds[i]] || [];
      if (comms.length === 0) continue;

      var latest = comms.reduce(function (max, c) {
        return c.date > max ? c.date : max;
      }, '');

      if (new Date(latest).getTime() < threshold) {
        silent.push({
          clientId: clientIds[i],
          lastContact: latest,
          daysSilent: Math.floor((Date.now() - new Date(latest).getTime()) / 86400000)
        });
      }
    }

    silent.sort(function (a, b) { return b.daysSilent - a.daysSilent; });
    return silent;
  }

  /* ── Public API ────────────────────────────────────────── */

  window.CortexFreelancer.ClientCommunication = {
    logCommunication: logCommunication,
    getCommunications: getCommunications,
    deleteCommunication: deleteCommunication,
    getResponseTimeAnalytics: getResponseTimeAnalytics,
    getOverallAnalytics: getOverallAnalytics,
    getLastContactDate: getLastContactDate,
    getSilentClients: getSilentClients,
    VALID_TYPES: VALID_TYPES,
    VALID_DIRECTIONS: VALID_DIRECTIONS
  };

})();
