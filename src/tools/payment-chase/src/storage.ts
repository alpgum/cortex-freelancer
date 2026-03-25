import {
  ChaseRecord,
  ChaseSequence,
  ClientPaymentProfile,
  MessageTemplate,
  EscalationLevel,
  StorageAdapter,
} from './types';

/**
 * In-memory storage adapter. Replace with file-based or DB adapter for production.
 */
export class InMemoryStorage implements StorageAdapter {
  private chaseRecords: Map<string, ChaseRecord> = new Map();
  private clientProfiles: Map<string, ClientPaymentProfile> = new Map();
  private sequences: Map<string, ChaseSequence> = new Map();
  private templates: Map<string, MessageTemplate> = new Map();

  // ── Chase Records ──────────────────────────────────────────────
  async saveChaseRecord(record: ChaseRecord): Promise<void> {
    this.chaseRecords.set(record.id, { ...record });
  }

  async getChaseRecord(id: string): Promise<ChaseRecord | null> {
    return this.chaseRecords.get(id) ?? null;
  }

  async getChaseRecordsByInvoice(invoiceId: string): Promise<ChaseRecord[]> {
    return Array.from(this.chaseRecords.values()).filter(r => r.invoiceId === invoiceId);
  }

  async getChaseRecordsByClient(clientId: string): Promise<ChaseRecord[]> {
    return Array.from(this.chaseRecords.values()).filter(r => r.clientId === clientId);
  }

  async getActiveChaseRecords(): Promise<ChaseRecord[]> {
    return Array.from(this.chaseRecords.values()).filter(r => r.status === 'active');
  }

  async getAllChaseRecords(): Promise<ChaseRecord[]> {
    return Array.from(this.chaseRecords.values());
  }

  // ── Client Profiles ────────────────────────────────────────────
  async saveClientProfile(profile: ClientPaymentProfile): Promise<void> {
    this.clientProfiles.set(profile.clientId, { ...profile });
  }

  async getClientProfile(clientId: string): Promise<ClientPaymentProfile | null> {
    return this.clientProfiles.get(clientId) ?? null;
  }

  async getAllClientProfiles(): Promise<ClientPaymentProfile[]> {
    return Array.from(this.clientProfiles.values());
  }

  // ── Sequences ──────────────────────────────────────────────────
  async saveSequence(sequence: ChaseSequence): Promise<void> {
    this.sequences.set(sequence.id, { ...sequence });
  }

  async getSequence(id: string): Promise<ChaseSequence | null> {
    return this.sequences.get(id) ?? null;
  }

  async getDefaultSequence(): Promise<ChaseSequence | null> {
    return Array.from(this.sequences.values()).find(s => s.isDefault) ?? null;
  }

  async getAllSequences(): Promise<ChaseSequence[]> {
    return Array.from(this.sequences.values());
  }

  // ── Templates ──────────────────────────────────────────────────
  async saveTemplate(template: MessageTemplate): Promise<void> {
    this.templates.set(template.id, { ...template });
  }

  async getTemplate(id: string): Promise<MessageTemplate | null> {
    return this.templates.get(id) ?? null;
  }

  async getTemplatesByEscalation(escalation: EscalationLevel): Promise<MessageTemplate[]> {
    return Array.from(this.templates.values()).filter(t => t.escalation === escalation);
  }

  async getAllTemplates(): Promise<MessageTemplate[]> {
    return Array.from(this.templates.values());
  }
}
