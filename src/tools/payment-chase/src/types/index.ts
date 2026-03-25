// ── Escalation Levels ──────────────────────────────────────────────
export enum EscalationLevel {
  FriendlyReminder = 'friendly_reminder',
  FirmFollowUp = 'firm_follow_up',
  FormalNotice = 'formal_notice',
  FinalWarning = 'final_warning',
  CollectionsReferral = 'collections_referral',
}

export const ESCALATION_ORDER: EscalationLevel[] = [
  EscalationLevel.FriendlyReminder,
  EscalationLevel.FirmFollowUp,
  EscalationLevel.FormalNotice,
  EscalationLevel.FinalWarning,
  EscalationLevel.CollectionsReferral,
];

export enum ToneStyle {
  Warm = 'warm',
  Professional = 'professional',
  Firm = 'firm',
  Legal = 'legal',
}

export const ESCALATION_TONE_MAP: Record<EscalationLevel, ToneStyle> = {
  [EscalationLevel.FriendlyReminder]: ToneStyle.Warm,
  [EscalationLevel.FirmFollowUp]: ToneStyle.Professional,
  [EscalationLevel.FormalNotice]: ToneStyle.Firm,
  [EscalationLevel.FinalWarning]: ToneStyle.Legal,
  [EscalationLevel.CollectionsReferral]: ToneStyle.Legal,
};

// ── Chase Sequence Configuration ───────────────────────────────────
export interface ChaseStepConfig {
  escalation: EscalationLevel;
  /** Days after due date (or after previous step) to trigger this step */
  daysAfterDue: number;
  /** Maximum number of reminders at this level before escalating */
  maxAttempts: number;
  /** Channel: email, sms, phone, letter */
  channels: ChaseChannel[];
  /** Template ID to use */
  templateId?: string;
}

export type ChaseChannel = 'email' | 'sms' | 'phone' | 'letter';

export interface ChaseSequence {
  id: string;
  name: string;
  description: string;
  steps: ChaseStepConfig[];
  /** Default sequence used when no client-specific override exists */
  isDefault: boolean;
}

// ── Invoice (integration interface) ────────────────────────────────
export interface Invoice {
  id: string;
  clientId: string;
  projectId?: string;
  number: string;
  amount: number;
  currency: string;
  issuedAt: Date;
  dueDate: Date;
  paidAt?: Date;
  status: InvoiceStatus;
  lineItems?: string[];
}

export type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'paid' | 'partial' | 'cancelled' | 'disputed';

// ── Client (integration interface) ─────────────────────────────────
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  timezone?: string;
  preferredChannel?: ChaseChannel;
  tags?: string[];
}

// ── Chase Record ───────────────────────────────────────────────────
export interface ChaseRecord {
  id: string;
  invoiceId: string;
  clientId: string;
  sequenceId: string;
  currentStep: number;
  currentAttempt: number;
  escalationLevel: EscalationLevel;
  status: ChaseStatus;
  actions: ChaseAction[];
  createdAt: Date;
  updatedAt: Date;
  nextActionAt?: Date;
  pausedAt?: Date;
  pauseReason?: string;
  resumeAt?: Date;
  resolvedAt?: Date;
  resolutionNote?: string;
}

export type ChaseStatus = 'active' | 'paused' | 'resolved' | 'escalated_externally' | 'cancelled';

export interface ChaseAction {
  id: string;
  timestamp: Date;
  escalation: EscalationLevel;
  channel: ChaseChannel;
  templateId: string;
  subject?: string;
  body: string;
  delivered: boolean;
  opened?: boolean;
  responded?: boolean;
  responseNote?: string;
}

// ── Client Intelligence ────────────────────────────────────────────
export interface ClientPaymentProfile {
  clientId: string;
  totalInvoices: number;
  paidOnTime: number;
  paidLate: number;
  unpaid: number;
  averageDaysToPayment: number;
  medianDaysToPayment: number;
  averageDaysLate: number;
  reliabilityScore: number; // 0-100
  preferredPayDay?: number; // day of month they tend to pay
  preferredPayDayOfWeek?: number; // 0=Sun .. 6=Sat
  lastPaymentDate?: Date;
  totalOutstanding: number;
  riskLevel: ClientRiskLevel;
  paymentHistory: PaymentHistoryEntry[];
  updatedAt: Date;
}

