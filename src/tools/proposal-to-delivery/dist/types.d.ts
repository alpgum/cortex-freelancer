/**
 * Proposal-to-Delivery Workflow Types
 *
 * Complete type definitions for the end-to-end freelancer workflow:
 * proposal acceptance → contract → kickoff → milestones → delivery → sign-off
 */
export type WorkflowStage = 'proposal_accepted' | 'contract_generation' | 'contract_review' | 'contract_signed' | 'project_kickoff' | 'milestone_setup' | 'in_progress' | 'milestone_review' | 'delivery_prep' | 'quality_check' | 'client_delivery' | 'client_review' | 'revisions' | 'sign_off' | 'completed' | 'cancelled';
export type TransitionTrigger = 'manual' | 'automated' | 'condition_met' | 'timeout' | 'rollback';
export interface Workflow {
    id: string;
    proposalId: string;
    projectName: string;
    clientId: string;
    clientName: string;
    currentStage: WorkflowStage;
    previousStage?: WorkflowStage;
    stageHistory: StageTransition[];
    contract?: ContractInfo;
    milestones: WorkflowMilestone[];
    deliveryChecklist: DeliveryCheckItem[];
    notifications: Notification[];
    automation: AutomationState;
    timeline: TimelineInfo;
    metadata: WorkflowMetadata;
    createdAt: string;
    updatedAt: string;
}
export interface WorkflowMetadata {
    projectType: 'fixed' | 'hourly' | 'retainer';
    totalValue: number;
    currency: string;
    tags: string[];
    notes: string[];
    customFields: Record<string, unknown>;
}
export interface StageDefinition {
    id: WorkflowStage;
    name: string;
    description: string;
    allowedTransitions: WorkflowStage[];
    rollbackTo?: WorkflowStage;
    entryConditions: Condition[];
    exitConditions: Condition[];
    autoActions: AutoAction[];
    timeoutHours?: number;
}
export interface StageTransition {
    id: string;
    from: WorkflowStage;
    to: WorkflowStage;
    trigger: TransitionTrigger;
    timestamp: string;
    actor: string;
    notes?: string;
    conditionsMet: string[];
    duration?: number;
}
export interface Condition {
    id: string;
    description: string;
    check: string;
    required: boolean;
    parameters?: Record<string, unknown>;
}
export interface AutoAction {
    id: string;
    type: AutoActionType;
    description: string;
    parameters: Record<string, unknown>;
    delayMinutes?: number;
    conditions?: Condition[];
}
export type AutoActionType = 'generate_contract' | 'create_milestones' | 'send_notification' | 'create_checklist' | 'generate_invoice' | 'schedule_meeting' | 'update_timeline' | 'run_quality_check' | 'package_deliverables' | 'transition_stage';
export interface ContractInfo {
    id: string;
    templateType: string;
    status: 'draft' | 'sent' | 'reviewed' | 'signed' | 'void';
    generatedAt: string;
    sentAt?: string;
    signedAt?: string;
    filePath?: string;
    terms: ContractTerms;
}
export interface ContractTerms {
    scope: string;
    deliverables: string[];
    paymentSchedule: PaymentScheduleItem[];
    startDate: string;
    endDate: string;
    revisionRounds: number;
    terminationClause: string;
    ipOwnership: string;
}
export interface PaymentScheduleItem {
    milestoneId?: string;
    description: string;
    amount: number;
    percentage: number;
    dueCondition: string;
    status: 'pending' | 'invoiced' | 'paid';
}
export interface WorkflowMilestone {
    id: string;
    name: string;
    description: string;
    order: number;
    status: 'pending' | 'in_progress' | 'review' | 'completed' | 'blocked';
    deliverables: string[];
    estimatedHours: number;
    actualHours: number;
    estimatedStartDate: string;
    estimatedEndDate: string;
    actualStartDate?: string;
    actualEndDate?: string;
    paymentAmount: number;
    paymentPercentage: number;
    dependencies: string[];
    acceptanceCriteria: string[];
}
export interface DeliveryCheckItem {
    id: string;
    category: DeliveryCategory;
    description: string;
    status: 'pending' | 'passed' | 'failed' | 'skipped';
    required: boolean;
    checkedAt?: string;
    checkedBy?: string;
    notes?: string;
}
export type DeliveryCategory = 'code_quality' | 'documentation' | 'testing' | 'security' | 'performance' | 'accessibility' | 'client_requirements' | 'packaging' | 'handover';
export interface Notification {
    id: string;
    type: NotificationType;
    recipient: 'freelancer' | 'client' | 'both';
    subject: string;
    message: string;
    stage: WorkflowStage;
    sentAt?: string;
    status: 'pending' | 'sent' | 'failed';
    channel: 'email' | 'in_app' | 'slack' | 'webhook';
}
export type NotificationType = 'stage_transition' | 'action_required' | 'deadline_approaching' | 'deadline_passed' | 'milestone_completed' | 'payment_due' | 'review_requested' | 'sign_off_complete' | 'quality_check_result';
export interface PendingAutoAction {
    id: string;
    seq: number;
    action: AutoAction;
    scheduledFor: string;
    attempts: number;
    status: 'pending' | 'running';
}
export interface CompletedAutoAction {
    id: string;
    actionType: AutoAction['type'];
    description: string;
    executedAt: string;
    status: 'success' | 'failed' | 'skipped';
    result?: unknown;
    error?: string;
}
export interface AutomationState {
    enabled: boolean;
    pendingActions: PendingAutoAction[];
    completedActions: CompletedAutoAction[];
    lastProcessedAt?: string;
}
export interface TimelineInfo {
    estimatedStartDate: string;
    estimatedEndDate: string;
    actualStartDate?: string;
    actualEndDate?: string;
    estimatedTotalHours: number;
    actualTotalHours: number;
    stageTimings: StageTiming[];
    varianceAnalysis?: VarianceAnalysis;
}
export interface StageTiming {
    stage: WorkflowStage;
    estimatedHours: number;
    actualHours: number;
    startedAt?: string;
    completedAt?: string;
}
export interface VarianceAnalysis {
    scheduleVariance: number;
    scheduleVariancePercent: number;
    effortVariance: number;
    effortVariancePercent: number;
    criticalPath: WorkflowStage[];
    bottlenecks: BottleneckInfo[];
    projectedCompletionDate: string;
    isOnTrack: boolean;
}
export interface BottleneckInfo {
    stage: WorkflowStage;
    delayHours: number;
    reason: string;
    suggestion: string;
}
export interface WorkflowConfig {
    autoGenerateContract: boolean;
    autoCreateMilestones: boolean;
    autoNotify: boolean;
    defaultCurrency: string;
    defaultRevisionRounds: number;
    qualityCheckRequired: boolean;
    notificationChannels: ('email' | 'in_app' | 'slack' | 'webhook')[];
    webhookUrl?: string;
    contractTemplatePath?: string;
    timeoutEscalation: boolean;
}
export interface ProposalInput {
    proposalId: string;
    projectName: string;
    clientId: string;
    clientName: string;
    projectType: 'fixed' | 'hourly' | 'retainer';
    totalValue: number;
    currency?: string;
    scope: string;
    deliverables: DeliverableInput[];
    estimatedHours: number;
    startDate: string;
    endDate: string;
    paymentStructure: 'milestone' | 'upfront' | 'split' | 'completion';
    revisionRounds?: number;
    tags?: string[];
    notes?: string;
}
export interface DeliverableInput {
    name: string;
    description: string;
    estimatedHours: number;
    acceptanceCriteria: string[];
    dependencies?: string[];
}
export interface WorkflowStore {
    workflows: Record<string, Workflow>;
    version: string;
    lastUpdated: string;
}
//# sourceMappingURL=types.d.ts.map