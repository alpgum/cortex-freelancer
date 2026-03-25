const { clamp, daysBetween } = require('./utils');

/**
 * UpsellOpportunityScorer (CFX-078)
 * Deterministic 0-100 scoring with explainability drivers.
 *
 * Input is integration-ready but offline-safe:
 * - client: relationship score, satisfaction flags, LTV, budget tier, project frequency
 * - milestones: delivered milestones + upcoming completion
 * - payments: on-time payments, overdue risk
 * - timeSignals: admin burden, effective rate, capacity
 * - risks: scope creep risk (0-100)
 */

function normalize01(x, { min = 0, max = 1 } = {}) {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return null;
  if (max === min) return 0;
  return clamp((Number(x) - min) / (max - min), 0, 1);
}

function budgetTier01(tier) {
  // Accept numeric 1-3/1-5 or strings.
  if (tier === null || tier === undefined) return null;
  if (typeof tier === 'number') {
    if (tier <= 1) return 0.2;
    if (tier === 2) return 0.5;
    if (tier >= 3) return 0.8;
    return clamp(tier / 5, 0, 1);
  }
  const s = String(tier).toLowerCase();
  if (s.includes('enterprise') || s.includes('high')) return 0.9;
  if (s.includes('mid')) return 0.6;
  if (s.includes('low') || s.includes('startup') || s.includes('small')) return 0.35;
  return 0.5;
}

function satisfaction01({ relationshipScore, satisfactionFlags }) {
  const rel01 = normalize01(relationshipScore, { min: 0, max: 100 });
  const flags = Array.isArray(satisfactionFlags) ? satisfactionFlags.map(f => String(f).toLowerCase()) : [];

  // Flags can be like: happy, praised, referral_intent, frustrated, quality_issue
  let flagBoost = 0;
  for (const f of flags) {
    if (['happy', 'praised', 'promoter', 'referral_intent', 'great', 'satisfied'].some(k => f.includes(k))) flagBoost += 0.1;
    if (['frustrated', 'angry', 'issue', 'bug', 'late', 'unsatisfied', 'churn_risk'].some(k => f.includes(k))) flagBoost -= 0.2;
  }
  flagBoost = clamp(flagBoost, -0.4, 0.4);

  if (rel01 === null && flags.length === 0) return null;
  const base = rel01 === null ? 0.5 : rel01;
  return clamp(base + flagBoost, 0, 1);
}

function paymentReliability01({ onTimeRate, overdueRisk }) {
  const onTime01 = normalize01(onTimeRate, { min: 0, max: 1 });
  const overdue01 = normalize01(overdueRisk, { min: 0, max: 1 });
  if (onTime01 === null && overdue01 === null) return null;
  const a = onTime01 === null ? 0.7 : onTime01;
  const b = overdue01 === null ? 0.2 : overdue01;
  return clamp(0.75 * a + 0.25 * (1 - b), 0, 1);
}

function recentWin01({ deliveredMilestones, nowIso }) {
  const now = nowIso || new Date().toISOString();
  const delivered = Array.isArray(deliveredMilestones) ? deliveredMilestones : [];
  if (delivered.length === 0) return 0;

  // Look for a delivery within last 14 days.
  let best = 0;
  for (const m of delivered) {
    const d = m.deliveredAt || m.completedAt || m.date || null;
    if (!d) continue;
    const age = daysBetween(d, now);
    if (age === null) continue;
    if (age <= 3) best = Math.max(best, 1);
    else if (age <= 7) best = Math.max(best, 0.85);
    else if (age <= 14) best = Math.max(best, 0.65);
    else if (age <= 30) best = Math.max(best, 0.35);
  }
  return best;
}

function milestoneCompletion01({ plannedCount, deliveredCount }) {
  if (plannedCount === null || plannedCount === undefined || plannedCount <= 0) return null;
  const d = deliveredCount || 0;
  return clamp(d / plannedCount, 0, 1);
}

function capacity01({ weeklyCapacityHours, weeklyAllocatedHours }) {
  if (weeklyCapacityHours === null || weeklyCapacityHours === undefined) return null;
  const cap = Number(weeklyCapacityHours);
  const alloc = Number(weeklyAllocatedHours || 0);
  if (!Number.isFinite(cap) || cap <= 0) return null;
  const free = clamp((cap - alloc) / cap, 0, 1);
  return free;
}

function seasonality01({ seasonality, nowIso }) {
  // seasonality: { busyMonths: [1..12], preferredPitchMonths:[...]} or string.
  const now = nowIso ? new Date(nowIso) : new Date();
  const month = now.getMonth() + 1;

  if (!seasonality) return 0.5;
  if (typeof seasonality === 'string') {
    const s = seasonality.toLowerCase();
    if (s.includes('q4') && [10, 11, 12].includes(month)) return 0.75;
    if (s.includes('summer') && [6, 7, 8].includes(month)) return 0.6;
    return 0.5;
  }

  const busy = Array.isArray(seasonality.busyMonths) ? seasonality.busyMonths : [];
  const preferred = Array.isArray(seasonality.preferredPitchMonths) ? seasonality.preferredPitchMonths : [];

  if (preferred.includes(month)) return 0.85;
  if (busy.includes(month)) return 0.35;
  return 0.55;
}

