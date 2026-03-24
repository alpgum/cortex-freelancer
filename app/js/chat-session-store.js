/**
 * CFX-041: Persistent Chat Sessions
 *
 * Replaces the old localStorage-only session store with:
 * - SessionId persisted to localStorage + cookie fallback
 * - Message history persisted to IndexedDB (with localStorage cache for sync restore)
 * - Multi-tab sync via BroadcastChannel
 * - Session expiry (default 24h inactivity)
 * - Metadata tracking: startedAt, lastActiveAt, messageCount
 *
 * Compatibility:
 * Exposes `window.CortexChatSessions` with the legacy API used by the existing UI/dispatchers.
 */

(function () {
  'use strict';

  // ────────────────────────────────────────────────────────────────────────────
  // IndexedDB wrapper (subset of src/session/session-storage.js)
  // ────────────────────────────────────────────────────────────────────────────

  var DB_NAME = 'cortex_sessions_v1';
  var DB_VERSION = 1;
  var STORE_MESSAGES = 'messages';
  var STORE_META = 'meta';

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          var msg = db.createObjectStore(STORE_MESSAGES, { keyPath: ['sessionId', 'ts'] });
          msg.createIndex('by_session', 'sessionId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'sessionId' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Failed to open IndexedDB')); };
    });
  }

  function Storage(opts) {
    opts = opts || {};
    this.maxMessages = typeof opts.maxMessages === 'number' ? opts.maxMessages : 200;
    this._dbp = null;
  }

  Storage.prototype._db = function () {
    if (!this._dbp) this._dbp = openDb();
    return this._dbp;
  };

  Storage.prototype.putMeta = async function (meta) {
    var db = await this._db();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put(meta);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  };

  Storage.prototype.getMeta = async function (sessionId) {
    var db = await this._db();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_META, 'readonly');
      var req = tx.objectStore(STORE_META).get(sessionId);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    });
  };

  Storage.prototype.addMessage = async function (sessionId, message) {
    var db = await this._db();
    var entry = { sessionId: sessionId, ts: message.ts || Date.now(), role: message.role, content: message.content };

    await new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_MESSAGES, 'readwrite');
      tx.objectStore(STORE_MESSAGES).put(entry);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });

    // Best-effort trim
    try {
      var count = await this.countMessages(sessionId);
      if (count > this.maxMessages) {
        await this.deleteOldest(sessionId, count - this.maxMessages);
      }
    } catch (_e) {}
  };

  Storage.prototype.countMessages = async function (sessionId) {
    var db = await this._db();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_MESSAGES, 'readonly');
      var idx = tx.objectStore(STORE_MESSAGES).index('by_session');
      var req = idx.count(sessionId);
      req.onsuccess = function () { resolve(req.result || 0); };
      req.onerror = function () { reject(req.error); };
    });
  };

  Storage.prototype.getMessages = async function (sessionId, limit) {
    var db = await this._db();
    limit = typeof limit === 'number' && limit > 0 ? limit : null;

    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_MESSAGES, 'readonly');
      var idx = tx.objectStore(STORE_MESSAGES).index('by_session');
      var range = IDBKeyRange.only(sessionId);
      var req = idx.openCursor(range, 'next');
      var items = [];

      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor) {
          if (limit && items.length > limit) items = items.slice(-limit);
          resolve(items);
          return;
        }
        items.push(cursor.value);
        cursor.continue();
      };
      req.onerror = function () { reject(req.error); };
    });
  };

  Storage.prototype.deleteOldest = async function (sessionId, n) {
    if (!n || n <= 0) return 0;
    var db = await this._db();

    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_MESSAGES, 'readwrite');
      var store = tx.objectStore(STORE_MESSAGES);
      var idx = store.index('by_session');
      var range = IDBKeyRange.only(sessionId);
      var req = idx.openCursor(range, 'next');
      var deleted = 0;

      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor || deleted >= n) return;
        store.delete(cursor.primaryKey);
        deleted++;
        cursor.continue();
      };
      tx.oncomplete = function () { resolve(deleted); };
      tx.onerror = function () { reject(tx.error); };
    });
  };

  Storage.prototype.clearSession = async function (sessionId) {
    var db = await this._db();

    await new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_MESSAGES, 'readwrite');
      var store = tx.objectStore(STORE_MESSAGES);
      var idx = store.index('by_session');
      var range = IDBKeyRange.only(sessionId);
      var req = idx.openCursor(range, 'next');
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });

    await new Promise(function (resolve, reject) {
      var tx2 = db.transaction(STORE_META, 'readwrite');
      tx2.objectStore(STORE_META).delete(sessionId);
      tx2.oncomplete = function () { resolve(); };
      tx2.onerror = function () { reject(tx2.error); };
    });
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Session manager (subset of src/session/session-manager.js)
  // ────────────────────────────────────────────────────────────────────────────

  var LS_SESSION_ID = 'cortex_session_id';
  var LS_META = 'cortex_session_meta';
  var LS_CACHE_PREFIX = 'cortex_chat_cache_';
  var COOKIE_NAME = 'cortex_session_id';
  var BC_NAME = 'cortex_session_channel';

  function now() { return Date.now(); }

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch (_e) { return fallback; }
  }

  function getCookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&') + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    } catch (_e) { return null; }
  }

  function setCookie(name, value, maxAgeSec) {
    try {
      var parts = [name + '=' + encodeURIComponent(String(value)), 'path=/', 'samesite=lax'];
      if (location && location.protocol === 'https:') parts.push('secure');
      if (maxAgeSec) parts.push('max-age=' + String(maxAgeSec));
      document.cookie = parts.join('; ');
    } catch (_e) {}
  }

  function uuid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return 'cs_' + window.crypto.randomUUID();
      }
    } catch (_e) {}
    return 'cs_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function SessionManager(opts) {
    opts = opts || {};
    this.timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 24 * 60 * 60 * 1000;
    this.maxCacheMessages = typeof opts.maxCacheMessages === 'number' ? opts.maxCacheMessages : 50;
    this.storage = new Storage({ maxMessages: typeof opts.maxStoredMessages === 'number' ? opts.maxStoredMessages : 200 });

    this._sessionId = null;
    this._meta = null;
    this._bc = null;
    this._listeners = {};

    this._init();
  }

  SessionManager.prototype.on = function (evt, fn) {
    if (!evt || !fn) return;
    (this._listeners[evt] = this._listeners[evt] || []).push(fn);
  };

  SessionManager.prototype._emit = function (evt, payload) {
    var list = this._listeners[evt] || [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (_e) {}
    }
  };

  SessionManager.prototype._cacheKey = function (sid) { return LS_CACHE_PREFIX + sid; };
  SessionManager.prototype._cacheLoad = function (sid) {
    var key = this._cacheKey(sid);
    var v = null;
    try { v = safeJsonParse(localStorage.getItem(key), null); } catch (_e) { v = null; }
    if (!v || !Array.isArray(v.messages)) return [];
    return v.messages;
  };
  SessionManager.prototype._cacheSave = function (sid, messages) {
    var key = this._cacheKey(sid);
    try { localStorage.setItem(key, JSON.stringify({ messages: messages.slice(-this.maxCacheMessages) })); } catch (_e) {}
  };
  SessionManager.prototype._cacheAdd = function (sid, message) {
    var msgs = this._cacheLoad(sid);
    msgs.push({ role: message.role, content: message.content, ts: message.ts || now() });
    this._cacheSave(sid, msgs);
  };
  SessionManager.prototype._cacheClear = function (sid) {
    try { localStorage.removeItem(this._cacheKey(sid)); } catch (_e) {}
  };

  SessionManager.prototype._persistMeta = function () {
    try { localStorage.setItem(LS_META, JSON.stringify(this._meta)); } catch (_e) {}
    try { this.storage.putMeta(this._meta); } catch (_e2) {}
  };

  SessionManager.prototype._init = function () {
    var sid = null;
    try { sid = localStorage.getItem(LS_SESSION_ID); } catch (_e) { sid = null; }
    if (!sid) sid = getCookie(COOKIE_NAME);

    var meta = null;
    try { meta = safeJsonParse(localStorage.getItem(LS_META), null); } catch (_e2) { meta = null; }

    if (sid && meta && meta.lastActiveAt && (now() - meta.lastActiveAt > this.timeoutMs)) {
      sid = null;
      meta = null;
    }

    if (!sid) sid = uuid();
    if (!meta || meta.sessionId !== sid) {
      meta = { sessionId: sid, startedAt: now(), lastActiveAt: now(), messageCount: 0 };
    }

    this._sessionId = sid;
    this._meta = meta;

    try { localStorage.setItem(LS_SESSION_ID, sid); } catch (_e3) {}
    setCookie(COOKIE_NAME, sid, Math.ceil(this.timeoutMs / 1000));
    this._persistMeta();

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this._bc = new BroadcastChannel(BC_NAME);
        this._bc.onmessage = this._onBroadcast.bind(this);
      }
    } catch (_e4) { this._bc = null; }

    this.hydrateFromStorage();
  };

  SessionManager.prototype._onBroadcast = function (ev) {
    var msg = ev && ev.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'message' && msg.sessionId === this._sessionId && msg.message) {
      this._cacheAdd(msg.sessionId, msg.message);
      this._meta.messageCount = (this._meta.messageCount || 0) + 1;
      this._meta.lastActiveAt = now();
      this._persistMeta();
      this._emit('message', msg.message);
    }

    if (msg.type === 'switch' && msg.newSessionId && msg.newSessionId !== this._sessionId) {
      this._sessionId = msg.newSessionId;
      this._meta = msg.meta || { sessionId: msg.newSessionId, startedAt: now(), lastActiveAt: now(), messageCount: 0 };
      try { localStorage.setItem(LS_SESSION_ID, this._sessionId); } catch (_e) {}
      this._persistMeta();
      setCookie(COOKIE_NAME, this._sessionId, Math.ceil(this.timeoutMs / 1000));
      this.hydrateFromStorage();
      this._emit('switched', { sessionId: this._sessionId });
    }

    if (msg.type === 'clear' && msg.sessionId === this._sessionId) {
      this._cacheClear(this._sessionId);
      this._emit('cleared', { sessionId: this._sessionId });
    }
  };

  SessionManager.prototype.getSessionId = function () { return this._sessionId; };
  SessionManager.prototype.getMeta = function () { return this._meta; };

  SessionManager.prototype.getHistorySync = function (limit) {
    var msgs = this._cacheLoad(this._sessionId);
    if (limit && msgs.length > limit) msgs = msgs.slice(-limit);
    return msgs;
  };

  SessionManager.prototype.hydrateFromStorage = async function () {
    var sid = this._sessionId;
    try {
      var msgs = await this.storage.getMessages(sid, this.maxCacheMessages);
      if (msgs && msgs.length) {
        var normalized = msgs.map(function (m) { return ({ role: m.role, content: m.content, ts: m.ts }); });
        this._cacheSave(sid, normalized);
        this._emit('hydrated', { sessionId: sid, messages: normalized });
      }
    } catch (_e) {}
  };

  SessionManager.prototype.addMessage = async function (role, content) {
    var sid = this._sessionId;
    var msg = { role: role, content: content, ts: now() };

    this._meta.lastActiveAt = now();
    this._meta.messageCount = (this._meta.messageCount || 0) + 1;
    this._persistMeta();

    this._cacheAdd(sid, msg);
    try { await this.storage.addMessage(sid, msg); } catch (_e) {}

    try { if (this._bc) this._bc.postMessage({ type: 'message', sessionId: sid, message: msg }); } catch (_e2) {}
    return msg;
  };

  SessionManager.prototype.clearSession = async function () {
    var oldSid = this._sessionId;
    var newSid = uuid();

    this._sessionId = newSid;
    this._meta = { sessionId: newSid, startedAt: now(), lastActiveAt: now(), messageCount: 0 };

    try { localStorage.setItem(LS_SESSION_ID, newSid); } catch (_e) {}
    setCookie(COOKIE_NAME, newSid, Math.ceil(this.timeoutMs / 1000));
    this._persistMeta();

    this._cacheClear(oldSid);
    try { await this.storage.clearSession(oldSid); } catch (_e2) {}

    try { if (this._bc) this._bc.postMessage({ type: 'switch', oldSessionId: oldSid, newSessionId: newSid, meta: this._meta }); } catch (_e3) {}
    this._emit('cleared', { oldSessionId: oldSid, sessionId: newSid });
    return newSid;
  };

  // Create a single global manager for the app
  var manager = new SessionManager();
  window.CortexSessionManager = manager;

  // Legacy API wrapper used by existing UI/dispatchers
  function getOrCreate(_sessionId) {
    // Always use the manager's active session.
    var sid = manager.getSessionId();
    return { id: sid, messages: manager.getHistorySync(), createdAt: manager.getMeta().startedAt, updatedAt: manager.getMeta().lastActiveAt };
  }

  function addMessage(_sessionId, msg) {
    // Keep signature, but ignore passed sessionId
    if (!msg || !msg.role) return;
    manager.addMessage(msg.role, msg.content);
  }

  function getHistory(_sessionId, limit) {
    return manager.getHistorySync(limit);
  }

  function listSessions() {
    var meta = manager.getMeta();
    var history = manager.getHistorySync();
    var first = history && history[0];
    return [{
      id: manager.getSessionId(),
      title: first ? String(first.content).substring(0, 50) : 'New chat',
      updatedAt: meta.lastActiveAt,
      msgCount: history.length
    }];
  }

  window.CortexChatSessions = {
    getOrCreate: getOrCreate,
    addMessage: addMessage,
    getHistory: getHistory,
    listSessions: listSessions,
    uuid: uuid
  };
})();
