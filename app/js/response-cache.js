/**
 * CFX-033: Response Caching (client-side)
 *
 * Lightweight local-only cache for AI responses.
 * - Keyed by: conversationId + promptHash + transport + model/mode (optional)
 * - Storage: localStorage (default) with graceful in-memory fallback
 * - Policies: TTL + LRU eviction (maxEntries + maxBytes)
 * - Safe-by-default: never leaves device
 *
 * Usage (browser):
 *   const cache = CortexFreelancer.ResponseCache.create({ namespace: 'cortex', ttlMs: 6*60*60*1000 });
 *   const key = await cache.buildKey({ conversationId, request, transport: 'sse', model: 'default' });
 *   const hit = cache.get(key);
 *   if (!hit) cache.set(key, { text: '...' }, { threadId: conversationId });
 *
 * Usage (node tests):
 *   const { create, createMemoryStorage } = require('./response-cache.js');
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else {
    root.CortexFreelancer = root.CortexFreelancer || {};
    root.CortexFreelancer.ResponseCache = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DEFAULTS = {
    namespace: 'cfx033',
    indexKey: 'response_cache:index',
    itemPrefix: 'response_cache:item:',

    // Keep this conservative; localStorage quotas vary (esp. Safari private mode).
    maxEntries: 120,
    maxBytes: 1.5 * 1024 * 1024, // ~1.5MB
    ttlMs: 24 * 60 * 60 * 1000, // 24h

    // If true, cache stores full request hash including conversation messages.
    // If false, only hashes the user prompt string.
    hashIncludesContext: true,

    // Optional: include endpoint in the key.
    endpoint: null
  };

  function now() { return Date.now(); }

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch (_e) { return fallback; }
  }

  function stableStringify(value) {
    // Deterministic JSON stringify (sort object keys).
    const seen = new WeakSet();

    function _stringify(v) {
      if (v === null || typeof v !== 'object') return JSON.stringify(v);
      if (seen.has(v)) return '"[Circular]"';
      seen.add(v);

      if (Array.isArray(v)) {
        return '[' + v.map(_stringify).join(',') + ']';
      }

      const keys = Object.keys(v).sort();
      return '{' + keys.map(k => JSON.stringify(k) + ':' + _stringify(v[k])).join(',') + '}';
    }

    return _stringify(value);
  }

  // Fast sync hash (FNV-1a 32-bit). Adequate for cache keys; sha256 used when available.
  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      // h *= 16777619 (with overflow)
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  async function sha256Hex(str) {
    // Browser: crypto.subtle. Node: global crypto webcrypto may exist.
    const cryptoObj = (typeof crypto !== 'undefined') ? crypto : null;
    if (!cryptoObj || !cryptoObj.subtle || typeof TextEncoder === 'undefined') return null;

    const enc = new TextEncoder();
    const buf = enc.encode(str);
    const digest = await cryptoObj.subtle.digest('SHA-256', buf);
    const bytes = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
    return hex;
  }

  async function hashString(str) {
    const h = await sha256Hex(str);
    return h || fnv1a32(str);
  }

  function createMemoryStorage() {
    const m = new Map();
    return {
      get length() { return m.size; },
      key(i) { return Array.from(m.keys())[i] || null; },
      getItem(k) { return m.has(k) ? m.get(k) : null; },
      setItem(k, v) { m.set(k, String(v)); },
      removeItem(k) { m.delete(k); },
      clear() { m.clear(); }
    };
  }

  function getDefaultStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        // Safari private mode can throw even on setItem.
        const t = '__cfx033_test__';
        localStorage.setItem(t, '1');
        localStorage.removeItem(t);
        return localStorage;
      }
    } catch (_e) {}
    return createMemoryStorage();
  }

  function byteSize(str) {
    // Approximate bytes in UTF-16 string; close enough for localStorage quota mgmt.
    return (str ? str.length * 2 : 0);
  }

  function create(opts) {
    opts = opts || {};
    const cfg = Object.assign({}, DEFAULTS, opts);
    const storage = cfg.storage || getDefaultStorage();

    const nsPrefix = cfg.namespace + ':';
    const indexStorageKey = nsPrefix + cfg.indexKey;
    const itemPrefix = nsPrefix + cfg.itemPrefix;

    function _loadIndex() {
      const raw = storage.getItem(indexStorageKey);
      const idx = safeJsonParse(raw, null);
      if (!idx || typeof idx !== 'object') {
        return { version: 1, totalBytes: 0, entries: [] };
      }
      if (!Array.isArray(idx.entries)) idx.entries = [];
      if (typeof idx.totalBytes !== 'number') idx.totalBytes = 0;
      return idx;
    }

    function _saveIndex(idx) {
      try { storage.setItem(indexStorageKey, JSON.stringify(idx)); } catch (_e) {
        // If we cannot persist index, attempt to clear it to keep app functional.
        try { storage.removeItem(indexStorageKey); } catch (_e2) {}
      }
    }

    function _itemKey(key) {
      return itemPrefix + key;
    }

    function _findEntryIndex(idx, key) {
      for (let i = 0; i < idx.entries.length; i++) {
        if (idx.entries[i] && idx.entries[i].key === key) return i;
      }
      return -1;
    }

    function _purgeExpired(idx) {
      const t = now();
      let changed = false;
      for (let i = idx.entries.length - 1; i >= 0; i--) {
        const e = idx.entries[i];
        if (!e) { idx.entries.splice(i, 1); changed = true; continue; }
        if (e.expiresAt && e.expiresAt <= t) {
          _deleteByEntry(idx, e);
          changed = true;
        }
      }
      if (changed) _saveIndex(idx);
    }

    function _deleteByEntry(idx, entry) {
      try { storage.removeItem(_itemKey(entry.key)); } catch (_e) {}
      idx.totalBytes = Math.max(0, (idx.totalBytes || 0) - (entry.bytes || 0));
      const pos = _findEntryIndex(idx, entry.key);
      if (pos !== -1) idx.entries.splice(pos, 1);
    }

    function _touchLRU(idx, key) {
      const pos = _findEntryIndex(idx, key);
      if (pos === -1) return;
      const e = idx.entries[pos];
      e.lastAccess = now();
      idx.entries.splice(pos, 1);
      idx.entries.push(e);
    }

    function _enforceLimits(idx) {
      let changed = false;

      while (idx.entries.length > cfg.maxEntries) {
        _deleteByEntry(idx, idx.entries[0]);
        changed = true;
      }

      while (idx.totalBytes > cfg.maxBytes && idx.entries.length) {
        _deleteByEntry(idx, idx.entries[0]);
        changed = true;
      }

      if (changed) _saveIndex(idx);
    }

    function get(key) {
      const idx = _loadIndex();
      _purgeExpired(idx);

      const pos = _findEntryIndex(idx, key);
      if (pos === -1) return null;

      const raw = storage.getItem(_itemKey(key));
      if (!raw) {
        // index drift
        _deleteByEntry(idx, idx.entries[pos]);
        _saveIndex(idx);
        return null;
      }

      const parsed = safeJsonParse(raw, null);
      if (!parsed || (parsed.expiresAt && parsed.expiresAt <= now())) {
        _deleteByEntry(idx, idx.entries[pos]);
        _saveIndex(idx);
        return null;
      }

      _touchLRU(idx, key);
      _saveIndex(idx);
      return parsed;
    }

    function set(key, value, meta) {
      meta = meta || {};
      const idx = _loadIndex();
      _purgeExpired(idx);

      const createdAt = now();
      const ttlMs = typeof meta.ttlMs === 'number' ? meta.ttlMs : cfg.ttlMs;
      const expiresAt = createdAt + ttlMs;

      const payload = {
        key: key,
        createdAt: createdAt,
        lastAccess: createdAt,
        expiresAt: expiresAt,
        threadId: meta.threadId || meta.conversationId || null,
        transport: meta.transport || null,
        model: meta.model || null,
        mode: meta.mode || null,
        endpoint: meta.endpoint || cfg.endpoint || null,
        value: value
      };

      const raw = JSON.stringify(payload);
      const bytes = byteSize(raw);

      // If a single item is too big, don't cache.
      if (bytes > cfg.maxBytes) return false;

      // Remove old value if exists (to avoid double-counting bytes).
      const existingPos = _findEntryIndex(idx, key);
      if (existingPos !== -1) {
        _deleteByEntry(idx, idx.entries[existingPos]);
      }

      try {
        storage.setItem(_itemKey(key), raw);
      } catch (_e) {
        // Quota exceeded (or blocked). Try evicting and retry once.
        _enforceLimits(idx);
        try {
          storage.setItem(_itemKey(key), raw);
        } catch (_e2) {
          return false;
        }
      }

      idx.entries.push({
        key: key,
        createdAt: createdAt,
        lastAccess: createdAt,
        expiresAt: expiresAt,
        bytes: bytes,
        threadId: payload.threadId
      });
      idx.totalBytes = (idx.totalBytes || 0) + bytes;

      _enforceLimits(idx);
      _saveIndex(idx);
      return true;
    }

    function clearAll() {
      const idx = _loadIndex();
      idx.entries.forEach(function (e) {
        if (e && e.key) {
          try { storage.removeItem(_itemKey(e.key)); } catch (_e) {}
        }
      });
      try { storage.removeItem(indexStorageKey); } catch (_e) {}
      return true;
    }

    function clearThread(threadId) {
      if (!threadId) return 0;
      const idx = _loadIndex();
      let removed = 0;
      for (let i = idx.entries.length - 1; i >= 0; i--) {
        const e = idx.entries[i];
        if (e && e.threadId === threadId) {
          _deleteByEntry(idx, e);
          removed++;
        }
      }
      _saveIndex(idx);
      return removed;
    }

    function stats() {
      const idx = _loadIndex();
      _purgeExpired(idx);
      return {
        entries: idx.entries.length,
        totalBytes: idx.totalBytes,
        maxEntries: cfg.maxEntries,
        maxBytes: cfg.maxBytes,
        ttlMs: cfg.ttlMs,
        namespace: cfg.namespace
      };
    }

    async function buildPromptHash(params) {
      params = params || {};
      if (!cfg.hashIncludesContext) {
        return hashString(String(params.prompt || ''));
      }

      const request = params.request || {};
      const basis = {
        endpoint: params.endpoint || cfg.endpoint || null,
        transport: params.transport || null,
        model: params.model || null,
        mode: params.mode || null,
        request: request
      };
      return hashString(stableStringify(basis));
    }

    async function buildKey(params) {
      params = params || {};
      const conversationId = params.conversationId || params.threadId || 'default';
      const transport = params.transport || 'default';
      const model = params.model || 'default';
      const mode = params.mode || 'default';

      const promptHash = params.promptHash || await buildPromptHash(params);
      // Keep key reasonably short for localStorage.
      const shortHash = String(promptHash).slice(0, 32);
      const endpointPart = (params.endpoint || cfg.endpoint) ? (':' + String(params.endpoint || cfg.endpoint).replace(/[^a-zA-Z0-9/_\-:.]/g, '')) : '';

      return ['v1', conversationId, transport, model, mode].join(':') + endpointPart + ':' + shortHash;
    }

    return {
      config: cfg,
      storage: storage,
      get: get,
      set: set,
      clearAll: clearAll,
      clearThread: clearThread,
      stats: stats,
      buildKey: buildKey,
      buildPromptHash: buildPromptHash,
      stableStringify: stableStringify,
      hashString: hashString
    };
  }

  return {
    DEFAULTS: DEFAULTS,
    create: create,
    createMemoryStorage: createMemoryStorage,
    stableStringify: stableStringify,
    hashString: hashString
  };
});
