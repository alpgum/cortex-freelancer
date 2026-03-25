import { createTestStorage, TEST_CLIENT } from './setup';
import { SmartTimingEngine } from '../src/intelligence/smart-timing';
import { ClientPaymentProfile } from '../src/types';

describe('Smart Timing Engine', () => {
  test('avoids weekend and sets 10:00', async () => {
    const storage = await createTestStorage();
    const timing = new SmartTimingEngine(storage);

    // Saturday
    const base = new Date('2026-03-07T15:00:00Z');
    const rec = await timing.getOptimalTiming(TEST_CLIENT.id, base);

    expect(rec.suggestedDate.getHours()).toBe(10);
    // Should not be weekend
    const day = rec.suggestedDate.getDay();
    expect([0, 6]).not.toContain(day);
  });

  test('uses client preferred pay day of week when available', async () => {
    const storage = await createTestStorage();

    const profile: ClientPaymentProfile = {
      clientId: TEST_CLIENT.id,
      totalInvoices: 5,
      paidOnTime: 4,
      paidLate: 1,
      unpaid: 0,
      averageDaysToPayment: 12,
      medianDaysToPayment: 12,
      averageDaysLate: 2,
      reliabilityScore: 85,
      preferredPayDay: 15,
      preferredPayDayOfWeek: 5, // Friday
      lastPaymentDate: new Date('2026-02-15T00:00:00Z'),
      totalOutstanding: 0,
      riskLevel: 'low',
      paymentHistory: [],
      updatedAt: new Date(),
    };
    await storage.saveClientProfile(profile);

    const timing = new SmartTimingEngine(storage);

    // Monday base date
    const base = new Date('2026-03-02T00:00:00Z');
    const rec = await timing.getOptimalTiming(TEST_CLIENT.id, base);

    expect(rec.confidence).toBeGreaterThan(0.3);
    expect(rec.reasoning.join(' ')).toContain('pay day');
  });
});
