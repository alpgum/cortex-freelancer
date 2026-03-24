/**
 * CFX-041: ServerSessionStore
 *
 * Provides a shared session history store for the API layer.
 *
 * Default: in-memory Map with inactivity expiry (24h).
 * Optional: Redis backing can be enabled later (hook points included).
 */

const DEFAULT_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_HISTORY = 20;

function createServerSessionStore(options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const maxHistory = Number.isFinite(options.maxHistory) ? options.maxHistory : DEFAULT_MAX_HISTORY;

  // In-memory fallback
  const sessions = new Map(); // sid -> { messages: [], lastActivity, startedAt, messageCount }

  function getOrCreate(sid) {
    if (!sid) return null;

    if (sessions.has(sid)) {
      const s = sessions.get(sid);
      if (Date.now() - s.lastActivity < timeoutMs) {
        s.lastActivity = Date.now();
        return s;
      }
      sessions.delete(sid);
    }

    const s = { messages: [], startedAt: Date.now(), lastActivity: Date.now(), messageCount: 0 };
    sessions.set(sid, s);
    return s;
  }

  function append(sid, role, content) {
    const s = sessions.get(sid);
    if (!s) return;
    s.messages.push({ role, content });
    if (s.messages.length > maxHistory) s.messages = s.messages.slice(-maxHistory);
    s.lastActivity = Date.now();
    s.messageCount++;
  }

  function cleanup() {
    const now = Date.now();
    for (const [sid, s] of sessions) {
      if (now - s.lastActivity > timeoutMs) sessions.delete(sid);
    }
  }

  function stats() {
    return { activeSessions: sessions.size, timeoutMs, maxHistory };
  }

  return { getOrCreate, append, cleanup, stats, _sessions: sessions };
}

module.exports = { createServerSessionStore };
