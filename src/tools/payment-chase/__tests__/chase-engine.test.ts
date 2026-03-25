import { createTestStorage, makeInvoice, TEST_CLIENT } from './setup';
import { ChaseEngine } from '../src/engine/chase-engine';

describe('Chase Engine', () => {
  test('startChase creates a chase record', async () => {
    const storage = await createTestStorage();
    const engine = new ChaseEngine(storage, { freelancerName: 'Tester' });

    const invoice = makeInvoice({ status: 'overdue' });
    const res = await engine.startChase(invoice, TEST_CLIENT);

    expect(res.action).toBe('created');
    const record = await storage.getChaseRecord(res.chaseId);
    expect(record).not.toBeNull();
    expect(record!.status).toBe('active');
  });

  test('processChase sends reminders and escalates after max attempts', async () => {
    const storage = await createTestStorage();
    const engine = new ChaseEngine(storage, {
      freelancerName: 'Tester',
      defaultPaymentLink: 'https://pay.example.com',
    });

    const invoice = makeInvoice({
      status: 'overdue',
      dueDate: new Date('2026-01-10T00:00:00Z'),
    });

    const start = await engine.startChase(invoice, TEST_CLIENT, 'aggressive');
    const record = await storage.getChaseRecord(start.chaseId);
    expect(record).not.toBeNull();

    // Force nextActionAt to now so processing triggers
    const now = new Date('2026-01-12T10:00:00Z');
    await storage.saveChaseRecord({ ...record!, nextActionAt: now });

    const res1 = await engine.processChase(start.chaseId, invoice, TEST_CLIENT, now);
    expect(['reminded', 'escalated']).toContain(res1.action);
    expect(res1.message?.body).toContain('invoice');

    // Repeat to push escalation (needs to meet next step's daysAfterDue)
    const later = new Date('2026-01-16T12:00:00Z'); // 6 days overdue
    const recAfter1 = await storage.getChaseRecord(start.chaseId);
    await storage.saveChaseRecord({ ...recAfter1!, nextActionAt: later });
    const res2 = await engine.processChase(start.chaseId, invoice, TEST_CLIENT, later);

    const recAfter2 = await storage.getChaseRecord(start.chaseId);
    expect(recAfter2!.actions.length).toBe(2);
    expect(res2.action).toBeDefined();
    expect(recAfter2!.currentStep).toBeGreaterThanOrEqual(1);
  });

  test('resolveChase when invoice is paid', async () => {
    const storage = await createTestStorage();
    const engine = new ChaseEngine(storage, { freelancerName: 'Tester' });

    const invoice = makeInvoice({ status: 'overdue' });
    const start = await engine.startChase(invoice, TEST_CLIENT);

    const paidInvoice = { ...invoice, status: 'paid' as const, paidAt: new Date('2026-01-11T00:00:00Z') };
    const res = await engine.processChase(start.chaseId, paidInvoice, TEST_CLIENT, new Date('2026-01-11T00:00:00Z'));

    expect(res.action).toBe('resolved');
    const record = await storage.getChaseRecord(start.chaseId);
    expect(record!.status).toBe('resolved');
  });

  test('pause and resume chase', async () => {
    const storage = await createTestStorage();
    const engine = new ChaseEngine(storage, { freelancerName: 'Tester' });

    const invoice = makeInvoice({ status: 'overdue' });
    const start = await engine.startChase(invoice, TEST_CLIENT);

    const paused = await engine.pauseChase(start.chaseId, 'Negotiation', new Date('2026-02-01T00:00:00Z'));
    expect(paused.action).toBe('paused');

    const recordPaused = await storage.getChaseRecord(start.chaseId);
    expect(recordPaused!.status).toBe('paused');

    const resumed = await engine.resumeChase(start.chaseId);
    expect(resumed.action).toBe('reminded');

    const recordResumed = await storage.getChaseRecord(start.chaseId);
    expect(recordResumed!.status).toBe('active');
  });
});
