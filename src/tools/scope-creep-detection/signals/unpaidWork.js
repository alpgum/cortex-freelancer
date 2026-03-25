const { clamp, hours, sum, normalizeText, formatPct, formatHours } = require('../utils');
const { UNPAID_PATTERNS, CHANGE_REQUEST_PATTERNS } = require('./keywords');

function isUnpaidEntry(entry) {
  if (entry.is_billable === false) return true;
  const tags = Array.isArray(entry.tags) ? entry.tags.join(' ') : '';
  const notes = entry.notes || '';
  const task = entry.task || '';
  const blob = normalizeText(`${tags} ${notes} ${task}`);
  return UNPAID_PATTERNS.some(p => p.test(blob));
}

function isUnpaidChangeWork(entry) {
  const notes = entry.notes || '';
  const task = entry.task || '';
  const blob = normalizeText(`${notes} ${task}`);
  return CHANGE_REQUEST_PATTERNS.some(p => p.test(blob));
}

function unpaidWorkSignal({ timeEntries = [], projectName = null }) {
  const name = projectName;
  const scoped = timeEntries.filter(e => (name ? String(e.project || '').toLowerCase().includes(String(name).toLowerCase()) : true));

  const totalHours = sum(scoped.map(e => hours(e.duration_seconds)));
  const unpaidEntries = scoped.filter(isUnpaidEntry);
  const unpaidHours = sum(unpaidEntries.map(e => hours(e.duration_seconds)));
  const unpaidRatio = totalHours > 0 ? unpaidHours / totalHours : 0;

  const unpaidChangeHours = sum(unpaidEntries.filter(isUnpaidChangeWork).map(e => hours(e.duration_seconds)));

  // score based on amount + ratio
  let score = 0;
  if (unpaidHours === 0) score = 0;
  else if (unpaidRatio >= 0.2 || unpaidHours >= 5) score = 100;
  else if (unpaidRatio >= 0.1 || unpaidHours >= 2) score = 75;
  else score = 50;

  if (unpaidChangeHours >= 1) score += 10;

  score = clamp(score, 0, 100);

  const summary = unpaidHours === 0
    ? 'No unpaid/non-billable work detected in time logs.'
    : `Unpaid work is ${formatPct(unpaidRatio, 0)} of tracked time (${formatHours(unpaidHours)}).`;

  return {
    id: 'unpaid_work',
    label: 'Unpaid / non-billable requests',
    score: Math.round(score),
    summary,
    details: {
      projectName: name,
      unpaidHours,
      totalHours,
      unpaidRatio,
      unpaidEntryCount: unpaidEntries.length,
      unpaidChangeHours,
    }
  };
}

module.exports = { unpaidWorkSignal, isUnpaidEntry };
