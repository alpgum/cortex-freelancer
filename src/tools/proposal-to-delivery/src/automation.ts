/**
 * Automation Queue for workflow auto-actions.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AutoAction,
  Workflow,
  PendingAutoAction,
  CompletedAutoAction,
} from './types';

export class AutomationQueue {
  schedule(workflow: Workflow, action: AutoAction, scheduledFor?: string): PendingAutoAction {
    const now = new Date();
    const scheduled = scheduledFor
      ? new Date(scheduledFor)
      : new Date(now.getTime() + (action.delayMinutes ?? 0) * 60 * 1000);

    const pending: PendingAutoAction = {
      id: uuidv4(),
      seq: workflow.automation.pendingActions.length,
      action,
      scheduledFor: scheduled.toISOString(),
      attempts: 0,
      status: 'pending',
    };

    workflow.automation.pendingActions.push(pending);
    workflow.updatedAt = now.toISOString();

    return pending;
  }

  getDue(workflow: Workflow, now: Date = new Date()): PendingAutoAction[] {
    if (!workflow.automation.enabled) return [];
    return workflow.automation.pendingActions
      .filter(p => p.status === 'pending')
      .filter(p => new Date(p.scheduledFor).getTime() <= now.getTime())
      .sort((a, b) => {
        const t = new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
        return t !== 0 ? t : a.seq - b.seq;
      });
  }

  markCompleted(
    workflow: Workflow,
    pendingId: string,
    completion: Omit<CompletedAutoAction, 'id' | 'executedAt'>
  ): CompletedAutoAction {
    const idx = workflow.automation.pendingActions.findIndex(p => p.id === pendingId);
    if (idx === -1) {
      throw new Error(`Pending action not found: ${pendingId}`);
    }

    const pending = workflow.automation.pendingActions[idx];
    workflow.automation.pendingActions.splice(idx, 1);

    const completed: CompletedAutoAction = {
      id: pendingId,
      executedAt: new Date().toISOString(),
      actionType: completion.actionType,
      description: completion.description,
      status: completion.status,
      result: completion.result,
      error: completion.error,
    };

    workflow.automation.completedActions.push(completed);
    workflow.automation.lastProcessedAt = completed.executedAt;
    workflow.updatedAt = completed.executedAt;

    return completed;
  }
}
