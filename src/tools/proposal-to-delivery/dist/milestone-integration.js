"use strict";
/**
 * Milestone Integration
 *
 * Auto-creates milestones from proposal scope.
 * Integrates with milestone-manager (CFX-063).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilestoneIntegration = void 0;
const uuid_1 = require("uuid");
const date_fns_1 = require("date-fns");
class MilestoneIntegration {
    /**
     * Create milestones from proposal deliverables.
     */
    createFromProposal(proposal, paymentSchedule) {
        const deliverables = proposal.deliverables;
        if (deliverables.length === 0) {
            return this.createDefaultMilestones(proposal, paymentSchedule);
        }
        const totalHours = deliverables.reduce((sum, d) => sum + d.estimatedHours, 0) || 1;
        const startDate = new Date(proposal.startDate);
        const endDate = new Date(proposal.endDate);
        const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        let cumulativeDays = 0;
        return deliverables.map((deliverable, index) => {
            const proportion = deliverable.estimatedHours / totalHours;
            const durationDays = Math.round(totalDays * proportion);
            const milestoneStart = (0, date_fns_1.addDays)(startDate, cumulativeDays);
            cumulativeDays += durationDays;
            const milestoneEnd = (0, date_fns_1.addDays)(startDate, cumulativeDays);
            const payment = paymentSchedule[index];
            const paymentAmount = payment?.amount ?? Math.round(proposal.totalValue * proportion * 100) / 100;
            const paymentPercentage = payment?.percentage ?? Math.round(proportion * 100);
            return {
                id: (0, uuid_1.v4)(),
                name: deliverable.name,
                description: deliverable.description,
                order: index + 1,
                status: 'pending',
                deliverables: [deliverable.name],
                estimatedHours: deliverable.estimatedHours,
                actualHours: 0,
                estimatedStartDate: (0, date_fns_1.format)(milestoneStart, 'yyyy-MM-dd'),
                estimatedEndDate: (0, date_fns_1.format)(milestoneEnd, 'yyyy-MM-dd'),
                paymentAmount,
                paymentPercentage,
                dependencies: deliverable.dependencies || (index > 0 ? [`milestone_${index}`] : []),
                acceptanceCriteria: deliverable.acceptanceCriteria,
            };
        });
    }
    /**
     * Create default milestones when no deliverables specified.
     */
    createDefaultMilestones(proposal, paymentSchedule) {
        const startDate = new Date(proposal.startDate);
        const endDate = new Date(proposal.endDate);
        const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const phases = [
            { name: 'Discovery & Planning', pct: 0.2 },
            { name: 'Development / Execution', pct: 0.5 },
            { name: 'Review & Refinement', pct: 0.2 },
            { name: 'Final Delivery', pct: 0.1 },
        ];
        let cumulativeDays = 0;
        return phases.map((phase, index) => {
            const durationDays = Math.round(totalDays * phase.pct);
            const milestoneStart = (0, date_fns_1.addDays)(startDate, cumulativeDays);
            cumulativeDays += durationDays;
            const milestoneEnd = (0, date_fns_1.addDays)(startDate, cumulativeDays);
            const payment = paymentSchedule[index];
            return {
                id: (0, uuid_1.v4)(),
                name: phase.name,
                description: `${phase.name} phase of the project`,
                order: index + 1,
                status: 'pending',
                deliverables: [`${phase.name} deliverables`],
                estimatedHours: Math.round(proposal.estimatedHours * phase.pct),
                actualHours: 0,
                estimatedStartDate: (0, date_fns_1.format)(milestoneStart, 'yyyy-MM-dd'),
                estimatedEndDate: (0, date_fns_1.format)(milestoneEnd, 'yyyy-MM-dd'),
                paymentAmount: payment?.amount ?? Math.round(proposal.totalValue * phase.pct * 100) / 100,
                paymentPercentage: payment?.percentage ?? Math.round(phase.pct * 100),
                dependencies: index > 0 ? [`milestone_${index}`] : [],
                acceptanceCriteria: [`${phase.name} completed and approved`],
            };
        });
    }
    /**
     * Start a milestone (set to in_progress).
     */
    startMilestone(milestone) {
        if (milestone.status !== 'pending') {
            throw new Error(`Cannot start milestone "${milestone.name}" — current status: ${milestone.status}`);
        }
        return {
            ...milestone,
            status: 'in_progress',
            actualStartDate: new Date().toISOString().split('T')[0],
        };
    }
    /**
     * Complete a milestone.
     */
    completeMilestone(milestone, actualHours) {
        if (milestone.status !== 'in_progress' && milestone.status !== 'review') {
            throw new Error(`Cannot complete milestone "${milestone.name}" — current status: ${milestone.status}`);
        }
        return {
            ...milestone,
            status: 'completed',
            actualHours: actualHours ?? milestone.actualHours,
            actualEndDate: new Date().toISOString().split('T')[0],
        };
    }
    /**
     * Submit milestone for review.
     */
    submitForReview(milestone) {
        if (milestone.status !== 'in_progress') {
            throw new Error(`Cannot submit milestone "${milestone.name}" for review — current status: ${milestone.status}`);
        }
        return { ...milestone, status: 'review' };
    }
    /**
     * Block a milestone.
     */
    blockMilestone(milestone) {
        return { ...milestone, status: 'blocked' };
    }
    /**
     * Log hours against a milestone.
     */
    logHours(milestone, hours) {
        return { ...milestone, actualHours: milestone.actualHours + hours };
    }
    /**
     * Calculate overall milestone progress.
     */
    getProgress(milestones) {
        const total = milestones.length;
        const completed = milestones.filter(m => m.status === 'completed').length;
        const inProgress = milestones.filter(m => m.status === 'in_progress').length;
        const pending = milestones.filter(m => m.status === 'pending').length;
        const blocked = milestones.filter(m => m.status === 'blocked').length;
        return {
            total,
            completed,
            inProgress,
            pending,
            blocked,
            percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
            totalEstimatedHours: milestones.reduce((sum, m) => sum + m.estimatedHours, 0),
            totalActualHours: milestones.reduce((sum, m) => sum + m.actualHours, 0),
        };
    }
    /**
     * Check if all milestones are completed.
     */
    allComplete(milestones) {
        return milestones.length > 0 && milestones.every(m => m.status === 'completed');
    }
    /**
     * Get the next milestone to work on.
     */
    getNextMilestone(milestones) {
        const inProgress = milestones.find(m => m.status === 'in_progress');
        if (inProgress)
            return inProgress;
        return milestones
            .filter(m => m.status === 'pending')
            .sort((a, b) => a.order - b.order)[0];
    }
}
exports.MilestoneIntegration = MilestoneIntegration;
//# sourceMappingURL=milestone-integration.js.map