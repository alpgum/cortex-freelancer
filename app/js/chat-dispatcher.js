/**
 * T05c: Chat Dispatcher — WebSocket primary (via ws-reconnect), SSE fallback, HTTP last resort
 * 
 * CFX-004: Refactored to use CortexWsReconnect for robust reconnection.
 * CFX-021: SSE fallback tier retained.
 * 
 * Depends on: ws-reconnect.js (must be loaded first)
 */
(function () {
  'use strict';

  var currentSessionId = null;
  var pendingRequests = {};
  var sseSupported = typeof EventSource !== 'undefined';
  var sseFailed = false;

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

  function generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* ── Wire up CortexWsReconnect events ── */

  function initWebSocket() {
    if (!window.CortexWsReconnect) {
      console.warn('[dispatcher] CortexWsReconnect not loaded, WS disabled');
      return;
    }

    var reconnect = window.CortexWsReconnect;

    // Connection state changes → UI
    reconnect.on('stateChange', function (info) {
      if (window.CortexChat && window.CortexChat.onConnectionChange) {
        window.CortexChat.onConnectionChange(info.to, info);
      }
    });

    // On reconnect, pending requests that were in-flight are lost — reject them
    reconnect.on('reconnecting', function (info) {
      rejectPendingRequests('Connection lost. Reconnecting (attempt ' + info.attempt + '/' + info.maxAttempts + ')...');
    });

    reconnect.on('failed', function (info) {
      rejectPendingRequests(info.message || 'Connection failed after ' + info.attempts + ' attempts.');
    });

    // Route incoming messages
    reconnect.on('message', function (data) {
      handleWsMessage(data);
    });

    // Start connection
    reconnect.connect();
  }

  function rejectPendingRequests(errorMsg) {
    Object.keys(pendingRequests).forEach(function (rid) {
      var h = pendingRequests[rid];
      if (h.onError) h.onError(errorMsg);
      if (h.resolve) h.resolve({ reply: errorMsg, _error: true });
      delete pendingRequests[rid];
    });
  }

  function handleWsMessage(data) {
    var rid = data.requestId;
    var handler = rid ? pendingRequests[rid] : null;

    switch (data.type) {
      case 'connected':
        // Server welcome
        break;

      case 'pong':
        // Handled by ws-reconnect
        break;

      case 'keepalive':
        // Server processing keepalive — no action needed
        break;

      case 'stream_start':
        if (handler && handler.onStreamStart) handler.onStreamStart(data);
        break;

      case 'stream_chunk':
        if (handler && handler.onChunk) handler.onChunk(data.chunk, data.index);
        break;

      case 'stream_end':
        if (data.sessionId) currentSessionId = data.sessionId;
        if (handler) {
          if (handler.onDone) handler.onDone(data.reply, data.meta);
          if (handler.resolve) handler.resolve({ reply: data.reply, sessionId: currentSessionId, meta: data.meta });
          delete pendingRequests[rid];
        }
        break;

      case 'queued':
        if (handler && handler.onQueued) handler.onQueued(data.position);
        break;

      case 'error':
        if (handler) {
          if (handler.onError) handler.onError(data.error);
          if (handler.resolve) handler.resolve({ reply: data.error || 'An error occurred.', _error: true });
          delete pendingRequests[rid];
        }
        break;
    }
  }

  /* ── Send via WebSocket (through reconnect manager) ── */

  function sendViaWebSocket(message, callbacks) {
    return new Promise(function (resolve) {
      var rid = generateRequestId();
      var sid = getSessionId();

      pendingRequests[rid] = {
        resolve: resolve,
        onStreamStart: callbacks.onStreamStart || null,
        onChunk: callbacks.onChunk || null,
        onDone: callbacks.onDone || null,
        onError: callbacks.onError || null,
        onQueued: callbacks.onQueued || null
      };

      var sent = window.CortexWsReconnect.send({
        type: 'chat',
        message: message,
        sessionId: sid,
        profile: getProfile(),
        goals: getGoals(),
        requestId: rid
      });

      // If message was queued (not sent immediately), notify caller
      if (!sent && callbacks.onQueued) {
        callbacks.onQueued('waiting');
      }

      // Timeout safety — if no response in 2.5 minutes
      setTimeout(function () {
        if (pendingRequests[rid]) {
          if (pendingRequests[rid].onError) pendingRequests[rid].onError('Request timed out. Please try again.');
          pendingRequests[rid].resolve({ reply: 'Request timed out. Please try again.', _error: true });
          delete pendingRequests[rid];
        }
      }, 150000);
    });
  }

  /* ── Send via SSE (streaming fallback) ── */

  function sendViaSSE(message, callbacks) {
    return new Promise(function (resolve) {
      var sid = getSessionId();
      var profile = getProfile();
      var goals = getGoals();
      var controller = new AbortController();
      var resolved = false;

      function done(result) {
        if (resolved) return;
        resolved = true;
        resolve(result);
      }

      var timeout = setTimeout(function () {
        controller.abort();
        done({ reply: 'Request timed out. Please try again.', _error: true });
      }, 130000);

      fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          sessionId: sid,
          profile: profile,
          goals: goals
        }),
        signal: controller.signal
      }).then(function (res) {
        if (!res.ok) {
          sseFailed = true;
          clearTimeout(timeout);
          return res.json().then(function (data) {
            done({ reply: data.error || 'SSE unavailable', _error: true, _sseFailed: true });
          });
        }

        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        if (callbacks.onStreamStart) callbacks.onStreamStart();

        function processSSE(text) {
          buffer += text;
          var lines = buffer.split('\n');
          buffer = lines.pop() || '';

          var currentEvent = null;
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('event: ') === 0) {
              currentEvent = line.slice(7).trim();
            } else if (line.indexOf('data: ') === 0) {
              var raw = line.slice(6);
              var payload;
              try { payload = JSON.parse(raw); } catch (e) { continue; }

              if (currentEvent === 'stream_chunk') {
                if (callbacks.onChunk) callbacks.onChunk(payload.chunk, payload.index);
              } else if (currentEvent === 'stream_end') {
                if (payload.sessionId) currentSessionId = payload.sessionId;
                if (callbacks.onDone) callbacks.onDone(payload.reply, payload.meta);
                clearTimeout(timeout);
                done({ reply: payload.reply, sessionId: currentSessionId, meta: payload.meta });
              } else if (currentEvent === 'error') {
                if (callbacks.onError) callbacks.onError(payload.error);
                clearTimeout(timeout);
                done({ reply: payload.error || 'An error occurred.', _error: true });
              }
              currentEvent = null;
            }
          }
        }

        function pump() {
          reader.read().then(function (result) {
            if (result.done) {
              if (!resolved) {
                clearTimeout(timeout);
                done({ reply: 'Stream ended unexpectedly.', _error: true });
              }
              return;
            }
            processSSE(decoder.decode(result.value, { stream: true }));
            pump();
          }).catch(function (err) {
            if (!resolved) {
              clearTimeout(timeout);
              done({ reply: 'Connection error.', _error: true });
            }
          });
        }

        pump();
      }).catch(function (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') return;
        sseFailed = true;
        done({ reply: 'Connection error.', _error: true, _sseFailed: true });
      });
    });
  }

  /* ── Send via HTTP (last resort fallback) ── */

  async function sendViaHttp(message) {
    var sid = getSessionId();
    var profile = getProfile();
    var goals = getGoals();
    var history = window.CortexChatSessions ? window.CortexChatSessions.getHistory(sid, 10) : [];

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
    if (data.sessionId) currentSessionId = data.sessionId;
    return { reply: data.reply || 'No response received.', sessionId: currentSessionId, meta: data.meta };
  }

  /* ── Public send() ── */

  async function send(message, callbacks) {
    callbacks = callbacks || {};

    // Rate limit
    if (window.CortexChatLimiter && !window.CortexChatLimiter.canSend()) {
      return { reply: '⚡ Daily message limit reached. Upgrade to Pro for 200 messages/day! → /pricing', _limited: true };
    }

    // Save user message
    var sid = getSessionId();
    if (window.CortexChatSessions) {
      window.CortexChatSessions.getOrCreate(sid);
      window.CortexChatSessions.addMessage(sid, { role: 'user', content: message });
    }
    if (window.CortexChatLimiter) window.CortexChatLimiter.record();

    try {
      var result;
      var wsConnected = window.CortexWsReconnect && window.CortexWsReconnect.isConnected();

      if (wsConnected) {
        // Tier 1: WebSocket — full streaming
        result = await sendViaWebSocket(message, callbacks);
      } else if (window.CortexWsReconnect && window.CortexWsReconnect.getState() === 'reconnecting') {
        // WS is reconnecting — queue message via reconnect manager and use WS path
        // The message will be sent once connection is re-established
        result = await sendViaWebSocket(message, callbacks);
      } else if (sseSupported && !sseFailed) {
        // Tier 2: SSE — streaming fallback when WS unavailable
        result = await sendViaSSE(message, callbacks);
        if (result._sseFailed) {
          result = await sendViaHttp(message);
        }
      } else {
        // Tier 3: HTTP — no streaming, last resort
        result = await sendViaHttp(message);
      }

      // Save AI response
      if (window.CortexChatSessions && result.reply && !result._error) {
        window.CortexChatSessions.addMessage(sid, { role: 'assistant', content: result.reply });
      }

      return result;
    } catch (e) {
      console.error('Chat dispatch error:', e);
      return { reply: 'Connection error. Please check your internet and try again.', _error: true };
    }
  }

  function isWebSocketConnected() {
    return window.CortexWsReconnect ? window.CortexWsReconnect.isConnected() : false;
  }

  function getConnectionMode() {
    if (isWebSocketConnected()) return 'websocket';
    if (window.CortexWsReconnect && window.CortexWsReconnect.getState() === 'reconnecting') return 'reconnecting';
    if (sseSupported && !sseFailed) return 'sse';
    return 'http';
  }

  /* ── Init ── */
  if (typeof WebSocket !== 'undefined') {
    setTimeout(initWebSocket, 500);
  }

  window.CortexChatDispatcher = {
    send: send,
    getSessionId: getSessionId,
    newSession: newSession,
    isWebSocketConnected: isWebSocketConnected,
    getConnectionMode: getConnectionMode,
    reconnect: function () {
      if (window.CortexWsReconnect) window.CortexWsReconnect.resetAndReconnect();
    }
  };
})();
