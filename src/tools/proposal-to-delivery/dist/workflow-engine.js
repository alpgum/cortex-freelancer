"use strict";
/**
 * Workflow Engine
 *
 * End-to-end proposal → contract → kickoff → milestones → delivery → sign-off.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProposalToDeliveryEngine = void 0;
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const state_machine_1 = require("./state-machine");
const contract_generator_1 = require("./contract-generator");
const milestone_integration_1 = require("./milestone-integration");
const delivery_checklist_1 = require("./delivery-checklist");
const notifications_1 = require("./notifications");
const timeline_1 = require("./timeline");
const automation_1 = require("./automation");
class ProposalToDeliveryEngine {
    constructor(config, deps = {}) {
        this.config = config;
        this.stateMachine = deps.stateMachine ?? new state_machine_1.WorkflowStateMachine();
        this.contractGenerator = deps.contractGenerator ?? new contract_generator_1.ContractGenerator();
        this.milestoneIntegration = deps.milestoneIntegration ?? new milestone_integration_1.MilestoneIntegration();
        this.deliveryChecklist = deps.deliveryChecklist ?? new delivery_checklist_1.DeliveryChecklistService();
        this.notifications = deps.notifications ?? new notifications_1.NotificationService({
            channels: config.notificationChannels,
            webhookUrl: config.webhookUrl,
            defaultChannel: config.notificationChannels[0],
        });
        this.timeline = deps.timeline ?? new timeline_1.TimelineService();
        this.automationQueue = deps.automationQueue ?? new automation_1.AutomationQueue();
    }
    getConfig() {
        return { ...this.config };
    }
    /**
     * Create a workflow from an accepted proposal.
     */
    createWorkflowFromProposal(proposal, actor = 'system') {
        const now = new Date().toISOString();
        const workflow = {
            id: (0, uuid_1.v4)(),
            proposalId: proposal.proposalId,
            projectName: proposal.projectName,
            clientId: proposal.clientId,
            clientName: proposal.clientName,
            currentStage: 'proposal_accepted',
            stageHistory: [],
            milestones: [],
            deliveryChecklist: [],
            notifications: [],
            automation: {
                enabled: true,
                pendingActions: [],
                completedActions: [],
            },
            timeline: {
                estimatedStartDate: proposal.startDate,
                estimatedEndDate: proposal.endDate,
                estimatedTotalHours: proposal.estimatedHours,
                actualTotalHours: 0,
                stageTimings: [],
            },
            metadata: {
                projectType: proposal.projectType,
                totalValue: proposal.totalValue,
                currency: proposal.currency || this.config.defaultCurrency,
                tags: proposal.tags || [],
                notes: proposal.notes ? [proposal.notes] : [],
                customFields: {},
            },
            createdAt: now,
            updatedAt: now,
        };
        // Store proposal snapshot for automations
        workflow.metadata.customFields['proposal'] = proposal;
        // Initialize timeline
        this.timeline.initialize(workflow, proposal.estimatedHours, proposal.startDate, proposal.endDate);
        this.timeline.markStageStart(workflow, 'proposal_accepted', now);
        // Schedule initial auto-actions
        if (workflow.automation.enabled) {
            this.scheduleStageAutoActions(workflow, 'proposal_accepted');
        }
        return workflow;
    }
    /**
     * Advance a workflow to a target stage.
     */
    advanceStage(workflow, targetStage, actor = 'system', notes) {
        const from = workflow.currentStage;
        // Mark completion of previous stage
        this.timeline.markStageComplete(workflow, from);
        const transition = this.stateMachine.transition(workflow, targetStage, 'manual', actor, notes);
        // Mark start of new stage
        this.timeline.markStageStart(workflow, targetStage);
        // Notifications for stage transition
        if (this.config.autoNotify) {
            for (const n of this.notifications.stageTransition(workflow, from, targetStage)) {
                this.notifications.queue(workflow, n);
            }
        }
        // Schedule auto-actions on entry
        if (workflow.automation.enabled) {
            this.scheduleStageAutoActions(workflow, targetStage);
        }
        workflow.updatedAt = new Date().toISOString();
        return workflow;
    }
    /**
     * Rollback the workflow.
     */
    rollback(workflow, actor = 'system', notes) {
        const from = workflow.currentStage;
        this.timeline.markStageComplete(workflow, from);
        const transition = this.stateMachine.rollback(workflow, actor, notes);
        this.timeline.markStageStart(workflow, workflow.currentStage);
        if (this.config.autoNotify) {
            for (const n of this.notifications.stageTransition(workflow, from, workflow.currentStage)) {
                this.notifications.queue(workflow, n);
            }
        }
        return workflow;
    }
    /**
     * Schedule stage auto-actions.
     */
    scheduleStageAutoActions(workflow, stage) {
        const actions = this.stateMachine.getAutoActions(stage);
        for (const action of actions) {
            // Apply config gates
            if (action.type === 'generate_contract' && !this.config.autoGenerateContract)
                continue;
            if (action.type === 'create_milestones' && !this.config.autoCreateMilestones)
                continue;
            if (action.type === 'send_notification' && !this.config.autoNotify)
                continue;
            if (action.type === 'run_quality_check' && !this.config.qualityCheckRequired)
                continue;
            this.automationQueue.schedule(workflow, action);
        }
    }
    /**
     * Process due automations for a workflow.
     */
    async processDueAutomations(workflow, actor = 'system') {
        let safety = 0;
        while (true) {
            const due = this.automationQueue.getDue(workflow);
            if (due.length === 0)
                break;
            // Safety to prevent infinite loops (e.g., transition_stage bouncing)
            if (safety++ > 200) {
                throw new Error('Automation processing exceeded safety limit');
            }
            const pending = due[0];
            try {
                const result = await this.executeAutoAction(workflow, pending.action, actor);
                this.automationQueue.markCompleted(workflow, pending.id, {
                    actionType: pending.action.type,
                    description: pending.action.description,
                    status: 'success',
                    result,
                });
            }
            catch (err) {
                this.automationQueue.markCompleted(workflow, pending.id, {
                    actionType: pending.action.type,
                    description: pending.action.description,
                    status: 'failed',
                    error: String(err?.message || err),
                });
            }
        }
        // Flush notifications
        if (this.config.autoNotify) {
            await this.notifications.flush(workflow);
        }
        // Update variance analysis
        this.timeline.computeVariance(workflow);
        workflow.updatedAt = new Date().toISOString();
    }
    /**
     * Execute an auto-action.
     */
    async executeAutoAction(workflow, action, actor) {
        switch (action.type) {
            case 'generate_contract':
                return this.autoGenerateContract(workflow);
            case 'create_milestones':
                return this.autoCreateMilestones(workflow);
            case 'create_checklist':
                return this.autoCreateChecklist(workflow);
            case 'send_notification': {
                const recipient = action.parameters.recipient || 'both';
                const template = String(action.parameters.template || 'action_required');
                const { subject, message, type } = this.notifications.template(template, workflow);
                const n = this.notifications.create(type, recipient, workflow.currentStage, subject, message, this.config.notificationChannels[0]);
                this.notifications.queue(workflow, n);
                return n;
            }
            case 'update_timeline':
                if (action.parameters.action === 'set_actual_start') {
                    workflow.timeline.actualStartDate = new Date().toISOString().split('T')[0];
                }
                if (action.parameters.action === 'set_actual_end') {
                    workflow.timeline.actualEndDate = new Date().toISOString().split('T')[0];
                }
                return this.timeline.computeVariance(workflow);
            case 'run_quality_check':
                return this.deliveryChecklist.runAutoChecks(workflow, actor);
            case 'package_deliverables':
                return this.createDeliveryPackage(workflow);
            case 'generate_invoice':
                // Integration stub — connect to invoice tool when available
                workflow.metadata.customFields['invoice'] = {
                    type: action.parameters.type,
                    generatedAt: new Date().toISOString(),
                    status: 'generated',
                };
                return workflow.metadata.customFields['invoice'];
            case 'schedule_meeting':
                workflow.metadata.customFields['meeting'] = {
                    type: action.parameters.meetingType,
                    scheduledAt: new Date().toISOString(),
                    status: 'scheduled',
                };
                return workflow.metadata.customFields['meeting'];
            case 'transition_stage': {
                const to = action.parameters.to;
                if (!to)
                    throw new Error('transition_stage missing "to"');
                this.advanceStage(workflow, to, actor, 'Auto-transition');
                return { transitionedTo: to };
            }
            default:
                return { skipped: true };
        }
    }
    // ─── Auto-actions implementations ────────────────────────────────────
    autoCreateChecklist(workflow) {
        if (workflow.deliveryChecklist.length > 0) {
            return { count: workflow.deliveryChecklist.length };
        }
        workflow.deliveryChecklist = this.deliveryChecklist.createDefaultChecklist();
        workflow.updatedAt = new Date().toISOString();
        return { count: workflow.deliveryChecklist.length };
    }
    autoCreateMilestones(workflow) {
        const proposal = workflow.metadata.customFields['proposal'];
        if (!proposal) {
            // In this engine, proposal is expected to be stored in customFields for future actions.
            // If missing, we cannot create milestones.
            return { count: workflow.milestones.length };
        }
        const paymentSchedule = workflow.contract?.terms.paymentSchedule || [];
        workflow.milestones = this.milestoneIntegration.createFromProposal(proposal, paymentSchedule);
        workflow.updatedAt = new Date().toISOString();
        return { count: workflow.milestones.length };
    }
    async autoGenerateContract(workflow) {
        const proposal = workflow.metadata.customFields['proposal'];
        if (!proposal) {
            throw new Error('Missing proposal data in workflow.metadata.customFields.proposal');
        }
        // Prefer external contract-template-system if available.
        const external = this.tryExternalContractTemplates();
        if (external) {
            const contractType = this.mapToExternalContractType(proposal.projectType);
            const result = await external.generateContract(contractType, {
                client: proposal.clientName,
                freelancer: 'Cortex Freelancer User',
                project: proposal.projectName,
                value: proposal.totalValue,
                currency: proposal.currency || this.config.defaultCurrency,
                startDate: proposal.startDate,
                endDate: proposal.endDate,
                clauses: [],
            });
            const info = this.contractGenerator.generateFromProposal(proposal);
            info.status = 'sent';
            info.filePath = result.path;
            info.generatedAt = result.generatedAt || info.generatedAt;
            workflow.contract = info;
            workflow.updatedAt = new Date().toISOString();
            return info;
        }
        // Fallback: generate markdown locally.
        const contract = this.contractGenerator.generateFromProposal(proposal);
        const md = this.contractGenerator.renderToMarkdown(contract, proposal);
        const outDir = path.join(process.cwd(), 'generated');
        if (!fs.existsSync(outDir))
            fs.mkdirSync(outDir, { recursive: true });
        const file = path.join(outDir, `contract-${workflow.id}.md`);
        fs.writeFileSync(file, md);
        contract.status = 'sent';
        contract.filePath = file;
        workflow.contract = contract;
        workflow.updatedAt = new Date().toISOString();
        return contract;
    }
    createDeliveryPackage(workflow) {
        const outDir = path.join(process.cwd(), 'delivery-packages', workflow.id);
        fs.mkdirSync(outDir, { recursive: true });
        const manifest = {
            workflowId: workflow.id,
            projectName: workflow.projectName,
            clientName: workflow.clientName,
            generatedAt: new Date().toISOString(),
            milestones: workflow.milestones.map(m => ({
                id: m.id,
                name: m.name,
                status: m.status,
                deliverables: m.deliverables,
            })),
            checklist: workflow.deliveryChecklist.map(c => ({ id: c.id, desc: c.description, status: c.status })),
            contract: workflow.contract?.filePath,
        };
        const manifestPath = path.join(outDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        workflow.metadata.customFields['deliveryPackage'] = { manifestPath };
        workflow.updatedAt = new Date().toISOString();
        return { manifestPath };
    }
    tryExternalContractTemplates() {
        const candidates = [
            path.resolve(__dirname, '..', '..', 'contract-templates', 'exports.js'),
            path.resolve(process.cwd(), '..', 'contract-templates', 'exports.js'),
        ];
        for (const p of candidates) {
            try {
                if (fs.existsSync(p)) {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    return require(p);
                }
            }
            catch {
                // ignore
            }
        }
        return null;
    }
    mapToExternalContractType(projectType) {
        switch (projectType) {
            case 'fixed':
                return 'fixed-price';
            case 'hourly':
                return 'hourly';
            case 'retainer':
                return 'retainer';
            default:
                return 'fixed-price';
        }
    }
    // ─── Convenience APIs ────────────────────────────────────────────────
    runQualityChecks(workflow, actor = 'system') {
        return this.deliveryChecklist.runAutoChecks(workflow, actor);
    }
    attachProposal(workflow, proposal) {
        workflow.metadata.customFields['proposal'] = proposal;
        workflow.updatedAt = new Date().toISOString();
    }
    markContractSigned(workflow) {
        if (!workflow.contract)
            throw new Error('No contract to sign');
        workflow.contract.status = 'signed';
        workflow.contract.signedAt = new Date().toISOString();
        workflow.updatedAt = new Date().toISOString();
    }
}
exports.ProposalToDeliveryEngine = ProposalToDeliveryEngine;
//# sourceMappingURL=workflow-engine.js.map