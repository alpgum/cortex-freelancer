const { optimizeTiming } = require('../timing-optimizer');

describe('CFX-078 TimingOptimizer', () => {
  test('prefers post_milestone right after delivery', () => {
    const res = optimizeTiming({
      nowIso: '2026-03-25T10:00:00.000Z',
      milestones: { delivered: [{ deliveredAt: '2026-03-24T09:00:00.000Z' }] },
      payments: { onTimeRate: 1, overdueRisk: 0, lastPaidAt: '2026-03-10T00:00:00.000Z' },
      project: {},
      client: { relationshipScore: 80, satisfactionFlags: ['happy'] },
      scoreResult: { score: 78 }
    });

    expect(res.bestWindow.kind).toBe('post_milestone');
    expect(res.channel).toBe('chat');
    expect(['confident', 'supportive', 'direct']).toContain(res.tone);
  });

  test('deprioritizes upsell when overdue risk is high', () => {
    const res = optimizeTiming({
      nowIso: '2026-03-25T10:00:00.000Z',
      milestones: { delivered: [{ deliveredAt: '2026-03-10T00:00:00.000Z' }] },
      payments: { overdueRisk: 0.9, lastPaidAt: '2026-01-10T00:00:00.000Z' },
      client: { relationshipScore: 60, satisfactionFlags: [] },
      scoreResult: { score: 80 }
    });

    // Still returns a window, but tone should lean direct.
    expect(res.tone).toBe('direct');
    expect(res.bestWindow).toBeTruthy();
  });
});
