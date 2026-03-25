/**
 * Workflow Engine
 *
 * End-to-end proposal → contract → kickoff → milestones → delivery → sign-off.
 */
import { Workflow, WorkflowConfig, ProposalInput, WorkflowStage } from './types';
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
export declare class ProposalToDeliveryEngine {
    private config;
    private stateMachine;
    private contractGenerator;
    private milestoneIntegration;
    private deliveryChecklist;
    private notifications;
    private timeline;
    private automationQueue;
    constructor(config: WorkflowConfig, deps?: EngineDeps);
    getConfig(): WorkflowConfig;
    /**
     * Create a workflow from an accepted proposal.
     */
    createWorkflowFromProposal(proposal: ProposalInput, actor?: string): Workflow;
    /**
     * Advance a workflow to a target stage.
     */
    advanceStage(workflow: Workflow, targetStage: WorkflowStage, actor?: string, notes?: string): Workflow;
    /**
     * Rollback the workflow.
     */
    rollback(workflow: Workflow, actor?: string, notes?: string): Workflow;
    /**
     * Schedule stage auto-actions.
     */
    scheduleStageAutoActions(workflow: Workflow, stage: WorkflowStage): void;
    /**
     * Process due automations for a workflow.
     */
    processDueAutomations(workflow: Workflow, actor?: string): Promise<void>;
    /**
     * Execute an auto-action.
     */
    private executeAutoAction;
    private autoCreateChecklist;
    private autoCreateMilestones;
    private autoGenerateContract;
    createDeliveryPackage(workflow: Workflow): {
        manifestPath: string;
    };
    private tryExternalContractTemplates;
    private mapToExternalContractType;
    runQualityChecks(workflow: Workflow, actor?: string): {
        checklist: import("./types").DeliveryCheckItem[];
        passed: number;
        failed: number;
        skipped: number;
    };
    attachProposal(workflow: Workflow, proposal: ProposalInput): void;
    markContractSigned(workflow: Workflow): void;
}
//# sourceMappingURL=workflow-engine.d.ts.map