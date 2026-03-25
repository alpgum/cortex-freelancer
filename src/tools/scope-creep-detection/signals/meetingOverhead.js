const { clamp, hours, sum, formatPct, formatHours } = require('../utils');
const { MEETING_PATTERNS } = require('./keywords');

function isMeetingEntry(entry) {
  const task = String(entry.task || '');
  const tags = Array.isArray(entry.tags) ? entry.tags.join(' ') : '';
  return MEETING_PATTERNS.some(p => p.test(task) || p.test(tags));
}

function meetingOverheadSignal({ timeEntries = [], projectName = null }) {
  const name = projectName;
  const scoped = timeEntries.filter(e => (name ? String(e.project || '').toLowerCase().includes(String(name).toLowerCase()) : true));
  const totalHours = sum(scoped.map(e => hours(e.duration_seconds)));
  const meetingEntries = scoped.filter(isMeetingEntry);
  const meetingHours = sum(meetingEntries.map(e => hours(e.duration_seconds)));
  const meetingCount = meetingEntries.length;
  const ratio = totalHours > 0 ? meetingHours / totalHours : 0;

  // 0 if <=10%, ~50 at 20%, 100 at 35%+
  let score;
  if (ratio <= 0.10) score = 0;
  else if (ratio >= 0.35) score = 100;
  else if (ratio <= 0.20) score = ((ratio - 0.10) / 0.10) * 50;
  else score = 50 + ((ratio - 0.20) / 0.15) * 50;

  // Meeting count penalty (lots of context-switching)
  if (meetingCount >= 6) score += 10;
  if (meetingCount >= 10) score += 10;

  score = clamp(score, 0, 100);

  const summary = totalHours === 0
    ? 'No time entries found to estimate meeting overhead.'
    : `Meetings are ${formatPct(ratio, 0)} of tracked time (${formatHours(meetingHours)} across ${meetingCount} sessions).`;

  return {
    id: 'meeting_overhead',
    label: 'Extra meetings / meeting overhead',
    score: Math.round(score),
    summary,
    details: {
      projectName: name,
      meetingHours,
      meetingCount,
      totalHours,
      meetingRatio: ratio,
    }
  };
}

module.exports = { meetingOverheadSignal, isMeetingEntry };
