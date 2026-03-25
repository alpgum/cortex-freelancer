/**
 * State Machine for Proposal-to-Delivery Workflow
 *
 * Manages stage definitions, transitions, conditions, rollback, and auto-actions.
 */
import { WorkflowStage, StageDefinition, StageTransition, TransitionTrigger, Condition, AutoAction, Workflow } from './types';
export declare const STAGE_DEFINITIONS: Record<WorkflowStage, StageDefinition>;
export declare class WorkflowStateMachine {
    private definitions;
    constructor(customDefinitions?: Partial<Record<WorkflowStage, Partial<StageDefinition>>>);
    getStageDefinition(stage: WorkflowStage): StageDefinition;
    getAllStages(): StageDefinition[];
    /**
     * Validate whether a transition is allowed.
     */
    canTransition(from: WorkflowStage, to: WorkflowStage): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Execute a stage transition on a workflow.
     */
    transition(workflow: Workflow, targetStage: WorkflowStage, trigger?: TransitionTrigger, actor?: string, notes?: string): StageTransition;
    /**
     * Rollback to the previous allowed stage.
     */
    rollback(workflow: Workflow, actor?: string, notes?: string): StageTransition;
    /**
     * Get auto-actions for a given stage.
     */
    getAutoActions(stage: WorkflowStage): AutoAction[];
    /**
     * Check conditions against a workflow.
     */
    checkConditions(conditions: Condition[], workflow: Workflow): Array<{
        description: string;
        met: boolean;
        required: boolean;
    }>;
    private evaluateCondition;
    /**
     * Get the happy-path stage order.
     */
    getHappyPath(): WorkflowStage[];
    /**
     * Check if workflow is in a terminal state.
     */
    isTerminal(stage: WorkflowStage): boolean;
    /**
     * Get timeout for a stage (hours).
     */
    getTimeout(stage: WorkflowStage): number | undefined;
}
//# sourceMappingURL=state-machine.d.ts.map