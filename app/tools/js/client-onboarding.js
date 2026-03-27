/**
 * CortexClientOnboarding — Client Onboarding Workflow System
 * Interactive checklist: contract signed → collect requirements → setup project
 * → send welcome email → schedule kickoff.
 * Auto-generated documents at each step. Track onboarding progress per client.
 *
 * Depends on: (optional) CortexProjectManager, CortexProjectTemplates
 * window.CortexClientOnboarding
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_client_onboarding';
  var VERSION = '1.0.0';

  /* ── Workflow Steps ───────────────────────────────────────── */

  var STEPS = [
    {
      id: 'contract_signed',
      label: 'Contract Signed',
      icon: '📝',
      description: 'Review and sign the service agreement',
      checklist: [
        { id: 'review_scope', label: 'Review scope of work' },
        { id: 'set_rate', label: 'Confirm rate & payment terms' },
        { id: 'sign_contract', label: 'Contract signed by both parties' },
        { id: 'store_contract', label: 'Store signed contract copy' }
      ],
      document: 'contract'
    },
    {
      id: 'collect_requirements',
      label: 'Collect Requirements',
      icon: '📋',
      description: 'Gather project details and client preferences',
      checklist: [
        { id: 'send_questionnaire', label: 'Send requirements questionnaire' },
        { id: 'receive_assets', label: 'Receive brand assets / credentials' },
        { id: 'define_goals', label: 'Define project goals & KPIs' },
        { id: 'identify_stakeholders', label: 'Identify key stakeholders' },
        { id: 'confirm_timeline', label: 'Confirm timeline expectations' }
      ],
      document: 'requirements'
    },
    {
      id: 'setup_project',
      label: 'Setup Project',
      icon: '⚙️',
      description: 'Create project workspace and configure tools',
      checklist: [
        { id: 'create_project', label: 'Create project in tracker' },
        { id: 'setup_repo', label: 'Setup repository / workspace' },
        { id: 'create_milestones', label: 'Define milestones & deliverables' },
        { id: 'setup_comms', label: 'Setup communication channel' },
        { id: 'share_access', label: 'Share access with client' }
      ],
      document: 'project_brief'
    },
    {
      id: 'send_welcome',
      label: 'Send Welcome Email',
      icon: '✉️',
      description: 'Send onboarding welcome package to client',
      checklist: [
        { id: 'draft_email', label: 'Draft welcome email' },
        { id: 'attach_docs', label: 'Attach project brief & timeline' },
        { id: 'include_contacts', label: 'Include contact information' },
        { id: 'send_email', label: 'Send welcome email' }
      ],
      document: 'welcome_email'
    },
    {
      id: 'schedule_kickoff',
      label: 'Schedule Kickoff',
      icon: '🚀',
      description: 'Schedule and prepare for kickoff meeting',
      checklist: [
        { id: 'propose_times', label: 'Propose meeting times' },
        { id: 'confirm_time', label: 'Confirm meeting date & time' },
        { id: 'prepare_agenda', label: 'Prepare kickoff agenda' },
        { id: 'send_invite', label: 'Send calendar invite' },
        { id: 'complete_kickoff', label: 'Kickoff meeting completed' }
      ],
      document: 'kickoff_agenda'
    }
  ];

  /* ── Storage ──────────────────────────────────────────────── */

  var _data = { onboardings: [], version: VERSION };

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        _data = { version: VERSION, onboardings: parsed.onboardings || [] };
      }
    } catch (e) { console.warn('Onboarding store load error:', e); }
    return _data.onboardings;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
    } catch (e) { console.error('Onboarding store save error:', e); }
  }

  function genId() {
    return 'onb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  /* ── CRUD ─────────────────────────────────────────────────── */

  function createOnboarding(clientData) {
    if (!clientData || !clientData.clientName) throw new Error('Client name is required');

    var now = new Date().toISOString();
    var steps = STEPS.map(function (step) {
      return {
        id: step.id,
        status: 'pending',
        completedAt: null,
        checklist: step.checklist.map(function (item) {
          return { id: item.id, checked: false, checkedAt: null };
        }),
        notes: '',
        generatedDoc: null
      };
    });

    var record = {
      id: genId(),
      clientName: clientData.clientName,
      clientEmail: clientData.clientEmail || '',
      clientCompany: clientData.clientCompany || '',
      projectName: clientData.projectName || '',
      projectType: clientData.projectType || '',
      rate: parseFloat(clientData.rate) || 0,
      paymentTerms: clientData.paymentTerms || 'net30',
      estimatedBudget: parseFloat(clientData.estimatedBudget) || 0,
      startDate: clientData.startDate || now.split('T')[0],
      kickoffDate: clientData.kickoffDate || '',
      steps: steps,
      currentStep: 0,
      status: 'in_progress',
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };

    _data.onboardings.unshift(record);
    save();
    return record;
  }

  function getOnboarding(id) {
    for (var i = 0; i < _data.onboardings.length; i++) {
      if (_data.onboardings[i].id === id) return _data.onboardings[i];
    }
    return null;
  }

  function getAllOnboardings() {
    return _data.onboardings.slice();
  }

  function updateOnboarding(id, updates) {
    var onb = getOnboarding(id);
    if (!onb) return null;

    var keys = Object.keys(updates);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] !== 'id' && keys[i] !== 'createdAt') {
        onb[keys[i]] = updates[keys[i]];
      }
    }
    onb.updatedAt = new Date().toISOString();
    save();
    return onb;
  }

  function deleteOnboarding(id) {
    var idx = -1;
    for (var i = 0; i < _data.onboardings.length; i++) {
      if (_data.onboardings[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return false;
    _data.onboardings.splice(idx, 1);
    save();
    return true;
  }

  /* ── Checklist Operations ─────────────────────────────────── */

  function toggleChecklistItem(onboardingId, stepId, itemId) {
    var onb = getOnboarding(onboardingId);
    if (!onb) return null;

    var step = null;
    for (var i = 0; i < onb.steps.length; i++) {
      if (onb.steps[i].id === stepId) { step = onb.steps[i]; break; }
    }
    if (!step) return null;

    var item = null;
    for (var j = 0; j < step.checklist.length; j++) {
      if (step.checklist[j].id === itemId) { item = step.checklist[j]; break; }
    }
    if (!item) return null;

    item.checked = !item.checked;
    item.checkedAt = item.checked ? new Date().toISOString() : null;

    // Update step status
    var allChecked = step.checklist.every(function (c) { return c.checked; });
    var anyChecked = step.checklist.some(function (c) { return c.checked; });

    if (allChecked) {
      step.status = 'completed';
      step.completedAt = new Date().toISOString();
    } else if (anyChecked) {
      step.status = 'in_progress';
      step.completedAt = null;
    } else {
      step.status = 'pending';
      step.completedAt = null;
    }

    // Auto-advance current step
    recalcCurrentStep(onb);

    // Check if entire onboarding is complete
    var allComplete = onb.steps.every(function (s) { return s.status === 'completed'; });
    if (allComplete) {
      onb.status = 'completed';
      onb.completedAt = new Date().toISOString();
    } else {
      onb.status = 'in_progress';
      onb.completedAt = null;
    }

    onb.updatedAt = new Date().toISOString();
    save();
    return onb;
  }

  function recalcCurrentStep(onb) {
    for (var i = 0; i < onb.steps.length; i++) {
      if (onb.steps[i].status !== 'completed') {
        onb.currentStep = i;
        return;
      }
    }
    onb.currentStep = onb.steps.length - 1;
  }

  function setStepNotes(onboardingId, stepId, notes) {
    var onb = getOnboarding(onboardingId);
    if (!onb) return null;

    for (var i = 0; i < onb.steps.length; i++) {
      if (onb.steps[i].id === stepId) {
        onb.steps[i].notes = notes;
        break;
      }
    }
    onb.updatedAt = new Date().toISOString();
    save();
    return onb;
  }

  /* ── Document Generation ──────────────────────────────────── */

  function generateDocument(onboardingId, stepId) {
    var onb = getOnboarding(onboardingId);
    if (!onb) return null;

    var step = null;
    var stepDef = null;
    for (var i = 0; i < onb.steps.length; i++) {
      if (onb.steps[i].id === stepId) {
        step = onb.steps[i];
        stepDef = STEPS[i];
        break;
      }
    }
    if (!step || !stepDef) return null;

    var doc = null;
    switch (stepDef.document) {
      case 'contract':
        doc = generateContractDoc(onb);
        break;
      case 'requirements':
        doc = generateRequirementsDoc(onb);
        break;
      case 'project_brief':
        doc = generateProjectBriefDoc(onb);
        break;
      case 'welcome_email':
        doc = generateWelcomeEmailDoc(onb);
        break;
      case 'kickoff_agenda':
        doc = generateKickoffAgendaDoc(onb);
        break;
    }

    if (doc) {
      step.generatedDoc = {
        type: stepDef.document,
        content: doc,
        generatedAt: new Date().toISOString()
      };
      onb.updatedAt = new Date().toISOString();
      save();
    }

    return doc;
  }

  function generateContractDoc(onb) {
    var date = formatDate(onb.startDate || new Date().toISOString());
    var rate = onb.rate ? '$' + onb.rate + '/hr' : 'TBD';
    var terms = formatPaymentTerms(onb.paymentTerms);

    return {
      title: 'Service Agreement',
      sections: [
        {
          heading: 'Parties',
          content: 'This Service Agreement ("Agreement") is entered into on ' + date + ' between:\n' +
            '• Service Provider: [Your Name / Business]\n' +
            '• Client: ' + esc(onb.clientName) + (onb.clientCompany ? ' (' + esc(onb.clientCompany) + ')' : '')
        },
        {
          heading: 'Scope of Work',
          content: 'Project: ' + esc(onb.projectName || 'TBD') + '\n' +
            'Type: ' + esc(onb.projectType || 'TBD') + '\n' +
            'Description: [Detailed scope to be defined during requirements phase]'
        },
        {
          heading: 'Compensation',
          content: 'Rate: ' + rate + '\n' +
            'Estimated Budget: ' + (onb.estimatedBudget ? '$' + onb.estimatedBudget.toLocaleString() : 'TBD') + '\n' +
            'Payment Terms: ' + terms
        },
        {
          heading: 'Timeline',
          content: 'Start Date: ' + date + '\n' +
            'Estimated Duration: [To be determined]\n' +
            'Milestones: [To be defined during project setup]'
        },
        {
          heading: 'Terms & Conditions',
          content: '• Revisions: Up to 2 rounds included per deliverable\n' +
            '• Late Payment: 1.5% monthly interest on overdue invoices\n' +
            '• Termination: 14 days written notice by either party\n' +
            '• IP Transfer: Upon full payment, all deliverables transfer to Client'
        }
      ]
    };
  }

  function generateRequirementsDoc(onb) {
    return {
      title: 'Requirements Questionnaire',
      sections: [
        {
          heading: 'Project Overview',
          content: 'Client: ' + esc(onb.clientName) + '\n' +
            'Project: ' + esc(onb.projectName || 'TBD') + '\n' +
            'Date: ' + formatDate(new Date().toISOString())
        },
        {
          heading: 'Business Goals',
          content: '1. What is the primary goal of this project?\n' +
            '2. Who is the target audience?\n' +
            '3. What does success look like? (KPIs)\n' +
            '4. Are there competitors or references to consider?'
        },
        {
          heading: 'Technical Requirements',
          content: '1. Preferred technologies or platforms?\n' +
            '2. Integration requirements (APIs, third-party services)?\n' +
            '3. Hosting / infrastructure preferences?\n' +
            '4. Performance expectations?'
        },
        {
          heading: 'Design & Brand',
          content: '1. Existing brand guidelines? (Y/N)\n' +
            '2. Color preferences or restrictions?\n' +
            '3. Reference websites / apps you like?\n' +
            '4. Assets to provide (logos, images, copy)?'
        },
        {
          heading: 'Timeline & Priorities',
          content: '1. Hard deadline? If so, what date?\n' +
            '2. Priority features (must-have vs. nice-to-have)?\n' +
            '3. Preferred communication frequency?\n' +
            '4. Key stakeholders and approval process?'
        }
      ]
    };
  }

  function generateProjectBriefDoc(onb) {
    var date = formatDate(onb.startDate || new Date().toISOString());

    return {
      title: 'Project Brief',
      sections: [
        {
          heading: 'Project Summary',
          content: 'Project: ' + esc(onb.projectName || 'TBD') + '\n' +
            'Client: ' + esc(onb.clientName) + (onb.clientCompany ? ' (' + esc(onb.clientCompany) + ')' : '') + '\n' +
            'Type: ' + esc(onb.projectType || 'TBD') + '\n' +
            'Start Date: ' + date + '\n' +
            'Budget: ' + (onb.estimatedBudget ? '$' + onb.estimatedBudget.toLocaleString() : 'TBD') + '\n' +
            'Rate: ' + (onb.rate ? '$' + onb.rate + '/hr' : 'TBD')
        },
        {
          heading: 'Objectives',
          content: '[List primary objectives based on requirements gathering]\n' +
            '1. \n2. \n3. '
        },
        {
          heading: 'Deliverables',
          content: '[List all expected deliverables]\n' +
            '1. \n2. \n3. '
        },
        {
          heading: 'Milestones & Timeline',
          content: '[Define key milestones with dates]\n' +
            '• Phase 1: Discovery — Week 1\n' +
            '• Phase 2: Design — Weeks 2-3\n' +
            '• Phase 3: Development — Weeks 4-6\n' +
            '• Phase 4: Review & Launch — Weeks 7-8'
        },
        {
          heading: 'Communication Plan',
          content: 'Primary Contact: ' + esc(onb.clientEmail || 'TBD') + '\n' +
            'Update Frequency: Weekly\n' +
            'Channel: [Slack / Email / Other]\n' +
            'Status Reports: Every Friday'
        }
      ]
    };
  }

  function generateWelcomeEmailDoc(onb) {
    var date = formatDate(onb.startDate || new Date().toISOString());

    return {
      title: 'Welcome Email',
      sections: [
        {
          heading: 'Subject',
          content: 'Welcome aboard! Let\'s kick off ' + esc(onb.projectName || 'your project')
        },
        {
          heading: 'Body',
          content: 'Hi ' + esc(onb.clientName.split(' ')[0]) + ',\n\n' +
            'Thank you for choosing to work together! I\'m excited to get started on ' +
            esc(onb.projectName || 'this project') + '.\n\n' +
            'Here\'s a quick overview of what to expect:\n\n' +
            '• Project Start: ' + date + '\n' +
            '• Rate: ' + (onb.rate ? '$' + onb.rate + '/hr' : 'As agreed') + '\n' +
            '• Payment: ' + formatPaymentTerms(onb.paymentTerms) + '\n' +
            (onb.estimatedBudget ? '• Estimated Budget: $' + onb.estimatedBudget.toLocaleString() + '\n' : '') +
            '\nAttached you\'ll find:\n' +
            '1. Project Brief — scope, timeline, and deliverables\n' +
            '2. Communication Plan — how we\'ll stay in sync\n\n' +
            'I\'ll be sending a calendar invite for our kickoff meeting shortly. In the meantime, feel free to reach out with any questions.\n\n' +
            'Looking forward to a great collaboration!\n\n' +
            'Best regards,\n[Your Name]'
        }
      ]
    };
  }

  function generateKickoffAgendaDoc(onb) {
    return {
      title: 'Kickoff Meeting Agenda',
      sections: [
        {
          heading: 'Meeting Details',
          content: 'Project: ' + esc(onb.projectName || 'TBD') + '\n' +
            'Client: ' + esc(onb.clientName) + '\n' +
            'Date: ' + (onb.kickoffDate ? formatDate(onb.kickoffDate) : '[TBD]') + '\n' +
            'Duration: 45-60 minutes'
        },
        {
          heading: 'Agenda',
          content: '1. Introductions & Roles (5 min)\n' +
            '   - Team members and responsibilities\n\n' +
            '2. Project Overview (10 min)\n' +
            '   - Goals and success criteria\n' +
            '   - Scope confirmation\n\n' +
            '3. Timeline & Milestones (10 min)\n' +
            '   - Key dates and deliverables\n' +
            '   - Dependencies and risks\n\n' +
            '4. Communication & Process (10 min)\n' +
            '   - Preferred channels\n' +
            '   - Meeting cadence\n' +
            '   - Feedback and approval workflow\n\n' +
            '5. Technical Setup (5 min)\n' +
            '   - Tools and access needed\n' +
            '   - Asset delivery plan\n\n' +
            '6. Questions & Next Steps (10 min)\n' +
            '   - Open discussion\n' +
            '   - Immediate action items'
        },
        {
          heading: 'Pre-Meeting Preparation',
          content: 'Client to prepare:\n' +
            '• Any remaining brand assets\n' +
            '• Access credentials (if applicable)\n' +
            '• List of stakeholders who need to be involved\n\n' +
            'Provider to prepare:\n' +
            '• Updated project brief\n' +
            '• Timeline visualization\n' +
            '• Communication channel setup'
        }
      ]
    };
  }

  /* ── Progress & Stats ─────────────────────────────────────── */

  function getProgress(onboardingId) {
    var onb = getOnboarding(onboardingId);
    if (!onb) return null;

    var totalItems = 0;
    var checkedItems = 0;
    var stepProgress = [];

    for (var i = 0; i < onb.steps.length; i++) {
      var step = onb.steps[i];
      var stepTotal = step.checklist.length;
      var stepChecked = step.checklist.filter(function (c) { return c.checked; }).length;
      totalItems += stepTotal;
      checkedItems += stepChecked;
      stepProgress.push({
        id: step.id,
        label: STEPS[i].label,
        icon: STEPS[i].icon,
        total: stepTotal,
        checked: stepChecked,
        percent: stepTotal > 0 ? Math.round((stepChecked / stepTotal) * 100) : 0,
        status: step.status
      });
    }

    return {
      overall: totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0,
      totalItems: totalItems,
      checkedItems: checkedItems,
      currentStep: onb.currentStep,
      steps: stepProgress,
      status: onb.status
    };
  }

  function getStats() {
    var all = _data.onboardings;
    var active = all.filter(function (o) { return o.status === 'in_progress'; }).length;
    var completed = all.filter(function (o) { return o.status === 'completed'; }).length;

    var avgCompletion = 0;
    if (all.length > 0) {
      var totalPercent = 0;
      for (var i = 0; i < all.length; i++) {
        var prog = getProgress(all[i].id);
        if (prog) totalPercent += prog.overall;
      }
      avgCompletion = Math.round(totalPercent / all.length);
    }

    // Average days to complete
    var completedOnes = all.filter(function (o) { return o.completedAt; });
    var avgDays = 0;
    if (completedOnes.length > 0) {
      var totalDays = completedOnes.reduce(function (sum, o) {
        return sum + (new Date(o.completedAt) - new Date(o.createdAt)) / 86400000;
      }, 0);
      avgDays = Math.round(totalDays / completedOnes.length);
    }

    return {
      total: all.length,
      active: active,
      completed: completed,
      avgCompletion: avgCompletion,
      avgDaysToComplete: avgDays
    };
  }

  /* ── Document Export ──────────────────────────────────────── */

  function exportDocumentText(doc) {
    if (!doc) return '';
    var lines = [];
    lines.push('═'.repeat(50));
    lines.push(doc.title.toUpperCase());
    lines.push('═'.repeat(50));
    lines.push('');

    for (var i = 0; i < doc.sections.length; i++) {
      var sec = doc.sections[i];
      lines.push('── ' + sec.heading + ' ──');
      lines.push('');
      lines.push(sec.content);
      lines.push('');
    }

    lines.push('─'.repeat(50));
    lines.push('Generated by Cortex Freelancer · ' + new Date().toLocaleDateString());
    return lines.join('\n');
  }

  function copyDocumentToClipboard(doc) {
    var text = exportDocumentText(doc);
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  /* ── Helpers ──────────────────────────────────────────────── */

  function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function formatPaymentTerms(terms) {
    var map = {
      'net15': 'Net 15', 'net30': 'Net 30', 'net45': 'Net 45', 'net60': 'Net 60',
      'immediate': 'Due on Receipt', 'milestone': 'Milestone-based', 'custom': 'Custom'
    };
    return map[terms] || terms || 'Net 30';
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '—';
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return Math.floor(days / 30) + 'mo ago';
  }

  /* ── Demo Data ────────────────────────────────────────────── */

  function seedDemo() {
    if (_data.onboardings.length > 0) return;

    var demo1 = createOnboarding({
      clientName: 'Sarah Chen',
      clientEmail: 'sarah@techvista.io',
      clientCompany: 'TechVista Inc.',
      projectName: 'Analytics Dashboard Redesign',
      projectType: 'Web Development',
      rate: 150,
      paymentTerms: 'net30',
      estimatedBudget: 18000,
      startDate: '2026-03-20'
    });

    // Mark first two steps as complete
    if (demo1) {
      var contractItems = STEPS[0].checklist;
      for (var i = 0; i < contractItems.length; i++) {
        toggleChecklistItem(demo1.id, 'contract_signed', contractItems[i].id);
      }
      var reqItems = STEPS[1].checklist;
      for (var j = 0; j < reqItems.length; j++) {
        toggleChecklistItem(demo1.id, 'collect_requirements', reqItems[j].id);
      }
      // Partially complete step 3
      toggleChecklistItem(demo1.id, 'setup_project', 'create_project');
      toggleChecklistItem(demo1.id, 'setup_project', 'setup_repo');
    }

    var demo2 = createOnboarding({
      clientName: 'Marcus Johnson',
      clientEmail: 'marcus@greenleaf.co',
      clientCompany: 'GreenLeaf Co.',
      projectName: 'E-commerce Platform Migration',
      projectType: 'E-commerce',
      rate: 125,
      paymentTerms: 'net15',
      estimatedBudget: 12000,
      startDate: '2026-03-24'
    });

    // Mark first step partially complete
    if (demo2) {
      toggleChecklistItem(demo2.id, 'contract_signed', 'review_scope');
      toggleChecklistItem(demo2.id, 'contract_signed', 'set_rate');
    }
  }

  /* ── Init ─────────────────────────────────────────────────── */

  load();

  /* ── Public API ───────────────────────────────────────────── */

  window.CortexClientOnboarding = {
    STEPS: STEPS,

    // CRUD
    create: createOnboarding,
    get: getOnboarding,
    getAll: getAllOnboardings,
    update: updateOnboarding,
    delete: deleteOnboarding,

    // Checklist
    toggleItem: toggleChecklistItem,
    setStepNotes: setStepNotes,

    // Documents
    generateDocument: generateDocument,
    exportDocumentText: exportDocumentText,
    copyDocument: copyDocumentToClipboard,

    // Progress & Stats
    getProgress: getProgress,
    getStats: getStats,

    // Utilities
    seedDemo: seedDemo,
    timeAgo: timeAgo,
    esc: esc,
    formatDate: formatDate,
    formatPaymentTerms: formatPaymentTerms
  };
})();
