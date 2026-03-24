/**
 * [CF-041] Bulk Proposal Generator — Batch Apply to Similar Jobs
 * Select multiple jobs from a list and generate customized proposals
 * for each using templates from CF-032 (ProposalTemplates). Supports
 * job selection UI, template selection, variable filling, batch
 * generation with progress indicator, and export capabilities.
 *
 * Integration with CF-037 (ProposalKeywordInjector): when available,
 * each generated proposal is analyzed for keyword match against the
 * job description, and an optional auto-enrich step injects missing
 * keywords automatically. Batch stats summary and CSV export included.
 *
 * @namespace window.CortexFreelancer.BulkProposal
 * @version 1.1.0
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_bulk_proposals';
  var CSS_INJECTED = false;

  var _initialized = false;
  var _jobs = [];
  var _selectedJobIds = [];
  var _batchHistory = [];
  var _container = null;
  var _categoryFilter = 'All';

  // ─── Demo Jobs ───────────────────────────────────────────────────

  var DEMO_JOBS = [
    { id: 'demo-001', title: 'React Dashboard for SaaS Platform', category: 'web-development', client: 'TechVentures Inc.', budget: '$3,000-$5,000', description: 'Build a real-time analytics dashboard using React, TypeScript, and D3.js. Must include user authentication, role-based access, and responsive design.' },
    { id: 'demo-002', title: 'Mobile App UI/UX Redesign', category: 'design', client: 'AppFlow Studio', budget: '$2,000-$4,000', description: 'Redesign the UI/UX for our iOS and Android fitness app. Deliverables include wireframes, high-fidelity mockups in Figma, and a component library.' },
    { id: 'demo-003', title: 'SEO Blog Content — 20 Articles', category: 'writing', client: 'GrowthPulse Media', budget: '$1,500-$2,500', description: 'Write 20 SEO-optimized blog articles (1,500-2,000 words each) for a B2B SaaS company. Topics provided. Must include keyword research and meta descriptions.' },
    { id: 'demo-004', title: 'Product Data Entry — 5,000 SKUs', category: 'data-entry', client: 'ShopMatrix Ltd.', budget: '$800-$1,200', description: 'Enter product data for 5,000 SKUs into our Shopify store. Data includes titles, descriptions, images, pricing, and variant attributes from supplier spreadsheets.' },
    { id: 'demo-005', title: 'Facebook & Google Ads Campaign', category: 'marketing', client: 'LaunchPad Digital', budget: '$2,500-$4,000', description: 'Plan and execute a 3-month paid advertising campaign across Facebook and Google Ads. Target audience: US-based SaaS decision makers. Budget management and weekly reporting required.' },
    { id: 'demo-006', title: 'Business Process Optimization', category: 'consulting', client: 'Meridian Corp.', budget: '$5,000-$8,000', description: 'Audit and optimize our order fulfillment workflow. Identify bottlenecks, recommend automation tools, and deliver an implementation roadmap with projected ROI.' },
    { id: 'demo-007', title: 'Cross-Platform Fitness App (Flutter)', category: 'mobile-development', client: 'FitTrack Labs', budget: '$8,000-$12,000', description: 'Build a cross-platform fitness tracking app using Flutter. Features: workout logging, progress charts, social sharing, push notifications, and Apple Health/Google Fit integration.' },
    { id: 'demo-008', title: 'AWS Infrastructure & CI/CD Pipeline', category: 'devops', client: 'CloudNine Systems', budget: '$4,000-$6,000', description: 'Set up AWS infrastructure with Terraform, configure CI/CD pipeline using GitHub Actions, implement Docker containerization, and establish monitoring with CloudWatch and Datadog.' },
    { id: 'demo-009', title: 'E2E Test Automation Suite (Cypress)', category: 'qa-testing', client: 'QualityFirst Software', budget: '$3,000-$5,000', description: 'Build a comprehensive end-to-end test automation suite using Cypress for our web application. Cover critical user flows, integrate with CI/CD, and document test cases.' },
    { id: 'demo-010', title: 'Agile Project Management — 6 Month Engagement', category: 'project-management', client: 'Nexus Innovations', budget: '$6,000-$10,000', description: 'Lead agile project management for a 12-person cross-functional team building a marketplace platform. Includes sprint planning, daily standups, stakeholder communication, and risk management.' }
  ];

  // ─── Helpers ─────────────────────────────────────────────────────

  /**
   * Generate a unique identifier for batch entries.
   * @returns {string} Unique ID string.
   */
  function _genId() {
    return 'bp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  /**
   * Deep clone an object via JSON serialization.
   * @param {*} obj - Object to clone.
   * @returns {*} Cloned object.
   */
  function _deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }

  /**
   * Escape HTML entities for safe rendering.
   * @param {string} str - Raw string.
   * @returns {string} Escaped string.
   */
  function _escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Persist batch history to localStorage.
   */
  function _persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_batchHistory)); } catch (e) { /* quota exceeded */ }
  }

  /**
   * Load batch history from localStorage.
   */
  function _loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) _batchHistory = JSON.parse(raw) || [];
    } catch (e) { _batchHistory = []; }
  }

  /**
   * Get a reference to ProposalKeywordInjector (CF-037) if available.
   * @returns {object|null} ProposalKeywordInjector module or null.
   */
  function _getKeywordInjector() {
    return (CF.ProposalKeywordInjector && typeof CF.ProposalKeywordInjector.analyze === 'function')
      ? CF.ProposalKeywordInjector
      : null;
  }

  /**
   * Run keyword analysis on a proposal against a job description.
   * Returns a score between 0 and 100, or null if injector is unavailable.
   * @param {string} proposalText - The generated proposal text.
   * @param {string} jobDescription - The job description to match against.
   * @returns {number|null} Keyword match score (0-100) or null.
   */
  function _analyzeKeywords(proposalText, jobDescription) {
    var injector = _getKeywordInjector();
    if (!injector) return null;
    try {
      var result = injector.analyze(proposalText, jobDescription);
      if (result && typeof result.score === 'number') return result.score;
      if (typeof result === 'number') return result;
      return null;
    } catch (e) { return null; }
  }

  /**
   * Enrich a proposal by injecting missing keywords from the job description.
   * Returns the enriched text or the original if injector is unavailable.
   * @param {string} proposalText - The generated proposal text.
   * @param {string} jobDescription - The job description to match against.
   * @returns {string} Enriched proposal text.
   */
  function _enrichProposal(proposalText, jobDescription) {
    var injector = _getKeywordInjector();
    if (!injector || typeof injector.enrichProposal !== 'function') return proposalText;
    try {
      var enriched = injector.enrichProposal(proposalText, jobDescription);
      return (typeof enriched === 'string') ? enriched : proposalText;
    } catch (e) { return proposalText; }
  }

  /**
   * Compute batch statistics from proposals with keyword scores.
   * @param {Array} proposals - Array of proposal objects with optional keywordScore.
   * @returns {object} Stats object with totalProposals, avgKeywordScore, categoriesCovered.
   */
  function _computeBatchStats(proposals) {
    var stats = { totalProposals: proposals.length, avgKeywordScore: null, categoriesCovered: [] };
    var catSet = {};
    var scoreSum = 0;
    var scoreCount = 0;
    for (var i = 0; i < proposals.length; i++) {
      var p = proposals[i];
      if (p.jobCategory) catSet[p.jobCategory] = true;
      if (typeof p.keywordScore === 'number') {
        scoreSum += p.keywordScore;
        scoreCount++;
      }
    }
    stats.categoriesCovered = Object.keys(catSet);
    if (scoreCount > 0) stats.avgKeywordScore = Math.round(scoreSum / scoreCount);
    return stats;
  }

  /**
   * Export batch proposals as CSV string.
   * Columns: Job Title, Client, Category, Keyword Score, Proposal Text.
   * @param {Array} proposals - Array of proposal objects.
   * @returns {string} CSV content.
   */
  function _exportCSV(proposals) {
    var rows = ['"Job Title","Client","Category","Keyword Score","Proposal Text"'];
    for (var i = 0; i < proposals.length; i++) {
      var p = proposals[i];
      var score = (typeof p.keywordScore === 'number') ? p.keywordScore : 'N/A';
      var text = (p.text || '').replace(/"/g, '""');
      rows.push(
        '"' + _escapeCSVField(p.jobTitle) + '",' +
        '"' + _escapeCSVField(p.client) + '",' +
        '"' + _escapeCSVField(p.jobCategory) + '",' +
        '"' + score + '",' +
        '"' + text + '"'
      );
    }
    return rows.join('\n');
  }

  /**
   * Escape a field for CSV output (double-quote escaping).
   * @param {string} val - Raw field value.
   * @returns {string} Escaped value.
   */
  function _escapeCSVField(val) {
    return String(val || '').replace(/"/g, '""');
  }

  /**
   * Trigger a file download from a string content.
   * @param {string} content - File content.
   * @param {string} filename - Suggested filename.
   * @param {string} mimeType - MIME type string.
   */
  function _downloadFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get a reference to ProposalTemplates if available.
   * @returns {object|null} ProposalTemplates module or null.
   */
  function _getTemplatesModule() {
    return (CF.ProposalTemplates && typeof CF.ProposalTemplates.getAllTemplates === 'function')
      ? CF.ProposalTemplates
      : null;
  }

  /**
   * Return all available templates, with fallback if ProposalTemplates is not loaded.
   * @returns {Array} Array of template objects.
   */
  function _getAvailableTemplates() {
    var mod = _getTemplatesModule();
    if (mod) return mod.getAllTemplates();

    // Fallback: minimal built-in templates when CF-032 is not loaded
    return [
      {
        id: 'bp-fallback-general', name: 'General Proposal', category: 'general',
        description: 'A versatile proposal template suitable for any project type.',
        tone: 'professional', tags: ['general'],
        sections: {
          greeting: 'Hi {{CLIENT_NAME}},',
          introduction: 'I came across your {{PROJECT_NAME}} posting and I am confident this is a great match for my expertise. With {{YEARS_EXPERIENCE}} years of relevant experience, I have successfully delivered similar projects with excellent results.',
          experience: 'My background includes extensive work in this domain. I prioritize clear communication, on-time delivery, and quality that exceeds expectations.',
          approach: 'My approach for {{PROJECT_NAME}}:\n1. Thorough requirements review and clarification\n2. Structured execution plan with milestone deliverables\n3. Regular progress updates and feedback cycles\n4. Quality assurance and final delivery',
          timeline: 'Based on the scope described, I can deliver within the timeline discussed. I am available to start immediately.',
          pricing: 'My rate is ${{HOURLY_RATE}}/hr. I am happy to discuss a fixed-price arrangement based on a detailed scope review.',
          closing: 'I would love to discuss this further. Please feel free to review my work at {{PORTFOLIO_LINK}} — looking forward to hearing from you.'
        }
      }
    ];
  }

  /**
   * Fill a template with variables, replacing {{PLACEHOLDER}} tokens.
   * Uses ProposalTemplates.fillTemplate if available, otherwise handles locally.
   * @param {string} templateId - Template identifier.
   * @param {object} variables - Key/value map of variable replacements.
   * @returns {object|null} Filled template object or null.
   */
  function _fillTemplate(templateId, variables) {
    var mod = _getTemplatesModule();
    if (mod && typeof mod.fillTemplate === 'function') {
      return mod.fillTemplate(templateId, variables);
    }

    // Fallback fill
    var templates = _getAvailableTemplates();
    var tpl = null;
    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === templateId) { tpl = _deepClone(templates[i]); break; }
    }
    if (!tpl) return null;

    var vars = variables || {};
    for (var key in tpl.sections) {
      if (tpl.sections.hasOwnProperty(key)) {
        tpl.sections[key] = tpl.sections[key].replace(/\{\{(\w+)\}\}/g, function (match, varName) {
          return vars[varName] !== undefined ? vars[varName] : match;
        });
      }
    }
    return tpl;
  }

  /**
   * Convert a filled template to plain text output.
   * Uses ProposalTemplates.previewTemplate if available.
   * @param {string} templateId - Template identifier.
   * @param {object} variables - Key/value map of variable replacements.
   * @returns {string} Plain text proposal.
   */
  function _previewTemplate(templateId, variables) {
    var mod = _getTemplatesModule();
    if (mod && typeof mod.previewTemplate === 'function') {
      return mod.previewTemplate(templateId, variables);
    }

    var filled = _fillTemplate(templateId, variables);
    if (!filled) return '';
    var text = '';
    var sectionOrder = ['greeting', 'introduction', 'experience', 'approach', 'timeline', 'pricing', 'closing'];
    for (var i = 0; i < sectionOrder.length; i++) {
      var content = filled.sections[sectionOrder[i]];
      if (content) { if (text) text += '\n\n'; text += content; }
    }
    return text;
  }

  /**
   * Extract unique categories from the current jobs list.
   * @returns {Array<string>} Sorted array of category strings.
   */
  function _getCategories() {
    var catSet = {};
    for (var i = 0; i < _jobs.length; i++) {
      var cat = _jobs[i].category || 'uncategorized';
      catSet[cat] = true;
    }
    return Object.keys(catSet).sort();
  }

  /**
   * Get filtered jobs based on the current category filter.
   * @returns {Array} Filtered job objects.
   */
  function _getFilteredJobs() {
    if (_categoryFilter === 'All') return _jobs;
    return _jobs.filter(function (j) { return j.category === _categoryFilter; });
  }

  // ─── Init ────────────────────────────────────────────────────────

  /**
   * Initialize the BulkProposal module.
   * Loads batch history from localStorage and sets up demo jobs if
   * no external job data has been provided.
   */
  function init() {
    if (_initialized) return;
    _initialized = true;
    _loadHistory();
    if (_jobs.length === 0) {
      _jobs = _deepClone(DEMO_JOBS);
    }
  }

  // ─── Job Management ──────────────────────────────────────────────

  /**
   * Set the list of jobs available for batch proposal generation.
   * Each job object should have at minimum: id, title, category, client, description.
   * @param {Array<object>} jobs - Array of job objects.
   */
  function setJobs(jobs) {
    if (!Array.isArray(jobs)) return;
    _jobs = _deepClone(jobs);
    _selectedJobIds = [];
    _categoryFilter = 'All';
  }

  /**
   * Programmatically select jobs by their IDs.
   * @param {Array<string>} jobIds - Array of job ID strings to select.
   */
  function selectJobs(jobIds) {
    if (!Array.isArray(jobIds)) return;
    _selectedJobIds = [];
    for (var i = 0; i < jobIds.length; i++) {
      for (var j = 0; j < _jobs.length; j++) {
        if (_jobs[j].id === jobIds[i]) {
          _selectedJobIds.push(jobIds[i]);
          break;
        }
      }
    }
  }

  // ─── Batch Generation ────────────────────────────────────────────

  /**
   * Generate proposals for all selected jobs using a given template and variables.
   * Common variables (CLIENT_NAME, YEARS_EXPERIENCE, HOURLY_RATE, PORTFOLIO_LINK)
   * are set once. Job-specific variables (PROJECT_NAME, CLIENT_NAME) are auto-filled
   * per job when available.
   *
   * @param {string} templateId - The template ID to use for generation.
   * @param {object} variables - Common variable overrides (CLIENT_NAME, YEARS_EXPERIENCE, etc.).
   * @returns {object} Batch result with id, timestamp, templateId, proposals array, and summary.
   */
  function generateBatch(templateId, variables) {
    if (!_initialized) init();
    var vars = variables || {};
    var selectedJobs = [];

    for (var i = 0; i < _selectedJobIds.length; i++) {
      for (var j = 0; j < _jobs.length; j++) {
        if (_jobs[j].id === _selectedJobIds[i]) {
          selectedJobs.push(_jobs[j]);
          break;
        }
      }
    }

    if (selectedJobs.length === 0) {
      return { id: null, error: 'No jobs selected', proposals: [] };
    }

    var proposals = [];
    for (var k = 0; k < selectedJobs.length; k++) {
      var job = selectedJobs[k];
      var jobVars = {};

      // Apply common variables first
      for (var key in vars) {
        if (vars.hasOwnProperty(key)) jobVars[key] = vars[key];
      }

      // Auto-fill job-specific variables
      jobVars.PROJECT_NAME = job.title || jobVars.PROJECT_NAME || 'your project';
      if (job.client && !jobVars.CLIENT_NAME) {
        jobVars.CLIENT_NAME = job.client;
      }

      var filled = _fillTemplate(templateId, jobVars);
      var text = _previewTemplate(templateId, jobVars);

      proposals.push({
        jobId: job.id,
        jobTitle: job.title,
        jobCategory: job.category,
        client: job.client,
        templateId: templateId,
        variables: _deepClone(jobVars),
        filled: filled,
        text: text,
        generatedAt: new Date().toISOString()
      });
    }

    var batchEntry = {
      id: _genId(),
      templateId: templateId,
      variables: _deepClone(vars),
      proposals: proposals,
      jobCount: proposals.length,
      createdAt: new Date().toISOString()
    };

    _batchHistory.unshift(batchEntry);
    if (_batchHistory.length > 50) _batchHistory = _batchHistory.slice(0, 50);
    _persist();

    return batchEntry;
  }

  // ─── History ─────────────────────────────────────────────────────

  /**
   * Retrieve all batch generation history entries.
   * @returns {Array<object>} Array of batch history entries (newest first).
   */
  function getBatchHistory() {
    if (!_initialized) init();
    return _deepClone(_batchHistory);
  }

  /**
   * Clear all batch generation history from memory and localStorage.
   */
  function clearHistory() {
    _batchHistory = [];
    _persist();
  }

  // ─── Render ──────────────────────────────────────────────────────

  /**
   * Render the full Bulk Proposal UI into the given container element.
   * Includes job selection, template picker, variable inputs, and batch results.
   * @param {HTMLElement|string} container - DOM element or element ID string.
   */
  function render(container) {
    _injectCSS();
    if (!_initialized) init();

    if (typeof container === 'string') {
      _container = document.getElementById(container);
    } else {
      _container = container;
    }
    if (!_container) return;

    _renderFull();
  }

  /**
   * Render the complete UI into the stored container.
   */
  function _renderFull() {
    if (!_container) return;
    var templates = _getAvailableTemplates();
    var categories = _getCategories();
    var filteredJobs = _getFilteredJobs();

    var h = '<div class="bp-panel">';

    // ── Header
    h += '<div class="bp-header">';
    h += '<div class="bp-header-left">';
    h += '<span class="bp-title">Bulk Proposal Generator</span>';
    h += '<span class="bp-subtitle">Batch apply to similar jobs with customized proposals</span>';
    h += '</div>';
    h += '<span class="bp-badge">' + _selectedJobIds.length + ' / ' + _jobs.length + ' selected</span>';
    h += '</div>';

    // ── Category Filter
    h += '<div class="bp-filter-bar">';
    h += '<button class="bp-filter-btn' + (_categoryFilter === 'All' ? ' bp-filter-active' : '') + '" data-bp-cat="All">All</button>';
    for (var c = 0; c < categories.length; c++) {
      var active = categories[c] === _categoryFilter ? ' bp-filter-active' : '';
      h += '<button class="bp-filter-btn' + active + '" data-bp-cat="' + _escapeHtml(categories[c]) + '">' + _escapeHtml(categories[c].replace(/-/g, ' ')) + '</button>';
    }
    h += '</div>';

    // ── Select All / Deselect All
    h += '<div class="bp-select-bar">';
    h += '<label class="bp-select-all-label"><input type="checkbox" id="bp-select-all" ' + (_selectedJobIds.length === filteredJobs.length && filteredJobs.length > 0 ? 'checked' : '') + '> Select all visible (' + filteredJobs.length + ')</label>';
    h += '<button class="bp-btn bp-btn-small bp-btn-secondary" id="bp-deselect-all">Clear selection</button>';
    h += '</div>';

    // ── Job List
    h += '<div class="bp-job-list">';
    for (var i = 0; i < filteredJobs.length; i++) {
      var job = filteredJobs[i];
      var checked = _selectedJobIds.indexOf(job.id) !== -1;
      h += '<div class="bp-job-item' + (checked ? ' bp-job-selected' : '') + '" data-bp-job="' + _escapeHtml(job.id) + '">';
      h += '<label class="bp-job-check"><input type="checkbox" class="bp-job-cb" data-bp-jobid="' + _escapeHtml(job.id) + '" ' + (checked ? 'checked' : '') + '></label>';
      h += '<div class="bp-job-info">';
      h += '<div class="bp-job-title">' + _escapeHtml(job.title) + '</div>';
      h += '<div class="bp-job-meta">';
      h += '<span class="bp-job-cat">' + _escapeHtml((job.category || '').replace(/-/g, ' ')) + '</span>';
      h += '<span class="bp-job-client">' + _escapeHtml(job.client || 'Unknown client') + '</span>';
      if (job.budget) h += '<span class="bp-job-budget">' + _escapeHtml(job.budget) + '</span>';
      h += '</div>';
      h += '<div class="bp-job-desc">' + _escapeHtml((job.description || '').substring(0, 140)) + (job.description && job.description.length > 140 ? '...' : '') + '</div>';
      // Full description tooltip overlay (shown on hover)
      h += '<div class="bp-job-tooltip">' + _escapeHtml(job.description || 'No description available.') + '</div>';
      h += '</div></div>';
    }
    if (filteredJobs.length === 0) {
      h += '<div class="bp-empty">No jobs match the current filter.</div>';
    }
    h += '</div>';

    // ── Template & Variables Section
    h += '<div class="bp-config-section">';
    h += '<div class="bp-config-header">Template & Variables</div>';
    h += '<div class="bp-config-body">';

    // Template dropdown
    h += '<div class="bp-field"><label class="bp-label">Template</label>';
    h += '<select class="bp-select" id="bp-template-select">';
    for (var t = 0; t < templates.length; t++) {
      h += '<option value="' + _escapeHtml(templates[t].id) + '">' + _escapeHtml(templates[t].name) + ' (' + _escapeHtml(templates[t].category) + ')</option>';
    }
    h += '</select></div>';

    // Common variables
    h += '<div class="bp-vars-grid">';
    h += '<div class="bp-field"><label class="bp-label">Client Name (default)</label>';
    h += '<input type="text" class="bp-input" id="bp-var-client" placeholder="Auto-filled per job"></div>';

    h += '<div class="bp-field"><label class="bp-label">Years of Experience</label>';
    h += '<input type="text" class="bp-input" id="bp-var-experience" placeholder="e.g. 5"></div>';

    h += '<div class="bp-field"><label class="bp-label">Hourly Rate ($)</label>';
    h += '<input type="text" class="bp-input" id="bp-var-rate" placeholder="e.g. 75"></div>';

    h += '<div class="bp-field"><label class="bp-label">Portfolio Link</label>';
    h += '<input type="text" class="bp-input" id="bp-var-portfolio" placeholder="https://..."></div>';
    h += '</div>';

    // Auto-enrich option (CF-037 integration)
    h += '<div class="bp-field bp-enrich-option">';
    h += '<label class="bp-checkbox-label"><input type="checkbox" id="bp-auto-enrich" class="bp-checkbox"> Auto-enrich with job keywords</label>';
    h += '<span class="bp-enrich-hint">When enabled, missing keywords from the job description are automatically injected into each proposal (requires CF-037 ProposalKeywordInjector).</span>';
    h += '</div>';

    // Generate button
    h += '<div class="bp-generate-row">';
    h += '<button class="bp-btn bp-btn-primary bp-btn-generate" id="bp-generate">';
    h += 'Generate ' + _selectedJobIds.length + ' Proposal' + (_selectedJobIds.length !== 1 ? 's' : '') + '</button>';
    h += '</div>';

    h += '</div></div>';

    // ── Progress Indicator (hidden by default)
    h += '<div class="bp-progress-wrap" id="bp-progress" style="display:none;">';
    h += '<div class="bp-progress-label" id="bp-progress-label">Generating proposals...</div>';
    h += '<div class="bp-progress-bar"><div class="bp-progress-fill" id="bp-progress-fill" style="width:0%;"></div></div>';
    h += '<div class="bp-progress-count" id="bp-progress-count">0 / 0</div>';
    h += '</div>';

    // ── Results Area
    h += '<div id="bp-results"></div>';

    h += '</div>'; // close bp-panel

    _container.innerHTML = h;
    _bindEvents();
  }

  /**
   * Bind all interactive event listeners to the rendered UI.
   */
  function _bindEvents() {
    if (!_container) return;

    // Category filter
    var filterBtns = _container.querySelectorAll('.bp-filter-btn');
    for (var f = 0; f < filterBtns.length; f++) {
      filterBtns[f].addEventListener('click', function () {
        _categoryFilter = this.getAttribute('data-bp-cat');
        _renderFull();
      });
    }

    // Individual job checkboxes
    var checkboxes = _container.querySelectorAll('.bp-job-cb');
    for (var cb = 0; cb < checkboxes.length; cb++) {
      checkboxes[cb].addEventListener('change', function () {
        var jobId = this.getAttribute('data-bp-jobid');
        var idx = _selectedJobIds.indexOf(jobId);
        if (this.checked && idx === -1) {
          _selectedJobIds.push(jobId);
        } else if (!this.checked && idx !== -1) {
          _selectedJobIds.splice(idx, 1);
        }
        _renderFull();
      });
    }

    // Select all
    var selectAllEl = _container.querySelector('#bp-select-all');
    if (selectAllEl) {
      selectAllEl.addEventListener('change', function () {
        var filtered = _getFilteredJobs();
        if (this.checked) {
          for (var i = 0; i < filtered.length; i++) {
            if (_selectedJobIds.indexOf(filtered[i].id) === -1) {
              _selectedJobIds.push(filtered[i].id);
            }
          }
        } else {
          for (var j = 0; j < filtered.length; j++) {
            var idx = _selectedJobIds.indexOf(filtered[j].id);
            if (idx !== -1) _selectedJobIds.splice(idx, 1);
          }
        }
        _renderFull();
      });
    }

    // Deselect all
    var deselectBtn = _container.querySelector('#bp-deselect-all');
    if (deselectBtn) {
      deselectBtn.addEventListener('click', function () {
        _selectedJobIds = [];
        _renderFull();
      });
    }

    // Generate batch
    var genBtn = _container.querySelector('#bp-generate');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        _handleGenerate();
      });
    }
  }

  /**
   * Handle the generate batch button click: gather variables, show progress, and render results.
   */
  function _handleGenerate() {
    if (_selectedJobIds.length === 0) return;

    var templateSelect = _container.querySelector('#bp-template-select');
    var templateId = templateSelect ? templateSelect.value : null;
    if (!templateId) return;

    var variables = {};
    var clientInput = _container.querySelector('#bp-var-client');
    var expInput = _container.querySelector('#bp-var-experience');
    var rateInput = _container.querySelector('#bp-var-rate');
    var portfolioInput = _container.querySelector('#bp-var-portfolio');

    if (clientInput && clientInput.value.trim()) variables.CLIENT_NAME = clientInput.value.trim();
    if (expInput && expInput.value.trim()) variables.YEARS_EXPERIENCE = expInput.value.trim();
    if (rateInput && rateInput.value.trim()) variables.HOURLY_RATE = rateInput.value.trim();
    if (portfolioInput && portfolioInput.value.trim()) variables.PORTFOLIO_LINK = portfolioInput.value.trim();

    // Read auto-enrich preference
    var autoEnrichCb = _container.querySelector('#bp-auto-enrich');
    var autoEnrich = autoEnrichCb ? autoEnrichCb.checked : false;

    // Show progress
    var progressWrap = _container.querySelector('#bp-progress');
    var progressFill = _container.querySelector('#bp-progress-fill');
    var progressCount = _container.querySelector('#bp-progress-count');
    var progressLabel = _container.querySelector('#bp-progress-label');
    if (progressWrap) progressWrap.style.display = 'block';

    var total = _selectedJobIds.length;
    var current = 0;

    // Simulate incremental progress with visual feedback
    function updateProgress(count) {
      var pct = Math.round((count / total) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressCount) progressCount.textContent = count + ' / ' + total;
      if (progressLabel) {
        if (count < total) progressLabel.textContent = 'Generating proposal ' + (count + 1) + ' of ' + total + '...';
        else progressLabel.textContent = 'Batch generation complete!';
      }
    }

    updateProgress(0);

    // Use a staggered timeout to visually show progress
    var batch = null;
    var stepDelay = Math.min(200, 2000 / total);

    function runStep() {
      current++;
      updateProgress(current);
      if (current >= total) {
        // All progress shown, now generate the actual batch
        batch = generateBatch(templateId, variables);
        if (progressFill) progressFill.style.width = '100%';
        updateProgress(total);

        // Post-generation: keyword analysis and optional auto-enrich per proposal
        _postProcessBatch(batch, autoEnrich);

        setTimeout(function () {
          if (progressWrap) progressWrap.style.display = 'none';
          _renderResults(batch);
        }, 400);
      } else {
        setTimeout(runStep, stepDelay);
      }
    }

    setTimeout(runStep, stepDelay);
  }

  /**
   * Post-process a batch: run keyword analysis on each proposal and
   * optionally auto-enrich proposals with missing keywords.
   * Mutates the batch object in-place.
   * @param {object} batch - Batch result from generateBatch().
   * @param {boolean} autoEnrich - Whether to auto-enrich proposals.
   */
  function _postProcessBatch(batch, autoEnrich) {
    if (!batch || !batch.proposals) return;
    for (var i = 0; i < batch.proposals.length; i++) {
      var p = batch.proposals[i];
      // Look up the job description
      var jobDesc = '';
      for (var j = 0; j < _jobs.length; j++) {
        if (_jobs[j].id === p.jobId) { jobDesc = _jobs[j].description || ''; break; }
      }

      // Auto-enrich if enabled
      if (autoEnrich && jobDesc) {
        p.text = _enrichProposal(p.text, jobDesc);
        p.enriched = true;
      }

      // Keyword analysis
      p.keywordScore = _analyzeKeywords(p.text, jobDesc);
    }

    // Compute and attach batch stats
    batch.stats = _computeBatchStats(batch.proposals);
  }

  /**
   * Render the batch results with proposal previews and export options.
   * @param {object} batch - Batch result from generateBatch().
   */
  function _renderResults(batch) {
    var resultsEl = _container.querySelector('#bp-results');
    if (!resultsEl || !batch || !batch.proposals) return;

    var h = '<div class="bp-results-panel">';
    h += '<div class="bp-results-header">';
    h += '<span class="bp-results-title">Generated Proposals</span>';
    h += '<span class="bp-badge">' + batch.proposals.length + ' proposal' + (batch.proposals.length !== 1 ? 's' : '') + '</span>';
    h += '</div>';

    // Export all button
    h += '<div class="bp-results-actions">';
    h += '<button class="bp-btn bp-btn-primary" id="bp-export-all">Copy All Proposals</button>';
    h += '<button class="bp-btn bp-btn-secondary" id="bp-clear-results">Clear Results</button>';
    h += '</div>';

    // Individual proposals
    for (var i = 0; i < batch.proposals.length; i++) {
      var p = batch.proposals[i];
      h += '<div class="bp-result-card" data-bp-idx="' + i + '">';
      h += '<div class="bp-result-card-header">';
      h += '<div class="bp-result-card-title">' + _escapeHtml(p.jobTitle) + '</div>';
      h += '<div class="bp-result-card-meta">';
      h += '<span class="bp-job-cat">' + _escapeHtml((p.jobCategory || '').replace(/-/g, ' ')) + '</span>';
      h += '<span class="bp-job-client">' + _escapeHtml(p.client || '') + '</span>';
      h += '</div>';
      h += '</div>';

      // Proposal preview (collapsed by default, first 200 chars)
      var preview = (p.text || '').substring(0, 250);
      h += '<div class="bp-result-preview" id="bp-preview-' + i + '">' + _escapeHtml(preview) + (p.text && p.text.length > 250 ? '...' : '') + '</div>';
      h += '<div class="bp-result-full" id="bp-full-' + i + '" style="display:none;">' + _escapeHtml(p.text || '').replace(/\n/g, '<br>') + '</div>';

      h += '<div class="bp-result-card-actions">';
      h += '<button class="bp-btn bp-btn-small bp-btn-secondary bp-toggle-btn" data-bp-toggle="' + i + '">Show Full</button>';
      h += '<button class="bp-btn bp-btn-small bp-btn-primary bp-copy-single" data-bp-copy="' + i + '">Copy</button>';
      h += '</div>';
      h += '</div>';
    }

    h += '</div>';
    resultsEl.innerHTML = h;

    // Bind result events
    _bindResultEvents(batch);
  }

  /**
   * Bind events for the results section (export all, copy individual, toggle preview).
   * @param {object} batch - The batch result object.
   */
  function _bindResultEvents(batch) {
    var resultsEl = _container.querySelector('#bp-results');
    if (!resultsEl) return;

    // Export all
    var exportAllBtn = resultsEl.querySelector('#bp-export-all');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', function () {
        var allText = '';
        for (var i = 0; i < batch.proposals.length; i++) {
          if (allText) allText += '\n\n' + '='.repeat(60) + '\n\n';
          allText += '--- ' + batch.proposals[i].jobTitle + ' ---\n\n';
          allText += batch.proposals[i].text || '';
        }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(allText).then(function () {
            exportAllBtn.textContent = 'Copied!';
            setTimeout(function () { exportAllBtn.textContent = 'Copy All Proposals'; }, 2000);
          });
        }
      });
    }

    // Clear results
    var clearBtn = resultsEl.querySelector('#bp-clear-results');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        resultsEl.innerHTML = '';
      });
    }

    // Toggle full/preview
    var toggleBtns = resultsEl.querySelectorAll('.bp-toggle-btn');
    for (var t = 0; t < toggleBtns.length; t++) {
      toggleBtns[t].addEventListener('click', function () {
        var idx = this.getAttribute('data-bp-toggle');
        var previewEl = resultsEl.querySelector('#bp-preview-' + idx);
        var fullEl = resultsEl.querySelector('#bp-full-' + idx);
        if (fullEl.style.display === 'none') {
          fullEl.style.display = 'block';
          previewEl.style.display = 'none';
          this.textContent = 'Collapse';
        } else {
          fullEl.style.display = 'none';
          previewEl.style.display = 'block';
          this.textContent = 'Show Full';
        }
      });
    }

    // Copy individual
    var copyBtns = resultsEl.querySelectorAll('.bp-copy-single');
    for (var cp = 0; cp < copyBtns.length; cp++) {
      copyBtns[cp].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-bp-copy'), 10);
        var text = batch.proposals[idx] ? batch.proposals[idx].text : '';
        var btn = this;
        if (navigator.clipboard && text) {
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = 'Copied!';
            setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
          });
        }
      });
    }
  }

  // ─── Destroy ─────────────────────────────────────────────────────

  /**
   * Tear down the Bulk Proposal UI and reset internal state.
   */
  function destroy() {
    if (_container) _container.innerHTML = '';
    _container = null;
    _selectedJobIds = [];
    _categoryFilter = 'All';
    _initialized = false;
  }

  // ─── CSS ─────────────────────────────────────────────────────────

  /**
   * Inject scoped CSS styles for the Bulk Proposal UI.
   * Uses a CSS_INJECTED guard to prevent duplicate injection.
   */
  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.bp-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;color:#e0e0e0}',

      /* Header */
      '.bp-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #222;background:#151515}',
      '.bp-header-left{display:flex;flex-direction:column;gap:2px}',
      '.bp-title{font-size:16px;font-weight:700;color:#e0e0e0}',
      '.bp-subtitle{font-size:12px;color:#666}',
      '.bp-badge{background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;white-space:nowrap}',

      /* Filter bar */
      '.bp-filter-bar{display:flex;gap:6px;padding:12px 20px;flex-wrap:wrap;border-bottom:1px solid #222}',
      '.bp-filter-btn{background:#222;color:#aaa;border:1px solid #333;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;text-transform:capitalize}',
      '.bp-filter-btn:hover{background:#2a2a2a;color:#fff}',
      '.bp-filter-active{background:#7c3aed33;color:#a78bfa;border-color:#7c3aed}',

      /* Select bar */
      '.bp-select-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid #222;background:#0d0d0d}',
      '.bp-select-all-label{display:flex;align-items:center;gap:8px;font-size:13px;color:#aaa;cursor:pointer}',
      '.bp-select-all-label input{accent-color:#7c3aed}',

      /* Job list */
      '.bp-job-list{max-height:420px;overflow-y:auto;border-bottom:1px solid #222}',
      '.bp-job-item{display:flex;align-items:flex-start;gap:12px;padding:12px 20px;border-bottom:1px solid #1a1a1a;transition:background .15s;cursor:pointer}',
      '.bp-job-item:hover{background:#1a1a1a}',
      '.bp-job-selected{background:#7c3aed0d;border-left:3px solid #7c3aed}',
      '.bp-job-check{display:flex;align-items:center;padding-top:3px}',
      '.bp-job-check input{accent-color:#7c3aed;width:16px;height:16px;cursor:pointer}',
      '.bp-job-info{flex:1;min-width:0}',
      '.bp-job-title{font-size:14px;font-weight:600;color:#e0e0e0;margin-bottom:4px}',
      '.bp-job-meta{display:flex;gap:10px;font-size:11px;margin-bottom:4px;flex-wrap:wrap}',
      '.bp-job-cat{color:#a78bfa;font-weight:600;text-transform:capitalize}',
      '.bp-job-client{color:#888}',
      '.bp-job-budget{color:#22c55e;font-weight:600}',
      '.bp-job-desc{font-size:12px;color:#666;line-height:1.4}',
      '.bp-empty{padding:40px 20px;text-align:center;color:#555;font-size:14px}',

      /* Config section */
      '.bp-config-section{border-bottom:1px solid #222}',
      '.bp-config-header{padding:14px 20px;background:#151515;border-bottom:1px solid #222;font-size:14px;font-weight:700;color:#e0e0e0}',
      '.bp-config-body{padding:16px 20px}',
      '.bp-field{margin-bottom:12px}',
      '.bp-label{display:block;color:#888;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}',
      '.bp-input{width:100%;padding:8px 12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box;font-family:inherit}',
      '.bp-input:focus{border-color:#7c3aed}',
      '.bp-select{width:100%;padding:8px 12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box;font-family:inherit;cursor:pointer}',
      '.bp-select:focus{border-color:#7c3aed}',
      '.bp-vars-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}',

      /* Generate row */
      '.bp-generate-row{margin-top:16px}',

      /* Buttons */
      '.bp-btn{border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit}',
      '.bp-btn-primary{background:#7c3aed;color:#fff}',
      '.bp-btn-primary:hover{background:#6d28d9}',
      '.bp-btn-secondary{background:#222;color:#aaa;border:1px solid #333}',
      '.bp-btn-secondary:hover{background:#2a2a2a;color:#fff}',
      '.bp-btn-small{padding:5px 12px;font-size:11px}',
      '.bp-btn-generate{width:100%;padding:12px;font-size:14px}',

      /* Progress */
      '.bp-progress-wrap{padding:16px 20px;border-bottom:1px solid #222}',
      '.bp-progress-label{font-size:13px;color:#a78bfa;margin-bottom:8px}',
      '.bp-progress-bar{height:6px;background:#222;border-radius:3px;overflow:hidden}',
      '.bp-progress-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#a78bfa);border-radius:3px;transition:width .3s ease}',
      '.bp-progress-count{font-size:11px;color:#666;margin-top:6px;text-align:right}',

      /* Results */
      '.bp-results-panel{border-top:1px solid #222}',
      '.bp-results-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#151515;border-bottom:1px solid #222}',
      '.bp-results-title{font-size:15px;font-weight:700;color:#e0e0e0}',
      '.bp-results-actions{display:flex;gap:8px;padding:12px 20px;border-bottom:1px solid #222}',

      /* Result card */
      '.bp-result-card{border-bottom:1px solid #1a1a1a;padding:16px 20px}',
      '.bp-result-card-header{margin-bottom:8px}',
      '.bp-result-card-title{font-size:14px;font-weight:600;color:#e0e0e0;margin-bottom:4px}',
      '.bp-result-card-meta{display:flex;gap:10px;font-size:11px}',
      '.bp-result-preview{font-size:13px;color:#888;line-height:1.5;margin-bottom:8px}',
      '.bp-result-full{font-size:13px;color:#ccc;line-height:1.6;white-space:pre-wrap;margin-bottom:8px;padding:12px;background:#0d0d0d;border:1px solid #222;border-radius:8px}',
      '.bp-result-card-actions{display:flex;gap:8px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Public API ──────────────────────────────────────────────────

  CF.BulkProposal = {
    /** Initialize the module, loading history and demo jobs. */
    init: init,
    /** Render the full UI into a container element or element ID. */
    render: render,
    /** Tear down the UI and reset state. */
    destroy: destroy,
    /** Set the jobs list for batch generation. */
    setJobs: setJobs,
    /** Programmatically select jobs by ID array. */
    selectJobs: selectJobs,
    /** Generate proposals for all selected jobs with a given template and variables. */
    generateBatch: generateBatch,
    /** Retrieve all batch history entries. */
    getBatchHistory: getBatchHistory,
    /** Clear all batch history from memory and storage. */
    clearHistory: clearHistory,
    /** Module version. */
    version: '1.0.0'
  };

})();
