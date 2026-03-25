import { createTestStorage, makeInvoice, TEST_CLIENT } from './setup';
import { ChaseEngine } from '../src/engine/chase-engine';
import { AnalyticsEngine } from '../src/analytics/analytics-engine';

describe('Analytics Engine', () => {
  test('generates analytics report', async () => {
    const storage = await createTestStorage();
    const engine = new ChaseEngine(storage, { freelancerName: 'Tester' });

    const invoice1 = makeInvoice({ id: 'inv-a', number: 'A', status: 'overdue' });
    const invoice2 = makeInvoice({ id: 'inv-b', number: 'B', status: 'paid', paidAt: new Date('2026-01-15T00:00:00Z') });

    const start = await engine.startChase(invoice1, TEST_CLIENT);
    const chase = await storage.getChaseRecord(start.chaseId);
    await storage.saveChaseRecord({ ...chase!, nextActionAt: new Date('2026-01-13T10:00:00Z') });
    await engine.processChase(start.chaseId, invoice1, TEST_CLIENT, new Date('2026-01-13T10:00:00Z'));

    const analytics = new AnalyticsEngine(storage);
    const report = await analytics.generateAnalytics(
      { start: new Date('2025-12-31T00:00:00Z'), end: new Date('2026-12-31T00:00:00Z') },
      [invoice1, invoice2],
      [TEST_CLIENT]
    );

    expect(report.totalChases).toBeGreaterThanOrEqual(1);
    expect(report.channelEffectiveness.email.sent).toBeGreaterThanOrEqual(1);
    expect(report.escalationBreakdown['friendly_reminder']).toBeDefined();
  });
});
