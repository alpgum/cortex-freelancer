/**
 * T05a: Chat Session Store
 * localStorage-backed conversation persistence.
 */
(function () {
  'use strict';
  var KEY = 'cortex_chat_sessions';
  var MAX_SESSIONS = 10;
  var MAX_MSGS = 50;

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveAll(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function uuid() {
    return 'cs_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  function getOrCreate(sessionId) {
    var all = loadAll();
    if (!sessionId || !all[sessionId]) {
      sessionId = sessionId || uuid();
      all[sessionId] = { id: sessionId, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
      // Evict oldest if over limit
      var keys = Object.keys(all).sort(function (a, b) { return all[a].updatedAt - all[b].updatedAt; });
      while (keys.length > MAX_SESSIONS) { delete all[keys.shift()]; }
      saveAll(all);
    }
    return all[sessionId];
  }

  function addMessage(sessionId, msg) {
    var all = loadAll();
    var session = all[sessionId];
    if (!session) { session = { id: sessionId, messages: [], createdAt: Date.now() }; all[sessionId] = session; }
    session.messages.push({ role: msg.role, content: msg.content, ts: Date.now() });
    if (session.messages.length > MAX_MSGS) session.messages = session.messages.slice(-MAX_MSGS);
    session.updatedAt = Date.now();
    saveAll(all);
  }

  function getHistory(sessionId, limit) {
    var all = loadAll();
    var session = all[sessionId];
    if (!session) return [];
    var msgs = session.messages || [];
    return limit ? msgs.slice(-limit) : msgs;
  }

  function listSessions() {
    var all = loadAll();
    return Object.values(all)
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })
      .map(function (s) {
        var first = s.messages && s.messages[0];
        return { id: s.id, title: first ? String(first.content).substring(0, 50) : 'New chat', updatedAt: s.updatedAt, msgCount: (s.messages || []).length };
      });
  }

  window.CortexChatSessions = { getOrCreate: getOrCreate, addMessage: addMessage, getHistory: getHistory, listSessions: listSessions, uuid: uuid };
})();
