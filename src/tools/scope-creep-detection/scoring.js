const { clamp } = require('./utils');

// Weights are chosen to keep the scorer explainable and action-oriented.
// They intentionally sum to ~1.0 so that the riskScore is a weighted average in 0–100.
const DEFAULT_WEIGHTS = {
  time_overrun: 0.2273,
  change_requests: 0.1364,
  new_deliverables: 0.0909,
  revisions: 0.1364,
  meeting_overhead: 0.0909,
  unpaid_work: 0.1364,
  timeline_compression: 0.0909,
  milestone_churn: 0.0909,
};

function normalizeWeights(weights) {
  const entries = Object.entries(weights || {});
  const total = entries.reduce((s, [, v]) => s + (Number(v) || 0), 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  const out = {};
  for (const [k, v] of entries) out[k] = (Number(v) || 0) / total;
  return out;
}

function severityTier(score) {
  // Tuned for early intervention: crossing ~60 means multiple strong drivers are present.
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/**
 * Score signals into an explainable risk score.
 * @param {Array<{id:string, score:number, label?:string, summary?:string, details?:any}>} signals
 * @param {object} [weights]
 */
function scoreScopeCreep(signals, weights) {
  const w = normalizeWeights(weights || DEFAULT_WEIGHTS);

  const enriched = (signals || []).map(s => {
    const weight = Number(w[s.id] ?? 0);
    const score = clamp(Number(s.score) || 0, 0, 100);
    const contribution = weight * score; // contribution in 0..100*weight
    return {
      ...s,
      weight,
      contribution,
    };
  });

  const total = enriched.reduce((acc, s) => acc + (s.contribution || 0), 0);
  const riskScore = clamp(Math.round(total), 0, 100);

  return {
    riskScore,
    severity: severityTier(riskScore),
    signals: enriched.sort((a, b) => (b.contribution || 0) - (a.contribution || 0)),
    weights: w,
  };
}

module.exports = {
  DEFAULT_WEIGHTS,
  normalizeWeights,
  severityTier,
  scoreScopeCreep,
};
