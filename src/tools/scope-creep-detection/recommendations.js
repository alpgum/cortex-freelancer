const { pickTopDrivers, formatHours } = require('./utils');

function buildTemplates({ workflow, topSignals }) {
  const clientName = workflow?.clientName || workflow?.clientId || 'Client';
  const projectName = workflow?.projectName || 'the project';
  const revisionRounds = workflow?.contract?.terms?.revisionRounds ?? 1;

  const timeOverrun = topSignals.find(s => s.id === 'time_overrun');
  const planned = timeOverrun?.details?.plannedHours;
  const actual = timeOverrun?.details?.actualHours;

  const overrunLine = (planned && actual)
    ? `Right now we’re at ~${formatHours(actual)} vs the original plan of ~${formatHours(planned)}.`
    : 'Right now the effort is trending above the original plan.';

  return {
    scopeConfirmEmail: [
      `Subject: ${projectName} — scope confirmation`,
      '',
      `Hi ${clientName},`,
      '',
      `Quick check-in to keep us aligned:`,
      `• In-scope deliverables: ${Array.isArray(workflow?.contract?.terms?.deliverables) ? workflow.contract.terms.deliverables.join('; ') : '[list deliverables]'}`,
      `• Included revision rounds: ${revisionRounds}`,
      '',
      `If anything has changed since the original agreement, can you reply with a short list of new requests so I can estimate impact?`,
      '',
      `Thanks,`,
      `[Your Name]`,
    ].join('\n'),

    changeOrderEmail: [
      `Subject: ${projectName} — change request estimate / change order`,
      '',
      `Hi ${clientName},`,
      '',
      `Happy to help with the new requests. To keep things predictable on timeline and budget, I’d like to treat them as a change order.`,
      '',
      overrunLine,
      '',
      `Here are two options:`,
      `A) Re-scope: We swap/trim items so we stay within the original budget/time.`,
      `B) Change order: We add the new work with an updated estimate and price.`,
      '',
      `If you confirm which option you prefer, I’ll send the updated milestone plan and we can proceed immediately.`,
      '',
      `Best,`,
      `[Your Name]`,
    ].join('\n'),

    revisionBoundaryMessage: [
      `Hi ${clientName} — just a quick note: the agreement includes ${revisionRounds} revision round(s).`,
      `I’m happy to keep iterating; once we go beyond that, I’ll send a small change order so it stays fair and predictable for both sides.`
    ].join('\n'),

    timelineBoundaryMessage: [
      `Hi ${clientName} — I can prioritize this, but to hit an earlier deadline we’ll need to either:`,
      `1) reduce scope, or`,
      `2) add budget for extra capacity / accelerated timeline.`,
      `Tell me which you prefer and I’ll propose the fastest path.`
    ].join('\n'),
  };
}

function suggestedAutomations({ workflow, severity, topSignals }) {
  const projectId = workflow?.id;
  const clientId = workflow?.clientId;

  const automations = [];

  // These are *suggestions* for existing automation engines to consume.
  automations.push({
    type: 'log_event',
    parameters: {
      projectId,
      kind: 'scope_creep_risk',
      severity,
      topDrivers: topSignals.map(s => s.id),
    }
  });

  if (severity === 'medium' || severity === 'high') {
    automations.push({
      type: 'send_email',
      parameters: {
        template: 'scope_confirmation',
        clientId,
        projectId,
      }
    });
  }

  if (severity === 'high') {
    automations.push({
      type: 'update_crm',
      parameters: {
        action: 'flag_risk',
        clientId,
        projectId,
        risk: 'scope_creep',
      }
    });
  }

  return automations;
}

function recommendationsFor({ workflow, scored }) {
  const topSignals = pickTopDrivers(scored.signals || [], 3);
  const tier = scored.severity;

  const commonSteps = [
    'Write down the current scope baseline (deliverables + revision rounds + deadline).',
    'Route any new requests through a single intake channel (one thread) to avoid drip-scope.',
    'Estimate impact in hours + timeline before starting the new work.',
  ];

  const low = [
    ...commonSteps,
    'Send a short scope confirmation message and ask for explicit approval on any new requests.',
  ];

  const medium = [
    ...commonSteps,
    'Schedule a 15–20 min scope review call focused on tradeoffs (scope vs deadline vs budget).',
    'Introduce a lightweight change-order process: every new deliverable gets a written estimate + approval.',
    'Re-baseline milestones and document what moved (and why).',
  ];

  const high = [
    ...commonSteps,
    'Pause any out-of-scope items until written approval is received (protect margin + focus).',
    'Send a formal change order / re-scope proposal with updated timeline and price.',
    'If revisions are the driver: enforce revision caps and require consolidated feedback rounds.',
    'If meetings are the driver: reduce to 1 standing call/week and move updates async.',
  ];

  // Driver-specific add-ons
  const addOns = [];
  const ids = new Set(topSignals.map(s => s.id));

  if (ids.has('meeting_overhead')) {
    addOns.push('Introduce an async update template and batch questions to reduce meeting frequency.');
  }
  if (ids.has('unpaid_work')) {
    addOns.push('Audit non-billable time and label it explicitly; convert recurring unpaid work into a paid line item.');
  }
  if (ids.has('revisions')) {
    addOns.push('Ask for consolidated feedback in one round; define what counts as a “revision round”.');
  }
  if (ids.has('timeline_compression')) {
    addOns.push('Offer a “fast-track” option (reduced scope) vs “accelerated” option (extra budget).');
  }

  const steps = tier === 'high' ? [...high, ...addOns] : tier === 'medium' ? [...medium, ...addOns] : [...low, ...addOns];

  return {
    tier,
    steps,
    templates: buildTemplates({ workflow, topSignals }),
    suggestedAutomations: suggestedAutomations({ workflow, severity: tier, topSignals }),
  };
}

module.exports = { recommendationsFor };
