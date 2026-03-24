/**
 * CortexClientCRM — Client Relationship Management data layer
 * Manage client records with notes, tags, follow-ups, and communication history.
 * All data stored in localStorage.
 *
 * window.CortexClientCRM
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_client_crm';
  var VALID_TAGS = ['hot', 'warm', 'cold', 'lost'];

  /* ── Storage helpers ─────────────────────────────────────── */

  function loadClients() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveClients(clients) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  }

  function generateId() {
    return 'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function findClient(clients, id) {
    for (var i = 0; i < clients.length; i++) {
      if (clients[i].id === id) return { client: clients[i], index: i };
    }
    return null;
  }

  /* ── CRUD ────────────────────────────────────────────────── */

  /**
   * Add a new client to the CRM
   * @param {Object} data - Client data
   * @param {string} data.name - Client name (required)
   * @param {string} [data.company] - Company name
   * @param {string} [data.email] - Email address
   * @param {string} [data.platform] - Platform (upwork, direct, etc.)
   * @param {string} [data.tag] - Tag: hot, warm, cold, lost
   * @param {string} [data.followUpDate] - ISO date string for follow-up
   * @param {string} [data.source] - How you found them
   * @returns {Object} The created client record
   */
  function addClient(data) {
    if (!data || !data.name) {
      throw new Error('Client name is required');
    }

    var clients = loadClients();
    var client = {
      id: generateId(),
      name: data.name,
      company: data.company || '',
      email: data.email || '',
      platform: data.platform || '',
      tag: VALID_TAGS.indexOf(data.tag) !== -1 ? data.tag : 'warm',
      followUpDate: data.followUpDate || null,
      source: data.source || '',
      notes: [],
      communications: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    clients.push(client);
    saveClients(clients);
    return client;
  }

  /**
   * Update an existing client
   * @param {string} id - Client ID
   * @param {Object} data - Fields to update
   * @returns {Object|null} Updated client or null if not found
   */
  function updateClient(id, data) {
    var clients = loadClients();
    var found = findClient(clients, id);
    if (!found) return null;

    var client = found.client;
    var updatable = ['name', 'company', 'email', 'platform', 'source', 'followUpDate'];

    updatable.forEach(function (key) {
      if (data[key] !== undefined) {
        client[key] = data[key];
      }
    });

    if (data.tag !== undefined) {
      if (VALID_TAGS.indexOf(data.tag) !== -1) {
        client.tag = data.tag;
      }
    }

    client.updatedAt = new Date().toISOString();
    saveClients(clients);
    return client;
  }

  /**
   * Delete a client by ID
   * @param {string} id - Client ID
   * @returns {boolean} True if deleted
   */
  function deleteClient(id) {
    var clients = loadClients();
    var len = clients.length;
    clients = clients.filter(function (c) { return c.id !== id; });
    if (clients.length < len) {
      saveClients(clients);
      return true;
    }
    return false;
  }

  /**
   * Get clients with optional filters
   * @param {Object} [filters] - Filter criteria
   * @param {string} [filters.tag] - Filter by tag
   * @param {string} [filters.search] - Search name/company (partial match)
   * @param {string} [filters.platform] - Filter by platform
   * @param {boolean} [filters.hasFollowUp] - Only clients with follow-up dates
   * @returns {Object[]} Array of matching clients, sorted by updatedAt desc
   */
  function getClients(filters) {
    var clients = loadClients();

    if (filters) {
      clients = clients.filter(function (c) {
        if (filters.tag && c.tag !== filters.tag) return false;
        if (filters.platform && c.platform !== filters.platform) return false;
        if (filters.hasFollowUp && !c.followUpDate) return false;
        if (filters.search) {
          var q = filters.search.toLowerCase();
          var match = (c.name || '').toLowerCase().indexOf(q) !== -1 ||
            (c.company || '').toLowerCase().indexOf(q) !== -1 ||
            (c.email || '').toLowerCase().indexOf(q) !== -1;
          if (!match) return false;
        }
        return true;
      });
    }

    clients.sort(function (a, b) {
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return clients;
  }

  /* ── Notes ───────────────────────────────────────────────── */

  /**
   * Add a note to a client
   * @param {string} clientId - Client ID
   * @param {string} note - Note text
   * @returns {Object|null} The note object or null if client not found
   */
  function addNote(clientId, note) {
    if (!note || !note.trim()) throw new Error('Note text is required');

    var clients = loadClients();
    var found = findClient(clients, clientId);
    if (!found) return null;

    var noteObj = {
      id: 'note_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
      text: note.trim(),
      createdAt: new Date().toISOString()
    };

    found.client.notes.push(noteObj);
    found.client.updatedAt = new Date().toISOString();
    saveClients(clients);
    return noteObj;
  }

  /**
   * Delete a note from a client
   * @param {string} clientId - Client ID
   * @param {string} noteId - Note ID
   * @returns {boolean} True if deleted
   */
  function deleteNote(clientId, noteId) {
    var clients = loadClients();
    var found = findClient(clients, clientId);
    if (!found) return false;

    var len = found.client.notes.length;
    found.client.notes = found.client.notes.filter(function (n) { return n.id !== noteId; });
    if (found.client.notes.length < len) {
      found.client.updatedAt = new Date().toISOString();
      saveClients(clients);
      return true;
    }
    return false;
  }

  /* ── Communication History ───────────────────────────────── */

  /**
   * Log a communication with a client
   * @param {string} clientId - Client ID
   * @param {Object} entry - Communication entry
   * @param {string} entry.type - Type: email, call, message, meeting
   * @param {string} entry.summary - Brief summary
   * @param {string} [entry.direction] - inbound or outbound
   * @returns {Object|null} The communication entry or null if client not found
   */
  function addCommunication(clientId, entry) {
    if (!entry || !entry.type || !entry.summary) {
      throw new Error('Communication type and summary are required');
    }

    var clients = loadClients();
    var found = findClient(clients, clientId);
    if (!found) return null;

    var comm = {
      id: 'comm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
      type: entry.type,
      summary: entry.summary,
      direction: entry.direction || 'outbound',
      date: new Date().toISOString()
    };

    found.client.communications.push(comm);
    found.client.updatedAt = new Date().toISOString();
    saveClients(clients);
    return comm;
  }

  /* ── Follow-ups ──────────────────────────────────────────── */

  /**
   * Get clients with upcoming follow-up dates (today and future)
   * @param {number} [daysAhead=7] - Number of days to look ahead
   * @returns {Object[]} Clients with follow-ups, sorted by follow-up date asc
   */
  function getUpcomingFollowups(daysAhead) {
    if (daysAhead === undefined) daysAhead = 7;

    var now = new Date();
    var todayStr = now.toISOString().slice(0, 10);
    var futureDate = new Date(now.getTime() + daysAhead * 86400000);
    var futureStr = futureDate.toISOString().slice(0, 10);

    var clients = loadClients();

    var upcoming = clients.filter(function (c) {
      if (!c.followUpDate) return false;
      var fd = c.followUpDate.slice(0, 10);
      return fd >= todayStr && fd <= futureStr;
    });

    upcoming.sort(function (a, b) {
      return a.followUpDate.localeCompare(b.followUpDate);
    });

    return upcoming;
  }

  /**
   * Get overdue follow-ups (follow-up date is in the past)
   * @returns {Object[]} Clients with overdue follow-ups
   */
  function getOverdueFollowups() {
    var todayStr = new Date().toISOString().slice(0, 10);
    var clients = loadClients();

    return clients.filter(function (c) {
      if (!c.followUpDate) return false;
      return c.followUpDate.slice(0, 10) < todayStr;
    }).sort(function (a, b) {
      return a.followUpDate.localeCompare(b.followUpDate);
    });
  }

  /* ── Public API ──────────────────────────────────────────── */

  window.CortexClientCRM = {
    addClient: addClient,
    updateClient: updateClient,
    deleteClient: deleteClient,
    getClients: getClients,
    addNote: addNote,
    deleteNote: deleteNote,
    addCommunication: addCommunication,
    getUpcomingFollowups: getUpcomingFollowups,
    getOverdueFollowups: getOverdueFollowups,
    VALID_TAGS: VALID_TAGS
  };

})();
