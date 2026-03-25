/**
 * Milestone Integration
 *
 * Auto-creates milestones from proposal scope.
 * Integrates with milestone-manager (CFX-063).
 */
import { WorkflowMilestone, ProposalInput, PaymentScheduleItem } from './types';
export declare class MilestoneIntegration {
    /**
     * Create milestones from proposal deliverables.
     */
    createFromProposal(proposal: ProposalInput, paymentSchedule: PaymentScheduleItem[]): WorkflowMilestone[];
    /**
     * Create default milestones when no deliverables specified.
     */
    private createDefaultMilestones;
    /**
     * Start a milestone (set to in_progress).
     */
    startMilestone(milestone: WorkflowMilestone): WorkflowMilestone;
    /**
     * Complete a milestone.
     */
    completeMilestone(milestone: WorkflowMilestone, actualHours?: number): WorkflowMilestone;
    /**
     * Submit milestone for review.
     */
    submitForReview(milestone: WorkflowMilestone): WorkflowMilestone;
    /**
     * Block a milestone.
     */
    blockMilestone(milestone: WorkflowMilestone): WorkflowMilestone;
    /**
     * Log hours against a milestone.
     */
    logHours(milestone: WorkflowMilestone, hours: number): WorkflowMilestone;
    /**
     * Calculate overall milestone progress.
     */
    getProgress(milestones: WorkflowMilestone[]): {
        total: number;
        completed: number;
        inProgress: number;
        pending: number;
        blocked: number;
        percentComplete: number;
        totalEstimatedHours: number;
        totalActualHours: number;
    };
    /**
     * Check if all milestones are completed.
     */
    allComplete(milestones: WorkflowMilestone[]): boolean;
    /**
     * Get the next milestone to work on.
     */
    getNextMilestone(milestones: WorkflowMilestone[]): WorkflowMilestone | undefined;
}
//# sourceMappingURL=milestone-integration.d.ts.map