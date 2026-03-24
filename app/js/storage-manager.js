/**
 * CF-102: Fix localStorage quota exceeded on Safari
 * Check storage size before writing, clean up old data near 5MB limit.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  var MAX_BYTES = 4.5 * 1024 * 1024; // 4.5MB safety threshold
  var CLEANUP_PREFIX = 'cortex_';

  function getUsedBytes() {
    var total = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      total += (key.length + (localStorage.getItem(key) || '').length) * 2; // UTF-16
    }
    return total;
  }

  function cleanupOldEntries(bytesNeeded) {
    // Collect entries with timestamps, sort oldest first
    var entries = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key.startsWith(CLEANUP_PREFIX)) continue;
      var val = localStorage.getItem(key);
      var ts = 0;
      try {
        var parsed = JSON.parse(val);
        ts = parsed._ts || parsed.timestamp || 0;
      } catch (e) { /* not JSON */ }
      entries.push({ key: key, size: (key.length + val.length) * 2, ts: ts });
    }
    entries.sort(function (a, b) { return a.ts - b.ts; });

    var freed = 0;
    for (var j = 0; j < entries.length && freed < bytesNeeded; j++) {
      localStorage.removeItem(entries[j].key);
      freed += entries[j].size;
    }
    return freed;
  }

  function safeSet(key, value) {
    var serialized = typeof value === 'string' ? value : JSON.stringify(value);
    var entrySize = (key.length + serialized.length) * 2;
    var used = getUsedBytes();

    if (used + entrySize > MAX_BYTES) {
      var needed = (used + entrySize) - MAX_BYTES + 10240; // free extra 10KB
      cleanupOldEntries(needed);
    }

    try {
      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      console.warn('[StorageManager] Quota exceeded, cleaning up…');
      cleanupOldEntries(entrySize + 51200);
      try {
        localStorage.setItem(key, serialized);
        return true;
      } catch (e2) {
        console.error('[StorageManager] Cannot write after cleanup', e2);
        return false;
      }
    }
  }

  function safeGet(key, fallback) {
    try {
      var val = localStorage.getItem(key);
      if (val === null) return fallback !== undefined ? fallback : null;
      try { return JSON.parse(val); } catch (e) { return val; }
    } catch (e) {
      return fallback !== undefined ? fallback : null;
    }
  }

  window.CortexFreelancer.StorageManager = {
    safeSet: safeSet,
    safeGet: safeGet,
    getUsedBytes: getUsedBytes,
    cleanupOldEntries: cleanupOldEntries
  };
})();
