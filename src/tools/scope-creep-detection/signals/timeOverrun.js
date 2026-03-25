const { clamp, hours, sum, formatHours } = require('../utils');

function scoreFromRatio(ratio) {
  // ratio <= 1.0 → 0
  // 1.10 → 20
  // 1.25 → 50
  // 1.50 → 75
  // 2.00+ → 100
  if (!isFinite(ratio) || ratio <= 1) return 0;
  if (ratio >= 2) return 100;
  if (ratio >= 1.5) return 75 + ((ratio - 1.5) / 0.5) * 25;
  if (ratio >= 1.25) return 50 + ((ratio - 1.25) / 0.25) * 25;
  if (ratio >= 1.1) return 20 + ((ratio - 1.1) / 0.15) * 30;
  return (ratio - 1) / 0.1 * 20;
}

/**
 * Time Overrun signal.
 *
 * Inputs:
 * - timeEntries: TimeTracker entries
 * - workflow: p2d workflow (optional)
 * - projectName: string (fallback matching)
 */
function timeOverrunSignal({ timeEntries = [], workflow = null, projectName = null }) {
  const name = workflow?.projectName || projectName || null;

  // Planned hours (best effort)
  const planned =
    (workflow?.timeline?.estimatedTotalHours) ??
    (Array.isArray(workflow?.milestones) ? sum(workflow.milestones.map(m => m.estimatedHours)) : null) ??
    null;

  // Actual hours (best effort)
  const actualFromWorkflow = workflow?.timeline?.actualTotalHours;

  const actualFromTime = sum(
    timeEntries
      .filter(e => (name ? String(e.project || '').toLowerCase().includes(String(name).toLowerCase()) : true))
      .map(e => hours(e.duration_seconds))
  );

  const actual = actualFromWorkflow != null ? Number(actualFromWorkflow) : actualFromTime;

  const ratio = planned && planned > 0 ? actual / planned : null;
  const score = ratio ? clamp(scoreFromRatio(ratio), 0, 100) : 0;

  let summary = 'Insufficient baseline hours to compare planned vs actual.';
  const details = {
    projectName: name,
    plannedHours: planned,
    actualHours: actual,
    ratio,
    sources: {
      planned: workflow?.timeline?.estimatedTotalHours != null ? 'workflow.timeline.estimatedTotalHours'
        : Array.isArray(workflow?.milestones) ? 'sum(workflow.milestones.estimatedHours)'
        : null,
      actual: actualFromWorkflow != null ? 'workflow.timeline.actualTotalHours' : 'time_entries.json aggregation',
    }
  };

  if (planned && planned > 0) {
    summary = ratio <= 1
      ? `Actual hours (${formatHours(actual)}) are within plan (${formatHours(planned)}).`
      : `Actual hours (${formatHours(actual)}) are ${ratio.toFixed(2)}× planned (${formatHours(planned)}).`;
  }

  return {
    id: 'time_overrun',
    label: 'Time overrun vs plan',
    score: Math.round(score),
    summary,
    details,
  };
}

module.exports = { timeOverrunSignal, scoreFromRatio };
