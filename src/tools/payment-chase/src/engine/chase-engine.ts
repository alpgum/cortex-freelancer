import { v4 as uuid } from 'uuid';
import { differenceInDays, addDays } from 'date-fns';
import {
  ChaseRecord,
  ChaseAction,
  ChaseSequence,
  ChaseStepConfig,
  Invoice,
  Client,
  EscalationLevel,
  TemplateVariables,
  StorageAdapter,
  MessageTemplate,
} from '../types';
import { renderTemplate } from '../templates/renderer';
import { SmartTimingEngine } from '../intelligence/smart-timing';
import { ClientIntelligence } from '../intelligence/client-intelligence';

export interface ChaseEngineConfig {
  freelancerName: string;
  freelancerCompany?: string;
  freelancerEmail?: string;
  freelancerPhone?: string;
  defaultPaymentLink?: string;
}

export interface ChaseResult {
  chaseId: string;
  action: 'created' | 'escalated' | 'reminded' | 'resolved' | 'paused' | 'no_action' | 'completed';
  escalation: EscalationLevel;
  message?: { subject?: string; body: string };
  nextActionAt?: Date;
  reasoning: string[];
}

/**
 * Chase Engine — the core orchestrator.
 * Manages the lifecycle of payment chases: creation, escalation,
 * reminders, pausing, and resolution.
 */
export class ChaseEngine {
  private timing: SmartTimingEngine;
  private intelligence: ClientIntelligence;

  constructor(
    private storage: StorageAdapter,
    private config: ChaseEngineConfig
  ) {
    this.timing = new SmartTimingEngine(storage);
    this.intelligence = new ClientIntelligence(storage);
  }

  /**
   * Start a new chase for an overdue invoice.
   */
  async startChase(
    invoice: Invoice,
    client: Client,
    sequenceId?: string
  ): Promise<ChaseResult> {
    // Check if already being chased
    const existing = await this.storage.getChaseRecordsByInvoice(invoice.id);
    const activeExisting = existing.find(r => r.status === 'active');
    if (activeExisting) {
      return {
        chaseId: activeExisting.id,
        action: 'no_action',
        escalation: activeExisting.escalationLevel,
        reasoning: ['Invoice already has an active chase'],
      };
    }

    // Get sequence (client-specific or default)
    let sequence: ChaseSequence | null = null;
    if (sequenceId) {
      sequence = await this.storage.getSequence(sequenceId);
    }
    if (!sequence) {
      // Use intelligence to pick the right sequence
      const strategy = await this.intelligence.getRecommendedStrategy(client.id);
      const seqId = strategy.urgency === 'relaxed' ? 'relaxed'
        : strategy.urgency === 'aggressive' ? 'aggressive'
        : 'default';
      sequence = await this.storage.getSequence(seqId);
    }
    if (!sequence) {
      sequence = await this.storage.getDefaultSequence();
    }
    if (!sequence) {
      throw new Error('No chase sequence available');
    }

    // Get optimal timing
    const timingRec = await this.timing.getOptimalTiming(client.id);

    const record: ChaseRecord = {
      id: uuid(),
      invoiceId: invoice.id,
      clientId: client.id,
      sequenceId: sequence.id,
      currentStep: 0,
      currentAttempt: 0,
      escalationLevel: sequence.steps[0].escalation,
      status: 'active',
      actions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      nextActionAt: timingRec.suggestedDate,
    };

    await this.storage.saveChaseRecord(record);

    return {
      chaseId: record.id,
      action: 'created',
      escalation: record.escalationLevel,
      nextActionAt: record.nextActionAt,
      reasoning: [`Chase started with ${sequence.name}`, ...timingRec.reasoning],
    };
  }

