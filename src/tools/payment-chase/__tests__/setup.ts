import { InMemoryStorage } from '../src/storage';
import { initializeDefaults } from '../src/index';
import { ChaseEngine } from '../src/engine/chase-engine';
import { Invoice, Client } from '../src/types';

export async function createTestStorage(): Promise<InMemoryStorage> {
  const storage = new InMemoryStorage();
  await initializeDefaults(storage);
  return storage;
}

export async function createTestEngine(): Promise<ChaseEngine> {
  const storage = await createTestStorage();
  return new ChaseEngine(storage, {
    freelancerName: 'Test Freelancer',
    freelancerEmail: 'test@freelancer.com',
    defaultPaymentLink: 'https://pay.example.com/invoice',
  });
}

export const TEST_CLIENT: Client = {
  id: 'client-1',
  name: 'Acme Corp',
  email: 'ap@acme.com',
  phone: '+1234567890',
  company: 'Acme Corp',
  timezone: 'UTC',
  preferredChannel: 'email',
};

export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const issuedAt = overrides.issuedAt ?? new Date('2026-01-01T00:00:00.000Z');
  const dueDate = overrides.dueDate ?? new Date('2026-01-10T00:00:00.000Z');
  return {
    id: overrides.id ?? 'inv-1',
    clientId: overrides.clientId ?? TEST_CLIENT.id,
    number: overrides.number ?? '2026-001',
    amount: overrides.amount ?? 1000,
    currency: overrides.currency ?? '$',
    issuedAt,
    dueDate,
    paidAt: overrides.paidAt,
    status: overrides.status ?? 'overdue',
    projectId: overrides.projectId,
    lineItems: overrides.lineItems,
  };
}