function scopeCreepPenalty01(scopeCreepRisk) {
  const r01 = normalize01(scopeCreepRisk, { min: 0, max: 100 });
  if (r01 === null) return 0;
  // Penalize high risk.
  if (r01 < 0.3) return 0;
  if (r01 < 0.6) return 0.35;
  return 0.8;
}

function scoreUpsellOpportunity(input) {
  const nowIso = input.nowIso || new Date().toISOString();

  const weights = {
    recentWin: 15,
    milestoneCompletion: 10,
    satisfaction: 20,
    budgetTier: 10,
    payment: 15,
    scopeCreepPenalty: 10,
    seasonality: 5,
    capacity: 15,
  };

  const recentWin = recentWin01({ deliveredMilestones: input.milestones?.delivered || [], nowIso });
  const completion = milestoneCompletion01({
    plannedCount: input.milestones?.plannedCount ?? null,
    deliveredCount: (input.milestones?.delivered || []).length,
  });
  const satisfaction = satisfaction01({
    relationshipScore: input.client?.relationshipScore ?? null,
    satisfactionFlags: input.client?.satisfactionFlags ?? [],
  });
  const budget = budgetTier01(input.client?.budgetTier ?? null);
  const payment = paymentReliability01({
    onTimeRate: input.payments?.onTimeRate ?? null,
    overdueRisk: input.payments?.overdueRisk ?? null,
  });
  const scopePenalty = scopeCreepPenalty01(input.risks?.scopeCreepRisk ?? null);
  const seasonality = seasonality01({ seasonality: input.client?.seasonality ?? null, nowIso });
  const capacity = capacity01({
    weeklyCapacityHours: input.timeSignals?.weeklyCapacityHours ?? null,
    weeklyAllocatedHours: input.timeSignals?.weeklyAllocatedHours ?? null,
  });

  const parts = [];
  function addPart({ id, title, weight, value01, direction = 'up', evidence = {} }) {
    if (value01 === null || value01 === undefined) return;
    const v = clamp(value01, 0, 1);
    const signed = direction === 'down' ? -v : v;
    parts.push({ id, title, weight, value01: v, direction, points: signed * weight, evidence });
  }

  addPart({
    id: 'recent_win',
    title: 'Recent win (fresh delivery momentum)',
    weight: weights.recentWin,
    value01: recentWin,
    evidence: { deliveredCount: (input.milestones?.delivered || []).length }
  });

  addPart({
    id: 'milestone_completion',
    title: 'Milestone completion (proof of progress)',
    weight: weights.milestoneCompletion,
    value01: completion,
    evidence: { plannedCount: input.milestones?.plannedCount ?? null }
  });

  addPart({
    id: 'satisfaction',
    title: 'Satisfaction / relationship strength',
    weight: weights.satisfaction,
    value01: satisfaction,
    evidence: {
      relationshipScore: input.client?.relationshipScore ?? null,
      satisfactionFlags: input.client?.satisfactionFlags ?? [],
    }
  });

  addPart({
    id: 'budget_tier',
    title: 'Budget tier / ability to buy',
    weight: weights.budgetTier,
    value01: budget,
    evidence: { budgetTier: input.client?.budgetTier ?? null }
  });

  addPart({
    id: 'payment_reliability',
    title: 'Payment reliability',
    weight: weights.payment,
    value01: payment,
    evidence: { onTimeRate: input.payments?.onTimeRate ?? null, overdueRisk: input.payments?.overdueRisk ?? null }
  });

  addPart({
    id: 'scope_creep_risk',
    title: 'Scope creep risk (penalty)',
    weight: weights.scopeCreepPenalty,
    value01: scopePenalty,
    direction: 'down',
    evidence: { scopeCreepRisk: input.risks?.scopeCreepRisk ?? null }
  });

  addPart({
    id: 'seasonality',
    title: 'Seasonality fit',
    weight: weights.seasonality,
    value01: seasonality,
    evidence: { month: new Date(nowIso).getMonth() + 1 }
  });

  addPart({
    id: 'capacity',
    title: 'Capacity to take on more work',
    weight: weights.capacity,
    value01: capacity,
    evidence: {
      weeklyCapacityHours: input.timeSignals?.weeklyCapacityHours ?? null,
      weeklyAllocatedHours: input.timeSignals?.weeklyAllocatedHours ?? null,
    }
  });

  const raw = parts.reduce((sum, p) => sum + p.points, 0);
  const maxUp = weights.recentWin + weights.milestoneCompletion + weights.satisfaction + weights.budgetTier + weights.payment + weights.seasonality + weights.capacity;
  const maxDown = weights.scopeCreepPenalty;

  // Convert [-maxDown, maxUp] -> [0, 100]
  const normalized = (raw + maxDown) / (maxUp + maxDown);
  const score = Math.round(clamp(normalized, 0, 1) * 100);

  // Sort drivers by absolute impact.
  const drivers = parts
    .slice()
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .map(p => ({
      id: p.id,
      title: p.title,
      impactPoints: Math.round(p.points * 10) / 10,
      direction: p.direction,
      evidence: p.evidence,
    }));

  let band = 'low';
  if (score >= 70) band = 'high';
  else if (score >= 45) band = 'medium';

  return {
    score,
    band,
    drivers,
    debug: {
      rawPoints: raw,
      maxUp,
      maxDown,
    }
  };
}

module.exports = {
  scoreUpsellOpportunity,
};
