const { clamp, parseDate, normalizeText } = require('../utils');
const { REVISION_PATTERNS } = require('./keywords');

function textHitsRevision(text) {
  const t = normalizeText(text);
  return REVISION_PATTERNS.some(p => p.test(t));
}

function countWorkflowRevisions(workflow) {
  const history = Array.isArray(workflow?.stageHistory) ? workflow.stageHistory : [];
  // count transitions *into* revisions stage
  return history.filter(h => String(h.to || '').toLowerCase() === 'revisions').length;
}

function revisionsSignal({ workflow = null, communications = { messages: [], responses: [] } } = {}) {
  const revisionRoundsBaseline = Number(workflow?.contract?.terms?.revisionRounds ?? 1);
  const revisionTransitions = workflow ? countWorkflowRevisions(workflow) : 0;

  const clientId = workflow?.clientId || null;
  const createdAt = parseDate(workflow?.createdAt) || null;

  const texts = [];
  for (const r of (communications.responses || []).filter(r => (clientId ? r.clientId === clientId : true))) {
    if (createdAt) {
      const dt = parseDate(r.respondedAt);
      if (dt && dt.getTime() < createdAt.getTime()) continue;
    }
    if (r.notes) texts.push(String(r.notes));
  }
  for (const m of (communications.messages || []).filter(m => (clientId ? m.clientId === clientId : true))) {
    if (createdAt) {
      const dt = parseDate(m.createdAt);
      if (dt && dt.getTime() < createdAt.getTime()) continue;
    }
    if (m.subject) texts.push(String(m.subject));
    if (m.body) texts.push(String(m.body));
  }

  const revisionMentions = texts.filter(textHitsRevision).length;

  // Observed revisions: prioritize explicit workflow transitions; add comm mentions lightly
  const observed = revisionTransitions + Math.floor(revisionMentions / 3);
  const over = Math.max(0, observed - revisionRoundsBaseline);

  // score: within baseline => 0; +1 => 50; +2 => 75; +3+ => 100
  let score = 0;
  if (over === 0) score = 0;
  else if (over === 1) score = 50;
  else if (over === 2) score = 75;
  else score = 100;

  score = clamp(score, 0, 100);

  const summary = over === 0
    ? `Revision activity appears within contract baseline (${revisionRoundsBaseline} rounds).`
    : `Revision activity appears above baseline by ~${over} round(s) (baseline: ${revisionRoundsBaseline}).`;

  return {
    id: 'revisions',
    label: 'Repeated revisions beyond baseline',
    score,
    summary,
    details: {
      revisionRoundsBaseline,
      revisionStageTransitions: revisionTransitions,
      revisionMentions,
      observedRevisionRoundsApprox: observed,
      overBaselineBy: over,
    }
  };
}

module.exports = { revisionsSignal, countWorkflowRevisions, textHitsRevision };
