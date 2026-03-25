const { daysBetween, clamp } = require('./utils');

function pickChannel({ relationshipScore }) {
  if (relationshipScore === null || relationshipScore === undefined) return 'email';
  if (relationshipScore >= 75) return 'chat';
  if (relationshipScore >= 55) return 'email';
  return 'email';
}

function pickTone({ satisfactionFlags = [], overdueRisk01 = 0 }) {
  const flags = satisfactionFlags.map(f => String(f).toLowerCase());
  const negative = flags.some(f => ['frustrated', 'unsatisfied', 'issue', 'late', 'churn_risk'].some(k => f.includes(k)));
  if (overdueRisk01 >= 0.6) return 'direct';
  if (negative) return 'supportive';
  return 'confident';
}

/**
 * TimingOptimizer (CFX-078)
 * Chooses best window + suggested channel/tone.
 */
function optimizeTiming({ nowIso, milestones = {}, payments = {}, project = {}, client = {}, scoreResult = {} }) {
  const now = nowIso || new Date().toISOString();

  const lastDelivered = Array.isArray(milestones.delivered) && milestones.delivered.length
    ? milestones.delivered
        .map(m => m.deliveredAt || m.completedAt || m.date)
        .filter(Boolean)
        .sort()
        .slice(-1)[0]
    : null;

  const upcomingDue = milestones.upcomingDueAt || project.upcomingMilestoneDueAt || null;
  const renewalAt = project.renewalAt || project.contractRenewalAt || null;

  const lastPaid = payments.lastPaidAt || null;
  const overdueRisk01 = payments.overdueRisk ?? null;

  const afterDeliveryDays = lastDelivered ? daysBetween(lastDelivered, now) : null;
  const afterPaymentDays = lastPaid ? daysBetween(lastPaid, now) : null;
  const toRenewalDays = renewalAt ? daysBetween(now, renewalAt) : null;
  const toUpcomingDays = upcomingDue ? daysBetween(now, upcomingDue) : null;

  // Candidate windows with scores.
  const candidates = [];

  // Right after a milestone delivery (0-7 days)
  if (afterDeliveryDays !== null) {
    const fit = afterDeliveryDays <= 7 ? (afterDeliveryDays <= 3 ? 1 : 0.75) : (afterDeliveryDays <= 14 ? 0.5 : 0.25);
    candidates.push({
      kind: 'post_milestone',
      score: 0.9 * fit,
      window: {
        start: lastDelivered,
        end: new Date(new Date(lastDelivered).getTime() + 7 * 86400000).toISOString(),
      },
      reason: 'Momentum is highest right after delivery when value is visible.'
    });
  }

  // After payment (0-5 days)
  if (afterPaymentDays !== null) {
    const fit = afterPaymentDays <= 5 ? 1 : (afterPaymentDays <= 14 ? 0.6 : 0.3);
    candidates.push({
      kind: 'post_payment',
      score: 0.85 * fit,
      window: {
        start: lastPaid,
        end: new Date(new Date(lastPaid).getTime() + 5 * 86400000).toISOString(),
      },
      reason: 'Payment clears friction; easier to discuss next steps once invoices are settled.'
    });
  }

  // Before renewal (14-45 days ahead)
  if (toRenewalDays !== null && toRenewalDays >= 0) {
    const fit = (toRenewalDays >= 14 && toRenewalDays <= 45) ? 1 : (toRenewalDays <= 90 ? 0.6 : 0.3);
    candidates.push({
      kind: 'pre_renewal',
      score: 0.8 * fit,
      window: {
        start: now,
        end: renewalAt,
      },
      reason: 'Before renewal is a natural negotiation point for expanding scope or moving to a retainer.'
    });
  }

  // Before upcoming milestone (planning window)
  if (toUpcomingDays !== null && toUpcomingDays >= 0) {
    const fit = toUpcomingDays <= 10 ? 0.8 : (toUpcomingDays <= 21 ? 1 : 0.5);
    candidates.push({
      kind: 'pre_milestone_planning',
      score: 0.75 * fit,
      window: {
        start: now,
        end: upcomingDue,
      },
      reason: 'Planning window: you can frame upsell as de-risking the next milestone.'
    });
  }

  // Default fallback: next 7 days.
  candidates.push({
    kind: 'next_week',
    score: 0.4,
    window: {
      start: now,
      end: new Date(new Date(now).getTime() + 7 * 86400000).toISOString(),
    },
    reason: 'No strong trigger detected; a short, low-pressure check-in works.'
  });

  // Adjustments
  // High overdue risk: deprioritize upsell timing.
  if (overdueRisk01 !== null && overdueRisk01 >= 0.6) {
    for (const c of candidates) c.score *= 0.6;
  }

  // If overall opportunity score low, prefer softer timing.
  const oppScore = scoreResult.score ?? 50;
  const score01 = clamp(oppScore / 100, 0, 1);
  for (const c of candidates) {
    c.score *= (0.7 + 0.3 * score01);
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  const channel = pickChannel({ relationshipScore: client.relationshipScore ?? null });
  const tone = pickTone({
    satisfactionFlags: Array.isArray(client.satisfactionFlags) ? client.satisfactionFlags : [],
    overdueRisk01: overdueRisk01 ?? 0,
  });

  const suggestedMessage = tone === 'direct'
    ? 'Quick check-in on next steps — if you’d like us to continue, I can propose a small add-on package. Also, let’s make sure the last invoice is fully settled first.'
    : tone === 'supportive'
      ? 'Wanted to make sure you feel great about the last delivery. If there’s anything we can do to make the next phase smoother, I can suggest a small package tailored to your goals.'
      : 'Great progress on the last milestone. I have 2–3 high-leverage next steps that would increase ROI — want me to send a short proposal?';

  return {
    bestWindow: best,
    candidates,
    channel,
    tone,
    suggestedMessage,
  };
}

module.exports = {
  optimizeTiming,
};
