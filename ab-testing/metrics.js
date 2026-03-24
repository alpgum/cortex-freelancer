/**
 * Lightweight client-side metrics collection for A/B variants.
 * Stores events in localStorage (bounded) and provides aggregation.
 */

const storage = require('./storage');
const { getOrCreateUserId, getAllAssignments } = require('./index');

const METRICS_KEY = 'cfx_ab_metrics_v1';
const MAX_EVENTS = 2000;

function now() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function unixMs() {
  return Date.now();
}

function _load() {
  try {
    return JSON.parse(storage.getItem(METRICS_KEY) || '[]');
  } catch {
    return [];
  }
}

function _save(events) {
  const trimmed = events.slice(-MAX_EVENTS);
  storage.setItem(METRICS_KEY, JSON.stringify(trimmed));
}

function record(event) {
  const events = _load();
  events.push(event);
  _save(events);
}

function recordTransportEvent({ name, transport, ok, latencyMs, error }) {
  const userId = getOrCreateUserId();
  const assignments = getAllAssignments({ userId });

  record({
    ts: unixMs(),
    userId,
    assignments,
    kind: 'transport',
    name,
    transport,
    ok: !!ok,
    latencyMs: typeof latencyMs === 'number' ? latencyMs : null,
    error: error ? String(error) : null
  });
}

function createTimer(meta = {}) {
  const start = now();
  return {
    end(extra = {}) {
      const endT = now();
      return { start, end: endT, durationMs: endT - start, ...meta, ...extra };
    }
  };
}

function clear() {
  storage.removeItem(METRICS_KEY);
}

function aggregate() {
  const events = _load();
  const byExperimentVariant = {}; // { expKey: { variantKey: stats } }

  function bump(expKey, variantKey, fn) {
    byExperimentVariant[expKey] ||= {};
    byExperimentVariant[expKey][variantKey] ||= {
      count: 0,
      ok: 0,
      error: 0,
      latency: { count: 0, sum: 0, min: null, max: null }
    };
    fn(byExperimentVariant[expKey][variantKey]);
  }

  for (const e of events) {
    if (!e.assignments) continue;

    for (const [expKey, variantKey] of Object.entries(e.assignments)) {
      bump(expKey, variantKey, (s) => {
        s.count += 1;
        if (e.ok === true) s.ok += 1;
        if (e.ok === false) s.error += 1;
        if (typeof e.latencyMs === 'number') {
          s.latency.count += 1;
          s.latency.sum += e.latencyMs;
          s.latency.min = s.latency.min == null ? e.latencyMs : Math.min(s.latency.min, e.latencyMs);
          s.latency.max = s.latency.max == null ? e.latencyMs : Math.max(s.latency.max, e.latencyMs);
        }
      });
    }
  }

  // derive means
  for (const expKey of Object.keys(byExperimentVariant)) {
    for (const variantKey of Object.keys(byExperimentVariant[expKey])) {
      const s = byExperimentVariant[expKey][variantKey];
      s.successRate = s.count ? s.ok / s.count : null;
      s.errorRate = s.count ? s.error / s.count : null;
      s.latency.mean = s.latency.count ? s.latency.sum / s.latency.count : null;
    }
  }

  return { eventsCount: events.length, byExperimentVariant };
}

module.exports = {
  METRICS_KEY,
  record,
  recordTransportEvent,
  createTimer,
  clear,
  aggregate
};

if (typeof window !== 'undefined') {
  window.CortexABMetrics = module.exports;
}
