/**
 * CortexProjectTemplates — Reusable Project Template System
 * [cf3-010] Save project setups as reusable templates with milestones,
 * default rates, typical timelines, and standard deliverables.
 * Quick-start new projects from templates.
 *
 * Built-in templates:
 *   - Web Development Project
 *   - Logo Design
 *   - Mobile App Development
 *   - Brand Identity Package
 *   - Content Strategy
 *   - SEO Audit & Optimization
 *
 * Depends on: CortexProjectManager (project-manager.js)
 * window.CortexProjectTemplates
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_project_templates';

  /* ── Built-in Templates ──────────────────────────────────── */

  var BUILT_IN = [
    {
      id: 'tpl_web_dev',
      name: 'Web Development Project',
      category: 'development',
      description: 'Full website build from design to launch with QA and deployment phases.',
      defaultRate: 85,
      estimatedWeeks: 8,
      estimatedBudget: 8000,
      tags: ['web', 'development', 'frontend'],
      milestones: [
        { name: 'Discovery & Planning', weekOffset: 0, durationWeeks: 1, deliverables: ['Project brief', 'Sitemap', 'Technical requirements'], estimatedHours: 12 },
        { name: 'UI/UX Design', weekOffset: 1, durationWeeks: 2, deliverables: ['Wireframes', 'Design mockups', 'Style guide'], estimatedHours: 24 },
        { name: 'Frontend Development', weekOffset: 3, durationWeeks: 2, deliverables: ['Responsive pages', 'Interactive components', 'CMS integration'], estimatedHours: 32 },
        { name: 'Backend Development', weekOffset: 3, durationWeeks: 2, deliverables: ['API endpoints', 'Database setup', 'Authentication'], estimatedHours: 28 },
        { name: 'QA & Testing', weekOffset: 5, durationWeeks: 1, deliverables: ['Cross-browser testing', 'Performance audit', 'Bug fixes'], estimatedHours: 16 },
        { name: 'Launch & Handoff', weekOffset: 6, durationWeeks: 1, deliverables: ['Deployment', 'Documentation', 'Training session'], estimatedHours: 10 }
      ],
      builtIn: true
    },
    {
      id: 'tpl_logo_design',
      name: 'Logo Design',
      category: 'design',
      description: 'Professional logo creation from concept exploration to final deliverables.',
      defaultRate: 75,
      estimatedWeeks: 3,
      estimatedBudget: 1500,
      tags: ['design', 'branding', 'logo'],
      milestones: [
        { name: 'Creative Brief & Research', weekOffset: 0, durationWeeks: 0.5, deliverables: ['Brand questionnaire', 'Competitor analysis', 'Mood board'], estimatedHours: 6 },
        { name: 'Concept Development', weekOffset: 0.5, durationWeeks: 1, deliverables: ['3-5 logo concepts', 'Rationale document'], estimatedHours: 12 },
        { name: 'Revision Rounds', weekOffset: 1.5, durationWeeks: 1, deliverables: ['2 revision rounds', 'Color variations', 'Typography refinement'], estimatedHours: 8 },
        { name: 'Final Delivery', weekOffset: 2.5, durationWeeks: 0.5, deliverables: ['Vector files (AI/SVG/EPS)', 'PNG/JPG exports', 'Brand usage guidelines'], estimatedHours: 4 }
      ],
      builtIn: true
    },
    {
      id: 'tpl_mobile_app',
      name: 'Mobile App Development',
      category: 'development',
      description: 'Native or cross-platform mobile app from prototype to app store submission.',
      defaultRate: 100,
      estimatedWeeks: 12,
      estimatedBudget: 15000,
      tags: ['mobile', 'app', 'development'],
      milestones: [
        { name: 'Requirements & Prototyping', weekOffset: 0, durationWeeks: 2, deliverables: ['Feature spec', 'User flows', 'Interactive prototype'], estimatedHours: 24 },
        { name: 'UI Design', weekOffset: 2, durationWeeks: 2, deliverables: ['Screen designs', 'Component library', 'Design system'], estimatedHours: 28 },
        { name: 'Core Development', weekOffset: 4, durationWeeks: 4, deliverables: ['Core features', 'API integration', 'Local storage'], estimatedHours: 60 },
        { name: 'Testing & QA', weekOffset: 8, durationWeeks: 2, deliverables: ['Unit tests', 'Device testing', 'Performance optimization'], estimatedHours: 24 },
        { name: 'Beta & Launch', weekOffset: 10, durationWeeks: 2, deliverables: ['Beta release', 'App store submission', 'Launch support'], estimatedHours: 16 }
      ],
      builtIn: true
    },
    {
      id: 'tpl_brand_identity',
      name: 'Brand Identity Package',
      category: 'design',
      description: 'Complete brand identity system including logo, colors, typography, and collateral.',
      defaultRate: 90,
      estimatedWeeks: 6,
      estimatedBudget: 5000,
      tags: ['branding', 'design', 'identity'],
      milestones: [
        { name: 'Brand Discovery', weekOffset: 0, durationWeeks: 1, deliverables: ['Brand audit', 'Target audience profile', 'Positioning strategy'], estimatedHours: 14 },
        { name: 'Visual Identity', weekOffset: 1, durationWeeks: 2, deliverables: ['Logo system', 'Color palette', 'Typography selection'], estimatedHours: 24 },
        { name: 'Collateral Design', weekOffset: 3, durationWeeks: 2, deliverables: ['Business cards', 'Letterhead', 'Social media templates'], estimatedHours: 18 },
        { name: 'Brand Guide & Handoff', weekOffset: 5, durationWeeks: 1, deliverables: ['Brand guidelines PDF', 'Asset package', 'Usage examples'], estimatedHours: 10 }
      ],
      builtIn: true
    },
    {
      id: 'tpl_content_strategy',
      name: 'Content Strategy',
      category: 'marketing',
      description: 'Content audit, strategy development, and editorial calendar creation.',
      defaultRate: 70,
      estimatedWeeks: 4,
      estimatedBudget: 3000,
      tags: ['content', 'marketing', 'strategy'],
      milestones: [
        { name: 'Content Audit', weekOffset: 0, durationWeeks: 1, deliverables: ['Existing content inventory', 'Performance analysis', 'Gap identification'], estimatedHours: 12 },
        { name: 'Strategy Development', weekOffset: 1, durationWeeks: 1.5, deliverables: ['Content pillars', 'Audience personas', 'Channel strategy'], estimatedHours: 16 },
        { name: 'Editorial Calendar', weekOffset: 2.5, durationWeeks: 1, deliverables: ['3-month calendar', 'Content briefs', 'Workflow templates'], estimatedHours: 10 },
        { name: 'Implementation Guide', weekOffset: 3.5, durationWeeks: 0.5, deliverables: ['SOPs document', 'Tool recommendations', 'KPI dashboard setup'], estimatedHours: 6 }
      ],
      builtIn: true
    },
    {
      id: 'tpl_seo_audit',
      name: 'SEO Audit & Optimization',
      category: 'marketing',
      description: 'Technical SEO audit with actionable recommendations and implementation support.',
      defaultRate: 80,
      estimatedWeeks: 3,
      estimatedBudget: 2500,
      tags: ['seo', 'marketing', 'audit'],
      milestones: [
        { name: 'Technical Audit', weekOffset: 0, durationWeeks: 1, deliverables: ['Site crawl report', 'Speed analysis', 'Schema markup review'], estimatedHours: 14 },
        { name: 'Content & Keyword Analysis', weekOffset: 1, durationWeeks: 1, deliverables: ['Keyword research', 'Content gap analysis', 'Competitor benchmarks'], estimatedHours: 12 },
        { name: 'Recommendations & Implementation', weekOffset: 2, durationWeeks: 1, deliverables: ['Priority action plan', 'On-page fixes', 'Monitoring setup'], estimatedHours: 10 }
      ],
      builtIn: true
    }
  ];

  /* ── Storage ─────────────────────────────────────────────── */

  function loadCustomTemplates() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomTemplates(templates) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }

  function generateId() {
    return 'tpl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  /* ── Template CRUD ───────────────────────────────────────── */

  /**
   * List all templates (built-in + custom)
   * @param {Object} [filters]
   * @param {string} [filters.category] - Filter by category
   * @param {string} [filters.search] - Search by name/description
   * @returns {Object[]}
   */
  function listTemplates(filters) {
    var all = BUILT_IN.concat(loadCustomTemplates());
    filters = filters || {};

    if (filters.category) {
      all = all.filter(function (t) { return t.category === filters.category; });
    }
    if (filters.search) {
      var q = filters.search.toLowerCase();
      all = all.filter(function (t) {
        return (t.name || '').toLowerCase().indexOf(q) !== -1 ||
               (t.description || '').toLowerCase().indexOf(q) !== -1 ||
               (t.tags || []).join(' ').toLowerCase().indexOf(q) !== -1;
      });
    }

    return all;
  }

  /**
   * Get a single template by ID
   * @param {string} id
   * @returns {Object|null}
   */
  function getTemplate(id) {
    var all = BUILT_IN.concat(loadCustomTemplates());
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null;
  }

  /**
   * Save a custom template
   * @param {Object} data
   * @param {string} data.name - Template name (required)
   * @param {string} [data.category]
   * @param {string} [data.description]
   * @param {number} [data.defaultRate]
   * @param {number} [data.estimatedWeeks]
   * @param {number} [data.estimatedBudget]
   * @param {string[]} [data.tags]
   * @param {Object[]} [data.milestones]
   * @returns {Object} The saved template
   */
  function saveTemplate(data) {
    if (!data || !data.name) throw new Error('Template name is required');

    var templates = loadCustomTemplates();
    var template = {
      id: data.id || generateId(),
      name: data.name,
      category: data.category || 'custom',
      description: data.description || '',
      defaultRate: parseFloat(data.defaultRate) || 0,
      estimatedWeeks: parseFloat(data.estimatedWeeks) || 0,
      estimatedBudget: parseFloat(data.estimatedBudget) || 0,
      tags: Array.isArray(data.tags) ? data.tags : [],
      milestones: Array.isArray(data.milestones) ? data.milestones : [],
      builtIn: false,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Update existing or add new
    var found = false;
    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === template.id) {
        templates[i] = template;
        found = true;
        break;
      }
    }
    if (!found) templates.push(template);

    saveCustomTemplates(templates);
    return template;
  }

  /**
   * Create a custom template from an existing project
   * @param {string} projectId - Project to base template on
   * @param {string} templateName - Name for the new template
   * @returns {Object|null} The saved template or null
   */
  function createFromProject(projectId, templateName) {
    var PM = window.CortexProjectManager;
    if (!PM) return null;

    var project = PM.get(projectId);
    if (!project) return null;

    return saveTemplate({
      name: templateName || project.name + ' Template',
      category: 'custom',
      description: 'Created from project: ' + project.name,
      defaultRate: project.hourlyRate || 0,
      estimatedBudget: project.budget || 0,
      tags: project.tags || [],
      milestones: [] // User can add milestones manually
    });
  }

  /**
   * Delete a custom template (cannot delete built-in)
   * @param {string} id
   * @returns {boolean}
   */
  function deleteTemplate(id) {
    // Prevent deleting built-in
    for (var i = 0; i < BUILT_IN.length; i++) {
      if (BUILT_IN[i].id === id) return false;
    }

    var templates = loadCustomTemplates();
    var newList = templates.filter(function (t) { return t.id !== id; });
    if (newList.length === templates.length) return false;

    saveCustomTemplates(newList);
    return true;
  }

  /* ── Apply Template → Create Project ─────────────────────── */

  /**
   * Apply a template to create a new project via CortexProjectManager
   * @param {string} templateId
   * @param {Object} [overrides] - Override template defaults
   * @param {string} [overrides.name] - Custom project name
   * @param {string} [overrides.clientId]
   * @param {string} [overrides.clientName]
   * @param {string} [overrides.startDate] - ISO date, defaults to today
   * @returns {Object|null} The created project or null
   */
  function applyTemplate(templateId, overrides) {
    var PM = window.CortexProjectManager;
    if (!PM) return null;

    var tpl = getTemplate(templateId);
    if (!tpl) return null;

    overrides = overrides || {};
    var startDate = overrides.startDate ? new Date(overrides.startDate) : new Date();

    // Calculate deadline from estimated weeks
    var deadline = null;
    if (tpl.estimatedWeeks) {
      deadline = new Date(startDate);
      deadline.setDate(deadline.getDate() + Math.ceil(tpl.estimatedWeeks * 7));
    }

    var project = PM.create({
      name: overrides.name || tpl.name,
      clientId: overrides.clientId || null,
      clientName: overrides.clientName || '',
      status: 'lead',
      budget: overrides.budget != null ? overrides.budget : (tpl.estimatedBudget || 0),
      hourlyRate: overrides.hourlyRate != null ? overrides.hourlyRate : (tpl.defaultRate || 0),
      deadline: deadline ? deadline.toISOString() : null,
      tags: (overrides.tags || tpl.tags || []).slice(),
      description: overrides.description || tpl.description || ''
    });

    // If CortexProjectTimeline is available, create milestones
    if (window.CortexProjectTimeline && tpl.milestones && tpl.milestones.length > 0) {
      try {
        var tlProject = window.CortexProjectTimeline.createProject({
          name: project.name,
          client: overrides.clientName || '',
          startDate: toDateStr(startDate),
          endDate: deadline ? toDateStr(deadline) : null,
          budget: project.budget,
          status: 'active'
        });

        if (tlProject) {
          tpl.milestones.forEach(function (m) {
            var mStart = new Date(startDate);
            mStart.setDate(mStart.getDate() + Math.round((m.weekOffset || 0) * 7));

            var mEnd = new Date(mStart);
            mEnd.setDate(mEnd.getDate() + Math.round((m.durationWeeks || 1) * 7));

            window.CortexProjectTimeline.addMilestone(tlProject.id, {
              name: m.name,
              startDate: toDateStr(mStart),
              dueDate: toDateStr(mEnd),
              estimatedHours: m.estimatedHours || 0,
              deliverables: (m.deliverables || []).join(', '),
              status: 'not_started',
              progress: 0
            });
          });
        }
      } catch (e) {
        // Timeline integration optional — project still created
      }
    }

    return project;
  }

  /* ── Categories ──────────────────────────────────────────── */

  var CATEGORIES = {
    development: { label: 'Development', icon: '💻' },
    design: { label: 'Design', icon: '🎨' },
    marketing: { label: 'Marketing', icon: '📢' },
    consulting: { label: 'Consulting', icon: '💼' },
    writing: { label: 'Writing', icon: '✍️' },
    custom: { label: 'Custom', icon: '⭐' }
  };

  function getCategories() {
    return CATEGORIES;
  }

  /* ── Helpers ─────────────────────────────────────────────── */

  function toDateStr(date) {
    var d = new Date(date);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /* ── Public API ──────────────────────────────────────────── */

  window.CortexProjectTemplates = {
    CATEGORIES: CATEGORIES,
    list: listTemplates,
    get: getTemplate,
    save: saveTemplate,
    delete: deleteTemplate,
    apply: applyTemplate,
    createFromProject: createFromProject,
    getCategories: getCategories
  };
})();
