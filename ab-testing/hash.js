/**
 * Deterministic hashing utilities for A/B assignment.
 * Lightweight: no deps.
 */

// 32-bit FNV-1a
function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (with 32-bit overflow)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function hashToUnitInterval(str) {
  // [0,1)
  return fnv1a32(str) / 0x100000000;
}

module.exports = { fnv1a32, hashToUnitInterval };
