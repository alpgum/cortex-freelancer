/**
 * Workflow definition (state machine) for project lifecycle.
 *
 * Kept intentionally simple: plain JS objects + small engine.
 */

const STAGES = [
  'lead',
  'qualification',
  'proposal',
  'contract',
  'kickoff',
  'delivery',
  'invoicing',
  'payment_followups',
  'closeout',
  'referral_testimonial'
];

const DEFAULT_TASKS_BY_STAGE = {
  lead: [
    { id: 'capture_lead', title: 'Capture lead in CRM', required: true }
  ],
  qualification: [
    { id: 'analyze_job', title: 'Analyze job / requirements', required: true },
    { id: 'calculate_rate', title: 'Calculate rate / pricing baseline', required: true },
    { id: 'qualify_client', title: 'Assess fit + risks', required: true }
  ],
  proposal: [
    { id: 'generate_proposal', title: 'Generate proposal', required: true },
    { id: 'send_proposal', title: 'Send proposal to client', required: true },
    { id: 'proposal_followup', title: 'Follow up on proposal', required: false }
  ],
  contract: [
    { id: 'generate_contract', title: 'Generate contract/SOW', required: true },
    { id: 'send_contract', title: 'Send contract for signature', required: true }
  ],
  kickoff: [
    { id: 'kickoff_email', title: 'Send kickoff email + next steps', required: true },
    { id: 'create_milestones', title: 'Create milestones', required: true }
  ],
  delivery: [
    { id: 'track_time', title: 'Track time against milestones', required: false },
    { id: 'milestone_updates', title: 'Send milestone updates', required: false }
  ],
  invoicing: [
    { id: 'generate_invoice', title: 'Generate invoice', required: true },
    { id: 'send_invoice', title: 'Send invoice', required: true }
  ],
  payment_followups: [
    { id: 'payment_followup_1', title: 'Payment follow-up (gentle)', required: false },
    { id: 'payment_followup_2', title: 'Payment follow-up (firm)', required: false }
  ],
  closeout: [
    { id: 'handoff', title: 'Handoff deliverables + docs', required: true },
    { id: 'close_project', title: 'Close project in CRM', required: true }
  ],
  referral_testimonial: [
    { id: 'ask_testimonial', title: 'Ask for testimonial', required: false },
    { id: 'ask_referral', title: 'Ask for referral', required: false }
  ]
};

function defaultWorkflowDefinition() {
  return {
    id: 'cfx071_default_lifecycle_v1',
    version: 1,
    stages: STAGES,
    initialStage: 'lead',
    tasksByStage: DEFAULT_TASKS_BY_STAGE,
    transitions: STAGES.reduce((acc, stage, idx) => {
      acc[stage] = idx < STAGES.length - 1 ? [STAGES[idx + 1]] : [];
      return acc;
    }, {})
  };
}

module.exports = {
  STAGES,
  DEFAULT_TASKS_BY_STAGE,
  defaultWorkflowDefinition
};
