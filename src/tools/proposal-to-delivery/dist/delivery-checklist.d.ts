/**
 * Delivery Checklist
 *
 * Generates and evaluates delivery readiness checklist items.
 */
import { DeliveryCheckItem, DeliveryCategory, Workflow } from './types';
export interface DeliveryChecklistConfig {
    includeAccessibility?: boolean;
    includeSecurity?: boolean;
    includePerformance?: boolean;
}
export declare class DeliveryChecklistService {
    createDefaultChecklist(config?: DeliveryChecklistConfig): DeliveryCheckItem[];
    /**
     * Mark an item status.
     */
    updateItem(checklist: DeliveryCheckItem[], itemId: string, status: DeliveryCheckItem['status'], checkedBy?: string, notes?: string): DeliveryCheckItem[];
    /**
     * Evaluate readiness for delivery.
     */
    isReady(checklist: DeliveryCheckItem[]): {
        ready: boolean;
        missing: DeliveryCheckItem[];
    };
    /**
     * Run quality checks automatically (simple heuristics / placeholders).
     * Real integrations can override this behavior.
     */
    runAutoChecks(workflow: Workflow, checkedBy?: string): {
        checklist: DeliveryCheckItem[];
        passed: number;
        failed: number;
        skipped: number;
    };
    groupByCategory(checklist: DeliveryCheckItem[]): Record<DeliveryCategory, DeliveryCheckItem[]>;
}
//# sourceMappingURL=delivery-checklist.d.ts.map