const { clamp, normalizeText, parseDate } = require('../utils');
const { DELIVERABLE_PATTERNS } = require('./keywords');

function textHitsDeliverable(text) {
  const t = normalizeText(text);
  return DELIVERABLE_PATTERNS.some(p => p.test(t));
}

function newDeliverablesSignal({ workflow = null, communications = { messages: [], responses: [] }, milestoneEvents = [] } = {}) {
  const workflowId = workflow?.id || null;
  const projectName = workflow?.projectName || null;
  const clientId = workflow?.clientId || null;
  const createdAt = parseDate(workflow?.createdAt) || null;

  const texts = [];

  // Comms evidence
  const resps = (communications.responses || []).filter(r => (clientId ? r.clientId === clientId : true));
  for (const r of resps) {
    if (createdAt) {
      const dt = parseDate(r.respondedAt);
      if (dt && dt.getTime() < createdAt.getTime()) continue;
    }
    if (r.notes) texts.push(String(r.notes));
  }

  const msgs = (communications.messages || []).filter(m => (clientId ? m.clientId === clientId : true));
  for (const m of msgs) {
    if (createdAt) {
      const dt = parseDate(m.createdAt);
      if (dt && dt.getTime() < createdAt.getTime()) continue;
    }
    if (m.subject) texts.push(String(m.subject));
    if (m.body) texts.push(String(m.body));
  }

  const textHits = texts.filter(textHitsDeliverable);

  // Milestone events evidence
  const events = (milestoneEvents || []).filter(ev => {
    if (workflowId && ev.workflowId && ev.workflowId !== workflowId) return false;
    if (!workflowId && projectName && ev.projectName) {
      return String(ev.projectName).toLowerCase().includes(String(projectName).toLowerCase());
    }
    return true;
  });

  const deliverableEvents = events.filter(ev => String(ev.type || '').toLowerCase() === 'deliverable_added');

  const count = textHits.length + deliverableEvents.length;

  // score: 0 none; 60 for 1; 80 for 2; 100 for 3+
  let score = 0;
  if (count === 0) score = 0;
  else if (count === 1) score = 60;
  else if (count === 2) score = 80;
  else score = 100;

  score = clamp(score, 0, 100);

  const summary = count === 0
    ? 'No new-deliverable signals detected.'
    : `Detected ~${count} new-deliverable signals (comms + optional milestone-events).`;

  return {
    id: 'new_deliverables',
    label: 'New deliverables added',
    score,
    summary,
    details: {
      workflowId,
      projectName,
      clientId,
      evidenceCount: count,
      evidence: {
        textSamples: textHits.slice(0, 3),
        deliverableEventSamples: deliverableEvents.slice(0, 3),
      }
    }
  };
}

module.exports = { newDeliverablesSignal, textHitsDeliverable };
