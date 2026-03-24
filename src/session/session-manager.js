/**
 * CFX-041: SessionManager
 *
 * Responsibilities:
 * - Create/persist a sessionId (localStorage + cookie fallback)
 * - Maintain session metadata (startAt, lastActiveAt, messageCount)
 * - Persist messages to IndexedDB via SessionStorage
 * - Provide multi-tab sync via BroadcastChannel
 * - Auto-expire sessions after inactivity timeout (default 24h)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./session-storage'));
  else root.CortexSessionManager = factory(root.CortexSessionStorage);
})(typeof self !== 'undefined' ? self : this, function (SessionStorage) {
  'use strict';

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
    } catch (_e) {
      return null;
    }
  }

  function setCookie(name, value, maxAgeSec) {
    try {
      var parts = [name + '=' + encodeURIComponent(String(value))];
      parts.push('path=/');
      parts.push('samesite=lax');
      if (typeof location !== 'undefined' && location.protocol === 'https:') parts.push('secure');
      if (maxAgeSec) parts.push('max-age=' + String(maxAgeSec));
      document.cookie = parts.join('; ');
    } catch (_e) {}
  }

  function uuid() {
    try {
      if (self.crypto && typeof self.crypto.randomUUID === 'function') {
        return 'cs_' + self.crypto.randomUUID();
      }
    } catch (_e) {}
    return 'cs_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function SessionManager(options) {
    options = options || {};
    this.timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 24 * 60 * 60 * 1000;
    this.maxCacheMessages = typeof options.maxCacheMessages === 'number' ? options.maxCacheMessages : 50;
    this.storage = new SessionStorage({ maxMessages: typeof options.maxStoredMessages === 'number' ? options.maxStoredMessages : 200 });

    this._meta = null;
    this._sessionId = null;
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

  SessionManager.prototype._init = function () {
    // Load or create sessionId
    var sid = null;
    try { sid = localStorage.getItem(LS_SESSION_ID); } catch (_e) { sid = null; }
    if (!sid) sid = getCookie(COOKIE_NAME);

    var meta = null;
    try { meta = safeJsonParse(localStorage.getItem(LS_META), null); } catch (_e2) { meta = null; }

    // Expire if inactive
    if (sid && meta && meta.lastActiveAt && (now() - meta.lastActiveAt > this.timeoutMs)) {
      sid = null;
      meta = null;
    }

    if (!sid) sid = uuid();
    if (!meta || meta.sessionId !== sid) {
      meta = {
        sessionId: sid,
        startedAt: now(),
        lastActiveAt: now(),
        messageCount: 0
      };
    }

    this._sessionId = sid;
    this._meta = meta;

    // Persist session id + cookie fallback
    try { localStorage.setItem(LS_SESSION_ID, sid); } catch (_e3) {}
    setCookie(COOKIE_NAME, sid, Math.ceil(this.timeoutMs / 1000));
    try { localStorage.setItem(LS_META, JSON.stringify(meta)); } catch (_e4) {}

    // BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this._bc = new BroadcastChannel(BC_NAME);
        this._bc.onmessage = this._onBroadcast.bind(this);
      }
    } catch (_e5) { this._bc = null; }

    // Async hydrate from IndexedDB
    this.hydrateFromStorage();
  };

  SessionManager.prototype._onBroadcast = function (ev) {
    var msg = ev && ev.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'message' && msg.sessionId === this._sessionId && msg.message) {
      // Keep local cache in sync
      this._cacheAdd(msg.sessionId, msg.message);
      this._meta.messageCount = (this._meta.messageCount || 0) + 1;
      this._meta.lastActiveAt = now();
      this._persistMeta();
      this._emit('message', msg.message);
    }

    if (msg.type === 'clear' && msg.sessionId === this._sessionId) {
      this._cacheClear(this._sessionId);
      this._emit('cleared', { sessionId: this._sessionId });
    }

    if (msg.type === 'switch' && msg.newSessionId && msg.newSessionId !== this._sessionId) {
      // Another tab started a new session; follow it.
      this._sessionId = msg.newSessionId;
      this._meta = msg.meta || { sessionId: msg.newSessionId, startedAt: now(), lastActiveAt: now(), messageCount: 0 };
      try { localStorage.setItem(LS_SESSION_ID, this._sessionId); } catch (_e) {}
      try { localStorage.setItem(LS_META, JSON.stringify(this._meta)); } catch (_e2) {}
      setCookie(COOKIE_NAME, this._sessionId, Math.ceil(this.timeoutMs / 1000));
      this.hydrateFromStorage();
      this._emit('switched', { sessionId: this._sessionId });
    }
  };

  SessionManager.prototype._persistMeta = function () {
    try { localStorage.setItem(LS_META, JSON.stringify(this._meta)); } catch (_e) {}
    // Also persist to IDB best-effort (no await)
    try { this.storage.putMeta(this._meta); } catch (_e2) {}
  };

  SessionManager.prototype.getSessionId = function () {
    return this._sessionId;
  };

  SessionManager.prototype.getMeta = function () {
    return this._meta;
  };

  SessionManager.prototype.touch = function () {
    if (!this._meta) return;
    this._meta.lastActiveAt = now();
    this._persistMeta();
  };

  SessionManager.prototype._cacheKey = function (sid) {
    return LS_CACHE_PREFIX + sid;
  };

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

  SessionManager.prototype.hydrateFromStorage = async function () {
    var sid = this._sessionId;
    try {
      var msgs = await this.storage.getMessages(sid, this.maxCacheMessages);
      if (msgs && msgs.length) {
        // normalize
        var normalized = msgs.map(function (m) { return ({ role: m.role, content: m.content, ts: m.ts }); });
        this._cacheSave(sid, normalized);
        this._emit('hydrated', { sessionId: sid, messages: normalized });
        try {
          var meta = await this.storage.getMeta(sid);
          if (meta) {
            this._meta = meta;
            this._persistMeta();
          }
        } catch (_e2) {}
      }
    } catch (_e3) {
      // IndexedDB may be blocked; cache still works.
    }
  };

  SessionManager.prototype.getHistorySync = function (limit) {
    var msgs = this._cacheLoad(this._sessionId);
    if (limit && msgs.length > limit) msgs = msgs.slice(-limit);
    return msgs;
  };

  SessionManager.prototype.addMessage = async function (role, content) {
    var sid = this._sessionId;
    var msg = { role: role, content: content, ts: now() };

    // Update metadata
    this._meta.lastActiveAt = now();
    this._meta.messageCount = (this._meta.messageCount || 0) + 1;
    this._persistMeta();

    // Cache + storage
    this._cacheAdd(sid, msg);
    try { await this.storage.addMessage(sid, msg); } catch (_e) {}

    // Broadcast to other tabs
    try { if (this._bc) this._bc.postMessage({ type: 'message', sessionId: sid, message: msg }); } catch (_e2) {}

    return msg;
  };

  SessionManager.prototype.clearSession = async function () {
    var oldSid = this._sessionId;

    // Create new session
    var newSid = uuid();
    this._sessionId = newSid;
    this._meta = { sessionId: newSid, startedAt: now(), lastActiveAt: now(), messageCount: 0 };

    // Persist new id
    try { localStorage.setItem(LS_SESSION_ID, newSid); } catch (_e) {}
    setCookie(COOKIE_NAME, newSid, Math.ceil(this.timeoutMs / 1000));
    this._persistMeta();

    // Best-effort clear old storage
    this._cacheClear(oldSid);
    try { await this.storage.clearSession(oldSid); } catch (_e2) {}

    // Broadcast switch so other tabs follow
    try {
      if (this._bc) this._bc.postMessage({ type: 'switch', oldSessionId: oldSid, newSessionId: newSid, meta: this._meta });
    } catch (_e3) {}

    this._emit('cleared', { oldSessionId: oldSid, sessionId: newSid });
    return newSid;
  };

  SessionManager.prototype.close = function () {
    try { if (this._bc) this._bc.close(); } catch (_e) {}
    this._bc = null;
  };

  return SessionManager;
});
