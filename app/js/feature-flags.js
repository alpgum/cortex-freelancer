/**
 * CFX-045: Feature Flags — Dynamic toggle & gradual rollout system
 *
 * Enables/disables features dynamically without code changes.
 * Supports boolean flags, percentage-based rollouts, and server overrides.
 *
 * Usage:
 *   FeatureFlags.init({ serverUrl: '/api/flags' });  // optional server
 *   FeatureFlags.isEnabled('webrtc');                 // true/false
 *   FeatureFlags.on('change', (flag, val) => { ... });
 *   FeatureFlags.setFlag('grpc', false);              // admin override
 *
 * Integrates with CortexTransport for transport gating.
 */
(function () {
  'use strict';

  /* ── Default Flag Definitions ─────────────────────────────────── */

  var DEFAULT_FLAGS = {
    // Transport flags
    'transport.webrtc': {
      enabled: true,
      description: 'WebRTC Data Channel transport',
      rolloutPercent: 100,
      group: 'transport',
    },
    'transport.grpc': {
      enabled: true,
      description: 'gRPC-Web transport',
      rolloutPercent: 100,
      group: 'transport',
    },
    'transport.socketio': {
      enabled: true,
      description: 'Socket.io transport',
      rolloutPercent: 100,
      group: 'transport',
    },
    'transport.sse': {
      enabled: true,
      description: 'Server-Sent Events transport',
      rolloutPercent: 100,
      group: 'transport',
    },
    'transport.http-chunked': {
      enabled: true,
      description: 'HTTP Chunked Streaming transport',
      rolloutPercent: 100,
      group: 'transport',
    },

    // UI experiments
    'ui.dark-mode-v2': {
      enabled: false,
      description: 'Experimental dark mode redesign',
      rolloutPercent: 0,
      group: 'ui',
    },
    'ui.chat-streaming-v2': {
      enabled: false,
      description: 'New streaming chat renderer',
      rolloutPercent: 0,
      group: 'ui',
    },
    'ui.onboarding-wizard-v2': {
      enabled: false,
      description: 'Revamped onboarding flow',
      rolloutPercent: 0,
      group: 'ui',
    },

    // Backend / experimental
    'exp.response-cache': {
      enabled: true,
      description: 'Client-side response caching (CFX-033)',
      rolloutPercent: 100,
      group: 'experimental',
    },
    'exp.wasm-client': {
      enabled: false,
      description: 'WASM transport client (CFX-029)',
      rolloutPercent: 0,
      group: 'experimental',
    },
    'exp.perf-metrics': {
      enabled: true,
      description: 'Performance metrics collection (CFX-040)',
      rolloutPercent: 100,
      group: 'experimental',
    },
  };

  /* ── Constants ────────────────────────────────────────────────── */

  var STORAGE_KEY = 'cortex_feature_flags';
  var DEVICE_ID_KEY = 'cortex_device_id';
  var SERVER_CACHE_TTL = 5 * 60 * 1000; // 5 min

  /* ── State ────────────────────────────────────────────────────── */

  var flags = {};           // merged runtime flags { [key]: FlagDef }
  var overrides = {};       // admin/local overrides { [key]: boolean }
  var serverFlags = null;   // last server response
  var serverFetchedAt = 0;
  var listeners = {};
  var deviceId = null;
  var config = {
    serverUrl: null,        // e.g. '/api/flags' — null = local-only
    refreshInterval: 0,     // ms, 0 = no auto-refresh
    storage: 'localStorage',
  };
  var refreshTimer = null;
  var initialized = false;

  /* ── Persistence ──────────────────────────────────────────────── */

  function getStorage() {
    try {
      if (config.storage === 'localStorage' && window.localStorage) {
        return window.localStorage;
      }
    } catch (e) { /* private browsing */ }
    return null;
  }

  function loadFromStorage() {
    var store = getStorage();
    if (!store) return {};
    try {
      var raw = store.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveToStorage() {
    var store = getStorage();
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify({
        overrides: overrides,
        serverFlags: serverFlags,
        serverFetchedAt: serverFetchedAt,
      }));
    } catch (e) { /* quota */ }
  }

  function getDeviceId() {
    if (deviceId) return deviceId;
    var store = getStorage();
    if (store) {
      deviceId = store.getItem(DEVICE_ID_KEY);
      if (deviceId) return deviceId;
    }
    // Generate deterministic device ID from available signals
    deviceId = 'dev_' + generateHash(
      navigator.userAgent + screen.width + screen.height + (navigator.language || '')
    );
    if (store) {
      try { store.setItem(DEVICE_ID_KEY, deviceId); } catch (e) { }
    }
    return deviceId;
  }

  /* ── Hashing (FNV-1a for rollout bucketing) ───────────────────── */

  function generateHash(str) {
    var hash = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16);
  }

  function rolloutBucket(flagKey) {
    var input = flagKey + ':' + getDeviceId();
    var hash = 0x811c9dc5;
    for (var i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return (hash % 100); // 0-99
  }

  /* ── Event System ─────────────────────────────────────────────── */

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(function (f) { return f !== fn; });
  }

  function emit(event) {
    var args = Array.prototype.slice.call(arguments, 1);
    var fns = listeners[event] || [];
    for (var i = 0; i < fns.length; i++) {
      try { fns[i].apply(null, args); } catch (e) { console.error('[feature-flags] listener error:', e); }
    }
  }

  /* ── Flag Resolution ──────────────────────────────────────────── */

  /**
   * Resolve a flag's effective value.
   * Priority: admin override > server flag > default definition
   */
  function resolveFlag(key) {
    // 1. Admin/local override (explicit boolean)
    if (overrides.hasOwnProperty(key)) {
      return !!overrides[key];
    }

    // 2. Server override
    if (serverFlags && serverFlags.hasOwnProperty(key)) {
      var sf = serverFlags[key];
      if (typeof sf === 'boolean') return sf;
      if (typeof sf === 'object' && sf !== null) {
        if (sf.enabled === false) return false;
        if (typeof sf.rolloutPercent === 'number') {
          return rolloutBucket(key) < sf.rolloutPercent;
        }
        return sf.enabled !== false;
      }
    }

    // 3. Default definition
    var def = flags[key];
    if (!def) return false; // unknown flag → disabled

    if (!def.enabled) return false;

    // Percentage rollout
    if (typeof def.rolloutPercent === 'number' && def.rolloutPercent < 100) {
      return rolloutBucket(key) < def.rolloutPercent;
    }

    return true;
  }

  /* ── Server Fetch ─────────────────────────────────────────────── */

  function fetchServerFlags() {
    if (!config.serverUrl) return Promise.resolve(null);

    return fetch(config.serverUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-cache',
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var oldServer = serverFlags;
        serverFlags = data.flags || data;
        serverFetchedAt = Date.now();
        saveToStorage();

        // Emit changes for any flag whose resolved value changed
        var allKeys = Object.keys(flags);
        for (var i = 0; i < allKeys.length; i++) {
          var k = allKeys[i];
          var oldVal = oldServer ? resolveFlagWith(k, oldServer) : resolveFlag(k);
          var newVal = resolveFlag(k);
          if (oldVal !== newVal) {
            emit('change', k, newVal);
          }
        }
        emit('server-sync', serverFlags);
        return serverFlags;
      })
      .catch(function (err) {
        console.warn('[feature-flags] Server fetch failed:', err.message);
        emit('server-error', err);
        return null;
      });
  }

  /** Resolve with a specific server flags object (for diffing) */
  function resolveFlagWith(key, sFlags) {
    if (overrides.hasOwnProperty(key)) return !!overrides[key];
    if (sFlags && sFlags.hasOwnProperty(key)) {
      var sf = sFlags[key];
      if (typeof sf === 'boolean') return sf;
      if (typeof sf === 'object' && sf !== null) {
        if (sf.enabled === false) return false;
        if (typeof sf.rolloutPercent === 'number') return rolloutBucket(key) < sf.rolloutPercent;
        return sf.enabled !== false;
      }
    }
    var def = flags[key];
    if (!def || !def.enabled) return false;
    if (typeof def.rolloutPercent === 'number' && def.rolloutPercent < 100) {
      return rolloutBucket(key) < def.rolloutPercent;
    }
    return true;
  }

  /* ── Admin API ────────────────────────────────────────────────── */

  function setFlag(key, value) {
    var oldVal = resolveFlag(key);
    if (typeof value === 'boolean') {
      overrides[key] = value;
    } else if (value === null || value === undefined) {
      delete overrides[key]; // remove override, fall back to default/server
    }
    saveToStorage();
    var newVal = resolveFlag(key);
    if (oldVal !== newVal) {
      emit('change', key, newVal);
    }
  }

  function setRollout(key, percent) {
    percent = Math.max(0, Math.min(100, Number(percent) || 0));
    if (flags[key]) {
      flags[key].rolloutPercent = percent;
    }
    // Also store as override metadata
    saveToStorage();
    emit('change', key, resolveFlag(key));
  }

  function resetFlag(key) {
    setFlag(key, null);
  }

  function resetAll() {
    overrides = {};
    saveToStorage();
    var allKeys = Object.keys(flags);
    for (var i = 0; i < allKeys.length; i++) {
      emit('change', allKeys[i], resolveFlag(allKeys[i]));
    }
    emit('reset');
  }

  /* ── Transport Integration ────────────────────────────────────── */

  /**
   * Returns list of transport names that are disabled via feature flags.
   * Used by CortexTransport to skip disabled transports.
   */
  function getDisabledTransports() {
    var disabled = [];
    var transportFlags = [
      'transport.webrtc',
      'transport.grpc',
      'transport.socketio',
      'transport.sse',
      'transport.http-chunked',
    ];
    for (var i = 0; i < transportFlags.length; i++) {
      if (!resolveFlag(transportFlags[i])) {
        // Extract transport name from flag key
        disabled.push(transportFlags[i].replace('transport.', ''));
      }
    }
    return disabled;
  }

  /* ── Query API ────────────────────────────────────────────────── */

  function getAllFlags() {
    var result = {};
    var keys = Object.keys(flags);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var def = flags[k];
      result[k] = {
        enabled: resolveFlag(k),
        description: def.description || '',
        group: def.group || 'default',
        rolloutPercent: def.rolloutPercent,
        hasOverride: overrides.hasOwnProperty(k),
        overrideValue: overrides.hasOwnProperty(k) ? overrides[k] : null,
        hasServerValue: serverFlags ? serverFlags.hasOwnProperty(k) : false,
        bucket: rolloutBucket(k),
      };
    }
    return result;
  }

  function getFlagsByGroup(group) {
    var all = getAllFlags();
    var result = {};
    for (var k in all) {
      if (all[k].group === group) result[k] = all[k];
    }
    return result;
  }

  function getGroups() {
    var groups = {};
    var keys = Object.keys(flags);
    for (var i = 0; i < keys.length; i++) {
      var g = flags[keys[i]].group || 'default';
      if (!groups[g]) groups[g] = 0;
      groups[g]++;
    }
    return groups;
  }

  /* ── Init ─────────────────────────────────────────────────────── */

  function init(opts) {
    opts = opts || {};

    // Merge config
    if (opts.serverUrl) config.serverUrl = opts.serverUrl;
    if (opts.refreshInterval) config.refreshInterval = opts.refreshInterval;
    if (opts.storage) config.storage = opts.storage;

    // Start with default flags
    flags = {};
    for (var k in DEFAULT_FLAGS) {
      flags[k] = Object.assign({}, DEFAULT_FLAGS[k]);
    }

    // Merge any custom flag definitions
    if (opts.flags) {
      for (var fk in opts.flags) {
        flags[fk] = Object.assign({}, DEFAULT_FLAGS[fk] || {}, opts.flags[fk]);
      }
    }

    // Load persisted state
    var stored = loadFromStorage();
    if (stored.overrides) overrides = stored.overrides;
    if (stored.serverFlags) {
      serverFlags = stored.serverFlags;
      serverFetchedAt = stored.serverFetchedAt || 0;
    }

    // Initialize device ID
    getDeviceId();

    // Fetch from server if configured and cache is stale
    if (config.serverUrl) {
      var cacheAge = Date.now() - serverFetchedAt;
      if (cacheAge > SERVER_CACHE_TTL) {
        fetchServerFlags();
      }

      // Auto-refresh
      if (config.refreshInterval > 0) {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(fetchServerFlags, config.refreshInterval);
      }
    }

    initialized = true;
    emit('init', getAllFlags());
    console.log('[feature-flags] Initialized with', Object.keys(flags).length, 'flags');
  }

  /* ── Public API ───────────────────────────────────────────────── */

  window.CortexFeatureFlags = {
    init: init,
    isEnabled: resolveFlag,
    setFlag: setFlag,
    setRollout: setRollout,
    resetFlag: resetFlag,
    resetAll: resetAll,
    getAllFlags: getAllFlags,
    getFlagsByGroup: getFlagsByGroup,
    getGroups: getGroups,
    getDisabledTransports: getDisabledTransports,
    fetchServerFlags: fetchServerFlags,
    getDeviceId: getDeviceId,
    on: on,
    off: off,

    // Convenience aliases
    enabled: resolveFlag,
    check: resolveFlag,
    toggle: function (key) {
      setFlag(key, !resolveFlag(key));
    },
  };

})();
