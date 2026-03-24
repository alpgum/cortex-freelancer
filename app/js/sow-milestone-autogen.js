(function(){
  'use strict';

  var PHASE_TEMPLATES = {
    default: [
      { name: 'Discovery & Planning', weight: 0.10 },
      { name: 'Design', weight: 0.20 },
      { name: 'Development', weight: 0.35 },
      { name: 'Testing & QA', weight: 0.20 },
      { name: 'Launch & Handoff', weight: 0.15 }
    ],
    design: [
      { name: 'Research & Moodboard', weight: 0.15 },
      { name: 'Wireframes', weight: 0.20 },
      { name: 'Visual Design', weight: 0.30 },
      { name: 'Revisions & Refinement', weight: 0.20 },
      { name: 'Final Delivery', weight: 0.15 }
    ],
    development: [
      { name: 'Architecture & Setup', weight: 0.10 },
      { name: 'Core Development', weight: 0.35 },
      { name: 'Feature Development', weight: 0.25 },
      { name: 'Testing & Bug Fixes', weight: 0.20 },
      { name: 'Deployment & Launch', weight: 0.10 }
    ],
    marketing: [
      { name: 'Strategy & Research', weight: 0.15 },
      { name: 'Content Creation', weight: 0.30 },
      { name: 'Campaign Setup', weight: 0.20 },
      { name: 'Execution & Monitoring', weight: 0.25 },
      { name: 'Reporting & Optimization', weight: 0.10 }
    ],
    writing: [
      { name: 'Research & Outline', weight: 0.15 },
      { name: 'First Draft', weight: 0.35 },
      { name: 'Review & Revisions', weight: 0.25 },
      { name: 'Final Edits', weight: 0.15 },
      { name: 'Delivery', weight: 0.10 }
    ]
  };

  var SCOPE_KEYWORDS = {
    design: ['design', 'wireframe', 'mockup', 'ui', 'ux', 'prototype', 'figma', 'sketch', 'logo', 'brand', 'visual', 'layout'],
    development: ['develop', 'code', 'build', 'app', 'software', 'api', 'backend', 'frontend', 'database', 'integration', 'mobile', 'web app', 'platform', 'system'],
    marketing: ['marketing', 'campaign', 'seo', 'social media', 'content strategy', 'ads', 'analytics', 'email marketing', 'branding', 'pr'],
    writing: ['writing', 'copywriting', 'blog', 'article', 'content', 'documentation', 'technical writing', 'editing']
  };

  function detectProjectType(projectName, scopeItems, deliverables) {
    var combined = (projectName + ' ' + scopeItems.join(' ') + ' ' + deliverables).toLowerCase();
    var scores = {};

    Object.keys(SCOPE_KEYWORDS).forEach(function(type) {
      scores[type] = 0;
      SCOPE_KEYWORDS[type].forEach(function(kw) {
        if (combined.indexOf(kw) !== -1) {
          scores[type]++;
        }
      });
    });

    var bestType = 'default';
    var bestScore = 0;
    Object.keys(scores).forEach(function(type) {
      if (scores[type] > bestScore) {
        bestScore = scores[type];
        bestType = type;
      }
    });

    return bestScore > 0 ? bestType : 'default';
  }

  function generateMilestoneDates(startDateStr, endDateStr, count) {
    var dates = [];
    if (!startDateStr || !endDateStr || count < 1) return dates;

    var start = new Date(startDateStr + 'T00:00:00');
    var end = new Date(endDateStr + 'T00:00:00');
    var totalMs = end.getTime() - start.getTime();

    if (totalMs <= 0) return dates;

    for (var i = 0; i < count; i++) {
      var fraction = (i + 1) / count;
      var msDate = new Date(start.getTime() + totalMs * fraction);
      var y = msDate.getFullYear();
      var m = String(msDate.getMonth() + 1).padStart(2, '0');
      var d = String(msDate.getDate()).padStart(2, '0');
      dates.push(y + '-' + m + '-' + d);
    }

    return dates;
  }

  function distributePayments(totalBudget, weights) {
    var amounts = [];
    var remaining = totalBudget;

    for (var i = 0; i < weights.length; i++) {
      if (i === weights.length - 1) {
        amounts.push(Math.round(remaining * 100) / 100);
      } else {
        var amt = Math.round(totalBudget * weights[i] * 100) / 100;
        amounts.push(amt);
        remaining -= amt;
      }
    }

    return amounts;
  }

  function getTotalBudget() {
    var rateType = document.getElementById('rate-type').value;
    var rateAmount = parseFloat(document.getElementById('rate-amount').value) || 0;
    var estHours = parseFloat(document.getElementById('est-hours').value) || 0;

    if (rateType === 'fixed') {
      return rateAmount;
    } else {
      return rateAmount * estHours;
    }
  }

  function getScopeItems() {
    var items = [];
    var rows = document.getElementById('scope-tbody').querySelectorAll('tr');
    rows.forEach(function(row) {
      var input = row.querySelector('input');
      if (input && input.value.trim()) {
        items.push(input.value.trim());
      }
    });
    return items;
  }

  function customizeMilestoneNames(phases, scopeItems, projectName) {
    var result = phases.map(function(p) {
      return { name: p.name, weight: p.weight };
    });

    if (scopeItems.length >= phases.length) {
      for (var i = 0; i < result.length; i++) {
        var scopeSlice = scopeItems.slice(
          Math.floor(i * scopeItems.length / result.length),
          Math.floor((i + 1) * scopeItems.length / result.length)
        );
        if (scopeSlice.length > 0) {
          var scopeHint = scopeSlice[0];
          if (scopeHint.length > 40) scopeHint = scopeHint.substring(0, 40) + '...';
          result[i].name = result[i].name + ': ' + scopeHint;
        }
      }
    }

    return result;
  }

  function handleAutoGenerate() {
    var projectName = document.getElementById('project-name').value.trim();
    var startDate = document.getElementById('start-date').value;
    var endDate = document.getElementById('end-date').value;
    var deliverables = document.getElementById('deliverables').value.trim();
    var scopeItems = getScopeItems();
    var totalBudget = getTotalBudget();

    // Validation
    var errors = [];
    if (!startDate || !endDate) errors.push('start and end dates');
    if (totalBudget <= 0) errors.push('a rate amount');

    if (errors.length > 0) {
      showToast('Please set ' + errors.join(' and ') + ' first');
      return;
    }

    var start = new Date(startDate + 'T00:00:00');
    var end = new Date(endDate + 'T00:00:00');
    if (end <= start) {
      showToast('End date must be after start date');
      return;
    }

    // Detect project type and get phases
    var projectType = detectProjectType(projectName, scopeItems, deliverables);
    var phases = PHASE_TEMPLATES[projectType];

    // If scope items are large enough, customize names
    if (scopeItems.length >= 3) {
      phases = customizeMilestoneNames(phases, scopeItems, projectName);
    }

    // Generate dates and payments
    var dates = generateMilestoneDates(startDate, endDate, phases.length);
    var weights = phases.map(function(p) { return p.weight; });
    var payments = distributePayments(totalBudget, weights);

    // Clear existing milestones
    document.getElementById('milestones-tbody').innerHTML = '';

    // Add generated milestones using the existing function
    for (var i = 0; i < phases.length; i++) {
      addMilestone(phases[i].name, dates[i] || '', payments[i]);
    }

    updatePreview();
    showToast('Generated ' + phases.length + ' milestones (' + projectType + ' project)');

    dataLayer.push({
      event: 'tool_used',
      tool_name: 'sow-generator',
      action: 'auto_generate_milestones',
      milestone_count: phases.length,
      project_type: projectType
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    // Find the existing "+ Add Milestone" button
    var addMilestoneBtn = document.querySelector('#milestones-tbody')
      .closest('.form-section')
      .querySelector('.btn-add-row');

    if (!addMilestoneBtn) return;

    // Create the auto-generate button
    var autoBtn = document.createElement('button');
    autoBtn.className = 'btn-add-row';
    autoBtn.type = 'button';
    autoBtn.style.cssText = 'margin-top:0.5rem;border-color:var(--orange);color:var(--orange);background:rgba(255,136,68,0.05)';
    autoBtn.textContent = '\u2728 Auto-Generate Milestones';
    autoBtn.setAttribute('aria-label', 'Automatically generate milestones based on scope and budget');
    autoBtn.addEventListener('click', handleAutoGenerate);

    // Insert after the existing add milestone button
    addMilestoneBtn.parentNode.insertBefore(autoBtn, addMilestoneBtn.nextSibling);
  });

})();
