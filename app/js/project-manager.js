/**
 * CortexProjectManager — Project Management data layer
 * Manage projects with client linking, budgets, time tracking, invoices, and proposals.
 * Statuses: Lead → Active → Completed → Archived
 * All data stored in localStorage.
 *
 * window.CortexProjectManager
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_projects';
  var STATUSES = ['lead', 'active', 'completed', 'archived'];
  var STATUS_TRANSITIONS = {
    lead: ['active', 'archived'],
    active: ['completed', 'archived'],
    completed: ['archived', 'active'],
    archived: ['active']
  };

  /* ── Storage helpers ─────────────────────────────────────── */

  function loadProjects() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveProjects(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  function generateId() {
    return 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function findProject(projects, id) {
    for (var i = 0; i < projects.length; i++) {
      if (projects[i].id === id) return { project: projects[i], index: i };
    }
    return null;
  }

  /* ── CRUD ────────────────────────────────────────────────── */

  /**
   * Create a new project
   * @param {Object} data
   * @param {string} data.name - Project name (required)
   * @param {string} [data.clientId] - Linked client ID (from CortexClientCRM)
   * @param {string} [data.clientName] - Client display name
   * @param {string} [data.status] - lead, active, completed, archived (default: lead)
   * @param {number} [data.budget] - Total budget in USD
   * @param {number} [data.hourlyRate] - Hourly rate in USD
   * @param {string} [data.deadline] - ISO date string
   * @param {string[]} [data.tags] - Freeform tags
   * @param {string} [data.description] - Project description
   * @param {string} [data.currency] - Currency code (default: USD)
   * @returns {Object} The created project record
   */
  function createProject(data) {
    if (!data || !data.name) {
      throw new Error('Project name is required');
    }

    var projects = loadProjects();
    var status = STATUSES.indexOf(data.status) !== -1 ? data.status : 'lead';

    var project = {
      id: generateId(),
      name: data.name,
      clientId: data.clientId || null,
      clientName: data.clientName || '',
      status: status,
      budget: parseFloat(data.budget) || 0,
      hourlyRate: parseFloat(data.hourlyRate) || 0,
      deadline: data.deadline || null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      description: data.description || '',
      currency: data.currency || 'USD',
      timeEntryIds: [],
      invoiceIds: [],
      proposalIds: [],
      totalLogged: 0,
      totalBilled: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    projects.push(project);
    saveProjects(projects);
    return project;
  }

  /**
   * Get a project by ID
   * @param {string} id
   * @returns {Object|null}
   */
  function getProject(id) {
    var projects = loadProjects();
    var found = findProject(projects, id);
    return found ? found.project : null;
  }

  /**
   * List all projects, optionally filtered
   * @param {Object} [filters]
   * @param {string} [filters.status] - Filter by status
   * @param {string} [filters.clientId] - Filter by client
   * @param {string} [filters.tag] - Filter by tag
   * @param {string} [filters.search] - Search name/description
   * @param {string} [filters.sortBy] - deadline, budget, createdAt, name (default: createdAt)
   * @param {string} [filters.sortDir] - asc or desc (default: desc)
   * @returns {Object[]}
   */
  function listProjects(filters) {
    var projects = loadProjects();
    filters = filters || {};

    if (filters.status) {
      projects = projects.filter(function (p) { return p.status === filters.status; });
    }
    if (filters.clientId) {
      projects = projects.filter(function (p) { return p.clientId === filters.clientId; });
    }
    if (filters.tag) {
      projects = projects.filter(function (p) {
        return p.tags && p.tags.indexOf(filters.tag) !== -1;
      });
    }
    if (filters.search) {
      var q = filters.search.toLowerCase();
      projects = projects.filter(function (p) {
        return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
               (p.description || '').toLowerCase().indexOf(q) !== -1 ||
               (p.clientName || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    var sortBy = filters.sortBy || 'createdAt';
    var desc = filters.sortDir !== 'asc';
    projects.sort(function (a, b) {
      var va = a[sortBy] || '';
      var vb = b[sortBy] || '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return desc ? vb - va : va - vb;
      }
      va = String(va);
      vb = String(vb);
      return desc ? vb.localeCompare(va) : va.localeCompare(vb);
    });

    return projects;
  }

  /**
   * Update a project
   * @param {string} id
   * @param {Object} data - Fields to update
   * @returns {Object|null} Updated project or null
   */
  function updateProject(id, data) {
    var projects = loadProjects();
    var found = findProject(projects, id);
    if (!found) return null;

    var project = found.project;
    var updatable = [
      'name', 'clientId', 'clientName', 'budget', 'hourlyRate',
      'deadline', 'tags', 'description', 'currency'
    ];

    updatable.forEach(function (key) {
      if (data[key] !== undefined) {
        if (key === 'budget' || key === 'hourlyRate') {
          project[key] = parseFloat(data[key]) || 0;
        } else {
          project[key] = data[key];
        }
      }
    });

    project.updatedAt = new Date().toISOString();
    saveProjects(projects);
    return project;
  }

  /**
   * Transition project status
   * @param {string} id
   * @param {string} newStatus
   * @returns {Object|null} Updated project or null
   * @throws {Error} If transition is invalid
   */
  function transitionStatus(id, newStatus) {
    var projects = loadProjects();
    var found = findProject(projects, id);
    if (!found) return null;

    var project = found.project;
    var allowed = STATUS_TRANSITIONS[project.status] || [];

    if (allowed.indexOf(newStatus) === -1) {
      throw new Error(
        'Cannot transition from "' + project.status + '" to "' + newStatus +
        '". Allowed: ' + allowed.join(', ')
      );
    }

    project.status = newStatus;
    project.updatedAt = new Date().toISOString();

    if (newStatus === 'completed' && !project.completedAt) {
      project.completedAt = new Date().toISOString();
    }

    saveProjects(projects);
    return project;
  }

  /**
   * Delete a project
   * @param {string} id
   * @returns {boolean}
   */
  function deleteProject(id) {
    var projects = loadProjects();
    var found = findProject(projects, id);
    if (!found) return false;

    projects.splice(found.index, 1);
    saveProjects(projects);
    return true;
  }

  /* ── Linking helpers ─────────────────────────────────────── */

  /**
   * Link a time entry to this project
   * @param {string} projectId
   * @param {string} timeEntryId
   * @param {number} hours - Hours logged
   * @returns {Object|null}
   */
  function linkTimeEntry(projectId, timeEntryId, hours) {
    var projects = loadProjects();
    var found = findProject(projects, projectId);
    if (!found) return null;

    var project = found.project;
    if (project.timeEntryIds.indexOf(timeEntryId) === -1) {
      project.timeEntryIds.push(timeEntryId);
    }
    project.totalLogged += parseFloat(hours) || 0;
    project.updatedAt = new Date().toISOString();
    saveProjects(projects);
    return project;
  }

  /**
   * Link an invoice to this project
   * @param {string} projectId
   * @param {string} invoiceId
   * @param {number} amount - Invoice amount
   * @returns {Object|null}
   */
  function linkInvoice(projectId, invoiceId, amount) {
    var projects = loadProjects();
    var found = findProject(projects, projectId);
    if (!found) return null;

    var project = found.project;
    if (project.invoiceIds.indexOf(invoiceId) === -1) {
      project.invoiceIds.push(invoiceId);
    }
    project.totalBilled += parseFloat(amount) || 0;
    project.updatedAt = new Date().toISOString();
    saveProjects(projects);
    return project;
  }

  /**
   * Link a proposal to this project
   * @param {string} projectId
   * @param {string} proposalId
   * @returns {Object|null}
   */
  function linkProposal(projectId, proposalId) {
    var projects = loadProjects();
    var found = findProject(projects, projectId);
    if (!found) return null;

    var project = found.project;
    if (project.proposalIds.indexOf(proposalId) === -1) {
      project.proposalIds.push(proposalId);
    }
    project.updatedAt = new Date().toISOString();
    saveProjects(projects);
    return project;
  }

  /* ── Analytics ───────────────────────────────────────────── */

  /**
   * Get project stats summary
   * @returns {Object} { total, byStatus, totalBudget, totalBilled, totalLogged, overdue }
   */
  function getStats() {
    var projects = loadProjects();
    var now = new Date().toISOString();
    var stats = {
      total: projects.length,
      byStatus: { lead: 0, active: 0, completed: 0, archived: 0 },
      totalBudget: 0,
      totalBilled: 0,
      totalLogged: 0,
      overdue: 0
    };

    projects.forEach(function (p) {
      stats.byStatus[p.status] = (stats.byStatus[p.status] || 0) + 1;
      if (p.status !== 'archived') {
        stats.totalBudget += p.budget || 0;
        stats.totalBilled += p.totalBilled || 0;
        stats.totalLogged += p.totalLogged || 0;
      }
      if (p.deadline && p.deadline < now && p.status === 'active') {
        stats.overdue++;
      }
    });

    return stats;
  }

  /**
   * Get projects for a specific client
   * @param {string} clientId
   * @returns {Object[]}
   */
  function getProjectsByClient(clientId) {
    return listProjects({ clientId: clientId });
  }

  /**
   * Get budget utilization for a project (billed / budget)
   * @param {string} id
   * @returns {Object|null} { budget, billed, remaining, utilization }
   */
  function getBudgetUtilization(id) {
    var project = getProject(id);
    if (!project) return null;

    var budget = project.budget || 0;
    var billed = project.totalBilled || 0;
    return {
      budget: budget,
      billed: billed,
      remaining: budget - billed,
      utilization: budget > 0 ? Math.round((billed / budget) * 100) : 0
    };
  }

  /* ── Export / Import ─────────────────────────────────────── */

  /**
   * Export all projects as JSON string
   * @returns {string}
   */
  function exportData() {
    return JSON.stringify(loadProjects(), null, 2);
  }

  /**
   * Import projects from JSON string (merges by ID)
   * @param {string} jsonStr
   * @returns {number} Count of imported projects
   */
  function importData(jsonStr) {
    var incoming = JSON.parse(jsonStr);
    if (!Array.isArray(incoming)) throw new Error('Invalid import data');

    var existing = loadProjects();
    var existingIds = {};
    existing.forEach(function (p) { existingIds[p.id] = true; });

    var added = 0;
    incoming.forEach(function (p) {
      if (p.id && !existingIds[p.id]) {
        existing.push(p);
        added++;
      }
    });

    saveProjects(existing);
    return added;
  }

  /* ── Public API ──────────────────────────────────────────── */

  window.CortexProjectManager = {
    STATUSES: STATUSES,
    STATUS_TRANSITIONS: STATUS_TRANSITIONS,
    create: createProject,
    get: getProject,
    list: listProjects,
    update: updateProject,
    delete: deleteProject,
    transitionStatus: transitionStatus,
    linkTimeEntry: linkTimeEntry,
    linkInvoice: linkInvoice,
    linkProposal: linkProposal,
    getStats: getStats,
    getProjectsByClient: getProjectsByClient,
    getBudgetUtilization: getBudgetUtilization,
    exportData: exportData,
    importData: importData
  };
})();
