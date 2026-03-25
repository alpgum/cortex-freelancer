import { createTestStorage, makeInvoice, TEST_CLIENT } from './setup';
import { ClientIntelligence } from '../src/intelligence/client-intelligence';

describe('Client Intelligence', () => {
  test('buildProfile computes reliability score and risk', async () => {
    const storage = await createTestStorage();
    const intel = new ClientIntelligence(storage);

    const invoices = [
      makeInvoice({ id: 'i1', status: 'paid', paidAt: new Date('2026-01-08T00:00:00Z') }), // early
      makeInvoice({ id: 'i2', number: '2026-002', status: 'paid', issuedAt: new Date('2026-02-01T00:00:00Z'), dueDate: new Date('2026-02-10T00:00:00Z'), paidAt: new Date('2026-02-25T00:00:00Z') }), // late
      makeInvoice({ id: 'i3', number: '2026-003', status: 'overdue', issuedAt: new Date('2026-03-01T00:00:00Z'), dueDate: new Date('2026-03-10T00:00:00Z') }),
    ];

    const profile = await intel.buildProfile(TEST_CLIENT.id, invoices);

    expect(profile.totalInvoices).toBe(3);
    expect(profile.paidOnTime).toBe(1);
    expect(profile.paidLate).toBe(1);
    expect(profile.unpaid).toBe(1);
    expect(profile.totalOutstanding).toBe(1000);
    expect(profile.reliabilityScore).toBeGreaterThanOrEqual(0);
    expect(['low', 'medium', 'high', 'critical']).toContain(profile.riskLevel);
  });

  test('predictLatePayment uses profile history', async () => {
    const storage = await createTestStorage();
    const intel = new ClientIntelligence(storage);

    const invoices = [
      makeInvoice({ id: 'i1', status: 'paid', paidAt: new Date('2026-01-20T00:00:00Z') }), // 10 days late
      makeInvoice({ id: 'i2', number: '2026-002', status: 'paid', issuedAt: new Date('2026-02-01T00:00:00Z'), dueDate: new Date('2026-02-10T00:00:00Z'), paidAt: new Date('2026-02-18T00:00:00Z') }),
    ];

    await intel.buildProfile(TEST_CLIENT.id, invoices);
    const pred = await intel.predictLatePayment(TEST_CLIENT.id);

    expect(pred.likelihood).toBeGreaterThan(0);
    expect(pred.reasoning.length).toBeGreaterThan(0);
  });
});
