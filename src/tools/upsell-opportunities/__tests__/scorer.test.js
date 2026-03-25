const { scoreUpsellOpportunity } = require('../scorer');

describe('CFX-078 UpsellOpportunityScorer', () => {
  test('high score for happy client with recent delivery + good payment + capacity', () => {
    const res = scoreUpsellOpportunity({
      nowIso: '2026-03-25T10:00:00.000Z',
      client: {
        relationshipScore: 85,
        satisfactionFlags: ['happy', 'praised'],
        budgetTier: 'high',
        seasonality: { preferredPitchMonths: [3] },
      },
      milestones: {
        plannedCount: 4,
        delivered: [{ id: 'm1', deliveredAt: '2026-03-23T00:00:00.000Z' }],
      },
      payments: {
        onTimeRate: 0.95,
        overdueRisk: 0.05,
      },
      timeSignals: {
        weeklyCapacityHours: 40,
        weeklyAllocatedHours: 20,
      },
      risks: {
        scopeCreepRisk: 10,
      }
    });

    expect(res.score).toBeGreaterThanOrEqual(70);
    expect(res.band).toBe('high');
    const ids = res.drivers.map(d => d.id);
    expect(ids).toContain('recent_win');
    expect(ids).toContain('payment_reliability');
  });

  test('penalizes high scope creep + poor payment reliability', () => {
    const res = scoreUpsellOpportunity({
      nowIso: '2026-03-25T10:00:00.000Z',
      client: {
        relationshipScore: 55,
        satisfactionFlags: ['issue'],
        budgetTier: 'mid',
      },
      milestones: {
        plannedCount: 2,
        delivered: [],
      },
      payments: {
        onTimeRate: 0.2,
        overdueRisk: 0.8,
      },
      timeSignals: {
        weeklyCapacityHours: 40,
        weeklyAllocatedHours: 38,
      },
      risks: {
        scopeCreepRisk: 85,
      }
    });

    expect(res.score).toBeLessThanOrEqual(55);
    const top = res.drivers[0];
    expect(['scope_creep_risk', 'payment_reliability', 'capacity', 'satisfaction']).toContain(top.id);
  });
});
