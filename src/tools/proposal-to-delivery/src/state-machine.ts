/**
 * State Machine for Proposal-to-Delivery Workflow
 * 
 * Manages stage definitions, transitions, conditions, rollback, and auto-actions.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowStage,
  StageDefinition,
  StageTransition,
  TransitionTrigger,
  Condition,
  AutoAction,
  Workflow,
} from './types';

// ─── Stage Definitions ─────────────────────────────────────────────────

export const STAGE_DEFINITIONS: Record<WorkflowStage, StageDefinition> = {
  proposal_accepted: {
    id: 'proposal_accepted',
    name: 'Proposal Accepted',
    description: 'Client has accepted the proposal. Ready for contract generation.',
    allowedTransitions: ['contract_generation', 'cancelled'],
    entryConditions: [
      { id: 'proposal_exists', description: 'Valid proposal ID', check: 'proposal_exists', required: true },
    ],
    exitConditions: [],
    autoActions: [
      {
        id: 'auto_advance_to_contract_generation',
        type: 'transition_stage',
        description: 'Move workflow into contract generation stage',
        parameters: { to: 'contract_generation' },
      },
      {
        id: 'notify_acceptance',
        type: 'send_notification',
        description: 'Notify freelancer of acceptance',
        parameters: { recipient: 'freelancer', template: 'proposal_accepted' },
      },
    ],
    timeoutHours: 24,
  },
  contract_generation: {
    id: 'contract_generation',
    name: 'Contract Generation',
    description: 'Contract is being generated from the proposal terms.',
    allowedTransitions: ['contract_review', 'cancelled'],
    rollbackTo: 'proposal_accepted',
    entryConditions: [],
    exitConditions: [
      { id: 'contract_generated', description: 'Contract has been generated', check: 'contract_generated', required: true },
    ],
    autoActions: [
      {
        id: 'create_contract',
        type: 'generate_contract',
        description: 'Generate contract from template',
        parameters: {},
      },
      {
        id: 'auto_advance_to_contract_review',
        type: 'transition_stage',
        description: 'Move workflow to contract review once generated',
        parameters: { to: 'contract_review' },
      },
    ],
    timeoutHours: 4,
  },
  contract_review: {
    id: 'contract_review',
    name: 'Contract Review',
    description: 'Contract sent to client for review.',
    allowedTransitions: ['contract_signed', 'contract_generation', 'cancelled'],
    rollbackTo: 'contract_generation',
    entryConditions: [
      { id: 'contract_generated', description: 'Contract exists', check: 'contract_generated', required: true },
    ],
    exitConditions: [],
    autoActions: [
      {
        id: 'notify_contract_sent',
        type: 'send_notification',
        description: 'Notify client that contract is ready for review',
        parameters: { recipient: 'client', template: 'contract_review' },
      },
    ],
    timeoutHours: 168, // 7 days
  },
  contract_signed: {
    id: 'contract_signed',
    name: 'Contract Signed',
    description: 'Both parties have signed the contract.',
    allowedTransitions: ['project_kickoff', 'cancelled'],
    entryConditions: [
      { id: 'contract_signed_check', description: 'Contract signed by both parties', check: 'contract_signed', required: true },
    ],
    exitConditions: [],
    autoActions: [
      {
        id: 'notify_signed',
        type: 'send_notification',
        description: 'Notify both parties of signed contract',
        parameters: { recipient: 'both', template: 'contract_signed' },
      },
      {
        id: 'update_timeline_start',
        type: 'update_timeline',
        description: 'Update timeline with actual start date',
        parameters: { action: 'set_actual_start' },
      },
      {
        id: 'auto_advance_to_kickoff',
        type: 'transition_stage',
        description: 'Move workflow into kickoff stage',
        parameters: { to: 'project_kickoff' },
      },
    ],
    timeoutHours: 24,
  },
  project_kickoff: {
    id: 'project_kickoff',
    name: 'Project Kickoff',
    description: 'Project initialization — setup tools, access, and schedule kickoff meeting.',
    allowedTransitions: ['milestone_setup', 'cancelled'],
    rollbackTo: 'contract_signed',
    entryConditions: [],
    exitConditions: [],
    autoActions: [
      {
        id: 'schedule_kickoff',
        type: 'schedule_meeting',
        description: 'Schedule kickoff meeting',
        parameters: { meetingType: 'kickoff' },
      },
      {
        id: 'notify_kickoff',
        type: 'send_notification',
        description: 'Send kickoff welcome to client',
        parameters: { recipient: 'client', template: 'project_kickoff' },
      },
      {
        id: 'auto_advance_to_milestone_setup',
        type: 'transition_stage',
        description: 'Move workflow into milestone setup',
        parameters: { to: 'milestone_setup' },
      },
    ],
    timeoutHours: 72,
  },
  milestone_setup: {
    id: 'milestone_setup',
    name: 'Milestone Setup',
    description: 'Creating milestones from proposal scope.',
    allowedTransitions: ['in_progress', 'cancelled'],
    rollbackTo: 'project_kickoff',
    entryConditions: [],
    exitConditions: [
      { id: 'milestones_created', description: 'At least one milestone exists', check: 'milestones_created', required: true },
    ],
    autoActions: [
      {
        id: 'auto_create_milestones',
        type: 'create_milestones',
        description: 'Auto-create milestones from proposal deliverables',
        parameters: {},
      },
      {
        id: 'create_delivery_checklist',
        type: 'create_checklist',
        description: 'Create delivery preparation checklist',
        parameters: {},
      },
      {
        id: 'auto_advance_to_in_progress',
        type: 'transition_stage',
        description: 'Move workflow into active work stage',
        parameters: { to: 'in_progress' },
      },
    ],
    timeoutHours: 24,
  },
  in_progress: {
    id: 'in_progress',
    name: 'In Progress',
    description: 'Active project work on current milestone.',
    allowedTransitions: ['milestone_review', 'delivery_prep', 'cancelled'],
    entryConditions: [
      { id: 'milestones_created', description: 'Milestones exist', check: 'milestones_created', required: true },
    ],
    exitConditions: [],
    autoActions: [
      {
        id: 'notify_work_started',
        type: 'send_notification',
        description: 'Notify client that work has started',
        parameters: { recipient: 'client', template: 'work_started' },
      },
    ],
  },
  milestone_review: {
    id: 'milestone_review',
    name: 'Milestone Review',
    description: 'Current milestone deliverables under client review.',
    allowedTransitions: ['in_progress', 'delivery_prep', 'cancelled'],
    rollbackTo: 'in_progress',
    entryConditions: [],
    exitConditions: [],
    autoActions: [
      {
        id: 'notify_milestone_review',
        type: 'send_notification',
        description: 'Notify client of milestone ready for review',
        parameters: { recipient: 'client', template: 'milestone_review' },
      },
    ],
    timeoutHours: 120, // 5 days
  },
  delivery_prep: {
    id: 'delivery_prep',
    name: 'Delivery Preparation',
    description: 'Preparing final deliverables for quality check.',
    allowedTransitions: ['quality_check', 'cancelled'],
    rollbackTo: 'in_progress',
    entryConditions: [],
    exitConditions: [],
    autoActions: [
      {
        id: 'package_deliverables',
        type: 'package_deliverables',
        description: 'Package all deliverables for delivery',
        parameters: {},
      },
      {
        id: 'auto_advance_to_quality_check',
        type: 'transition_stage',
        description: 'Move workflow into quality check',
        parameters: { to: 'quality_check' },
      },
    ],
    timeoutHours: 48,
  },
  quality_check: {
    id: 'quality_check',
    name: 'Quality Check',
    description: 'Running quality assurance checks on deliverables.',
    allowedTransitions: ['client_delivery', 'delivery_prep', 'cancelled'],
    rollbackTo: 'delivery_prep',
    entryConditions: [],
    exitConditions: [
      { id: 'quality_passed', description: 'All required checks passed', check: 'quality_passed', required: true },
    ],
    autoActions: [
      {
        id: 'run_quality_checks',
        type: 'run_quality_check',
        description: 'Run automated quality checks',
        parameters: {},
      },
      {
        id: 'notify_quality_result',
        type: 'send_notification',
        description: 'Notify freelancer of quality check result',
        parameters: { recipient: 'freelancer', template: 'quality_check_result' },
      },
      {
        id: 'auto_advance_to_client_delivery',
        type: 'transition_stage',
        description: 'Move workflow to client delivery when quality passes',
        parameters: { to: 'client_delivery' },
      },
    ],
    timeoutHours: 24,
  },
  client_delivery: {
    id: 'client_delivery',
    name: 'Client Delivery',
    description: 'Deliverables sent to client.',
    allowedTransitions: ['client_review', 'cancelled'],
    entryConditions: [
      { id: 'quality_passed', description: 'Quality checks have passed', check: 'quality_passed', required: true },
    ],
    exitConditions: [],
    autoActions: [
      {
        id: 'notify_delivery',
        type: 'send_notification',
        description: 'Notify client of delivery',
        parameters: { recipient: 'client', template: 'deliverables_ready' },
      },
      {
        id: 'generate_final_invoice',
        type: 'generate_invoice',
        description: 'Generate final invoice',
        parameters: { type: 'final' },
      },
      {
        id: 'auto_advance_to_client_review',
        type: 'transition_stage',
        description: 'Move workflow to client review',
        parameters: { to: 'client_review' },
      },
    ],
    timeoutHours: 48,
  },
  client_review: {
    id: 'client_review',
    name: 'Client Review',
    description: 'Client is reviewing the final deliverables.',
    allowedTransitions: ['sign_off', 'revisions', 'cancelled'],
    entryConditions: [],
    exitConditions: [],
    autoActions: [
      {
        id: 'notify_review_request',
        type: 'send_notification',
        description: 'Request client review',
        parameters: { recipient: 'client', template: 'review_request' },
      },
    ],
    timeoutHours: 168, // 7 days
  },
  revisions: {
    id: 'revisions',
    name: 'Revisions',
    description: 'Addressing client feedback and making revisions.',
    allowedTransitions: ['client_review', 'quality_check', 'cancelled'],
    rollbackTo: 'client_review',
    entryConditions: [],
    exitConditions: [],
    autoActions: [
      {
        id: 'notify_revisions_started',
        type: 'send_notification',
        description: 'Notify client that revisions are in progress',
        parameters: { recipient: 'client', template: 'revisions_started' },
      },
    ],
    timeoutHours: 72,
  },
  sign_off: {
    id: 'sign_off',
    name: 'Sign-Off',
    description: 'Client has approved deliverables. Project complete.',
    allowedTransitions: ['completed'],
    entryConditions: [],
    exitConditions: [],
    autoActions: [
      {
        id: 'notify_sign_off',
        type: 'send_notification',
        description: 'Notify both parties of sign-off',
        parameters: { recipient: 'both', template: 'sign_off_complete' },
      },
      {
        id: 'final_timeline_update',
        type: 'update_timeline',
        description: 'Record final timeline',
        parameters: { action: 'set_actual_end' },
      },
      {
        id: 'auto_advance_to_completed',
        type: 'transition_stage',
        description: 'Complete workflow',
        parameters: { to: 'completed' },
      },
    ],
    timeoutHours: 24,
  },
  completed: {
    id: 'completed',
    name: 'Completed',
    description: 'Workflow finished. Project delivered and signed off.',
    allowedTransitions: [],
    entryConditions: [],
    exitConditions: [],
    autoActions: [
      {
        id: 'notify_completion',
        type: 'send_notification',
        description: 'Send project completion summary',
        parameters: { recipient: 'both', template: 'project_complete' },
      },
    ],
  },
  cancelled: {
    id: 'cancelled',
    name: 'Cancelled',
    description: 'Workflow cancelled.',
    allowedTransitions: [],
    entryConditions: [],
    exitConditions: [],
    autoActions: [
      {
        id: 'notify_cancellation',
        type: 'send_notification',
        description: 'Notify both parties of cancellation',
        parameters: { recipient: 'both', template: 'workflow_cancelled' },
      },
    ],
  },
};

// ─── State Machine Class ───────────────────────────────────────────────

export class WorkflowStateMachine {
  private definitions: Record<WorkflowStage, StageDefinition>;

  constructor(customDefinitions?: Partial<Record<WorkflowStage, Partial<StageDefinition>>>) {
    this.definitions = { ...STAGE_DEFINITIONS };
    if (customDefinitions) {
      for (const [stage, overrides] of Object.entries(customDefinitions)) {
        const key = stage as WorkflowStage;
        if (this.definitions[key]) {
          this.definitions[key] = { ...this.definitions[key], ...overrides };
        }
      }
    }
  }

  getStageDefinition(stage: WorkflowStage): StageDefinition {
    const def = this.definitions[stage];
    if (!def) throw new Error(`Unknown stage: ${stage}`);
    return def;
  }

  getAllStages(): StageDefinition[] {
    return Object.values(this.definitions);
  }

  /**
   * Validate whether a transition is allowed.
   */
  canTransition(from: WorkflowStage, to: WorkflowStage): { allowed: boolean; reason?: string } {
    const fromDef = this.definitions[from];
    if (!fromDef) return { allowed: false, reason: `Unknown stage: ${from}` };

    if (!fromDef.allowedTransitions.includes(to)) {
      return {
        allowed: false,
        reason: `Transition ${from} → ${to} not allowed. Valid: ${fromDef.allowedTransitions.join(', ')}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Execute a stage transition on a workflow.
   */
  transition(
    workflow: Workflow,
    targetStage: WorkflowStage,
    trigger: TransitionTrigger = 'manual',
    actor: string = 'system',
    notes?: string
  ): StageTransition {
    const { allowed, reason } = this.canTransition(workflow.currentStage, targetStage);
    if (!allowed) {
      throw new Error(reason);
    }

    // Check entry conditions of target
    const targetDef = this.definitions[targetStage];
    const conditionResults = this.checkConditions(targetDef.entryConditions, workflow);
    const failedRequired = conditionResults.filter(r => !r.met && r.required);
    if (failedRequired.length > 0) {
      throw new Error(
        `Entry conditions not met for ${targetStage}: ${failedRequired.map(c => c.description).join(', ')}`
      );
    }

    const now = new Date().toISOString();
    const lastEntry = workflow.stageHistory[workflow.stageHistory.length - 1];
    const duration = lastEntry ? new Date(now).getTime() - new Date(lastEntry.timestamp).getTime() : 0;

    const transition: StageTransition = {
      id: uuidv4(),
      from: workflow.currentStage,
      to: targetStage,
      trigger,
      timestamp: now,
      actor,
      notes,
      conditionsMet: conditionResults.filter(c => c.met).map(c => c.description),
      duration,
    };

    workflow.previousStage = workflow.currentStage;
    workflow.currentStage = targetStage;
    workflow.stageHistory.push(transition);
    workflow.updatedAt = now;

    return transition;
  }

  /**
   * Rollback to the previous allowed stage.
   */
  rollback(
    workflow: Workflow,
    actor: string = 'system',
    notes?: string
  ): StageTransition {
    const currentDef = this.definitions[workflow.currentStage];
    const rollbackTarget = currentDef.rollbackTo;

    if (!rollbackTarget) {
      throw new Error(`No rollback defined for stage: ${workflow.currentStage}`);
    }

    return this.transition(workflow, rollbackTarget, 'rollback', actor, notes || `Rolled back from ${workflow.currentStage}`);
  }

  /**
   * Get auto-actions for a given stage.
   */
  getAutoActions(stage: WorkflowStage): AutoAction[] {
    return this.definitions[stage]?.autoActions || [];
  }

  /**
   * Check conditions against a workflow.
   */
  checkConditions(
    conditions: Condition[],
    workflow: Workflow
  ): Array<{ description: string; met: boolean; required: boolean }> {
    return conditions.map(condition => ({
      description: condition.description,
      required: condition.required,
      met: this.evaluateCondition(condition, workflow),
    }));
  }

  private evaluateCondition(condition: Condition, workflow: Workflow): boolean {
    switch (condition.check) {
      case 'proposal_exists':
        return !!workflow.proposalId;
      case 'contract_generated':
        return !!workflow.contract && workflow.contract.status !== 'draft';
      case 'contract_signed':
        return !!workflow.contract && workflow.contract.status === 'signed';
      case 'milestones_created':
        return workflow.milestones.length > 0;
      case 'quality_passed':
        return workflow.deliveryChecklist
          .filter(item => item.required)
          .every(item => item.status === 'passed' || item.status === 'skipped');
      default:
        return true; // unknown conditions pass by default
    }
  }

  /**
   * Get the happy-path stage order.
   */
  getHappyPath(): WorkflowStage[] {
    return [
      'proposal_accepted',
      'contract_generation',
      'contract_review',
      'contract_signed',
      'project_kickoff',
      'milestone_setup',
      'in_progress',
      'milestone_review',
      'delivery_prep',
      'quality_check',
      'client_delivery',
      'client_review',
      'sign_off',
      'completed',
    ];
  }

  /**
   * Check if workflow is in a terminal state.
   */
  isTerminal(stage: WorkflowStage): boolean {
    return this.definitions[stage]?.allowedTransitions.length === 0;
  }

  /**
   * Get timeout for a stage (hours).
   */
  getTimeout(stage: WorkflowStage): number | undefined {
    return this.definitions[stage]?.timeoutHours;
  }
}
