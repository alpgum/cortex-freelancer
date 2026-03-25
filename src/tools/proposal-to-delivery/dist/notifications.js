"use strict";
/**
 * Notification System
 *
 * Smart notifications for stage transitions and milestones.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const uuid_1 = require("uuid");
class NotificationService {
    constructor(config) {
        this.config = config;
    }
    create(type, recipient, stage, subject, message, channel) {
        return {
            id: (0, uuid_1.v4)(),
            type,
            recipient,
            subject,
            message,
            stage,
            status: 'pending',
            channel: channel || this.config.defaultChannel || (this.config.channels[0] ?? 'in_app'),
        };
    }
    queue(workflow, notification) {
        workflow.notifications.push(notification);
        workflow.updatedAt = new Date().toISOString();
        return notification;
    }
    /**
     * Send pending notifications.
     * In this implementation, we mark as sent and optionally POST to a webhook.
     */
    async flush(workflow) {
        const pending = workflow.notifications.filter(n => n.status === 'pending');
        let sent = 0;
        let failed = 0;
        for (const n of pending) {
            try {
                // Webhook (optional)
                if (n.channel === 'webhook' && this.config.webhookUrl) {
                    await fetch(this.config.webhookUrl, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            workflowId: workflow.id,
                            clientId: workflow.clientId,
                            stage: workflow.currentStage,
                            notification: n,
                            timestamp: new Date().toISOString(),
                        }),
                    });
                }
                n.status = 'sent';
                n.sentAt = new Date().toISOString();
                sent++;
            }
            catch (err) {
                n.status = 'failed';
                failed++;
            }
        }
        workflow.updatedAt = new Date().toISOString();
        return { sent, failed };
    }
    /**
     * Convenience helper: create a stage transition notification.
     */
    stageTransition(workflow, from, to) {
        const subject = `Stage Update: ${from} → ${to}`;
        const freelancerMsg = `Workflow ${workflow.projectName} moved from ${from} to ${to}.`;
        const clientMsg = `Project "${workflow.projectName}" is now in stage: ${to}.`;
        return [
            this.create('stage_transition', 'freelancer', to, subject, freelancerMsg),
            this.create('stage_transition', 'client', to, subject, clientMsg),
        ];
    }
    /**
     * Template-based messages.
     */
    template(templateId, workflow) {
        const map = {
            proposal_accepted: {
                subject: `Proposal accepted: ${workflow.projectName}`,
                message: `Client accepted proposal ${workflow.proposalId}. Next: generate contract.`,
                type: 'action_required',
            },
            contract_review: {
                subject: `Contract ready for review: ${workflow.projectName}`,
                message: `Please review and sign the contract to begin the project.`,
                type: 'action_required',
            },
            contract_signed: {
                subject: `Contract signed: ${workflow.projectName}`,
                message: `Contract is signed. Kickoff is next.`,
                type: 'stage_transition',
            },
            project_kickoff: {
                subject: `Kickoff: ${workflow.projectName}`,
                message: `Welcome! We'll schedule a kickoff call and confirm access/tools.`,
                type: 'stage_transition',
            },
            work_started: {
                subject: `Work started: ${workflow.projectName}`,
                message: `Work is underway. We'll send updates as milestones complete.`,
                type: 'stage_transition',
            },
            deliverables_ready: {
                subject: `Deliverables ready: ${workflow.projectName}`,
                message: `Final deliverables are ready for your review.`,
                type: 'review_requested',
            },
            quality_check_result: {
                subject: `Quality check complete: ${workflow.projectName}`,
                message: `Quality checks have completed. Review checklist status before delivery.`,
                type: 'quality_check_result',
            },
            review_request: {
                subject: `Review requested: ${workflow.projectName}`,
                message: `Please review the deliverables and confirm approval or revision notes.`,
                type: 'review_requested',
            },
            revisions_started: {
                subject: `Revisions in progress: ${workflow.projectName}`,
                message: `We are addressing your feedback and will resubmit for review soon.`,
                type: 'stage_transition',
            },
            sign_off_complete: {
                subject: `Sign-off complete: ${workflow.projectName}`,
                message: `Thank you — sign-off is complete.`,
                type: 'sign_off_complete',
            },
            project_complete: {
                subject: `Project completed: ${workflow.projectName}`,
                message: `Project is complete and delivered. Thank you for working together.`,
                type: 'stage_transition',
            },
            workflow_cancelled: {
                subject: `Workflow cancelled: ${workflow.projectName}`,
                message: `Workflow has been cancelled. If this is unexpected, please reach out.`,
                type: 'action_required',
            },
        };
        return map[templateId] || {
            subject: `Notification: ${workflow.projectName}`,
            message: `Update for workflow ${workflow.id}.`,
            type: 'action_required',
        };
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=notifications.js.map