#!/usr/bin/env node
/**
 * Client Onboarding Workflow Automation
 * Sprint 2 Task 16 — Cortex Freelancer
 *
 * Automates the entire client onboarding journey: welcome sequences,
 * document collection, project setup checklists, kick-off scheduling,
 * and progress tracking. Reduces manual overhead and ensures consistent
 * first impressions across all new clients.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Storage ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'onboarding'
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const PATHS = {
  workflows:   () => path.join(DATA_DIR, 'workflows.json'),
  templates:   () => path.join(DATA_DIR, 'templates.json'),
  checklists:  () => path.join(DATA_DIR, 'checklists.json'),
  documents:   () => path.join(DATA_DIR, 'documents.json'),
  settings:    () => path.join(DATA_DIR, 'settings.json'),
};

// ─── Default Onboarding Templates ──────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    id: 'standard',
    name: 'Standard Project Onboarding',
    description: 'Full onboarding for typical client projects',
    phases: [
      {
        name: 'Welcome & Discovery',
        order: 1,
        duration_days: 2,
        steps: [
          { id: 'welcome_email', label: 'Send welcome email with intro packet', type: 'automated', required: true },
          { id: 'questionnaire', label: 'Send project questionnaire', type: 'automated', required: true },
          { id: 'nda_sign', label: 'NDA signature requested', type: 'document', required: false },
          { id: 'discovery_call', label: 'Schedule discovery call', type: 'manual', required: true },
        ]
      },
      {
        name: 'Documentation & Access',
        order: 2,
        duration_days: 3,
        steps: [
          { id: 'contract_sign', label: 'Contract signed by both parties', type: 'document', required: true },
          { id: 'collect_brand', label: 'Collect brand assets & guidelines', type: 'document', required: false },
          { id: 'access_granted', label: 'Request necessary tool/repo access', type: 'manual', required: true },
          { id: 'payment_setup', label: 'Payment method & billing confirmed', type: 'manual', required: true },
        ]
      },
      {
        name: 'Project Setup',
        order: 3,
        duration_days: 2,
        steps: [
          { id: 'project_folder', label: 'Create project folder structure', type: 'automated', required: true },
          { id: 'comm_channel', label: 'Set up communication channel (Slack/Discord)', type: 'manual', required: true },
          { id: 'timeline_draft', label: 'Draft project timeline & milestones', type: 'manual', required: true },
          { id: 'kickoff_meeting', label: 'Schedule kick-off meeting', type: 'manual', required: true },
        ]
      },
      {
        name: 'Launch & Confirm',
        order: 4,
        duration_days: 1,
        steps: [
          { id: 'kickoff_done', label: 'Kick-off meeting completed', type: 'manual', required: true },
          { id: 'first_invoice', label: 'Send first invoice / deposit request', type: 'automated', required: true },
          { id: 'expectations_doc', label: 'Share expectations & SLA document', type: 'automated', required: false },
          { id: 'onboarding_complete', label: 'Mark onboarding as complete', type: 'manual', required: true },
        ]
      }
    ]
  },
  {
    id: 'quick',
    name: 'Quick Start Onboarding',
    description: 'Lightweight onboarding for small/repeat clients',
    phases: [
      {
        name: 'Quick Setup',
        order: 1,
        duration_days: 1,
        steps: [
          { id: 'welcome_msg', label: 'Send welcome message', type: 'automated', required: true },
          { id: 'contract_sign', label: 'Contract / SOW signed', type: 'document', required: true },
          { id: 'payment_setup', label: 'Confirm payment method', type: 'manual', required: true },
          { id: 'kickoff_brief', label: 'Quick kick-off call or async brief', type: 'manual', required: true },
          { id: 'start_work', label: 'Begin work', type: 'manual', required: true },
        ]
      }
    ]
  },
  {
    id: 'retainer',
    name: 'Retainer Client Onboarding',
    description: 'Onboarding for ongoing retainer relationships',
    phases: [
      {
        name: 'Agreement & Setup',
        order: 1,
        duration_days: 3,
        steps: [
          { id: 'welcome_email', label: 'Send retainer welcome packet', type: 'automated', required: true },
          { id: 'retainer_agreement', label: 'Sign retainer agreement', type: 'document', required: true },
          { id: 'scope_definition', label: 'Define monthly scope & deliverables', type: 'manual', required: true },
          { id: 'reporting_cadence', label: 'Agree on reporting cadence', type: 'manual', required: true },
        ]
      },
      {
        name: 'Systems Integration',
        order: 2,
        duration_days: 3,
        steps: [
          { id: 'tool_access', label: 'Set up shared tool access', type: 'manual', required: true },
          { id: 'comm_channel', label: 'Create dedicated comm channel', type: 'manual', required: true },
          { id: 'recurring_billing', label: 'Set up recurring billing', type: 'automated', required: true },
          { id: 'status_meetings', label: 'Schedule recurring status meetings', type: 'manual', required: true },
        ]
      },
      {
        name: 'First Cycle',
        order: 3,
        duration_days: 5,
        steps: [
          { id: 'first_sprint', label: 'Complete first work cycle', type: 'manual', required: true },
          { id: 'first_report', label: 'Deliver first status report', type: 'manual', required: true },
          { id: 'feedback_loop', label: 'Collect feedback & adjust', type: 'manual', required: true },
          { id: 'onboarding_complete', label: 'Confirm ongoing workflow', type: 'manual', required: true },
        ]
      }
    ]
  }
];

// ─── Welcome Message Templates ──────────────────────────────────────────────

const WELCOME_MESSAGES = {
  standard: {
    subject: 'Welcome aboard! Let\'s build something great 🚀',
    body: `Hi {client_name},

Thank you for choosing to work with me on {project_name}! I'm excited to get started.

Here's what happens next:

1. **Discovery Questionnaire** — I'll send a brief questionnaire to understand your vision, goals, and preferences.
2. **Contract & NDA** — We'll formalize our agreement so both sides are protected.
3. **Kick-off Call** — We'll schedule a call to align on scope, timeline, and communication preferences.
4. **Project Setup** — I'll set up our project workspace, communication channel, and timeline.

**Expected timeline:** We should be fully set up and working within {setup_days} business days.

If you have any questions in the meantime, don't hesitate to reach out!

Looking forward to our collaboration,
{freelancer_name}`
  },
  quick: {
    subject: 'Let\'s get started! ⚡',
    body: `Hi {client_name},

Great to work with you on {project_name}!

Quick next steps:
1. ✍️ Sign the attached contract/SOW
2. 💳 Confirm payment method
3. 📞 Quick kick-off (15 min call or async brief)

Then we're off to the races!

{freelancer_name}`
  },
  retainer: {
    subject: 'Welcome to our retainer partnership 🤝',
    body: `Hi {client_name},

I'm thrilled to formalize our ongoing partnership! Here's what to expect:

**Retainer Setup:**
- Monthly scope: {monthly_hours} hours / {monthly_deliverables}
- Billing: {billing_cycle} on the {billing_day}
- Reporting: {reporting_cadence}

**Next Steps:**
1. Sign the retainer agreement (attached)
2. Set up shared tools & communication
3. Define first month's priorities
4. Schedule recurring check-ins

I'll have everything ready within the week.

{freelancer_name}`
  }
};

// ─── Onboarding Questionnaire Templates ─────────────────────────────────────

const QUESTIONNAIRES = {
  web_project: {
    name: 'Web Project Discovery',
    questions: [
      { id: 'goals', q: 'What are the primary goals for this project?', type: 'text' },
      { id: 'audience', q: 'Who is your target audience?', type: 'text' },
      { id: 'competitors', q: 'Any competitor sites or designs you admire?', type: 'text' },
      { id: 'brand_guide', q: 'Do you have existing brand guidelines?', type: 'yes_no' },
      { id: 'timeline', q: 'What\'s your ideal launch date?', type: 'date' },
      { id: 'budget', q: 'What\'s your budget range?', type: 'select', options: ['Under $5K', '$5K-$15K', '$15K-$50K', '$50K+'] },
      { id: 'features', q: 'Key features needed (select all that apply):', type: 'multi', options: ['Blog', 'E-commerce', 'User Auth', 'API Integration', 'CMS', 'Analytics', 'SEO', 'Multilingual'] },
      { id: 'hosting', q: 'Do you have existing hosting / domain?', type: 'yes_no' },
      { id: 'content', q: 'Who will provide the content (text, images)?', type: 'text' },
      { id: 'maintenance', q: 'Will you need ongoing maintenance after launch?', type: 'yes_no' },
    ]
  },
  design_project: {
    name: 'Design Project Discovery',
    questions: [
      { id: 'design_type', q: 'What type of design work do you need?', type: 'select', options: ['Logo/Branding', 'UI/UX', 'Marketing Materials', 'Social Media', 'Packaging', 'Other'] },
      { id: 'style_pref', q: 'Describe your preferred style (modern, minimal, bold, etc.)', type: 'text' },
      { id: 'colors', q: 'Any specific colors or color palette preferences?', type: 'text' },
      { id: 'examples', q: 'Share links to designs you like:', type: 'text' },
      { id: 'deliverables', q: 'What file formats do you need?', type: 'multi', options: ['PNG', 'SVG', 'PDF', 'PSD', 'Figma', 'AI'] },
      { id: 'revisions', q: 'How many revision rounds do you expect?', type: 'select', options: ['1-2', '3-4', '5+', 'Unlimited'] },
    ]
  },
  consulting: {
    name: 'Consulting Engagement Discovery',
    questions: [
      { id: 'challenge', q: 'What\'s the main challenge you\'re facing?', type: 'text' },
      { id: 'tried', q: 'What have you already tried?', type: 'text' },
      { id: 'success_metrics', q: 'How will you measure success?', type: 'text' },
      { id: 'stakeholders', q: 'Who are the key stakeholders?', type: 'text' },
      { id: 'engagement_type', q: 'Preferred engagement style:', type: 'select', options: ['Advisory (async)', 'Workshops', 'Embedded (part-time)', 'Full-time sprint'] },
      { id: 'duration', q: 'Expected engagement duration:', type: 'select', options: ['One-time', '1-3 months', '3-6 months', '6+ months'] },
    ]
  }
};

// ─── Core Functions ─────────────────────────────────────────────────────────

function startOnboarding(clientName, projectName, opts = {}) {
  const workflows = readJSON(PATHS.workflows());
  const templateId = opts.template || 'standard';
  const templates = readJSON(PATHS.templates(), DEFAULT_TEMPLATES);
  const template = templates.find(t => t.id === templateId) || templates[0];

  if (!template) return { error: `Template "${templateId}" not found` };

  const now = new Date();
  const workflow = {
    id: crypto.randomUUID(),
    client_name: clientName,
    project_name: projectName,
    template_id: template.id,
    template_name: template.name,
    status: 'active',
    started_at: now.toISOString(),
    estimated_completion: new Date(now.getTime() + template.phases.reduce((sum, p) => sum + p.duration_days, 0) * 86400000).toISOString(),
    contact_email: opts.email || null,
    contact_phone: opts.phone || null,
    notes: opts.notes || '',
    project_type: opts.project_type || 'general',
    project_value: opts.value ? parseFloat(opts.value) : null,
    currency: opts.currency || 'USD',
    phases: template.phases.map(phase => ({
      ...phase,
      status: phase.order === 1 ? 'active' : 'pending',
      started_at: phase.order === 1 ? now.toISOString() : null,
      completed_at: null,
      steps: phase.steps.map(step => ({
        ...step,
        status: 'pending',
        completed_at: null,
        completed_by: null,
        notes: '',
      }))
    })),
    questionnaire_sent: false,
    questionnaire_completed: false,
    welcome_sent: false,
    documents_collected: [],
    activity_log: [
      { timestamp: now.toISOString(), action: 'onboarding_started', detail: `Started "${template.name}" workflow` }
    ]
  };

  workflows.push(workflow);
  writeJSON(PATHS.workflows(), workflows);

  return {
    success: true,
    workflow_id: workflow.id,
    client: clientName,
    project: projectName,
    template: template.name,
    phases: template.phases.length,
    total_steps: template.phases.reduce((sum, p) => sum + p.steps.length, 0),
    estimated_days: template.phases.reduce((sum, p) => sum + p.duration_days, 0),
    estimated_completion: workflow.estimated_completion,
    message: `🎉 Onboarding started for ${clientName} — "${projectName}"\n` +
             `📋 Template: ${template.name}\n` +
             `📊 ${template.phases.length} phases, ${template.phases.reduce((sum, p) => sum + p.steps.length, 0)} steps\n` +
             `⏱️ Estimated: ${template.phases.reduce((sum, p) => sum + p.duration_days, 0)} business days`
  };
}

function completeStep(workflowId, stepId, opts = {}) {
  const workflows = readJSON(PATHS.workflows());
  const wf = workflows.find(w => w.id === workflowId || w.client_name.toLowerCase().includes((workflowId || '').toLowerCase()));

  if (!wf) return { error: 'Workflow not found' };
  if (wf.status === 'completed') return { error: 'Onboarding already completed' };

  let stepFound = false;
  let phaseCompleted = false;
  let allPhasesCompleted = true;

  for (const phase of wf.phases) {
    for (const step of phase.steps) {
      if (step.id === stepId) {
        step.status = 'completed';
        step.completed_at = new Date().toISOString();
        step.completed_by = opts.by || 'freelancer';
        step.notes = opts.notes || step.notes;
        stepFound = true;

        wf.activity_log.push({
          timestamp: new Date().toISOString(),
          action: 'step_completed',
          detail: `✅ "${step.label}" completed in "${phase.name}"`
        });

        // Check if all required steps in phase are done
        const requiredSteps = phase.steps.filter(s => s.required);
        const completedRequired = requiredSteps.filter(s => s.status === 'completed');
        if (completedRequired.length === requiredSteps.length && requiredSteps.length > 0) {
          phase.status = 'completed';
          phase.completed_at = new Date().toISOString();
          phaseCompleted = true;

          wf.activity_log.push({
            timestamp: new Date().toISOString(),
            action: 'phase_completed',
            detail: `🎯 Phase "${phase.name}" completed!`
          });

          // Activate next phase
          const nextPhase = wf.phases.find(p => p.order === phase.order + 1);
          if (nextPhase && nextPhase.status === 'pending') {
            nextPhase.status = 'active';
            nextPhase.started_at = new Date().toISOString();
          }
        }
        break;
      }
    }
    if (phase.status !== 'completed') allPhasesCompleted = false;
  }

  if (!stepFound) return { error: `Step "${stepId}" not found in workflow` };

  // Check if entire onboarding is complete
  if (allPhasesCompleted) {
    wf.status = 'completed';
    wf.completed_at = new Date().toISOString();
    wf.activity_log.push({
      timestamp: new Date().toISOString(),
      action: 'onboarding_completed',
      detail: `🎉 Onboarding complete for ${wf.client_name}!`
    });
  }

  writeJSON(PATHS.workflows(), workflows);

  const totalSteps = wf.phases.reduce((sum, p) => sum + p.steps.length, 0);
  const completedSteps = wf.phases.reduce((sum, p) => sum + p.steps.filter(s => s.status === 'completed').length, 0);
  const progress = Math.round((completedSteps / totalSteps) * 100);

  return {
    success: true,
    workflow_id: wf.id,
    client: wf.client_name,
    step_completed: stepId,
    phase_completed: phaseCompleted,
    onboarding_completed: wf.status === 'completed',
    progress: `${completedSteps}/${totalSteps} (${progress}%)`,
    message: `✅ Step completed for ${wf.client_name}\n` +
             `📊 Progress: ${completedSteps}/${totalSteps} (${progress}%)` +
             (phaseCompleted ? '\n🎯 Phase completed!' : '') +
             (wf.status === 'completed' ? '\n🎉 ONBOARDING COMPLETE!' : '')
  };
}

function getWorkflowStatus(workflowId) {
  const workflows = readJSON(PATHS.workflows());
  const wf = workflows.find(w => w.id === workflowId || w.client_name.toLowerCase().includes((workflowId || '').toLowerCase()));

  if (!wf) return { error: 'Workflow not found' };

  const totalSteps = wf.phases.reduce((sum, p) => sum + p.steps.length, 0);
  const completedSteps = wf.phases.reduce((sum, p) => sum + p.steps.filter(s => s.status === 'completed').length, 0);
  const progress = Math.round((completedSteps / totalSteps) * 100);

  const phaseSummary = wf.phases.map(phase => {
    const done = phase.steps.filter(s => s.status === 'completed').length;
    const total = phase.steps.length;
    const icon = phase.status === 'completed' ? '✅' : phase.status === 'active' ? '🔵' : '⏳';
    return {
      name: phase.name,
      status: phase.status,
      icon,
      progress: `${done}/${total}`,
      steps: phase.steps.map(s => ({
        id: s.id,
        label: s.label,
        status: s.status,
        required: s.required,
        type: s.type,
        icon: s.status === 'completed' ? '✅' : s.required ? '🔴' : '⚪'
      }))
    };
  });

  // Calculate days elapsed and remaining
  const startDate = new Date(wf.started_at);
  const now = new Date();
  const daysElapsed = Math.floor((now - startDate) / 86400000);
  const estComplete = new Date(wf.estimated_completion);
  const daysRemaining = Math.max(0, Math.floor((estComplete - now) / 86400000));

  return {
    workflow_id: wf.id,
    client: wf.client_name,
    project: wf.project_name,
    template: wf.template_name,
    status: wf.status,
    progress: `${completedSteps}/${totalSteps} (${progress}%)`,
    progress_bar: generateProgressBar(progress),
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    started: wf.started_at.split('T')[0],
    estimated_completion: wf.estimated_completion.split('T')[0],
    phases: phaseSummary,
    next_actions: getNextActions(wf),
    blockers: getBlockers(wf)
  };
}

function generateProgressBar(pct) {
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${pct}%`;
}

function getNextActions(wf) {
  const actions = [];
  for (const phase of wf.phases) {
    if (phase.status !== 'active') continue;
    for (const step of phase.steps) {
      if (step.status === 'pending') {
        actions.push({
          step_id: step.id,
          label: step.label,
          type: step.type,
          required: step.required,
          phase: phase.name
        });
      }
    }
  }
  return actions;
}

function getBlockers(wf) {
  const blockers = [];
  for (const phase of wf.phases) {
    if (phase.status !== 'active') continue;
    for (const step of phase.steps) {
      if (step.status === 'pending' && step.required) {
        // Check if step has been pending too long (phase duration exceeded)
        if (phase.started_at) {
          const phaseStart = new Date(phase.started_at);
          const daysSinceStart = (new Date() - phaseStart) / 86400000;
          if (daysSinceStart > phase.duration_days * 1.5) {
            blockers.push({
              step_id: step.id,
              label: step.label,
              phase: phase.name,
              overdue_days: Math.floor(daysSinceStart - phase.duration_days)
            });
          }
        }
      }
    }
  }
  return blockers;
}

function generateWelcomeMessage(workflowId, opts = {}) {
  const workflows = readJSON(PATHS.workflows());
  const wf = workflows.find(w => w.id === workflowId || w.client_name.toLowerCase().includes((workflowId || '').toLowerCase()));

  if (!wf) return { error: 'Workflow not found' };

  const settings = readJSON(PATHS.settings(), {});
  const templateKey = wf.template_id || 'standard';
  const msgTemplate = WELCOME_MESSAGES[templateKey] || WELCOME_MESSAGES.standard;

  const totalDays = wf.phases.reduce((sum, p) => sum + (p.duration_days || 0), 0);

  const message = msgTemplate.body
    .replace(/{client_name}/g, wf.client_name)
    .replace(/{project_name}/g, wf.project_name)
    .replace(/{freelancer_name}/g, settings.freelancer_name || opts.name || 'Your freelancer')
    .replace(/{setup_days}/g, totalDays)
    .replace(/{monthly_hours}/g, opts.monthly_hours || 'TBD')
    .replace(/{monthly_deliverables}/g, opts.monthly_deliverables || 'TBD')
    .replace(/{billing_cycle}/g, opts.billing_cycle || 'Monthly')
    .replace(/{billing_day}/g, opts.billing_day || '1st')
    .replace(/{reporting_cadence}/g, opts.reporting_cadence || 'Weekly');

  wf.welcome_sent = true;
  wf.activity_log.push({
    timestamp: new Date().toISOString(),
    action: 'welcome_generated',
    detail: 'Welcome message generated'
  });
  writeJSON(PATHS.workflows(), workflows);

  return {
    success: true,
    subject: msgTemplate.subject,
    message,
    client: wf.client_name,
    project: wf.project_name
  };
}

function generateQuestionnaire(workflowId, questionnaireType) {
  const workflows = readJSON(PATHS.workflows());
  const wf = workflows.find(w => w.id === workflowId || w.client_name.toLowerCase().includes((workflowId || '').toLowerCase()));

  if (!wf) return { error: 'Workflow not found' };

  const qType = questionnaireType || wf.project_type || 'web_project';
  const questionnaire = QUESTIONNAIRES[qType];

  if (!questionnaire) {
    return {
      error: `Unknown questionnaire type "${qType}"`,
      available: Object.keys(QUESTIONNAIRES)
    };
  }

  wf.questionnaire_sent = true;
  wf.questionnaire_type = qType;
  wf.activity_log.push({
    timestamp: new Date().toISOString(),
    action: 'questionnaire_generated',
    detail: `"${questionnaire.name}" questionnaire generated`
  });
  writeJSON(PATHS.workflows(), workflows);

  let formatted = `📋 **${questionnaire.name}**\n`;
  formatted += `Client: ${wf.client_name} | Project: ${wf.project_name}\n\n`;

  questionnaire.questions.forEach((q, i) => {
    formatted += `${i + 1}. ${q.q}\n`;
    if (q.type === 'select' && q.options) {
      q.options.forEach(opt => { formatted += `   ○ ${opt}\n`; });
    } else if (q.type === 'multi' && q.options) {
      q.options.forEach(opt => { formatted += `   ☐ ${opt}\n`; });
    } else if (q.type === 'yes_no') {
      formatted += `   ○ Yes  ○ No\n`;
    }
    formatted += '\n';
  });

  return {
    success: true,
    questionnaire_name: questionnaire.name,
    type: qType,
    question_count: questionnaire.questions.length,
    formatted,
    raw: questionnaire.questions,
    client: wf.client_name,
    project: wf.project_name
  };
}

function collectDocument(workflowId, docName, opts = {}) {
  const workflows = readJSON(PATHS.workflows());
  const wf = workflows.find(w => w.id === workflowId || w.client_name.toLowerCase().includes((workflowId || '').toLowerCase()));

  if (!wf) return { error: 'Workflow not found' };

  const doc = {
    id: crypto.randomUUID(),
    name: docName,
    type: opts.type || 'general',
    status: opts.status || 'received',
    received_at: new Date().toISOString(),
    file_path: opts.path || null,
    notes: opts.notes || '',
    reviewed: false
  };

  wf.documents_collected.push(doc);
  wf.activity_log.push({
    timestamp: new Date().toISOString(),
    action: 'document_collected',
    detail: `📄 Document received: "${docName}"`
  });
  writeJSON(PATHS.workflows(), workflows);

  return {
    success: true,
    document_id: doc.id,
    name: docName,
    client: wf.client_name,
    total_documents: wf.documents_collected.length,
    message: `📄 Document "${docName}" collected for ${wf.client_name}`
  };
}

function listWorkflows(opts = {}) {
  const workflows = readJSON(PATHS.workflows());
  const statusFilter = opts.status || 'all';

  const filtered = statusFilter === 'all'
    ? workflows
    : workflows.filter(w => w.status === statusFilter);

  if (filtered.length === 0) {
    return { workflows: [], message: 'No onboarding workflows found.' };
  }

  return {
    total: filtered.length,
    workflows: filtered.map(wf => {
      const totalSteps = wf.phases.reduce((sum, p) => sum + p.steps.length, 0);
      const completedSteps = wf.phases.reduce((sum, p) => sum + p.steps.filter(s => s.status === 'completed').length, 0);
      const progress = Math.round((completedSteps / totalSteps) * 100);
      const icon = wf.status === 'completed' ? '✅' : wf.status === 'active' ? '🔵' : '⏸️';

      return {
        id: wf.id,
        icon,
        client: wf.client_name,
        project: wf.project_name,
        template: wf.template_name,
        status: wf.status,
        progress: `${progress}%`,
        started: wf.started_at.split('T')[0],
        next_actions: getNextActions(wf).length
      };
    })
  };
}

function generateChecklist(workflowId) {
  const workflows = readJSON(PATHS.workflows());
  const wf = workflows.find(w => w.id === workflowId || w.client_name.toLowerCase().includes((workflowId || '').toLowerCase()));

  if (!wf) return { error: 'Workflow not found' };

  let checklist = `# 📋 Onboarding Checklist\n`;
  checklist += `**Client:** ${wf.client_name} | **Project:** ${wf.project_name}\n`;
  checklist += `**Template:** ${wf.template_name}\n\n`;

  for (const phase of wf.phases) {
    const icon = phase.status === 'completed' ? '✅' : phase.status === 'active' ? '🔵' : '⏳';
    checklist += `## ${icon} ${phase.name}\n`;

    for (const step of phase.steps) {
      const check = step.status === 'completed' ? '☑️' : '☐';
      const req = step.required ? '🔴' : '⚪';
      checklist += `${check} ${req} ${step.label}`;
      if (step.completed_at) {
        checklist += ` (${step.completed_at.split('T')[0]})`;
      }
      checklist += '\n';
    }
    checklist += '\n';
  }

  const totalSteps = wf.phases.reduce((sum, p) => sum + p.steps.length, 0);
  const completedSteps = wf.phases.reduce((sum, p) => sum + p.steps.filter(s => s.status === 'completed').length, 0);
  checklist += `---\n📊 Progress: ${completedSteps}/${totalSteps} (${Math.round((completedSteps / totalSteps) * 100)}%)\n`;

  return {
    success: true,
    client: wf.client_name,
    checklist
  };
}

function configureSettings(opts = {}) {
  const settings = readJSON(PATHS.settings(), {});

  if (opts.freelancer_name) settings.freelancer_name = opts.freelancer_name;
  if (opts.business_name) settings.business_name = opts.business_name;
  if (opts.email) settings.email = opts.email;
  if (opts.default_template) settings.default_template = opts.default_template;
  if (opts.auto_welcome !== undefined) settings.auto_welcome = opts.auto_welcome;
  if (opts.auto_questionnaire !== undefined) settings.auto_questionnaire = opts.auto_questionnaire;
  if (opts.default_currency) settings.default_currency = opts.default_currency;

  settings.updated_at = new Date().toISOString();
  writeJSON(PATHS.settings(), settings);

  return { success: true, settings };
}

function listTemplates() {
  const templates = readJSON(PATHS.templates(), DEFAULT_TEMPLATES);
  return {
    templates: templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      phases: t.phases.length,
      total_steps: t.phases.reduce((sum, p) => sum + p.steps.length, 0),
      estimated_days: t.phases.reduce((sum, p) => sum + p.duration_days, 0)
    }))
  };
}

function getActivityLog(workflowId, opts = {}) {
  const workflows = readJSON(PATHS.workflows());
  const wf = workflows.find(w => w.id === workflowId || w.client_name.toLowerCase().includes((workflowId || '').toLowerCase()));

  if (!wf) return { error: 'Workflow not found' };

  const limit = opts.limit || 20;
  const log = wf.activity_log.slice(-limit).reverse();

  return {
    client: wf.client_name,
    project: wf.project_name,
    total_events: wf.activity_log.length,
    showing: log.length,
    log: log.map(entry => ({
      time: entry.timestamp,
      action: entry.action,
      detail: entry.detail
    }))
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
📋 Client Onboarding Workflow Automation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMANDS:
  start <client> <project>    Start new onboarding workflow
    --template <id>           Template: standard|quick|retainer (default: standard)
    --email <email>           Client email
    --type <type>             Project type: web_project|design_project|consulting
    --value <amount>          Project value
    --currency <code>         Currency (default: USD)
    --notes <text>            Additional notes

  complete <id> <step>        Complete an onboarding step
    --by <person>             Who completed it
    --notes <text>            Step notes

  status <id>                 View workflow status & progress
  checklist <id>              Generate printable checklist
  welcome <id>                Generate welcome message
  questionnaire <id>          Generate project questionnaire
    --type <type>             Type: web_project|design_project|consulting

  collect-doc <id> <name>     Record document received
    --type <type>             Document type
    --notes <text>            Notes

  list                        List all workflows
    --status <status>         Filter: active|completed|all
  templates                   List available templates
  log <id>                    View activity log
    --limit <n>               Number of entries (default: 20)

  settings                    Configure defaults
    --name <name>             Freelancer name
    --business <name>         Business name
    --email <email>           Contact email
    --default-template <id>   Default template
    --currency <code>         Default currency

  help                        Show this help

EXAMPLES:
  node client-onboarding.js start "Acme Corp" "Website Redesign" --template standard
  node client-onboarding.js complete <id> welcome_email
  node client-onboarding.js status "acme"
  node client-onboarding.js welcome "acme"
  node client-onboarding.js questionnaire "acme" --type web_project
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    printHelp();
    return;
  }

  const command = args[0];
  const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };
  const hasFlag = (flag) => args.includes(flag);

  let result;

  switch (command) {
    case 'start':
      result = startOnboarding(args[1], args[2], {
        template: getFlag('--template'),
        email: getFlag('--email'),
        project_type: getFlag('--type'),
        value: getFlag('--value'),
        currency: getFlag('--currency'),
        notes: getFlag('--notes'),
      });
      break;

    case 'complete':
      result = completeStep(args[1], args[2], {
        by: getFlag('--by'),
        notes: getFlag('--notes'),
      });
      break;

    case 'status':
      result = getWorkflowStatus(args[1]);
      break;

    case 'checklist':
      result = generateChecklist(args[1]);
      break;

    case 'welcome':
      result = generateWelcomeMessage(args[1], {
        name: getFlag('--name'),
        monthly_hours: getFlag('--hours'),
        monthly_deliverables: getFlag('--deliverables'),
        billing_cycle: getFlag('--billing-cycle'),
        billing_day: getFlag('--billing-day'),
        reporting_cadence: getFlag('--reporting'),
      });
      break;

    case 'questionnaire':
      result = generateQuestionnaire(args[1], getFlag('--type'));
      break;

    case 'collect-doc':
      result = collectDocument(args[1], args[2], {
        type: getFlag('--type'),
        notes: getFlag('--notes'),
      });
      break;

    case 'list':
      result = listWorkflows({
        status: getFlag('--status') || 'all',
      });
      break;

    case 'templates':
      result = listTemplates();
      break;

    case 'log':
      result = getActivityLog(args[1], {
        limit: getFlag('--limit') ? parseInt(getFlag('--limit')) : 20,
      });
      break;

    case 'settings':
      result = configureSettings({
        freelancer_name: getFlag('--name'),
        business_name: getFlag('--business'),
        email: getFlag('--email'),
        default_template: getFlag('--default-template'),
        default_currency: getFlag('--currency'),
      });
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
