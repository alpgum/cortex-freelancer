import { promises as fs } from 'fs';
import path from 'path';
import {
  ChaseRecord,
  ChaseSequence,
  ClientPaymentProfile,
  MessageTemplate,
  EscalationLevel,
  StorageAdapter,
} from './types';

interface FileStorageSchema {
  chaseRecords: ChaseRecord[];
  clientProfiles: ClientPaymentProfile[];
  sequences: ChaseSequence[];
  templates: MessageTemplate[];
}

const EMPTY: FileStorageSchema = {
  chaseRecords: [],
  clientProfiles: [],
  sequences: [],
  templates: [],
};

function reviveDates<T>(obj: any): T {
  // Naive date revival for known date fields by pattern.
  // For this tool, we revive any ISO-like string under keys ending with 'At' or 'Date' or 'dueDate'/'issuedAt'.
  const revive = (val: any, key?: string): any => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const out: any = {};
      for (const k of Object.keys(val)) out[k] = revive(val[k], k);
      return out;
    }
    if (Array.isArray(val)) return val.map(v => revive(v));
    if (typeof val === 'string') {
      const looksLikeDateKey = key && (/(At|Date)$/).test(key) || key === 'dueDate' || key === 'issuedAt';
      if (looksLikeDateKey) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return val;
  };
  return revive(obj) as T;
}

/**
 * File-backed storage adapter for CLI use.
 */
export class FileStorage implements StorageAdapter {
  constructor(private filePath: string) {}

  private async load(): Promise<FileStorageSchema> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return reviveDates<FileStorageSchema>({ ...EMPTY, ...parsed });
    } catch (err: any) {
      if (err?.code === 'ENOENT') return { ...EMPTY };
      throw err;
    }
  }

  private async save(data: FileStorageSchema): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  private async update(mutator: (data: FileStorageSchema) => void): Promise<void> {
    const data = await this.load();
    mutator(data);
    await this.save(data);
  }

  // Chase records
  async saveChaseRecord(record: ChaseRecord): Promise<void> {
    await this.update(data => {
      const idx = data.chaseRecords.findIndex(r => r.id === record.id);
      if (idx >= 0) data.chaseRecords[idx] = record;
      else data.chaseRecords.push(record);
    });
  }

  async getChaseRecord(id: string): Promise<ChaseRecord | null> {
    const data = await this.load();
    return data.chaseRecords.find(r => r.id === id) ?? null;
  }

  async getChaseRecordsByInvoice(invoiceId: string): Promise<ChaseRecord[]> {
    const data = await this.load();
    return data.chaseRecords.filter(r => r.invoiceId === invoiceId);
  }

  async getChaseRecordsByClient(clientId: string): Promise<ChaseRecord[]> {
    const data = await this.load();
    return data.chaseRecords.filter(r => r.clientId === clientId);
  }

  async getActiveChaseRecords(): Promise<ChaseRecord[]> {
    const data = await this.load();
    return data.chaseRecords.filter(r => r.status === 'active');
  }

  async getAllChaseRecords(): Promise<ChaseRecord[]> {
    const data = await this.load();
    return data.chaseRecords;
  }

  // Client profiles
  async saveClientProfile(profile: ClientPaymentProfile): Promise<void> {
    await this.update(data => {
      const idx = data.clientProfiles.findIndex(p => p.clientId === profile.clientId);
      if (idx >= 0) data.clientProfiles[idx] = profile;
      else data.clientProfiles.push(profile);
    });
  }

  async getClientProfile(clientId: string): Promise<ClientPaymentProfile | null> {
    const data = await this.load();
    return data.clientProfiles.find(p => p.clientId === clientId) ?? null;
  }

  async getAllClientProfiles(): Promise<ClientPaymentProfile[]> {
    const data = await this.load();
    return data.clientProfiles;
  }

  // Sequences
  async saveSequence(sequence: ChaseSequence): Promise<void> {
    await this.update(data => {
      const idx = data.sequences.findIndex(s => s.id === sequence.id);
      if (idx >= 0) data.sequences[idx] = sequence;
      else data.sequences.push(sequence);
    });
  }

  async getSequence(id: string): Promise<ChaseSequence | null> {
    const data = await this.load();
    return data.sequences.find(s => s.id === id) ?? null;
  }

  async getDefaultSequence(): Promise<ChaseSequence | null> {
    const data = await this.load();
    return data.sequences.find(s => s.isDefault) ?? null;
  }

  async getAllSequences(): Promise<ChaseSequence[]> {
    const data = await this.load();
    return data.sequences;
  }

  // Templates
  async saveTemplate(template: MessageTemplate): Promise<void> {
    await this.update(data => {
      const idx = data.templates.findIndex(t => t.id === template.id);
      if (idx >= 0) data.templates[idx] = template;
      else data.templates.push(template);
    });
  }

  async getTemplate(id: string): Promise<MessageTemplate | null> {
    const data = await this.load();
    return data.templates.find(t => t.id === id) ?? null;
  }

  async getTemplatesByEscalation(escalation: EscalationLevel): Promise<MessageTemplate[]> {
    const data = await this.load();
    return data.templates.filter(t => t.escalation === escalation);
  }

  async getAllTemplates(): Promise<MessageTemplate[]> {
    const data = await this.load();
    return data.templates;
  }
}
