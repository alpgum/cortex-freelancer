/**
 * Cortex Freelancer A/B Testing (CFX-044)
 * - deterministic assignment via hashing
 * - persistent via localStorage
 * - feature flags / forcing via query params or storage
 */

const { EXPERIMENTS } = require('./experiments');
const { assignVariant } = require('./assign');
const storage = require('./storage');

const STORAGE_KEYS = {
  userId: 'cfx_ab_user_id',
  forced: 'cfx_ab_forced', // JSON: { [experimentKey]: variantKey }
  assigned: 'cfx_ab_assigned' // JSON: { [experimentKey]: variantKey }
};

function randomId() {
  // not for crypto; stable-ish id for assignment
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateUserId() {
  let id = storage.getItem(STORAGE_KEYS.userId);
  if (!id) {
    id = randomId();
    storage.setItem(STORAGE_KEYS.userId, id);
  }
  return id;
}

function getForcedMap() {
  try {
    return JSON.parse(storage.getItem(STORAGE_KEYS.forced) || '{}');
  } catch {
    return {};
  }
}

function setForcedMap(map) {
  storage.setItem(STORAGE_KEYS.forced, JSON.stringify(map || {}));
}

function getAssignedMap() {
  try {
    return JSON.parse(storage.getItem(STORAGE_KEYS.assigned) || '{}');
  } catch {
    return {};
  }
}

function setAssignedMap(map) {
  storage.setItem(STORAGE_KEYS.assigned, JSON.stringify(map || {}));
}

function parseQueryOverrides() {
  if (typeof window === 'undefined') return {};
  const url = new URL(window.location.href);
  const overrides = {};
  // format: ?ab_transport_method_v1=sse
  for (const [k, v] of url.searchParams.entries()) {
    if (k.startsWith('ab_')) {
      overrides[k.slice(3)] = v;
    }
  }
  return overrides;
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

  const assigned = assignVariant({ experimentKey, experiment, userId });
  assignedMap[experimentKey] = assigned;
  setAssignedMap(assignedMap);
  return assigned;
}

function getAllAssignments(options = {}) {
  const res = {};
  for (const key of Object.keys(EXPERIMENTS)) {
    res[key] = getVariant(key, options);
  }
  return res;
}

function forceVariant(experimentKey, variantKey) {
  const forced = getForcedMap();
  forced[experimentKey] = variantKey;
  setForcedMap(forced);
  // also pin assigned to forced for consistency
  const assigned = getAssignedMap();
  assigned[experimentKey] = variantKey;
  setAssignedMap(assigned);
}

function clearForces() {
  storage.removeItem(STORAGE_KEYS.forced);
}

function resetAssignments() {
  storage.removeItem(STORAGE_KEYS.assigned);
}

module.exports = {
  EXPERIMENTS,
  STORAGE_KEYS,
  getOrCreateUserId,
  getVariant,
  getAllAssignments,
  forceVariant,
  clearForces,
  resetAssignments
};

// Browser global
if (typeof window !== 'undefined') {
  window.CortexABTesting = module.exports;
}
