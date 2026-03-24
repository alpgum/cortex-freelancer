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
  // Fetch-based transports (SSE/HTTP/chunked) can be aborted via AbortController
  var activeFetchControllers = {};
  var sseSupported = typeof EventSource !== 'undefined';
  var sseFailed = false;
  var chunkedFailed = false;

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
    // CFX-041: prefer persistent SessionManager session id
    if (window.CortexSessionManager && typeof window.CortexSessionManager.getSessionId === 'function') {
      currentSessionId = window.CortexSessionManager.getSessionId();
      return currentSessionId;
    }

    // Legacy fallback
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
    // CFX-041: start a fresh session (best-effort)
    if (window.CortexSessionManager && typeof window.CortexSessionManager.clearSession === 'function') {
      try {
        window.CortexSessionManager.clearSession().then(function (sid) {
          currentSessionId = sid;
        });
        currentSessionId = window.CortexSessionManager.getSessionId();
        return currentSessionId;
      } catch (_e) {}
    }

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

    // Connection state changes → UI (+ analytics)
    reconnect.on('stateChange', function (info) {
      if (window.CortexChat && window.CortexChat.onConnectionChange) {
        window.CortexChat.onConnectionChange(info.to, info);
      }
      if (window.CortexAnalytics && window.CortexAnalytics.track) {
        window.CortexAnalytics.track('connection', 'ws_state_change', {
          transport: 'ws',
          meta: { kind: info.to }
        });
      }
    });

    // On reconnect, pending requests that were in-flight are lost — reject them
    reconnect.on('reconnecting', function (info) {
      rejectPendingRequests('Connection lost. Reconnecting (attempt ' + info.attempt + '/' + info.maxAttempts + ')...');
      if (window.CortexAnalytics && window.CortexAnalytics.track) {
        window.CortexAnalytics.track('connection', 'ws_reconnecting', {
          transport: 'ws',
          meta: { kind: 'reconnecting' }
        });
      }
    });

    reconnect.on('failed', function (info) {
      rejectPendingRequests(info.message || 'Connection failed after ' + info.attempts + ' attempts.');
      if (window.CortexAnalytics && window.CortexAnalytics.track) {
        window.CortexAnalytics.track('error', 'ws_failed', {
          transport: 'ws',
          meta: { kind: 'failed', errorCode: 'WS_FAILED' }
        });
      }
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
      // CFX-007: Wrap string errors as structured objects for error handler
      var errorObj = typeof errorMsg === 'string'
        ? { code: 'E101', error: errorMsg, hint: 'The connection will retry automatically.', retryable: true }
        : errorMsg;
      if (h.onError) h.onError(errorObj);
      if (h.resolve) h.resolve({ reply: errorObj.error || errorMsg, _error: true, _retryable: true });
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
          var totalMs = handler._t0 ? (Date.now() - handler._t0) : null;
          if (window.CortexAnalytics && window.CortexAnalytics.track) {
            window.CortexAnalytics.track('chat', 'message_received', {
              transport: handler._transport || 'ws',
              perf: { totalMs: totalMs }
            });
          }
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
          // CFX-007: Pass full structured error (code, hint, retryable) to handler
          var errorPayload = data.code ? data : (data.error || 'An error occurred.');
          if (window.CortexAnalytics && window.CortexAnalytics.track) {
            window.CortexAnalytics.track('error', 'chat_error', {
              transport: handler._transport || 'ws',
              meta: { kind: 'chat', errorCode: data.code || 'E_UNKNOWN', retryable: data.retryable }
            });
          }
          if (handler.onError) handler.onError(errorPayload);
          if (handler.resolve) handler.resolve({
            reply: data.error || 'An error occurred.',
            _error: true,
            _errorCode: data.code,
            _retryable: data.retryable,
            _hint: data.hint,
          });
          delete pendingRequests[rid];
        }
        break;
    }
  }

  /* ── Send via WebSocket (through reconnect manager) ── */

  function sendViaWebSocket(message, callbacks, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var rid = options.requestId || options.clientRequestId || generateRequestId();
      var sid = getSessionId();

      pendingRequests[rid] = {
        resolve: resolve,
        onStreamStart: callbacks.onStreamStart || null,
        onChunk: callbacks.onChunk || null,
        onDone: callbacks.onDone || null,
        onError: callbacks.onError || null,
        onQueued: callbacks.onQueued || null,
        _t0: Date.now(),
        _transport: 'ws'
      };

      var sent = window.CortexWsReconnect.send({
        type: 'chat',
        message: message,
        sessionId: sid,
        profile: getProfile(),
        goals: getGoals(),
        requestId: rid
      });

      if (window.CortexAnalytics && window.CortexAnalytics.track) {
        window.CortexAnalytics.track('chat', 'message_sent', { transport: 'ws' });
      }

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

  function sendViaSSE(message, callbacks, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var sid = getSessionId();
      var profile = getProfile();
      var goals = getGoals();
      var requestId = options.requestId || options.clientRequestId || generateRequestId();
      var controller = new AbortController();
      activeFetchControllers[requestId] = controller;

      // Bridge external AbortSignal → internal controller
      if (options.signal && typeof options.signal.addEventListener === 'function') {
        try {
          if (options.signal.aborted) controller.abort();
          else options.signal.addEventListener('abort', function () { controller.abort(); }, { once: true });
        } catch (e) { /* best-effort */ }
      }

      var resolved = false;
      var t0 = Date.now();
      if (window.CortexAnalytics && window.CortexAnalytics.track) {
        window.CortexAnalytics.track('chat', 'message_sent', { transport: 'sse' });
      }

      function done(result) {
        if (resolved) return;
        resolved = true;
        try { delete activeFetchControllers[requestId]; } catch (_) {}
        var totalMs = t0 ? (Date.now() - t0) : null;
        if (window.CortexAnalytics && window.CortexAnalytics.track) {
          if (result && result._error) {
            window.CortexAnalytics.track('error', 'chat_error', { transport: 'sse', meta: { kind: 'chat', errorCode: result._errorCode || 'SSE_ERROR', retryable: result._retryable } });
          } else {
            window.CortexAnalytics.track('chat', 'message_received', { transport: 'sse', perf: { totalMs: totalMs } });
          }
        }
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
          goals: goals,
          requestId: requestId,
          clientRequestId: requestId
        }),
        signal: controller.signal
      }).then(function (res) {
        // CFX-042: observe server rate-limit headers for UI
        try {
          if (window.CortexFreelancer && window.CortexFreelancer.__chatRateLimiter && window.CortexFreelancer.__chatRateLimiter.observeResponse) {
            window.CortexFreelancer.__chatRateLimiter.observeResponse(res);
          }
        } catch (_e0) {}

        if (!res.ok) {
          sseFailed = true;
          clearTimeout(timeout);
          return res.json().then(function (data) {
            // If rate limited, hint limiter to wait.
            try {
              if (res.status === 429) {
                var ra = res.headers.get('Retry-After');
                if (ra && window.CortexFreelancer && window.CortexFreelancer.__chatRateLimiter && window.CortexFreelancer.__chatRateLimiter.setServerWait) {
                  window.CortexFreelancer.__chatRateLimiter.setServerWait(parseInt(ra, 10) || 1);
                }
              }
            } catch (_e1) {}
            done({ reply: data.error || 'SSE unavailable', _error: true, _sseFailed: true, retryAfter: data.retryAfter });
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
              if (err && err.name === 'AbortError') {
                done({ reply: 'Request cancelled.', _aborted: true });
              } else {
                done({ reply: 'Connection error.', _error: true });
              }
            }
          });
        }

        pump();
      }).catch(function (err) {
        clearTimeout(timeout);
        if (err && err.name === 'AbortError') {
          done({ reply: 'Request cancelled.', _aborted: true });
          return;
        }
        sseFailed = true;
        done({ reply: 'Connection error.', _error: true, _sseFailed: true });
      });
    });
  }

  /* ── Send via HTTP Chunked Transfer (CFX-023 fallback) ── */

  function sendViaChunked(message, callbacks, options) {
    options = options || {};
    var ChunkedStream = window.CortexFreelancer && window.CortexFreelancer.ChunkedStream;
    if (!ChunkedStream || !ChunkedStream.isSupported() || ChunkedStream.hasFailed()) {
      chunkedFailed = true;
      return Promise.resolve({ reply: 'Chunked transfer unavailable', _error: true, _chunkedFailed: true });
    }

    var sid = getSessionId();
    var requestId = options.requestId || options.clientRequestId || null;
    var t0 = Date.now();
    if (window.CortexAnalytics && window.CortexAnalytics.track) {
      window.CortexAnalytics.track('chat', 'message_sent', { transport: 'chunked' });
    }
    return ChunkedStream.streamMessage(message, {
      sessionId: sid,
      requestId: requestId,
      signal: options.signal,
      profile: getProfile(),
      goals: getGoals(),
      onStart: callbacks.onStreamStart || null,
      onChunk: callbacks.onChunk || null,
      onDone: function (reply, meta) {
        if (meta && meta.sessionId) currentSessionId = meta.sessionId;
        if (window.CortexAnalytics && window.CortexAnalytics.track) {
          window.CortexAnalytics.track('chat', 'message_received', { transport: 'chunked', perf: { totalMs: Date.now() - t0 } });
        }
        if (callbacks.onDone) callbacks.onDone(reply, meta);
      },
      onError: function (err) {
        if (window.CortexAnalytics && window.CortexAnalytics.track) {
          window.CortexAnalytics.track('error', 'chat_error', { transport: 'chunked', meta: { kind: 'chat', errorCode: 'CHUNKED_ERROR' } });
        }
        if (callbacks.onError) callbacks.onError(err);
      },
    }).then(function (result) {
      if (result._chunkedFailed) {
        chunkedFailed = true;
      }
      if (result.sessionId) currentSessionId = result.sessionId;
      return result;
    });
  }

  /* ── Send via HTTP (last resort fallback) ── */

  async function sendViaHttp(message, options) {
    options = options || {};
    var sid = getSessionId();
    var profile = getProfile();
    var goals = getGoals();
    var history = window.CortexChatSessions ? window.CortexChatSessions.getHistory(sid, 10) : [];

    var requestId = options.requestId || options.clientRequestId || generateRequestId();
    var controller = new AbortController();
    activeFetchControllers[requestId] = controller;

    if (options.signal && typeof options.signal.addEventListener === 'function') {
      try {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener('abort', function () { controller.abort(); }, { once: true });
      } catch (e) { /* best-effort */ }
    }

    try {
      var t0 = Date.now();
      if (window.CortexAnalytics && window.CortexAnalytics.track) {
        window.CortexAnalytics.track('chat', 'message_sent', { transport: 'http' });
      }
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: message,
          sessionId: sid,
          profile: profile,
          goals: goals,
          requestId: requestId,
          clientRequestId: requestId,
          history: history.map(function (m) { return { role: m.role, content: m.content }; })
        })
      });

      // CFX-042: observe server rate-limit headers for UI
      try {
        if (window.CortexFreelancer && window.CortexFreelancer.__chatRateLimiter && window.CortexFreelancer.__chatRateLimiter.observeResponse) {
          window.CortexFreelancer.__chatRateLimiter.observeResponse(res);
        }
        if (res.status === 429) {
          var ra = res.headers.get('Retry-After');
          if (ra && window.CortexFreelancer && window.CortexFreelancer.__chatRateLimiter && window.CortexFreelancer.__chatRateLimiter.setServerWait) {
            window.CortexFreelancer.__chatRateLimiter.setServerWait(parseInt(ra, 10) || 1);
          }
        }
      } catch (_e0) {}

      var data = await res.json();
      if (data.sessionId) currentSessionId = data.sessionId;
      if (window.CortexAnalytics && window.CortexAnalytics.track) {
        if (res.ok) {
          window.CortexAnalytics.track('chat', 'message_received', { transport: 'http', perf: { totalMs: Date.now() - t0 } });
        } else {
          window.CortexAnalytics.track('error', 'chat_error', { transport: 'http', meta: { kind: 'chat', errorCode: 'HTTP_' + res.status } });
        }
      }
      return { reply: data.reply || 'No response received.', sessionId: currentSessionId, meta: data.meta };
    } catch (e) {
      if (e && e.name === 'AbortError') {
        return { reply: 'Request cancelled.', _aborted: true };
      }
      throw e;
    } finally {
      try { delete activeFetchControllers[requestId]; } catch (_) {}
    }

  }

  /* ── Public send() ── */

  async function send(message, callbacks, options) {
    callbacks = callbacks || {};
    options = options || {};

    // Stable id across transport fallback (prevents accidental double-submit semantics)
    var clientRequestId = options.requestId || options.clientRequestId || generateRequestId();
    options.clientRequestId = clientRequestId;
    if (!options.requestId) options.requestId = clientRequestId;

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
        result = await sendViaWebSocket(message, callbacks, options);
      } else if (window.CortexWsReconnect && window.CortexWsReconnect.getState() === 'reconnecting') {
        // WS is reconnecting — queue message via reconnect manager and use WS path
        // The message will be sent once connection is re-established
        result = await sendViaWebSocket(message, callbacks, options);
      } else if (sseSupported && !sseFailed) {
        // Tier 2: SSE — streaming fallback when WS unavailable
        result = await sendViaSSE(message, callbacks, options);
        if (result._sseFailed) {
          // Tier 3: Chunked Transfer — streaming over plain HTTP (CFX-023)
          result = await sendViaChunked(message, callbacks, options);
          if (result._chunkedFailed) {
            result = await sendViaHttp(message, options);
          }
        }
      } else if (!chunkedFailed) {
        // Tier 3: Chunked Transfer — streaming over plain HTTP (CFX-023)
        result = await sendViaChunked(message, callbacks, options);
        if (result._chunkedFailed) {
          result = await sendViaHttp(message, options);
        }
      } else {
        // Tier 4: HTTP — no streaming, last resort
        result = await sendViaHttp(message, options);
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
    if (!chunkedFailed && window.CortexFreelancer && window.CortexFreelancer.ChunkedStream && window.CortexFreelancer.ChunkedStream.isSupported()) return 'chunked';
    return 'http';
  }

  /* ── Cancellation (best-effort) ── */

  function cancelRequest(requestId) {
    if (!requestId) return false;

    // WS/WebRTC style pending request
    var h = pendingRequests[requestId];
    if (h) {
      try {
        if (h.onError) h.onError({ code: 'CANCELLED', error: 'Request cancelled.', hint: 'Cancelled by user.', retryable: false });
        if (h.resolve) h.resolve({ reply: 'Request cancelled.', _aborted: true });
      } catch (_) {}
      delete pendingRequests[requestId];
    }

    // Fetch-based controllers
    var ctrl = activeFetchControllers[requestId];
    if (ctrl) {
      try { ctrl.abort(); } catch (_) {}
      try { delete activeFetchControllers[requestId]; } catch (_) {}
    }

    // Chunked transfer stream (single active stream)
    try {
      if (window.CortexFreelancer && window.CortexFreelancer.ChunkedStream && window.CortexFreelancer.ChunkedStream.isStreaming()) {
        window.CortexFreelancer.ChunkedStream.abort();
      }
    } catch (_) {}

    // Best-effort tell server (may be ignored if unsupported)
    try {
      if (window.CortexWsReconnect) {
        if (window.CortexWsReconnect.removeQueuedByRequestId) {
          window.CortexWsReconnect.removeQueuedByRequestId(requestId);
        }
        window.CortexWsReconnect.send({ type: 'cancel', requestId: requestId, sessionId: getSessionId() });
      }
    } catch (_) {}

    return true;
  }

  /* ── Init ── */
  if (typeof WebSocket !== 'undefined') {
    setTimeout(initWebSocket, 500);
  }

  window.CortexChatDispatcher = {
    send: send,
    cancelRequest: cancelRequest,
    getSessionId: getSessionId,
    newSession: newSession,
    isWebSocketConnected: isWebSocketConnected,
    getConnectionMode: getConnectionMode,
    reconnect: function () {
      if (window.CortexWsReconnect) window.CortexWsReconnect.resetAndReconnect();
    }
  };
})();
