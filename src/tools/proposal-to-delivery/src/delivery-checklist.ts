/**
 * Delivery Checklist
 * 
 * Generates and evaluates delivery readiness checklist items.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DeliveryCheckItem,
  DeliveryCategory,
  Workflow,
} from './types';

export interface DeliveryChecklistConfig {
  includeAccessibility?: boolean;
  includeSecurity?: boolean;
  includePerformance?: boolean;
}

export class DeliveryChecklistService {
  createDefaultChecklist(config: DeliveryChecklistConfig = {}): DeliveryCheckItem[] {
    const includeAccessibility = config.includeAccessibility ?? true;
    const includeSecurity = config.includeSecurity ?? true;
    const includePerformance = config.includePerformance ?? true;

    const items: Array<Omit<DeliveryCheckItem, 'id'>> = [
      // Code quality
      { category: 'code_quality', description: 'Linting passes / no critical warnings', status: 'pending', required: true },
      { category: 'testing', description: 'Automated tests pass', status: 'pending', required: true },
      { category: 'documentation', description: 'README / handover docs updated', status: 'pending', required: true },

      // Client requirements
      { category: 'client_requirements', description: 'All proposal deliverables included', status: 'pending', required: true },
      { category: 'client_requirements', description: 'Acceptance criteria met', status: 'pending', required: true },

      // Packaging
      { category: 'packaging', description: 'Deliverables packaged in client-ready format', status: 'pending', required: true },
      { category: 'handover', description: 'Access credentials & handover instructions prepared', status: 'pending', required: true },

      // Optional checks
      ...(includeSecurity
        ? [{ category: 'security' as const, description: 'No secrets committed; security review complete', status: 'pending' as const, required: true }]
        : [{ category: 'security' as const, description: 'Security review skipped (not applicable)', status: 'skipped' as const, required: false }]),

      ...(includePerformance
        ? [{ category: 'performance' as const, description: 'Performance checks completed (if applicable)', status: 'pending' as const, required: false }]
        : []),

      ...(includeAccessibility
        ? [{ category: 'accessibility' as const, description: 'Accessibility checks completed (if applicable)', status: 'pending' as const, required: false }]
        : []),
    ];

    return items.map(item => ({ ...item, id: uuidv4() }));
  }

  /**
   * Mark an item status.
   */
  updateItem(
    checklist: DeliveryCheckItem[],
    itemId: string,
    status: DeliveryCheckItem['status'],
    checkedBy: string = 'system',
    notes?: string
  ): DeliveryCheckItem[] {
    return checklist.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        status,
        checkedAt: new Date().toISOString(),
        checkedBy,
        notes,
      };
    });
  }

  /**
   * Evaluate readiness for delivery.
   */
  isReady(checklist: DeliveryCheckItem[]): { ready: boolean; missing: DeliveryCheckItem[] } {
    const missing = checklist.filter(item => item.required && item.status !== 'passed' && item.status !== 'skipped');
    return { ready: missing.length === 0, missing };
  }

  /**
   * Run quality checks automatically (simple heuristics / placeholders).
   * Real integrations can override this behavior.
   */
  runAutoChecks(workflow: Workflow, checkedBy: string = 'system'): {
    checklist: DeliveryCheckItem[];
    passed: number;
    failed: number;
    skipped: number;
  } {
    let checklist = workflow.deliveryChecklist;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Placeholder logic: pass all required checks if we have milestones completed.
    const allMilestonesComplete = workflow.milestones.length > 0 && workflow.milestones.every(m => m.status === 'completed');

    checklist = checklist.map(item => {
      if (item.status !== 'pending') {
        if (item.status === 'passed') passed++;
        if (item.status === 'failed') failed++;
        if (item.status === 'skipped') skipped++;
        return item;
      }

      const shouldPass = allMilestonesComplete || item.required === false;
      const newStatus: DeliveryCheckItem['status'] = shouldPass ? 'passed' : 'failed';
      if (newStatus === 'passed') passed++; else failed++;

      return {
        ...item,
        status: newStatus,
        checkedAt: new Date().toISOString(),
        checkedBy,
        notes: shouldPass ? 'Auto-check passed' : 'Auto-check failed: milestones incomplete',
      };
    });

    workflow.deliveryChecklist = checklist;
    workflow.updatedAt = new Date().toISOString();

    return { checklist, passed, failed, skipped };
  }

  groupByCategory(checklist: DeliveryCheckItem[]): Record<DeliveryCategory, DeliveryCheckItem[]> {
    const grouped = {} as Record<DeliveryCategory, DeliveryCheckItem[]>;
    for (const item of checklist) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
    return grouped;
  }
}
