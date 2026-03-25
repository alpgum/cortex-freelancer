const { clamp, parseDate, normalizeText, formatPct } = require('../utils');
const { URGENCY_PATTERNS } = require('./keywords');

function textHitsUrgency(text) {
  const t = normalizeText(text);
  return URGENCY_PATTERNS.some(p => p.test(t));
}

function timelineCompressionSignal({ workflow = null, communications = { messages: [], responses: [] } } = {}) {
  const timeline = workflow?.timeline || {};
  const start = parseDate(timeline.estimatedStartDate || workflow?.createdAt) || null;
  const end = parseDate(timeline.estimatedEndDate) || null;
  const now = new Date();

  const estTotalHours = Number(timeline.estimatedTotalHours || 0) || 0;
  const actualHours = Number(timeline.actualTotalHours || 0) || 0;

  // Progress vs time elapsed heuristic
  let timeRatio = 0;
  if (start && end && end.getTime() > start.getTime()) {
    timeRatio = clamp((now.getTime() - start.getTime()) / (end.getTime() - start.getTime()), 0, 2);
  }
  const effortRatio = estTotalHours > 0 ? clamp(actualHours / estTotalHours, 0, 3) : 0;

  // Urgency evidence from comms
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

  const urgencyHits = texts.filter(textHitsUrgency);

  // Score combines urgency pressure + schedule pressure
  let score = 0;

  // Schedule pressure: if time is advanced relative to effort, this suggests compression/under-resourced timeline.
  // Example: timeRatio 0.8 but effortRatio 0.4 => behind.
  const behindBy = timeRatio - effortRatio;
  if (behindBy > 0.35) score += 60;
  else if (behindBy > 0.2) score += 40;
  else if (behindBy > 0.1) score += 20;

  // Late in timeline and not done
  if (timeRatio > 0.8 && effortRatio < 0.7) score += 20;
  if (timeRatio > 1.0 && effortRatio < 0.9) score += 20;

  // Urgency keywords bump
  if (urgencyHits.length >= 1) score += 20;
  if (urgencyHits.length >= 3) score += 10;

  score = clamp(score, 0, 100);

  const summary = `Timeline pressure: time elapsed ${formatPct(timeRatio, 0)} vs effort used ${formatPct(effortRatio, 0)}; urgency signals: ${urgencyHits.length}.`;

  return {
    id: 'timeline_compression',
    label: 'Timeline compression / deadline pressure',
    score: Math.round(score),
    summary,
    details: {
      estimatedStartDate: timeline.estimatedStartDate || workflow?.createdAt || null,
      estimatedEndDate: timeline.estimatedEndDate || null,
      timeRatio,
      effortRatio,
      behindBy,
      urgencyEvidenceCount: urgencyHits.length,
      urgencyEvidenceSamples: urgencyHits.slice(0, 2),
    }
  };
}

module.exports = { timelineCompressionSignal, textHitsUrgency };
