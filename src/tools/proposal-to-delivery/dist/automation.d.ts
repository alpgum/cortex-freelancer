/**
 * Automation Queue for workflow auto-actions.
 */
import { AutoAction, Workflow, PendingAutoAction, CompletedAutoAction } from './types';
export declare class AutomationQueue {
    schedule(workflow: Workflow, action: AutoAction, scheduledFor?: string): PendingAutoAction;
    getDue(workflow: Workflow, now?: Date): PendingAutoAction[];
    markCompleted(workflow: Workflow, pendingId: string, completion: Omit<CompletedAutoAction, 'id' | 'executedAt'>): CompletedAutoAction;
}
//# sourceMappingURL=automation.d.ts.map