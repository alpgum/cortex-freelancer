/**
 * Workflow Engine
 * 
 * End-to-end proposal → contract → kickoff → milestones → delivery → sign-off.
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  Workflow,
  WorkflowConfig,
  ProposalInput,
  WorkflowStage,
  ContractInfo,
  AutoAction,
} from './types';
import { WorkflowStateMachine } from './state-machine';
import { ContractGenerator } from './contract-generator';
import { MilestoneIntegration } from './milestone-integration';
import { DeliveryChecklistService } from './delivery-checklist';
import { NotificationService } from './notifications';
import { TimelineService } from './timeline';
import { AutomationQueue } from './automation';

export interface EngineDeps {
  stateMachine?: WorkflowStateMachine;
  contractGenerator?: ContractGenerator;
  milestoneIntegration?: MilestoneIntegration;
  deliveryChecklist?: DeliveryChecklistService;
  notifications?: NotificationService;
  timeline?: TimelineService;
  automationQueue?: AutomationQueue;
}

export class ProposalToDeliveryEngine {
  private config: WorkflowConfig;
  private stateMachine: WorkflowStateMachine;
  private contractGenerator: ContractGenerator;
  private milestoneIntegration: MilestoneIntegration;
  private deliveryChecklist: DeliveryChecklistService;
  private notifications: NotificationService;
  private timeline: TimelineService;
  private automationQueue: AutomationQueue;

  constructor(config: WorkflowConfig, deps: EngineDeps = {}) {
    this.config = config;
    this.stateMachine = deps.stateMachine ?? new WorkflowStateMachine();
    this.contractGenerator = deps.contractGenerator ?? new ContractGenerator();
    this.milestoneIntegration = deps.milestoneIntegration ?? new MilestoneIntegration();
    this.deliveryChecklist = deps.deliveryChecklist ?? new DeliveryChecklistService();
    this.notifications = deps.notifications ?? new NotificationService({
      channels: config.notificationChannels,
      webhookUrl: config.webhookUrl,
      defaultChannel: config.notificationChannels[0],
    });
    this.timeline = deps.timeline ?? new TimelineService();
    this.automationQueue = deps.automationQueue ?? new AutomationQueue();
  }

  getConfig(): WorkflowConfig {
    return { ...this.config };
  }

  /**
   * Create a workflow from an accepted proposal.
   */
  createWorkflowFromProposal(proposal: ProposalInput, actor: string = 'system'): Workflow {
    const now = new Date().toISOString();

    const workflow: Workflow = {
      id: uuidv4(),
      proposalId: proposal.proposalId,
      projectName: proposal.projectName,
      clientId: proposal.clientId,
      clientName: proposal.clientName,
      currentStage: 'proposal_accepted',
      stageHistory: [],
      milestones: [],
      deliveryChecklist: [],
      notifications: [],
      automation: {
        enabled: true,
        pendingActions: [],
        completedActions: [],
      },
      timeline: {
        estimatedStartDate: proposal.startDate,
        estimatedEndDate: proposal.endDate,
        estimatedTotalHours: proposal.estimatedHours,
        actualTotalHours: 0,
        stageTimings: [],
      },
      metadata: {
        projectType: proposal.projectType,
        totalValue: proposal.totalValue,
        currency: proposal.currency || this.config.defaultCurrency,
        tags: proposal.tags || [],
        notes: proposal.notes ? [proposal.notes] : [],
        customFields: {},
      },
      createdAt: now,
      updatedAt: now,
    };

    // Store proposal snapshot for automations
    workflow.metadata.customFields['proposal'] = proposal;

    // Initialize timeline
    this.timeline.initialize(workflow, proposal.estimatedHours, proposal.startDate, proposal.endDate);
    this.timeline.markStageStart(workflow, 'proposal_accepted', now);

    // Schedule initial auto-actions
    if (workflow.automation.enabled) {
      this.scheduleStageAutoActions(workflow, 'proposal_accepted');
    }

    return workflow;
  }

  /**
   * Advance a workflow to a target stage.
   */
  advanceStage(workflow: Workflow, targetStage: WorkflowStage, actor: string = 'system', notes?: string): Workflow {
    const from = workflow.currentStage;

    // Mark completion of previous stage
    this.timeline.markStageComplete(workflow, from);

    const transition = this.stateMachine.transition(workflow, targetStage, 'manual', actor, notes);

    // Mark start of new stage
    this.timeline.markStageStart(workflow, targetStage);

    // Notifications for stage transition
    if (this.config.autoNotify) {
      for (const n of this.notifications.stageTransition(workflow, from, targetStage)) {
        this.notifications.queue(workflow, n);
      }
    }

    // Schedule auto-actions on entry
    if (workflow.automation.enabled) {
      this.scheduleStageAutoActions(workflow, targetStage);
    }

    workflow.updatedAt = new Date().toISOString();
    return workflow;
  }

  /**
   * Rollback the workflow.
   */
  rollback(workflow: Workflow, actor: string = 'system', notes?: string): Workflow {
    const from = workflow.currentStage;
    this.timeline.markStageComplete(workflow, from);

    const transition = this.stateMachine.rollback(workflow, actor, notes);

    this.timeline.markStageStart(workflow, workflow.currentStage);

    if (this.config.autoNotify) {
      for (const n of this.notifications.stageTransition(workflow, from, workflow.currentStage)) {
        this.notifications.queue(workflow, n);
      }
    }

    return workflow;
  }

  /**
   * Schedule stage auto-actions.
   */
  scheduleStageAutoActions(workflow: Workflow, stage: WorkflowStage): void {
    const actions = this.stateMachine.getAutoActions(stage);

    for (const action of actions) {
      // Apply config gates
      if (action.type === 'generate_contract' && !this.config.autoGenerateContract) continue;
      if (action.type === 'create_milestones' && !this.config.autoCreateMilestones) continue;
      if (action.type === 'send_notification' && !this.config.autoNotify) continue;
      if (action.type === 'run_quality_check' && !this.config.qualityCheckRequired) continue;

      this.automationQueue.schedule(workflow, action);
    }
  }

  /**
   * Process due automations for a workflow.
   */
  async processDueAutomations(workflow: Workflow, actor: string = 'system'): Promise<void> {
    let safety = 0;

    while (true) {
      const due = this.automationQueue.getDue(workflow);
      if (due.length === 0) break;

      // Safety to prevent infinite loops (e.g., transition_stage bouncing)
      if (safety++ > 200) {
        throw new Error('Automation processing exceeded safety limit');
      }

      const pending = due[0];

      try {
        const result = await this.executeAutoAction(workflow, pending.action, actor);
        this.automationQueue.markCompleted(workflow, pending.id, {
          actionType: pending.action.type,
          description: pending.action.description,
          status: 'success',
          result,
        });
      } catch (err: any) {
        this.automationQueue.markCompleted(workflow, pending.id, {
          actionType: pending.action.type,
          description: pending.action.description,
          status: 'failed',
          error: String(err?.message || err),
        });
      }
    }

    // Flush notifications
    if (this.config.autoNotify) {
      await this.notifications.flush(workflow);
    }

    // Update variance analysis
    this.timeline.computeVariance(workflow);

    workflow.updatedAt = new Date().toISOString();
  }

  /**
   * Execute an auto-action.
   */
  private async executeAutoAction(workflow: Workflow, action: AutoAction, actor: string): Promise<unknown> {
    switch (action.type) {
      case 'generate_contract':
        return this.autoGenerateContract(workflow);

      case 'create_milestones':
        return this.autoCreateMilestones(workflow);

      case 'create_checklist':
        return this.autoCreateChecklist(workflow);

      case 'send_notification': {
        const recipient = (action.parameters.recipient as any) || 'both';
        const template = String(action.parameters.template || 'action_required');
        const { subject, message, type } = this.notifications.template(template, workflow);
        const n = this.notifications.create(type, recipient, workflow.currentStage, subject, message, this.config.notificationChannels[0]);
        this.notifications.queue(workflow, n);
        return n;
      }

      case 'update_timeline':
        if (action.parameters.action === 'set_actual_start') {
          workflow.timeline.actualStartDate = new Date().toISOString().split('T')[0];
        }
        if (action.parameters.action === 'set_actual_end') {
          workflow.timeline.actualEndDate = new Date().toISOString().split('T')[0];
        }
        return this.timeline.computeVariance(workflow);

      case 'run_quality_check':
        return this.deliveryChecklist.runAutoChecks(workflow, actor);

      case 'package_deliverables':
        return this.createDeliveryPackage(workflow);

      case 'generate_invoice':
        // Integration stub — connect to invoice tool when available
        workflow.metadata.customFields['invoice'] = {
          type: action.parameters.type,
          generatedAt: new Date().toISOString(),
          status: 'generated',
        };
        return workflow.metadata.customFields['invoice'];

      case 'schedule_meeting':
        workflow.metadata.customFields['meeting'] = {
          type: action.parameters.meetingType,
          scheduledAt: new Date().toISOString(),
          status: 'scheduled',
        };
        return workflow.metadata.customFields['meeting'];

      case 'transition_stage': {
        const to = action.parameters.to as WorkflowStage;
        if (!to) throw new Error('transition_stage missing "to"');
        this.advanceStage(workflow, to, actor, 'Auto-transition');
        return { transitionedTo: to };
      }

      default:
        return { skipped: true };
    }
  }

  // ─── Auto-actions implementations ────────────────────────────────────

  private autoCreateChecklist(workflow: Workflow): { count: number } {
    if (workflow.deliveryChecklist.length > 0) {
      return { count: workflow.deliveryChecklist.length };
    }

    workflow.deliveryChecklist = this.deliveryChecklist.createDefaultChecklist();
    workflow.updatedAt = new Date().toISOString();
    return { count: workflow.deliveryChecklist.length };
  }

  private autoCreateMilestones(workflow: Workflow): { count: number } {
    const proposal = workflow.metadata.customFields['proposal'] as ProposalInput | undefined;
    if (!proposal) {
      // In this engine, proposal is expected to be stored in customFields for future actions.
      // If missing, we cannot create milestones.
      return { count: workflow.milestones.length };
    }

    const paymentSchedule = workflow.contract?.terms.paymentSchedule || [];
    workflow.milestones = this.milestoneIntegration.createFromProposal(proposal, paymentSchedule);
    workflow.updatedAt = new Date().toISOString();
    return { count: workflow.milestones.length };
  }

  private async autoGenerateContract(workflow: Workflow): Promise<ContractInfo> {
    const proposal = workflow.metadata.customFields['proposal'] as ProposalInput | undefined;
    if (!proposal) {
      throw new Error('Missing proposal data in workflow.metadata.customFields.proposal');
    }

    // Prefer external contract-template-system if available.
    const external = this.tryExternalContractTemplates();
    if (external) {
      const contractType = this.mapToExternalContractType(proposal.projectType);
      const result = await external.generateContract(contractType, {
        client: proposal.clientName,
        freelancer: 'Cortex Freelancer User',
        project: proposal.projectName,
        value: proposal.totalValue,
        currency: proposal.currency || this.config.defaultCurrency,
        startDate: proposal.startDate,
        endDate: proposal.endDate,
        clauses: [],
      });

      const info = this.contractGenerator.generateFromProposal(proposal);
      info.status = 'sent';
      info.filePath = result.path;
      info.generatedAt = result.generatedAt || info.generatedAt;

      workflow.contract = info;
      workflow.updatedAt = new Date().toISOString();
      return info;
    }

    // Fallback: generate markdown locally.
    const contract = this.contractGenerator.generateFromProposal(proposal);
    const md = this.contractGenerator.renderToMarkdown(contract, proposal);

    const outDir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `contract-${workflow.id}.md`);
    fs.writeFileSync(file, md);

    contract.status = 'sent';
    contract.filePath = file;

    workflow.contract = contract;
    workflow.updatedAt = new Date().toISOString();

    return contract;
  }

  createDeliveryPackage(workflow: Workflow): { manifestPath: string } {
    const outDir = path.join(process.cwd(), 'delivery-packages', workflow.id);
    fs.mkdirSync(outDir, { recursive: true });

    const manifest = {
      workflowId: workflow.id,
      projectName: workflow.projectName,
      clientName: workflow.clientName,
      generatedAt: new Date().toISOString(),
      milestones: workflow.milestones.map(m => ({
        id: m.id,
        name: m.name,
        status: m.status,
        deliverables: m.deliverables,
      })),
      checklist: workflow.deliveryChecklist.map(c => ({ id: c.id, desc: c.description, status: c.status })),
      contract: workflow.contract?.filePath,
    };

    const manifestPath = path.join(outDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    workflow.metadata.customFields['deliveryPackage'] = { manifestPath };
    workflow.updatedAt = new Date().toISOString();

    return { manifestPath };
  }

  private tryExternalContractTemplates(): any | null {
    const candidates = [
      path.resolve(__dirname, '..', '..', 'contract-templates', 'exports.js'),
      path.resolve(process.cwd(), '..', 'contract-templates', 'exports.js'),
    ];

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          return require(p);
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

  private mapToExternalContractType(projectType: ProposalInput['projectType']): string {
    switch (projectType) {
      case 'fixed':
        return 'fixed-price';
      case 'hourly':
        return 'hourly';
      case 'retainer':
        return 'retainer';
      default:
        return 'fixed-price';
    }
  }

  // ─── Convenience APIs ────────────────────────────────────────────────

  runQualityChecks(workflow: Workflow, actor: string = 'system') {
    return this.deliveryChecklist.runAutoChecks(workflow, actor);
  }


  attachProposal(workflow: Workflow, proposal: ProposalInput): void {
    workflow.metadata.customFields['proposal'] = proposal;
    workflow.updatedAt = new Date().toISOString();
  }

  markContractSigned(workflow: Workflow): void {
    if (!workflow.contract) throw new Error('No contract to sign');
    workflow.contract.status = 'signed';
    workflow.contract.signedAt = new Date().toISOString();
    workflow.updatedAt = new Date().toISOString();
  }
}
