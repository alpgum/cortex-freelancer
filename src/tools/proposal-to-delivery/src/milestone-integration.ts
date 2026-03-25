/**
 * Milestone Integration
 * 
 * Auto-creates milestones from proposal scope.
 * Integrates with milestone-manager (CFX-063).
 */

import { v4 as uuidv4 } from 'uuid';
import { addDays, format } from 'date-fns';
import {
  WorkflowMilestone,
  ProposalInput,
  DeliverableInput,
  PaymentScheduleItem,
} from './types';

export class MilestoneIntegration {
  /**
   * Create milestones from proposal deliverables.
   */
  createFromProposal(
    proposal: ProposalInput,
    paymentSchedule: PaymentScheduleItem[]
  ): WorkflowMilestone[] {
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
      const milestoneStart = addDays(startDate, cumulativeDays);
      cumulativeDays += durationDays;
      const milestoneEnd = addDays(startDate, cumulativeDays);

      const payment = paymentSchedule[index];
      const paymentAmount = payment?.amount ?? Math.round(proposal.totalValue * proportion * 100) / 100;
      const paymentPercentage = payment?.percentage ?? Math.round(proportion * 100);

      return {
        id: uuidv4(),
        name: deliverable.name,
        description: deliverable.description,
        order: index + 1,
        status: 'pending' as const,
        deliverables: [deliverable.name],
        estimatedHours: deliverable.estimatedHours,
        actualHours: 0,
        estimatedStartDate: format(milestoneStart, 'yyyy-MM-dd'),
        estimatedEndDate: format(milestoneEnd, 'yyyy-MM-dd'),
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
  private createDefaultMilestones(
    proposal: ProposalInput,
    paymentSchedule: PaymentScheduleItem[]
  ): WorkflowMilestone[] {
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
      const milestoneStart = addDays(startDate, cumulativeDays);
      cumulativeDays += durationDays;
      const milestoneEnd = addDays(startDate, cumulativeDays);

      const payment = paymentSchedule[index];

      return {
        id: uuidv4(),
        name: phase.name,
        description: `${phase.name} phase of the project`,
        order: index + 1,
        status: 'pending' as const,
        deliverables: [`${phase.name} deliverables`],
        estimatedHours: Math.round(proposal.estimatedHours * phase.pct),
        actualHours: 0,
        estimatedStartDate: format(milestoneStart, 'yyyy-MM-dd'),
        estimatedEndDate: format(milestoneEnd, 'yyyy-MM-dd'),
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
  startMilestone(milestone: WorkflowMilestone): WorkflowMilestone {
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
  completeMilestone(milestone: WorkflowMilestone, actualHours?: number): WorkflowMilestone {
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
  submitForReview(milestone: WorkflowMilestone): WorkflowMilestone {
    if (milestone.status !== 'in_progress') {
      throw new Error(`Cannot submit milestone "${milestone.name}" for review — current status: ${milestone.status}`);
    }
    return { ...milestone, status: 'review' };
  }

  /**
   * Block a milestone.
   */
  blockMilestone(milestone: WorkflowMilestone): WorkflowMilestone {
    return { ...milestone, status: 'blocked' };
  }

  /**
   * Log hours against a milestone.
   */
  logHours(milestone: WorkflowMilestone, hours: number): WorkflowMilestone {
    return { ...milestone, actualHours: milestone.actualHours + hours };
  }

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
  } {
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
  allComplete(milestones: WorkflowMilestone[]): boolean {
    return milestones.length > 0 && milestones.every(m => m.status === 'completed');
  }

  /**
   * Get the next milestone to work on.
   */
  getNextMilestone(milestones: WorkflowMilestone[]): WorkflowMilestone | undefined {
    const inProgress = milestones.find(m => m.status === 'in_progress');
    if (inProgress) return inProgress;

    return milestones
      .filter(m => m.status === 'pending')
      .sort((a, b) => a.order - b.order)[0];
  }
}
