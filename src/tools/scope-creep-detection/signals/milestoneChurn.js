const { clamp } = require('../utils');

const STAGE_ORDER = [
  'proposal_accepted',
  'contract_generation',
  'contract_review',
  'contract_signed',
  'project_kickoff',
  'milestone_setup',
  'in_progress',
  'milestone_review',
  'delivery_prep',
  'quality_check',
  'client_delivery',
  'client_review',
  'revisions',
  'sign_off',
  'completed',
  'cancelled',
];

function stageIndex(stage) {
  const idx = STAGE_ORDER.indexOf(String(stage || '').toLowerCase());
  return idx < 0 ? null : idx;
}

function countRegressions(stageHistory) {
  const hist = Array.isArray(stageHistory) ? stageHistory : [];
  let regressions = 0;
  for (const h of hist) {
    const from = stageIndex(h.from);
    const to = stageIndex(h.to);
    if (from == null || to == null) continue;
    if (to < from) regressions++;
  }
  return regressions;
}

function milestoneChurnSignal({ workflow = null, milestoneEvents = [] } = {}) {
  const workflowId = workflow?.id || null;
  const projectName = workflow?.projectName || null;

  const regressions = countRegressions(workflow?.stageHistory);

  const events = (milestoneEvents || []).filter(ev => {
    if (workflowId && ev.workflowId && ev.workflowId !== workflowId) return false;
    if (!workflowId && projectName && ev.projectName) {
      return String(ev.projectName).toLowerCase().includes(String(projectName).toLowerCase());
    }
    return true;
  });

  const churnEvents = events.filter(ev => {
    const t = String(ev.type || '').toLowerCase();
    return ['milestone_added', 'milestone_removed', 'deliverable_added', 'deliverable_removed', 'date_changed', 'milestone_resequenced'].includes(t);
  });

  const churnCount = churnEvents.length;

  // score: regressions + churn events
  let score = 0;
  if (regressions === 0 && churnCount === 0) score = 0;
  else {
    score += Math.min(60, regressions * 20);
    score += Math.min(60, churnCount * 15);
  }

  score = clamp(score, 0, 100);

  const summary = (regressions === 0 && churnCount === 0)
    ? 'No milestone churn detected (no stage regressions; no milestone-change events).'
    : `Milestone churn signals: ${regressions} stage regressions; ${churnCount} milestone-change event(s).`;

  return {
    id: 'milestone_churn',
    label: 'Milestone churn / plan instability',
    score: Math.round(score),
    summary,
    details: {
      workflowId,
      projectName,
      stageRegressions: regressions,
      churnEventCount: churnCount,
      churnEventSamples: churnEvents.slice(0, 3),
    }
  };
}

module.exports = { milestoneChurnSignal, countRegressions };
