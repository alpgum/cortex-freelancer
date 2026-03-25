import { SmartTimingEngine } from '../timing';

describe('SmartTimingEngine', () => {
  test('adjustToBusinessHours moves time to next workday start when outside hours', () => {
    const engine = new SmartTimingEngine({
      timezone: 'America/New_York',
      workdays: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '17:00'
    });

    const d = new Date('2026-03-22T02:00:00.000Z'); // Sunday UTC
    const adjusted = engine.adjustToBusinessHours(new Date(d));

    // Should be set to a weekday at 09:00 local time; we assert it's within business hours
    expect(engine.isBusinessHours(adjusted)).toBe(true);
  });

  test('calculateOptimalTiming respects business hours when rule requires it', () => {
    const engine = new SmartTimingEngine({
      timezone: 'America/New_York',
      workdays: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '17:00'
    });

    const previous = new Date('2026-03-23T00:30:00.000Z'); // likely outside NY business
    const scheduled = engine.calculateOptimalTiming('payment_setup', { timezone: 'America/New_York', type: 'smb' }, previous);

    expect(engine.isBusinessHours(scheduled, 'America/New_York')).toBe(true);
  });
});
