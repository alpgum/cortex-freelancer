/**
 * Timeline Tracking + Variance Analysis
 */
import { TimelineInfo, Workflow, WorkflowStage, VarianceAnalysis } from './types';
export declare class TimelineService {
    /**
     * Initialize timeline estimates from proposal.
     */
    initialize(workflow: Workflow, estimatedTotalHours: number, estimatedStartDate: string, estimatedEndDate: string): TimelineInfo;
    /**
     * Mark stage start.
     */
    markStageStart(workflow: Workflow, stage: WorkflowStage, at?: string): void;
    /**
     * Mark stage completion.
     */
    markStageComplete(workflow: Workflow, stage: WorkflowStage, at?: string): void;
    /**
     * Compute variance analysis.
     */
    computeVariance(workflow: Workflow): VarianceAnalysis;
    /**
     * Simple projection: estimated end if remaining stages take their estimated hours.
     */
    projectCompletionDate(workflow: Workflow): Date;
    private getOrCreateStageTiming;
    private recomputeTotals;
    private criticalPath;
    private detectBottlenecks;
}
//# sourceMappingURL=timeline.d.ts.map