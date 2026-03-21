/**
 * Cortex Freelancer — Tool Onboarding Tooltips
 * Shows first-time 3-step tooltips per tool page.
 * Tracks seen state in localStorage. Auto-inits from data-tool-name.
 */
(function() {
  'use strict';

  var STORAGE_PREFIX = 'cortex-onboarding-seen-';

  // Per-tool tooltip definitions: 3 key features each
  var TOOL_TIPS = {
    'Email Writer': [
      { target: '#contextInput', title: 'Describe Your Situation', desc: 'Paste or type the full context — the more detail, the better your emails will be. Include amounts, timelines, and what you need.' },
      { target: '#scenarioSelect', title: 'Pick a Scenario', desc: 'Choose a specific email type or leave it on "Auto-detect" and we\'ll analyze your context to pick the best templates.' },
      { target: '#generateBtn', title: 'Generate & Copy', desc: 'Hit Generate to get up to 3 email variants. Copy any email with one click and paste it straight into your inbox.' }
    ],
    'Bio Generator': [
      { target: '#nameInput', title: 'Enter Your Details', desc: 'Start with your name and select your top skills. We\'ll generate bios tailored to each platform\'s character limits.' },
      { target: '#skillsWrap', title: 'Select Your Skills', desc: 'Pick up to 6 skills that define your freelance expertise. These will be woven naturally into each bio variant.' },
      { target: '#generateBtn', title: 'Get 3 Platform Bios', desc: 'Generate optimized bios for Upwork (500 chars), LinkedIn (300 words), and Twitter/X (160 chars) — all at once.' }
    ],
    'Contract Review': [
      { target: '#contractInput,#contextInput,.input-textarea', title: 'Paste Your Contract', desc: 'Paste the full contract text here. Our analyzer will scan every clause for potential issues and missing protections.' },
      { target: '#generateBtn,.generate-btn', title: 'Run the Analysis', desc: 'Click to get a detailed breakdown with a Contract Score, red flags, and specific recommendations for your contract.' },
      { target: '.results-section', title: 'Review the Results', desc: 'Each issue is categorized by severity. Look for red flags first, then review suggestions to strengthen your position.' }
    ],
    'Rate Calculator': [
      { target: '#annualInput,#incomeInput,.input-field', title: 'Enter Your Financials', desc: 'Input your desired annual income and expenses. We\'ll calculate the hourly rate you need to charge to hit your goals.' },
      { target: '#hoursInput,#workHours,.input-field', title: 'Set Your Work Hours', desc: 'Define how many billable hours you work per week. Be realistic — not all working hours are billable.' },
      { target: '#generateBtn,.generate-btn', title: 'Calculate Your Rate', desc: 'Get your recommended hourly, daily, and project rates broken down with a clear explanation of the math.' }
    ],
    'Invoice': [
      { target: '#clientName,.input-field', title: 'Add Client Details', desc: 'Enter your client\'s name and information. The invoice will be formatted professionally and ready to send.' },
      { target: '.input-textarea,#items,.input-field', title: 'Add Line Items', desc: 'List your services, quantities, and rates. The invoice total will be calculated automatically.' },
      { target: '#generateBtn,.generate-btn', title: 'Generate Invoice', desc: 'Create a professional PDF-ready invoice. Copy it, print it, or save it as a draft for later.' }
    ],
    'Proposal': [
      { target: '#contextInput,.input-textarea', title: 'Describe the Project', desc: 'Tell us about the project you\'re pitching for. Include the client\'s needs, budget range, and timeline.' },
      { target: '#toneSelect,.input-field', title: 'Set the Tone', desc: 'Choose between formal, friendly, or assertive. The proposal language will match your selected style.' },
      { target: '#generateBtn,.generate-btn', title: 'Generate Proposal', desc: 'Get a structured, persuasive proposal with scope, timeline, pricing, and terms — ready to customize and send.' }
    ],
    'Scope Analyzer': [
      { target: '#contextInput,.input-textarea', title: 'Paste the Project Brief', desc: 'Enter the project description or requirements document. The analyzer will identify scope boundaries and potential issues.' },
      { target: '#generateBtn,.generate-btn', title: 'Analyze Scope', desc: 'Run the analysis to get a detailed breakdown of deliverables, risks, and recommendations for clear scope boundaries.' },
      { target: '.results-section', title: 'Review Findings', desc: 'Each item is flagged with risk level. Pay attention to scope creep indicators and missing deliverable definitions.' }
    ],
    'Meeting Notes': [
      { target: '#contextInput,.input-textarea', title: 'Paste Meeting Notes', desc: 'Enter your raw meeting notes, transcript, or bullet points. We\'ll organize them into a professional summary.' },
      { target: '#generateBtn,.generate-btn', title: 'Generate Summary', desc: 'Get a structured meeting summary with key decisions, action items, and follow-ups — ready to share with your client.' },
      { target: '.results-section', title: 'Copy & Share', desc: 'Each section is clearly formatted. Copy the full summary or individual sections to send to your team or client.' }
    ],
    'Payment Checker': [
      { target: '#contextInput,.input-textarea,.input-field', title: 'Enter Payment Details', desc: 'Input the client name, invoice amount, and due date. We\'ll help you track and follow up on outstanding payments.' },
      { target: '#generateBtn,.generate-btn', title: 'Check Status', desc: 'Generate a payment status report with recommended follow-up actions based on how overdue the payment is.' },
      { target: '.results-section', title: 'Take Action', desc: 'Get ready-to-send follow-up emails and escalation templates for each stage of the payment collection process.' }
    ],
    'Client Red Flags': [
      { target: '#contextInput,.input-textarea', title: 'Describe the Client', desc: 'Paste messages, describe interactions, or share the project brief. We\'ll analyze for common freelancer red flags.' },
      { target: '#generateBtn,.generate-btn', title: 'Run the Scan', desc: 'Our analyzer checks for 20+ common red flags including scope creep signals, payment risk, and communication issues.' },
      { target: '.results-section', title: 'Review Warnings', desc: 'Each red flag comes with an explanation and recommended action. Use this to make informed decisions about taking on clients.' }
    ],
    'Fee Calculator': [
      { target: '.input-field', title: 'Enter Project Details', desc: 'Input the project parameters — hours, complexity, and expenses. We\'ll calculate the optimal fee to charge.' },
      { target: '#generateBtn,.generate-btn', title: 'Calculate Fee', desc: 'Get a comprehensive fee breakdown including your time, overhead, profit margin, and suggested client price.' },
      { target: '.results-section', title: 'Review Breakdown', desc: 'See exactly how your fee is composed. Use the breakdown to justify your pricing to clients with confidence.' }
    ],
    'Tax Estimator': [
      { target: '.input-field', title: 'Enter Your Income', desc: 'Input your freelance income and deductions. We\'ll estimate your tax obligations for the current year.' },
      { target: '#generateBtn,.generate-btn', title: 'Estimate Taxes', desc: 'Calculate estimated quarterly and annual tax payments based on your income and filing status.' },
      { target: '.results-section', title: 'Plan Ahead', desc: 'See your estimated tax breakdown and set-aside recommendations so you\'re never caught off guard at tax time.' }
    ],
    'Portfolio Review': [
      { target: '#contextInput,.input-textarea', title: 'Share Your Portfolio', desc: 'Paste your portfolio URL or describe your current portfolio. We\'ll analyze it for freelance client appeal.' },
      { target: '#generateBtn,.generate-btn', title: 'Get Feedback', desc: 'Receive a detailed portfolio review with scores for presentation, content quality, and client conversion potential.' },
      { target: '.results-section', title: 'Improve & Iterate', desc: 'Follow the specific suggestions to strengthen your portfolio. Each recommendation is actionable and prioritized.' }
    ],
    'SOW Generator': [
      { target: '#contextInput,.input-textarea,.input-field', title: 'Define the Project', desc: 'Enter the project details — scope, deliverables, and timeline. We\'ll generate a professional Statement of Work.' },
      { target: '#generateBtn,.generate-btn', title: 'Generate SOW', desc: 'Create a comprehensive SOW with clear scope boundaries, milestones, payment terms, and revision policies.' },
      { target: '.results-section', title: 'Customize & Send', desc: 'Review and edit the generated SOW. Copy it directly or use it as a starting point for your client agreement.' }
    ],
    'Project Brief': [
      { target: '#contextInput,.input-textarea,.input-field', title: 'Enter Project Info', desc: 'Describe the project goals, target audience, and requirements. The more context, the better the brief.' },
      { target: '#generateBtn,.generate-btn', title: 'Generate Brief', desc: 'Get a professional project brief with objectives, deliverables, timeline, and success criteria — structured for clarity.' },
      { target: '.results-section', title: 'Share with Client', desc: 'Use the generated brief to align with your client before starting work. It ensures everyone is on the same page.' }
    ]
  };

  function getStorageKey(toolName) {
    return STORAGE_PREFIX + toolName.toLowerCase().replace(/\s+/g, '-');
  }

  function hasSeen(toolName) {
    return localStorage.getItem(getStorageKey(toolName)) === '1';
  }

  function markSeen(toolName) {
    localStorage.setItem(getStorageKey(toolName), '1');
  }

  function findElement(selectorList) {
    var selectors = selectorList.split(',');
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i].trim());
      if (el) return el;
    }
    return null;
  }

  function init() {
    var toolName = document.body.getAttribute('data-tool-name');
    if (!toolName || hasSeen(toolName)) return;

    var tips = TOOL_TIPS[toolName];
    if (!tips) return;

    // Wait a bit for the page to fully render
    setTimeout(function() { startTour(toolName, tips); }, 1200);
  }

  function startTour(toolName, tips) {
    var currentStep = 0;

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    document.body.appendChild(overlay);

    // Create tooltip element
    var tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';
    tooltip.setAttribute('role', 'dialog');
    tooltip.setAttribute('aria-label', 'Onboarding tooltip');
    document.body.appendChild(tooltip);

    function showStep(index) {
      var tip = tips[index];
      var targetEl = findElement(tip.target);

      // Remove previous highlight
      var prev = document.querySelector('.onboarding-highlight');
      if (prev) prev.classList.remove('onboarding-highlight');

      // Build dots
      var dotsHtml = '';
      for (var d = 0; d < tips.length; d++) {
        dotsHtml += '<div class="onboarding-tooltip-dot' + (d === index ? ' active' : '') + '"></div>';
      }

      var isLast = index === tips.length - 1;
      var btnLabel = isLast ? 'Got it' : 'Next';
      var skipBtn = !isLast ? '<button class="onboarding-tooltip-btn secondary" data-action="skip">Skip</button>' : '';

      tooltip.innerHTML =
        '<div class="onboarding-tooltip-arrow top"></div>' +
        '<div class="onboarding-tooltip-step">Step ' + (index + 1) + ' of ' + tips.length + '</div>' +
        '<div class="onboarding-tooltip-title">' + tip.title + '</div>' +
        '<div class="onboarding-tooltip-desc">' + tip.desc + '</div>' +
        '<div class="onboarding-tooltip-footer">' +
          '<div class="onboarding-tooltip-dots">' + dotsHtml + '</div>' +
          '<div style="display:flex;gap:.4rem">' + skipBtn +
          '<button class="onboarding-tooltip-btn" data-action="next">' + btnLabel + '</button>' +
          '</div>' +
        '</div>';

      // Position tooltip
      if (targetEl) {
        targetEl.classList.add('onboarding-highlight');
        var rect = targetEl.getBoundingClientRect();
        var tooltipHeight = 200; // estimate
        var top = rect.bottom + 12;
        var left = rect.left + (rect.width / 2) - 160;

        // Adjust if off screen
        if (left < 12) left = 12;
        if (left + 320 > window.innerWidth) left = window.innerWidth - 332;
        if (top + tooltipHeight > window.innerHeight) {
          top = rect.top - tooltipHeight - 12;
          var arrow = tooltip.querySelector('.onboarding-tooltip-arrow');
          if (arrow) { arrow.className = 'onboarding-tooltip-arrow bottom'; }
        }

        // Scroll into view if needed
        if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(function() { positionTooltip(); }, 400);
        } else {
          positionTooltip();
        }

        function positionTooltip() {
          var r = targetEl.getBoundingClientRect();
          var t = r.bottom + 12;
          var l = r.left + (r.width / 2) - 160;
          if (l < 12) l = 12;
          if (l + 320 > window.innerWidth) l = window.innerWidth - 332;
          if (t + 200 > window.innerHeight) {
            t = r.top - 200 - 12;
            var a = tooltip.querySelector('.onboarding-tooltip-arrow');
            if (a) a.className = 'onboarding-tooltip-arrow bottom';
          }
          tooltip.style.top = t + 'px';
          tooltip.style.left = l + 'px';
        }

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
      } else {
        // Fallback: center on screen
        tooltip.style.top = '50%';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translate(-50%, -50%)';
        var arrow = tooltip.querySelector('.onboarding-tooltip-arrow');
        if (arrow) arrow.style.display = 'none';
      }

      // Activate
      overlay.classList.add('active');
      tooltip.classList.add('active');

      // Bind buttons
      var nextBtn = tooltip.querySelector('[data-action="next"]');
      var skipBtnEl = tooltip.querySelector('[data-action="skip"]');

      if (nextBtn) {
        nextBtn.onclick = function() {
          if (isLast) {
            closeTour();
          } else {
            currentStep++;
            tooltip.classList.remove('active');
            setTimeout(function() { showStep(currentStep); }, 200);
          }
        };
      }

      if (skipBtnEl) {
        skipBtnEl.onclick = function() { closeTour(); };
      }
    }

    function closeTour() {
      markSeen(toolName);
      overlay.classList.remove('active');
      tooltip.classList.remove('active');
      var highlighted = document.querySelector('.onboarding-highlight');
      if (highlighted) highlighted.classList.remove('onboarding-highlight');
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      }, 300);
    }

    // Close on overlay click
    overlay.addEventListener('click', function() { closeTour(); });

    // Close on Escape
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') {
        closeTour();
        document.removeEventListener('keydown', onEsc);
      }
    });

    showStep(0);
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