export type ClientRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PaymentHistoryEntry {
  invoiceId: string;
  amount: number;
  dueDate: Date;
  paidAt?: Date;
  daysToPayment?: number;
  daysLate?: number;
  chaseActionsNeeded: number;
}

// ── Smart Timing ───────────────────────────────────────────────────
export interface TimingRecommendation {
  suggestedDate: Date;
  suggestedTime: string; // HH:MM in client timezone
  confidence: number; // 0-1
  reasoning: string[];
  factors: TimingFactor[];
}

export interface TimingFactor {
  name: string;
  weight: number;
  value: number; // -1 to 1 (negative = avoid, positive = good)
  description: string;
}

// ── Templates ──────────────────────────────────────────────────────
export interface MessageTemplate {
  id: string;
  name: string;
  escalation: EscalationLevel;
  tone: ToneStyle;
  channel: ChaseChannel;
  subject?: string;
  body: string;
  /** Available variables: {{clientName}}, {{invoiceNumber}}, {{amount}}, {{dueDate}}, {{daysOverdue}}, {{companyName}}, etc. */
  variables: string[];
  isDefault: boolean;
}

export interface TemplateVariables {
  clientName: string;
  clientCompany?: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  projectName?: string;
  freelancerName: string;
  freelancerCompany?: string;
  freelancerEmail?: string;
  freelancerPhone?: string;
  paymentLink?: string;
  lineItems?: string;
  [key: string]: string | number | undefined;
}

// ── Analytics ──────────────────────────────────────────────────────
export interface ChaseAnalytics {
  period: { start: Date; end: Date };
  totalChases: number;
  activeChases: number;
  resolvedChases: number;
  averageDaysToPayment: number;
  recoveryRate: number; // percentage
  totalAmountChased: number;
  totalAmountRecovered: number;
  escalationBreakdown: Record<EscalationLevel, number>;
  channelEffectiveness: Record<ChaseChannel, ChannelStats>;
  topDelinquentClients: ClientDelinquencyRecord[];
}

export interface ChannelStats {
  sent: number;
  delivered: number;
  opened: number;
  responded: number;
  effectivenessRate: number;
}

export interface ClientDelinquencyRecord {
  clientId: string;
  clientName: string;
  totalOutstanding: number;
  invoicesOverdue: number;
  averageDaysLate: number;
  reliabilityScore: number;
}

// ── Storage Interface ──────────────────────────────────────────────
export interface StorageAdapter {
  // Chase records
  saveChaseRecord(record: ChaseRecord): Promise<void>;
  getChaseRecord(id: string): Promise<ChaseRecord | null>;
  getChaseRecordsByInvoice(invoiceId: string): Promise<ChaseRecord[]>;
  getChaseRecordsByClient(clientId: string): Promise<ChaseRecord[]>;
  getActiveChaseRecords(): Promise<ChaseRecord[]>;
  getAllChaseRecords(): Promise<ChaseRecord[]>;

  // Client profiles
  saveClientProfile(profile: ClientPaymentProfile): Promise<void>;
  getClientProfile(clientId: string): Promise<ClientPaymentProfile | null>;
  getAllClientProfiles(): Promise<ClientPaymentProfile[]>;

  // Sequences
  saveSequence(sequence: ChaseSequence): Promise<void>;
  getSequence(id: string): Promise<ChaseSequence | null>;
  getDefaultSequence(): Promise<ChaseSequence | null>;
  getAllSequences(): Promise<ChaseSequence[]>;

  // Templates
  saveTemplate(template: MessageTemplate): Promise<void>;
  getTemplate(id: string): Promise<MessageTemplate | null>;
  getTemplatesByEscalation(escalation: EscalationLevel): Promise<MessageTemplate[]>;
  getAllTemplates(): Promise<MessageTemplate[]>;
}
