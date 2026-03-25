const { clamp, parseDate, normalizeText } = require('../utils');
const { CHANGE_REQUEST_PATTERNS } = require('./keywords');

function textHitsChange(text) {
  const t = normalizeText(text);
  return CHANGE_REQUEST_PATTERNS.some(p => p.test(t));
}

function changeRequestsSignal({ workflow = null, communications = { messages: [], responses: [] } } = {}) {
  const clientId = workflow?.clientId || null;
  const createdAt = parseDate(workflow?.createdAt) || null;

  const msgs = (communications.messages || []).filter(m => (clientId ? m.clientId === clientId : true));
  const resps = (communications.responses || []).filter(r => (clientId ? r.clientId === clientId : true));

  const windowed = (items, timeField) => items.filter(it => {
    if (!createdAt) return true;
    const dt = parseDate(it[timeField]);
    return dt ? dt.getTime() >= createdAt.getTime() : true;
  });

  const candidateTexts = [];
  for (const r of windowed(resps, 'respondedAt')) {
    if (r.notes) candidateTexts.push(String(r.notes));
  }
  for (const m of windowed(msgs, 'createdAt')) {
    // Outgoing messages can still contain “milestone changed / new request” notes or subjects.
    if (m.subject) candidateTexts.push(String(m.subject));
    if (m.body) candidateTexts.push(String(m.body));
  }

  const hits = candidateTexts.filter(textHitsChange);
  const count = hits.length;

  // score: 0 none, 40 for 1-2, 70 for 3-4, 100 for 5+
  let score = 0;
  if (count === 0) score = 0;
  else if (count <= 2) score = 40;
  else if (count <= 4) score = 70;
  else score = 100;

  score = clamp(score, 0, 100);

  const summary = count === 0
    ? 'No change-request signals detected in communications.'
    : `Detected ~${count} change-request signals in communications (keyword heuristics).`;

  return {
    id: 'change_requests',
    label: 'Expanding requirements / change requests',
    score,
    summary,
    details: {
      clientId,
      evidenceCount: count,
      sampleEvidence: hits.slice(0, 3),
    }
  };
}

module.exports = { changeRequestsSignal, textHitsChange };
