/**
 * Notification System
 *
 * Smart notifications for stage transitions and milestones.
 */
import { Notification, NotificationType, WorkflowStage, Workflow } from './types';
export interface NotificationConfig {
    channels: ('email' | 'in_app' | 'slack' | 'webhook')[];
    webhookUrl?: string;
    defaultChannel?: 'email' | 'in_app' | 'slack' | 'webhook';
}
export declare class NotificationService {
    private config;
    constructor(config: NotificationConfig);
    create(type: NotificationType, recipient: Notification['recipient'], stage: WorkflowStage, subject: string, message: string, channel?: Notification['channel']): Notification;
    queue(workflow: Workflow, notification: Notification): Notification;
    /**
     * Send pending notifications.
     * In this implementation, we mark as sent and optionally POST to a webhook.
     */
    flush(workflow: Workflow): Promise<{
        sent: number;
        failed: number;
    }>;
    /**
     * Convenience helper: create a stage transition notification.
     */
    stageTransition(workflow: Workflow, from: WorkflowStage, to: WorkflowStage): Notification[];
    /**
     * Template-based messages.
     */
    template(templateId: string, workflow: Workflow): {
        subject: string;
        message: string;
        type: NotificationType;
    };
}
//# sourceMappingURL=notifications.d.ts.map