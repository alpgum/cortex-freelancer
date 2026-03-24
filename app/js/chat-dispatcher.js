/**
 * T05c: Chat Dispatcher
 * Sends messages to /api/chat and manages the flow.
 */
(function () {
  'use strict';

  var currentSessionId = null;

  function getProfile() {
    if (window.CortexFreelancer && typeof window.CortexFreelancer.getProfile === 'function') {
      return window.CortexFreelancer.getProfile();
    }
    return null;
  }

  function getGoals() {
    if (window.CortexFreelancer && typeof window.CortexFreelancer.getGoals === 'function') {
      return window.CortexFreelancer.getGoals();
    }
    return null;
  }

  function getSessionId() {
    if (!currentSessionId) {
      // Try to resume last session
      var sessions = window.CortexChatSessions ? window.CortexChatSessions.listSessions() : [];
      if (sessions.length > 0 && sessions[0].msgCount < 50) {
        currentSessionId = sessions[0].id;
      } else {
        currentSessionId = window.CortexChatSessions ? window.CortexChatSessions.uuid() : 'session_' + Date.now();
      }
    }
    return currentSessionId;
  }

  function newSession() {
    currentSessionId = window.CortexChatSessions ? window.CortexChatSessions.uuid() : 'session_' + Date.now();
    return currentSessionId;
  }

  async function send(message) {
    // Rate limit
    if (window.CortexChatLimiter && !window.CortexChatLimiter.canSend()) {
      return { reply: '⚡ Daily message limit reached. Upgrade to Pro for 200 messages/day! → /pricing', _limited: true };
    }

    var sid = getSessionId();
    var profile = getProfile();
    var goals = getGoals();
    var history = window.CortexChatSessions ? window.CortexChatSessions.getHistory(sid, 10) : [];

    // Save user message
    if (window.CortexChatSessions) {
      window.CortexChatSessions.getOrCreate(sid);
      window.CortexChatSessions.addMessage(sid, { role: 'user', content: message });
    }

    // Record usage
    if (window.CortexChatLimiter) window.CortexChatLimiter.record();

    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          sessionId: sid,
          profile: profile,
          goals: goals,
          history: history.map(function (m) { return { role: m.role, content: m.content }; })
        })
      });

      var data = await res.json();

      // Save AI response
      if (window.CortexChatSessions && data.reply) {
        window.CortexChatSessions.addMessage(sid, { role: 'assistant', content: data.reply });
      }

      if (data.sessionId) currentSessionId = data.sessionId;

      return { reply: data.reply || 'No response received.', sessionId: currentSessionId };
    } catch (e) {
      console.error('Chat dispatch error:', e);
      return { reply: 'Connection error. Please check your internet and try again. 🔄', _error: true };
    }
  }

  window.CortexChatDispatcher = { send: send, getSessionId: getSessionId, newSession: newSession };
})();
