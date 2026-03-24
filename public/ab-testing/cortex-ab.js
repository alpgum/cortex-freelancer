/* Cortex Freelancer A/B Testing (CFX-044)
 * Browser-only bundle (no build step).
 */
(function () {
  // --- storage ---
  const memory = new Map();
  function hasLocalStorage() {
    try { return typeof window !== 'undefined' && !!window.localStorage; } catch { return false; }
  }
  function getItem(k) { return hasLocalStorage() ? window.localStorage.getItem(k) : (memory.has(k) ? memory.get(k) : null); }
  function setItem(k, v) { return hasLocalStorage() ? window.localStorage.setItem(k, v) : memory.set(k, v); }
  function removeItem(k) { return hasLocalStorage() ? window.localStorage.removeItem(k) : memory.delete(k); }

  // --- hash (fnv1a32) ---
  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  function hashToUnitInterval(str) { return fnv1a32(str) / 0x100000000; }

  function pickWeightedVariant(variants, unit) {
    const total = variants.reduce((s, v) => s + (v.weight ?? 0), 0);
    if (total <= 0) return variants[0] && variants[0].key;
    let acc = 0;
    for (const v of variants) {
      acc += (v.weight ?? 0) / total;
      if (unit < acc) return v.key;
    }
    return variants[variants.length - 1] && variants[variants.length - 1].key;
  }

  // --- experiments ---
  const EXPERIMENTS = {
    transport_method_v1: {
      description: 'Choose client transport/update mechanism for chat/queue results',
      salt: 'cfx-044-transport-method-v1',
      variants: [
        { key: 'sse', weight: 0.45 },
        { key: 'polling', weight: 0.30 },
        { key: 'socketio', weight: 0.20 },
        { key: 'ws', weight: 0.05 }
      ]
    },
    chat_ui_v1: {
      description: 'UI variants for chat layout and loading states',
      salt: 'cfx-044-chat-ui-v1',
      variants: [
        { key: 'control', weight: 0.50 },
        { key: 'compact', weight: 0.25 },
        { key: 'loading_skeleton', weight: 0.25 }
      ]
    }
  };

  const STORAGE_KEYS = {
    userId: 'cfx_ab_user_id',
    forced: 'cfx_ab_forced',
    assigned: 'cfx_ab_assigned'
  };

  function randomId() { return `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }
  function getOrCreateUserId() {
    let id = getItem(STORAGE_KEYS.userId);
    if (!id) { id = randomId(); setItem(STORAGE_KEYS.userId, id); }
    return id;
  }
  function getForcedMap() { try { return JSON.parse(getItem(STORAGE_KEYS.forced) || '{}'); } catch { return {}; } }
  function setForcedMap(map) { setItem(STORAGE_KEYS.forced, JSON.stringify(map || {})); }
  function getAssignedMap() { try { return JSON.parse(getItem(STORAGE_KEYS.assigned) || '{}'); } catch { return {}; } }
  function setAssignedMap(map) { setItem(STORAGE_KEYS.assigned, JSON.stringify(map || {})); }

  function parseQueryOverrides() {
    const url = new URL(window.location.href);
    const overrides = {};
    for (const [k, v] of url.searchParams.entries()) {
      if (k.startsWith('ab_')) overrides[k.slice(3)] = v;
    }
    return overrides;
  }

  function assignVariant(experimentKey, experiment, userId) {
    const seed = `${experiment.salt}::${experimentKey}::${userId}`;
    const u = hashToUnitInterval(seed);
    return pickWeightedVariant(experiment.variants, u);
  }

  function getVariant(experimentKey, options = {}) {
    const experiment = EXPERIMENTS[experimentKey];
    if (!experiment) throw new Error(`Unknown experiment: ${experimentKey}`);

    const userId = options.userId || getOrCreateUserId();
    const queryOverrides = options.queryOverrides ?? parseQueryOverrides();
    const forcedMap = options.forcedMap || getForcedMap();

    const forced = queryOverrides[experimentKey] || forcedMap[experimentKey];
    if (forced) return forced;

    const assignedMap = getAssignedMap();
    if (assignedMap[experimentKey]) return assignedMap[experimentKey];

    const assigned = assignVariant(experimentKey, experiment, userId);
    assignedMap[experimentKey] = assigned;
    setAssignedMap(assignedMap);
    return assigned;
  }

  function getAllAssignments(options = {}) {
    const res = {};
    for (const key of Object.keys(EXPERIMENTS)) res[key] = getVariant(key, options);
    return res;
  }

  function forceVariant(experimentKey, variantKey) {
    const forced = getForcedMap();
    forced[experimentKey] = variantKey;
    setForcedMap(forced);
    const assigned = getAssignedMap();
    assigned[experimentKey] = variantKey;
    setAssignedMap(assigned);
  }

  function clearForces() { removeItem(STORAGE_KEYS.forced); }
  function resetAssignments() { removeItem(STORAGE_KEYS.assigned); }

  // --- metrics ---
  const METRICS_KEY = 'cfx_ab_metrics_v1';
  const MAX_EVENTS = 2000;
  function _loadEvents() { try { return JSON.parse(getItem(METRICS_KEY) || '[]'); } catch { return []; } }
  function _saveEvents(events) { setItem(METRICS_KEY, JSON.stringify(events.slice(-MAX_EVENTS))); }
  function record(event) { const ev = _loadEvents(); ev.push(event); _saveEvents(ev); }
  function perfNow() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  function recordTransportEvent({ name, transport, ok, latencyMs, error }) {
    const userId = getOrCreateUserId();
    const assignments = getAllAssignments({ userId });
    record({
      ts: Date.now(),
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
    const start = perfNow();
    return {
      end(extra = {}) {
        const end = perfNow();
        return { start, end, durationMs: end - start, ...meta, ...extra };
      }
    };
  }

  function clearMetrics() { removeItem(METRICS_KEY); }

  function aggregate() {
    const events = _loadEvents();
    const byExperimentVariant = {};
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

  window.CortexABTesting = {
    EXPERIMENTS,
    STORAGE_KEYS,
    getOrCreateUserId,
    getVariant,
    getAllAssignments,
    forceVariant,
    clearForces,
    resetAssignments
  };

  window.CortexABMetrics = {
    METRICS_KEY,
    record,
    recordTransportEvent,
    createTimer,
    clear: clearMetrics,
    aggregate
  };
})();
