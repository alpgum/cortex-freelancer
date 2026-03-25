"use strict";
/**
 * Timeline Tracking + Variance Analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelineService = void 0;
const date_fns_1 = require("date-fns");
class TimelineService {
    /**
     * Initialize timeline estimates from proposal.
     */
    initialize(workflow, estimatedTotalHours, estimatedStartDate, estimatedEndDate) {
        const stageWeights = [
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
        const stageTimings = stageWeights.map(w => ({
            stage: w.stage,
            estimatedHours: Math.round(estimatedTotalHours * w.pct * 100) / 100,
            actualHours: 0,
        }));
        const timeline = {
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
    markStageStart(workflow, stage, at = new Date().toISOString()) {
        const timing = this.getOrCreateStageTiming(workflow, stage);
        if (!timing.startedAt)
            timing.startedAt = at;
    }
    /**
     * Mark stage completion.
     */
    markStageComplete(workflow, stage, at = new Date().toISOString()) {
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
    computeVariance(workflow) {
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
        const scheduleVarianceDays = (0, date_fns_1.differenceInCalendarDays)(estEnd, projectedEnd);
        const estDurationDays = Math.max(1, (0, date_fns_1.differenceInCalendarDays)(estEnd, new Date(workflow.timeline.estimatedStartDate)));
        const scheduleVariance = scheduleVarianceDays * 24; // hours equivalent
        const scheduleVariancePercent = Math.round((scheduleVarianceDays / estDurationDays) * 10000) / 100;
        const bottlenecks = this.detectBottlenecks(workflow);
        const analysis = {
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
    projectCompletionDate(workflow) {
        const now = new Date();
        if (workflow.timeline.actualEndDate) {
            return new Date(workflow.timeline.actualEndDate);
        }
        const remainingEstimatedHours = workflow.timeline.stageTimings
            .filter(t => !t.completedAt)
            .reduce((sum, t) => sum + t.estimatedHours, 0);
        // Convert hours to days ~ 8h/day
        const remainingDays = Math.ceil(remainingEstimatedHours / 8);
        return (0, date_fns_1.addDays)(now, remainingDays);
    }
    // ─── Helpers ─────────────────────────────────────────────────────────
    getOrCreateStageTiming(workflow, stage) {
        let timing = workflow.timeline.stageTimings.find(t => t.stage === stage);
        if (!timing) {
            timing = { stage, estimatedHours: 0, actualHours: 0 };
            workflow.timeline.stageTimings.push(timing);
        }
        return timing;
    }
    recomputeTotals(workflow) {
        workflow.timeline.actualTotalHours = Math.round(workflow.timeline.stageTimings.reduce((sum, t) => sum + (t.actualHours || 0), 0) * 100) / 100;
    }
    criticalPath(workflow) {
        // Approx: stages with largest estimated hours.
        return workflow.timeline.stageTimings
            .slice()
            .sort((a, b) => b.estimatedHours - a.estimatedHours)
            .slice(0, 4)
            .map(t => t.stage);
    }
    detectBottlenecks(workflow) {
        const bottlenecks = [];
        for (const timing of workflow.timeline.stageTimings) {
            if (!timing.startedAt)
                continue;
            if (timing.completedAt)
                continue;
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
exports.TimelineService = TimelineService;
//# sourceMappingURL=timeline.js.map