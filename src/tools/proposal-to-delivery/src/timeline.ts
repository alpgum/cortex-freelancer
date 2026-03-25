/**
 * Timeline Tracking + Variance Analysis
 */

import { addDays, differenceInCalendarDays } from 'date-fns';
import {
  TimelineInfo,
  StageTiming,
  Workflow,
  WorkflowStage,
  VarianceAnalysis,
  BottleneckInfo,
} from './types';

export class TimelineService {
  /**
   * Initialize timeline estimates from proposal.
   */
  initialize(workflow: Workflow, estimatedTotalHours: number, estimatedStartDate: string, estimatedEndDate: string): TimelineInfo {
    const stageWeights: Array<{ stage: WorkflowStage; pct: number }> = [
      { stage: 'contract_generation', pct: 0.02 },
      { stage: 'contract_review', pct: 0.05 },
      { stage: 'project_kickoff', pct: 0.03 },
      { stage: 'milestone_setup', pct: 0.05 },
      { stage: 'in_progress', pct: 0.65 },
      { stage: 'milestone_review', pct: 0.05 },
      { stage: 'delivery_prep', pct: 0.05 },
      { stage: 'quality_check', pct: 0.03 },
      { stage: 'client_review', pct: 0.07 },
    ];

    const stageTimings: StageTiming[] = stageWeights.map(w => ({
      stage: w.stage,
      estimatedHours: Math.round(estimatedTotalHours * w.pct * 100) / 100,
      actualHours: 0,
    }));

    const timeline: TimelineInfo = {
      estimatedStartDate,
      estimatedEndDate,
      estimatedTotalHours,
      actualTotalHours: 0,
      stageTimings,
    };

    workflow.timeline = timeline;
    return timeline;
  }

  /**
   * Mark stage start.
   */
  markStageStart(workflow: Workflow, stage: WorkflowStage, at: string = new Date().toISOString()): void {
    const timing = this.getOrCreateStageTiming(workflow, stage);
    if (!timing.startedAt) timing.startedAt = at;
  }

  /**
   * Mark stage completion.
   */
  markStageComplete(workflow: Workflow, stage: WorkflowStage, at: string = new Date().toISOString()): void {
    const timing = this.getOrCreateStageTiming(workflow, stage);
    timing.completedAt = at;

    if (timing.startedAt) {
      const ms = new Date(at).getTime() - new Date(timing.startedAt).getTime();
      timing.actualHours = Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
    }

    this.recomputeTotals(workflow);
  }

  /**
   * Compute variance analysis.
   */
  computeVariance(workflow: Workflow): VarianceAnalysis {
    const estimatedTotalHours = workflow.timeline.estimatedTotalHours;
    const actualTotalHours = workflow.timeline.actualTotalHours;

    const effortVariance = Math.round((estimatedTotalHours - actualTotalHours) * 100) / 100; // positive = under budget
    const effortVariancePercent = estimatedTotalHours > 0
      ? Math.round((effortVariance / estimatedTotalHours) * 10000) / 100
      : 0;

    const estEnd = new Date(workflow.timeline.estimatedEndDate);
    const actEnd = workflow.timeline.actualEndDate ? new Date(workflow.timeline.actualEndDate) : undefined;

    // Schedule variance based on days.
    const projectedEnd = this.projectCompletionDate(workflow);
    const scheduleVarianceDays = differenceInCalendarDays(estEnd, projectedEnd);
    const estDurationDays = Math.max(1, differenceInCalendarDays(estEnd, new Date(workflow.timeline.estimatedStartDate)));

    const scheduleVariance = scheduleVarianceDays * 24; // hours equivalent
    const scheduleVariancePercent = Math.round((scheduleVarianceDays / estDurationDays) * 10000) / 100;

    const bottlenecks = this.detectBottlenecks(workflow);

    const analysis: VarianceAnalysis = {
      scheduleVariance,
      scheduleVariancePercent,
      effortVariance,
      effortVariancePercent,
      criticalPath: this.criticalPath(workflow),
      bottlenecks,
      projectedCompletionDate: projectedEnd.toISOString().split('T')[0],
      isOnTrack: scheduleVarianceDays >= 0 && effortVariance >= 0,
    };

    workflow.timeline.varianceAnalysis = analysis;
    workflow.updatedAt = new Date().toISOString();

    return analysis;
  }

  /**
   * Simple projection: estimated end if remaining stages take their estimated hours.
   */
  projectCompletionDate(workflow: Workflow): Date {
    const now = new Date();
    if (workflow.timeline.actualEndDate) {
      return new Date(workflow.timeline.actualEndDate);
    }

    const remainingEstimatedHours = workflow.timeline.stageTimings
      .filter(t => !t.completedAt)
      .reduce((sum, t) => sum + t.estimatedHours, 0);

    // Convert hours to days ~ 8h/day
    const remainingDays = Math.ceil(remainingEstimatedHours / 8);
    return addDays(now, remainingDays);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private getOrCreateStageTiming(workflow: Workflow, stage: WorkflowStage): StageTiming {
    let timing = workflow.timeline.stageTimings.find(t => t.stage === stage);
    if (!timing) {
      timing = { stage, estimatedHours: 0, actualHours: 0 };
      workflow.timeline.stageTimings.push(timing);
    }
    return timing;
  }

  private recomputeTotals(workflow: Workflow): void {
    workflow.timeline.actualTotalHours = Math.round(
      workflow.timeline.stageTimings.reduce((sum, t) => sum + (t.actualHours || 0), 0) * 100
    ) / 100;
  }

  private criticalPath(workflow: Workflow): WorkflowStage[] {
    // Approx: stages with largest estimated hours.
    return workflow.timeline.stageTimings
      .slice()
      .sort((a, b) => b.estimatedHours - a.estimatedHours)
      .slice(0, 4)
      .map(t => t.stage);
  }

  private detectBottlenecks(workflow: Workflow): BottleneckInfo[] {
    const bottlenecks: BottleneckInfo[] = [];

    for (const timing of workflow.timeline.stageTimings) {
      if (!timing.startedAt) continue;
      if (timing.completedAt) continue;

      const hoursInStage = (Date.now() - new Date(timing.startedAt).getTime()) / (1000 * 60 * 60);
      const over = hoursInStage - (timing.estimatedHours || 0);

      if (over > 24) {
        bottlenecks.push({
          stage: timing.stage,
          delayHours: Math.round(over * 100) / 100,
          reason: 'Stage taking longer than estimated',
          suggestion: 'Re-scope or renegotiate deadline; increase focus; reduce context switching',
        });
      }
    }

    return bottlenecks;
  }
}