  /**
   * Process a chase — determine if it's time to send a reminder or escalate.
   */
  async processChase(
    chaseId: string,
    invoice: Invoice,
    client: Client,
    now: Date = new Date()
  ): Promise<ChaseResult> {
    const record = await this.storage.getChaseRecord(chaseId);
    if (!record) throw new Error(`Chase not found: ${chaseId}`);
    if (record.status !== 'active') {
      return {
        chaseId,
        action: 'no_action',
        escalation: record.escalationLevel,
        reasoning: [`Chase is ${record.status}`],
      };
    }

    // Check if invoice was paid
    if (invoice.paidAt || invoice.status === 'paid') {
      return this.resolveChase(chaseId, 'Payment received');
    }

    const sequence = await this.storage.getSequence(record.sequenceId);
    if (!sequence) throw new Error(`Sequence not found: ${record.sequenceId}`);

    const step = sequence.steps[record.currentStep];
    if (!step) {
      // All steps exhausted
      record.status = 'escalated_externally';
      record.updatedAt = now;
      await this.storage.saveChaseRecord(record);
      return {
        chaseId,
        action: 'completed',
        escalation: record.escalationLevel,
        reasoning: ['All chase steps exhausted — requires manual intervention'],
      };
    }

    // Check if it's time for action
    const daysOverdue = differenceInDays(now, invoice.dueDate);
    if (daysOverdue < step.daysAfterDue) {
      return {
        chaseId,
        action: 'no_action',
        escalation: record.escalationLevel,
        nextActionAt: record.nextActionAt,
        reasoning: [`Not yet time: ${daysOverdue} days overdue, step triggers at ${step.daysAfterDue} days`],
      };
    }

    // Check if next action time has arrived
    if (record.nextActionAt && now < record.nextActionAt) {
      return {
        chaseId,
        action: 'no_action',
        escalation: record.escalationLevel,
        nextActionAt: record.nextActionAt,
        reasoning: ['Waiting for optimal send time'],
      };
    }

    // Send the chase message
    const template = await this.getTemplate(step);
    if (!template) {
      return {
        chaseId,
        action: 'no_action',
        escalation: record.escalationLevel,
        reasoning: [`No template found for step: ${step.templateId}`],
      };
    }

    const variables = this.buildVariables(invoice, client, daysOverdue);
    const rendered = renderTemplate(template, variables);

    const action: ChaseAction = {
      id: uuid(),
      timestamp: now,
      escalation: step.escalation,
      channel: step.channels[0],
      templateId: template.id,
      subject: rendered.subject,
      body: rendered.body,
      delivered: true, // will be updated by actual send
    };

    record.actions.push(action);
    record.currentAttempt++;
    record.escalationLevel = step.escalation;

    // Check if we need to move to next step
    if (record.currentAttempt >= step.maxAttempts) {
      record.currentStep++;
      record.currentAttempt = 0;
      if (record.currentStep < sequence.steps.length) {
        record.escalationLevel = sequence.steps[record.currentStep].escalation;
      }
    }

    // Calculate next action timing
    const nextStep = sequence.steps[record.currentStep];
    if (nextStep) {
      const nextDueDay = addDays(invoice.dueDate, nextStep.daysAfterDue);
      const timing = await this.timing.getOptimalTiming(client.id, nextDueDay);
      record.nextActionAt = timing.suggestedDate;
    } else {
      record.nextActionAt = undefined;
    }

    record.updatedAt = now;
    await this.storage.saveChaseRecord(record);

    return {
      chaseId,
      action: record.currentStep > 0 && record.currentAttempt === 0 ? 'escalated' : 'reminded',
      escalation: record.escalationLevel,
      message: rendered,
      nextActionAt: record.nextActionAt,
      reasoning: [`Sent ${step.escalation} via ${step.channels[0]}`],
    };
  }

  /**
   * Resolve a chase (payment received or manually resolved).
   */
  async resolveChase(chaseId: string, note: string): Promise<ChaseResult> {
    const record = await this.storage.getChaseRecord(chaseId);
    if (!record) throw new Error(`Chase not found: ${chaseId}`);

    record.status = 'resolved';
    record.resolvedAt = new Date();
    record.resolutionNote = note;
    record.updatedAt = new Date();
    await this.storage.saveChaseRecord(record);

    return {
      chaseId,
      action: 'resolved',
      escalation: record.escalationLevel,
      reasoning: [`Chase resolved: ${note}`],
    };
  }

