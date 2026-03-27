/**
 * [cf3-022] Portfolio Case Study Generator
 * Auto-generates case studies from completed projects.
 * Pulls project data (scope, timeline, deliverables, budget),
 * formats into problem/solution/results structure.
 * Export as shareable page or PDF.
 *
 * Depends on: CortexProjectManager, CortexFreelancer.CaseStudyGenerator
 */
(function () {
  'use strict';

  /* ── Helpers ──────────────────────────────────────────────── */
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  var PM = null;   // CortexProjectManager
  var CSG = null;  // CortexFreelancer.CaseStudyGenerator
  var CRM = null;  // CortexClientCRM (optional)

  var STORAGE_KEY = 'cortex_cs_gen_drafts';
  var currentStudy = null;

  function loadDrafts() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { return []; }
  }
  function saveDrafts(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) { }
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    PM = window.CortexProjectManager;
    CSG = window.CortexFreelancer && window.CortexFreelancer.CaseStudyGenerator;
    CRM = window.CortexClientCRM || null;

    bindEvents();
    populateProjectPicker();
    renderDraftsList();
    updatePreview();
  }

  /* ── Event Binding ────────────────────────────────────────── */
  function bindEvents() {
    $('#project-picker').addEventListener('change', onProjectSelected);
    $('#btn-generate').addEventListener('click', generateFromForm);
    $('#btn-clear').addEventListener('click', clearForm);
    $('#btn-export-pdf').addEventListener('click', exportPDF);
    $('#btn-copy-html').addEventListener('click', copyShareableHTML);
    $('#btn-copy-md').addEventListener('click', copyMarkdown);
    $('#btn-save-draft').addEventListener('click', saveDraft);

    // Live preview on form changes
    var formFields = ['cs-title', 'cs-client', 'cs-industry', 'cs-duration',
      'cs-budget', 'cs-problem', 'cs-solution', 'cs-results',
      'cs-skills', 'cs-testimonial', 'cs-rating'];
    formFields.forEach(function (id) {
      var el = $('#' + id);
      if (el) el.addEventListener('input', updatePreview);
    });

    // Deliverables dynamic list
    $('#btn-add-deliverable').addEventListener('click', addDeliverableRow);

    // Keyboard
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        exportPDF();
      }
    });
  }

  /* ── Project Picker ───────────────────────────────────────── */
  function populateProjectPicker() {
    var select = $('#project-picker');
    select.innerHTML = '<option value="">-- Select a completed project --</option>';

    if (!PM) {
      select.innerHTML += '<option value="" disabled>Project Manager not loaded</option>';
      return;
    }

    var projects = PM.list({ sortBy: 'createdAt', sortDir: 'desc' });

    // Group: completed first, then archived, then active
    var completed = [];
    var archived = [];
    var other = [];

    projects.forEach(function (p) {
      if (p.status === 'completed') completed.push(p);
      else if (p.status === 'archived') archived.push(p);
      else other.push(p);
    });

    function addGroup(label, items) {
      if (items.length === 0) return;
      var group = document.createElement('optgroup');
      group.label = label;
      items.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        var budget = p.budget ? ' — $' + Number(p.budget).toLocaleString() : '';
        opt.textContent = p.name + (p.clientName ? ' (' + p.clientName + ')' : '') + budget;
        group.appendChild(opt);
      });
      select.appendChild(group);
    }

    addGroup('Completed', completed);
    addGroup('Archived', archived);
    addGroup('Active / Lead', other);
  }

  function onProjectSelected() {
    var projectId = $('#project-picker').value;
    if (!projectId || !PM) return;

    var p = PM.get(projectId);
    if (!p) return;

    // Fill form from project data
    $('#cs-title').value = p.name || '';
    $('#cs-client').value = p.clientName || '';
    $('#cs-budget').value = p.budget ? '$' + Number(p.budget).toLocaleString() : '';

    // Duration calculation
    if (p.createdAt) {
      var start = new Date(p.createdAt);
      var end = p.completedAt ? new Date(p.completedAt) : new Date();
      var weeks = Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 7));
      $('#cs-duration').value = weeks <= 4 ? weeks + ' weeks' : Math.round(weeks / 4.3) + ' months';
    }

    // Tags as skills
    if (p.tags && p.tags.length) {
      $('#cs-skills').value = p.tags.join(', ');
    }

    // Description as problem seed
    if (p.description) {
      $('#cs-problem').value = p.description;
    }

    // Try to get industry from CRM
    if (CRM && p.clientId) {
      try {
        var client = CRM.get(p.clientId);
        if (client && client.industry) {
          $('#cs-industry').value = client.industry;
        }
      } catch (_) { }
    }

    // Deliverables from milestones if available
    var delList = $('#deliverables-list');
    delList.innerHTML = '';
    if (p.milestones && p.milestones.length) {
      p.milestones.forEach(function (m) {
        addDeliverableRow(null, m.name || m);
      });
    } else {
      addDeliverableRow();
    }

    // Auto-generate content using the existing CaseStudyGenerator
    if (CSG) {
      var generated = CSG.generateCaseStudy({
        title: p.name,
        description: p.description,
        skills: p.tags || [],
        rating: p.rating,
        earnedAmount: p.budget || p.totalBilled,
        duration: $('#cs-duration').value,
        feedbackText: p.feedbackText || ''
      });

      if (generated) {
        if (!$('#cs-problem').value) $('#cs-problem').value = generated.challenge;
        if (!$('#cs-solution').value) $('#cs-solution').value = generated.solution;
        if (!$('#cs-results').value) $('#cs-results').value = generated.results;
      }
    }

    updatePreview();
    toast('Project data loaded — review and customize below');
  }

  /* ── Deliverables Dynamic List ────────────────────────────── */
  function addDeliverableRow(e, value) {
    var list = $('#deliverables-list');
    var row = document.createElement('div');
    row.className = 'dyn-row';
    row.innerHTML = '<input class="form-input" placeholder="e.g. Responsive landing page" value="' + esc(value || '') + '" oninput="window.CortexCaseStudyGen.updatePreview()">' +
      '<button class="btn-del" title="Remove">&times;</button>';
    row.querySelector('.btn-del').addEventListener('click', function () {
      row.remove();
      updatePreview();
    });
    list.appendChild(row);
  }

  /* ── Generate from Form ───────────────────────────────────── */
  function generateFromForm() {
    var title = $('#cs-title').value.trim();
    if (!title) {
      toast('Please enter a project title', 'error');
      $('#cs-title').focus();
      return;
    }

    var deliverables = getDeliverables();

    currentStudy = {
      id: 'cs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      title: title,
      client: $('#cs-client').value.trim(),
      industry: $('#cs-industry').value.trim(),
      duration: $('#cs-duration').value.trim(),
      budget: $('#cs-budget').value.trim(),
      problem: $('#cs-problem').value.trim(),
      solution: $('#cs-solution').value.trim(),
      results: $('#cs-results').value.trim(),
      skills: $('#cs-skills').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      deliverables: deliverables,
      testimonial: $('#cs-testimonial').value.trim(),
      rating: parseFloat($('#cs-rating').value) || null,
      createdAt: new Date().toISOString()
    };

    // Auto-fill empty sections using CaseStudyGenerator templates
    if (CSG && (!currentStudy.problem || !currentStudy.solution || !currentStudy.results)) {
      var generated = CSG.generateCaseStudy({
        title: title,
        skills: currentStudy.skills,
        rating: currentStudy.rating,
        earnedAmount: parseBudget(currentStudy.budget),
        duration: currentStudy.duration
      });
      if (generated) {
        if (!currentStudy.problem) currentStudy.problem = generated.challenge;
        if (!currentStudy.solution) currentStudy.solution = generated.solution;
        if (!currentStudy.results) currentStudy.results = generated.results;
        // Also fill the form fields
        if (!$('#cs-problem').value) $('#cs-problem').value = currentStudy.problem;
        if (!$('#cs-solution').value) $('#cs-solution').value = currentStudy.solution;
        if (!$('#cs-results').value) $('#cs-results').value = currentStudy.results;
      }
    }

    updatePreview();
    toast('Case study generated — review the preview');

    // Scroll to preview on mobile
    if (window.innerWidth < 1000) {
      var preview = $('#preview-panel');
      if (preview) preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function getDeliverables() {
    var items = [];
    $$('#deliverables-list .dyn-row input').forEach(function (inp) {
      var val = inp.value.trim();
      if (val) items.push(val);
    });
    return items;
  }

  function parseBudget(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
  }

  /* ── Clear Form ───────────────────────────────────────────── */
  function clearForm() {
    var fields = ['cs-title', 'cs-client', 'cs-industry', 'cs-duration',
      'cs-budget', 'cs-problem', 'cs-solution', 'cs-results',
      'cs-skills', 'cs-testimonial', 'cs-rating'];
    fields.forEach(function (id) { $('#' + id).value = ''; });
    $('#deliverables-list').innerHTML = '';
    addDeliverableRow();
    $('#project-picker').value = '';
    currentStudy = null;
    updatePreview();
    toast('Form cleared');
  }

  /* ── Live Preview ─────────────────────────────────────────── */
  function updatePreview() {
    var title = $('#cs-title').value.trim() || 'Project Title';
    var client = $('#cs-client').value.trim();
    var industry = $('#cs-industry').value.trim();
    var duration = $('#cs-duration').value.trim();
    var budget = $('#cs-budget').value.trim();
    var problem = $('#cs-problem').value.trim();
    var solution = $('#cs-solution').value.trim();
    var results = $('#cs-results').value.trim();
    var skills = $('#cs-skills').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var deliverables = getDeliverables();
    var testimonial = $('#cs-testimonial').value.trim();
    var rating = $('#cs-rating').value.trim();

    var doc = $('#cs-doc');
    var html = '';

    // Header
    html += '<div class="cs-doc-header">';
    html += '<div class="cs-doc-badge">CASE STUDY</div>';
    html += '<h2 class="cs-doc-title">' + esc(title) + '</h2>';
    if (client || industry) {
      html += '<div class="cs-doc-meta">';
      if (client) html += '<span>' + esc(client) + '</span>';
      if (industry) html += '<span>' + esc(industry) + '</span>';
      html += '</div>';
    }
    html += '</div>';

    // Overview bar
    var hasOverview = duration || budget || skills.length;
    if (hasOverview) {
      html += '<div class="cs-overview-bar">';
      if (duration) html += '<div class="cs-overview-item"><div class="cs-overview-label">Duration</div><div class="cs-overview-val">' + esc(duration) + '</div></div>';
      if (budget) html += '<div class="cs-overview-item"><div class="cs-overview-label">Budget</div><div class="cs-overview-val">' + esc(budget) + '</div></div>';
      if (skills.length) html += '<div class="cs-overview-item"><div class="cs-overview-label">Skills</div><div class="cs-overview-val">' + skills.map(function (s) { return esc(s); }).join(', ') + '</div></div>';
      html += '</div>';
    }

    // Problem
    html += '<div class="cs-section">';
    html += '<div class="cs-section-num">01</div>';
    html += '<h3 class="cs-section-title">The Challenge</h3>';
    html += '<p class="cs-section-body">' + (problem ? esc(problem) : '<span class="cs-placeholder">Describe the client\'s problem or challenge...</span>') + '</p>';
    html += '</div>';

    // Deliverables
    if (deliverables.length > 0) {
      html += '<div class="cs-section">';
      html += '<div class="cs-section-num">02</div>';
      html += '<h3 class="cs-section-title">Key Deliverables</h3>';
      html += '<ul class="cs-deliverables">';
      deliverables.forEach(function (d) {
        html += '<li>' + esc(d) + '</li>';
      });
      html += '</ul>';
      html += '</div>';
    }

    // Solution
    html += '<div class="cs-section">';
    html += '<div class="cs-section-num">' + (deliverables.length > 0 ? '03' : '02') + '</div>';
    html += '<h3 class="cs-section-title">The Solution</h3>';
    html += '<p class="cs-section-body">' + (solution ? esc(solution) : '<span class="cs-placeholder">Describe your approach and solution...</span>') + '</p>';
    html += '</div>';

    // Results
    var resultNum = deliverables.length > 0 ? '04' : '03';
    html += '<div class="cs-section">';
    html += '<div class="cs-section-num">' + resultNum + '</div>';
    html += '<h3 class="cs-section-title">The Results</h3>';
    html += '<p class="cs-section-body">' + (results ? highlightMetrics(results) : '<span class="cs-placeholder">Describe measurable outcomes and impact...</span>') + '</p>';
    html += '</div>';

    // Testimonial
    if (testimonial) {
      html += '<div class="cs-testimonial">';
      html += '<div class="cs-quote-mark">&ldquo;</div>';
      html += '<p class="cs-quote-text">' + esc(testimonial) + '</p>';
      if (client) html += '<div class="cs-quote-author">— ' + esc(client) + '</div>';
      if (rating) html += '<div class="cs-quote-rating">' + renderStars(parseFloat(rating)) + '</div>';
      html += '</div>';
    }

    // Footer
    html += '<div class="cs-doc-footer">';
    html += '<span>Generated with Cortex Freelancer</span>';
    html += '<span>' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) + '</span>';
    html += '</div>';

    doc.innerHTML = html;

    // Enable/disable export buttons
    var hasContent = title !== 'Project Title';
    $('#btn-export-pdf').disabled = !hasContent;
    $('#btn-copy-html').disabled = !hasContent;
    $('#btn-copy-md').disabled = !hasContent;
    $('#btn-save-draft').disabled = !hasContent;
  }

  function renderStars(rating) {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      if (rating >= i) html += '<span class="cs-star filled">&#9733;</span>';
      else if (rating >= i - 0.5) html += '<span class="cs-star half">&#9733;</span>';
      else html += '<span class="cs-star">&#9734;</span>';
    }
    return html;
  }

  function highlightMetrics(text) {
    return esc(text)
      .replace(/(\$[\d,]+(?:\.\d{2})?)/g, '<strong class="cs-metric">$1</strong>')
      .replace(/(\d+(?:\.\d+)?%)/g, '<strong class="cs-metric">$1</strong>')
      .replace(/(\d+(?:\.\d+)?x\b)/gi, '<strong class="cs-metric">$1</strong>')
      .replace(/(\d+(?:\.\d+)?\s*(?:hours|days|weeks|months|users|clients|stars))/gi, '<strong class="cs-metric">$1</strong>');
  }

  /* ── Export: PDF (via print) ──────────────────────────────── */
  function exportPDF() {
    window.print();
    toast('Print dialog opened — save as PDF');
    trackEvent('case_study_export', 'pdf');
  }

  /* ── Export: Shareable HTML ───────────────────────────────── */
  function copyShareableHTML() {
    var study = collectStudy();
    var html = buildShareableHTML(study);
    navigator.clipboard.writeText(html).then(function () {
      toast('Shareable HTML copied to clipboard');
      trackEvent('case_study_export', 'html');
    }).catch(function () {
      // Fallback: open in new window
      var w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      toast('Opened in new tab');
    });
  }

  function buildShareableHTML(s) {
    var deliverablesList = '';
    if (s.deliverables && s.deliverables.length) {
      deliverablesList = '<div style="margin-bottom:24px"><h3 style="color:#ff8844;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px">Key Deliverables</h3><ul style="padding-left:18px;margin:0">' +
        s.deliverables.map(function (d) { return '<li style="color:#333;font-size:14px;margin-bottom:4px">' + esc(d) + '</li>'; }).join('') +
        '</ul></div>';
    }

    var overviewHtml = '';
    if (s.duration || s.budget || s.skills.length) {
      overviewHtml = '<div style="display:flex;gap:24px;background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:24px;flex-wrap:wrap">';
      if (s.duration) overviewHtml += '<div><div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:1px">Duration</div><div style="font-size:14px;font-weight:700;color:#1a1a1a">' + esc(s.duration) + '</div></div>';
      if (s.budget) overviewHtml += '<div><div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:1px">Budget</div><div style="font-size:14px;font-weight:700;color:#1a1a1a">' + esc(s.budget) + '</div></div>';
      if (s.skills.length) overviewHtml += '<div><div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:1px">Skills</div><div style="font-size:14px;color:#1a1a1a">' + s.skills.map(function (sk) { return esc(sk); }).join(', ') + '</div></div>';
      overviewHtml += '</div>';
    }

    var testimonialHtml = '';
    if (s.testimonial) {
      testimonialHtml = '<div style="background:#fff8f0;border-left:3px solid #ff8844;border-radius:0 8px 8px 0;padding:20px;margin-top:24px">' +
        '<p style="font-style:italic;color:#333;font-size:14px;line-height:1.7;margin:0">&ldquo;' + esc(s.testimonial) + '&rdquo;</p>' +
        (s.client ? '<div style="margin-top:8px;font-weight:700;font-size:13px;color:#666">— ' + esc(s.client) + '</div>' : '') +
        '</div>';
    }

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(s.title) + ' — Case Study</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;background:#fff;line-height:1.6}</style></head>' +
      '<body><div style="max-width:700px;margin:0 auto;padding:48px 24px">' +
      '<div style="margin-bottom:32px"><div style="display:inline-block;background:#ff8844;color:#fff;font-size:10px;font-weight:800;padding:4px 10px;border-radius:100px;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px">Case Study</div>' +
      '<h1 style="font-size:28px;font-weight:900;letter-spacing:-1px;color:#1a1a1a;margin-bottom:6px">' + esc(s.title) + '</h1>' +
      (s.client ? '<div style="font-size:14px;color:#888">' + esc(s.client) + (s.industry ? ' &middot; ' + esc(s.industry) : '') + '</div>' : '') + '</div>' +
      overviewHtml +
      '<div style="margin-bottom:24px"><h3 style="color:#ff8844;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">The Challenge</h3><p style="font-size:15px;color:#333;line-height:1.7">' + esc(s.problem) + '</p></div>' +
      deliverablesList +
      '<div style="margin-bottom:24px"><h3 style="color:#ff8844;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">The Solution</h3><p style="font-size:15px;color:#333;line-height:1.7">' + esc(s.solution) + '</p></div>' +
      '<div style="margin-bottom:24px"><h3 style="color:#ff8844;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">The Results</h3><p style="font-size:15px;color:#333;line-height:1.7">' + esc(s.results) + '</p></div>' +
      testimonialHtml +
      '<div style="border-top:1px solid #eee;padding-top:16px;margin-top:32px;font-size:11px;color:#bbb;text-align:center">Generated with Cortex Freelancer</div>' +
      '</div></body></html>';
  }

  /* ── Export: Markdown ─────────────────────────────────────── */
  function copyMarkdown() {
    var s = collectStudy();
    var lines = [
      '# ' + s.title,
      ''
    ];

    if (s.client) lines.push('**Client:** ' + s.client);
    if (s.industry) lines.push('**Industry:** ' + s.industry);
    if (s.duration) lines.push('**Duration:** ' + s.duration);
    if (s.budget) lines.push('**Budget:** ' + s.budget);
    if (s.skills.length) lines.push('**Skills:** ' + s.skills.join(', '));
    if (s.client || s.industry || s.duration || s.budget || s.skills.length) lines.push('');

    lines.push('## The Challenge');
    lines.push(s.problem || 'N/A');
    lines.push('');

    if (s.deliverables.length) {
      lines.push('## Key Deliverables');
      s.deliverables.forEach(function (d) { lines.push('- ' + d); });
      lines.push('');
    }

    lines.push('## The Solution');
    lines.push(s.solution || 'N/A');
    lines.push('');

    lines.push('## The Results');
    lines.push(s.results || 'N/A');
    lines.push('');

    if (s.testimonial) {
      lines.push('---');
      lines.push('');
      lines.push('> "' + s.testimonial + '"');
      if (s.client) lines.push('> — ' + s.client);
      lines.push('');
    }

    navigator.clipboard.writeText(lines.join('\n')).then(function () {
      toast('Markdown copied to clipboard');
      trackEvent('case_study_export', 'markdown');
    });
  }

  /* ── Collect Study Data ───────────────────────────────────── */
  function collectStudy() {
    return {
      title: $('#cs-title').value.trim() || 'Untitled Project',
      client: $('#cs-client').value.trim(),
      industry: $('#cs-industry').value.trim(),
      duration: $('#cs-duration').value.trim(),
      budget: $('#cs-budget').value.trim(),
      problem: $('#cs-problem').value.trim(),
      solution: $('#cs-solution').value.trim(),
      results: $('#cs-results').value.trim(),
      skills: $('#cs-skills').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      deliverables: getDeliverables(),
      testimonial: $('#cs-testimonial').value.trim(),
      rating: parseFloat($('#cs-rating').value) || null
    };
  }

  /* ── Save / Load Drafts ───────────────────────────────────── */
  function saveDraft() {
    var study = collectStudy();
    if (!study.title || study.title === 'Untitled Project') {
      toast('Add a title before saving', 'error');
      return;
    }

    var drafts = loadDrafts();
    study.id = 'draft_' + Date.now();
    study.savedAt = new Date().toISOString();
    drafts.unshift(study);
    if (drafts.length > 20) drafts = drafts.slice(0, 20);
    saveDrafts(drafts);
    renderDraftsList();
    toast('Draft saved');
  }

  function loadDraft(idx) {
    var drafts = loadDrafts();
    var d = drafts[idx];
    if (!d) return;

    $('#cs-title').value = d.title || '';
    $('#cs-client').value = d.client || '';
    $('#cs-industry').value = d.industry || '';
    $('#cs-duration').value = d.duration || '';
    $('#cs-budget').value = d.budget || '';
    $('#cs-problem').value = d.problem || '';
    $('#cs-solution').value = d.solution || '';
    $('#cs-results').value = d.results || '';
    $('#cs-skills').value = (d.skills || []).join(', ');
    $('#cs-testimonial').value = d.testimonial || '';
    $('#cs-rating').value = d.rating || '';

    // Deliverables
    var delList = $('#deliverables-list');
    delList.innerHTML = '';
    if (d.deliverables && d.deliverables.length) {
      d.deliverables.forEach(function (item) { addDeliverableRow(null, item); });
    } else {
      addDeliverableRow();
    }

    updatePreview();
    toast('Draft loaded');
  }

  function deleteDraft(idx) {
    var drafts = loadDrafts();
    drafts.splice(idx, 1);
    saveDrafts(drafts);
    renderDraftsList();
    toast('Draft deleted');
  }

  function renderDraftsList() {
    var container = $('#drafts-list');
    if (!container) return;

    var drafts = loadDrafts();
    if (drafts.length === 0) {
      container.innerHTML = '<div class="drafts-empty">No saved drafts yet</div>';
      return;
    }

    container.innerHTML = drafts.map(function (d, idx) {
      var date = d.savedAt ? new Date(d.savedAt).toLocaleDateString() : '';
      return '<div class="draft-item">' +
        '<div class="draft-info" data-draft-load="' + idx + '">' +
          '<div class="draft-title">' + esc(d.title) + '</div>' +
          '<div class="draft-meta">' + (d.client ? esc(d.client) + ' &middot; ' : '') + date + '</div>' +
        '</div>' +
        '<button class="draft-del" data-draft-del="' + idx + '" title="Delete draft">&times;</button>' +
      '</div>';
    }).join('');

    container.querySelectorAll('[data-draft-load]').forEach(function (el) {
      el.addEventListener('click', function () {
        loadDraft(parseInt(el.dataset.draftLoad));
      });
    });

    container.querySelectorAll('[data-draft-del]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteDraft(parseInt(btn.dataset.draftDel));
      });
    });
  }

  /* ── Toast ────────────────────────────────────────────────── */
  function toast(msg, type) {
    var el = $('#cs-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (type === 'error' ? ' error' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.className = 'toast'; }, 2500);
  }

  /* ── Analytics ────────────────────────────────────────────── */
  function trackEvent(action, label) {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'tool_used',
        tool_name: 'case-study-generator',
        tool_action: action,
        tool_label: label
      });
    }
  }

  /* ── Boot ──────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CortexCaseStudyGen = {
    init: init,
    updatePreview: updatePreview,
    generateFromForm: generateFromForm,
    exportPDF: exportPDF,
    copyShareableHTML: copyShareableHTML,
    copyMarkdown: copyMarkdown,
    collectStudy: collectStudy
  };

})();