  /**
   * Pause a chase (for holidays, negotiations, etc.).
   */
  async pauseChase(chaseId: string, reason: string, resumeAt?: Date): Promise<ChaseResult> {
    const record = await this.storage.getChaseRecord(chaseId);
    if (!record) throw new Error(`Chase not found: ${chaseId}`);

    record.status = 'paused';
    record.pausedAt = new Date();
    record.pauseReason = reason;
    record.resumeAt = resumeAt;
    record.updatedAt = new Date();
    await this.storage.saveChaseRecord(record);

    return {
      chaseId,
      action: 'paused',
      escalation: record.escalationLevel,
      reasoning: [`Chase paused: ${reason}${resumeAt ? ` — resumes ${resumeAt.toISOString()}` : ''}`],
    };
  }

  /**
   * Resume a paused chase.
   */
  async resumeChase(chaseId: string): Promise<ChaseResult> {
    const record = await this.storage.getChaseRecord(chaseId);
    if (!record) throw new Error(`Chase not found: ${chaseId}`);
    if (record.status !== 'paused') {
      return {
        chaseId,
        action: 'no_action',
        escalation: record.escalationLevel,
        reasoning: ['Chase is not paused'],
      };
    }

    record.status = 'active';
    record.pausedAt = undefined;
    record.pauseReason = undefined;
    record.resumeAt = undefined;
    record.updatedAt = new Date();

    // Recalculate next action
    const timing = await this.timing.getOptimalTiming(record.clientId);
    record.nextActionAt = timing.suggestedDate;
    await this.storage.saveChaseRecord(record);

    return {
      chaseId,
      action: 'reminded',
      escalation: record.escalationLevel,
      nextActionAt: record.nextActionAt,
      reasoning: ['Chase resumed', ...timing.reasoning],
    };
  }

  /**
   * Process all active chases — the main "tick" method.
   * Call this periodically (e.g., daily) to process all pending actions.
   */
  async processAllChases(
    getInvoice: (id: string) => Promise<Invoice | null>,
    getClient: (id: string) => Promise<Client | null>,
    now: Date = new Date()
  ): Promise<ChaseResult[]> {
    const results: ChaseResult[] = [];

    // Check paused chases that should resume
    const allRecords = await this.storage.getAllChaseRecords();
    for (const record of allRecords) {
      if (record.status === 'paused' && record.resumeAt && now >= record.resumeAt) {
        const result = await this.resumeChase(record.id);
        results.push(result);
      }
    }

    // Process active chases
    const activeRecords = await this.storage.getActiveChaseRecords();
    for (const record of activeRecords) {
      const invoice = await getInvoice(record.invoiceId);
      const client = await getClient(record.clientId);
      if (!invoice || !client) continue;

      const result = await this.processChase(record.id, invoice, client, now);
      results.push(result);
    }

    return results;
  }

  // ── Private Helpers ────────────────────────────────────────────

  private async getTemplate(step: ChaseStepConfig): Promise<MessageTemplate | null> {
    if (step.templateId) {
      return this.storage.getTemplate(step.templateId);
    }
    const templates = await this.storage.getTemplatesByEscalation(step.escalation);
    return templates.find(t => t.isDefault && t.channel === step.channels[0]) ?? templates[0] ?? null;
  }

  private buildVariables(invoice: Invoice, client: Client, daysOverdue: number): TemplateVariables {
    return {
      clientName: client.name,
      clientCompany: client.company,
      invoiceNumber: invoice.number,
      amount: invoice.amount.toFixed(2),
      currency: invoice.currency,
      dueDate: invoice.dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      daysOverdue,
      freelancerName: this.config.freelancerName,
      freelancerCompany: this.config.freelancerCompany,
      freelancerEmail: this.config.freelancerEmail,
      freelancerPhone: this.config.freelancerPhone,
      paymentLink: this.config.defaultPaymentLink ?? '',
      lineItems: invoice.lineItems?.join(', '),
    };
  }
}
