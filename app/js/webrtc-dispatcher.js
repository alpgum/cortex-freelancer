/**
 * CFX-025: WebRTC-Enhanced Chat Dispatcher
 * 
 * Enhanced dispatcher with WebRTC as primary transport tier:
 * Tier 1: WebRTC P2P data channel (lowest latency)
 * Tier 2: WebSocket (existing fallback)
 * Tier 3: SSE (server-sent events)
 * Tier 4: HTTP chunked transfer
 * Tier 5: HTTP (last resort)
 * 
 * Features:
 * - WebRTC transport auto-detection and connection
 * - Graceful fallback cascade with error handling
 * - Connection health monitoring across all transports
 * - Transport preference storage and recovery
 */
(function () {
  'use strict';

  var currentSessionId = null;
  var pendingRequests = {};
  // Fetch-based transports can be aborted via AbortController
  var activeFetchControllers = {};
  var webrtcClient = null;
  var webrtcConnected = false;
  var webrtcFailed = false;
  var sseSupported = typeof EventSource !== 'undefined';
  var sseFailed = false;
  var chunkedFailed = false;

  // Transport states
  var TransportStates = {
    WEBRTC: 'webrtc',
    WEBSOCKET: 'websocket',
    RECONNECTING: 'reconnecting',
    SSE: 'sse',
    CHUNKED: 'chunked',
    HTTP: 'http'
  };

  // Configuration
  var config = {
    webrtcConnectionTimeout: 15000,  // 15s to establish WebRTC
    webrtcRetryDelay: 5000,          // 5s between WebRTC retry attempts
    webrtcMaxRetries: 3,             // Max WebRTC connection attempts
    enableWebRTC: true               // Can be disabled via localStorage
  };

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

  /* ── WebRTC Transport Layer ── */

  function initWebRTC() {
    // Check if WebRTC is disabled or unavailable
    if (!config.enableWebRTC || 
        !window.CortexWebRTCClient || 
        !window.CortexWebRTCClient.isSupported() ||
        webrtcFailed) {
      console.log('[webrtc-dispatcher] WebRTC unavailable or disabled');
      return;
    }

    console.log('[webrtc-dispatcher] Initializing WebRTC transport');

    try {
      webrtcClient = new window.CortexWebRTCClient();

      // Setup event handlers
      webrtcClient.on('connected', function() {
        console.log('[webrtc-dispatcher] WebRTC connected');
        webrtcConnected = true;
        updateConnectionStatus();
      });

      webrtcClient.on('disconnected', function() {
        console.log('[webrtc-dispatcher] WebRTC disconnected');
        webrtcConnected = false;
        updateConnectionStatus();
      });

      webrtcClient.on('error', function(error) {
        console.error('[webrtc-dispatcher] WebRTC error:', error);
        
        if (error.code === 'CONNECTION_TIMEOUT' || 
            error.code === 'CONNECTION_ERROR') {
          webrtcFailed = true;
          // Try to reconnect after delay
          setTimeout(function() {
            if (!webrtcConnected) {
              retryWebRTCConnection();
            }
          }, config.webrtcRetryDelay);
        }
      });

      webrtcClient.on('message', function(data) {
        handleWebRTCMessage(data);
      });

      // Start connection
      webrtcClient.connect()
        .then(function() {
          console.log('[webrtc-dispatcher] WebRTC connection established');
        })
        .catch(function(err) {
          console.warn('[webrtc-dispatcher] WebRTC connection failed:', err.message);
          webrtcFailed = true;
        });

    } catch (err) {
      console.error('[webrtc-dispatcher] Failed to initialize WebRTC:', err);
      webrtcFailed = true;
    }
  }

  function retryWebRTCConnection() {
    if (webrtcClient && !webrtcConnected && config.webrtcMaxRetries > 0) {
      console.log('[webrtc-dispatcher] Retrying WebRTC connection');
      config.webrtcMaxRetries--;
      webrtcFailed = false;
      
      webrtcClient.connect()
        .catch(function(err) {
          console.warn('[webrtc-dispatcher] WebRTC retry failed:', err.message);
          webrtcFailed = true;
        });
    }
  }

  function handleWebRTCMessage(data) {
    var rid = data.requestId;
    var handler = rid ? pendingRequests[rid] : null;

    switch (data.type) {
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
          if (handler.resolve) handler.resolve({ 
            reply: data.reply, 
            sessionId: currentSessionId, 
            meta: data.meta 
          });
          delete pendingRequests[rid];
        }
        break;

      case 'error':
        if (handler) {
          var errorPayload = data.code ? data : (data.error || 'An error occurred.');
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

  function sendViaWebRTC(message, callbacks, options) {
    options = options || {};
    if (!webrtcClient || !webrtcConnected) {
      return Promise.reject(new Error('WebRTC not available'));
    }

    return new Promise(function (resolve) {
      var rid = options.requestId || options.clientRequestId || generateRequestId();
      var sid = getSessionId();

      // Allow cancellation via AbortSignal
      if (options.signal && typeof options.signal.addEventListener === 'function') {
        try {
          if (options.signal.aborted) {
            resolve({ reply: 'Request cancelled.', _aborted: true });
            return;
          }
          options.signal.addEventListener('abort', function () {
            try {
              // Best-effort: tell peer
              if (webrtcClient) {
                webrtcClient.send({ type: 'cancel', requestId: rid, sessionId: sid });
              }
            } catch (_) {}
            try {
              if (pendingRequests[rid] && pendingRequests[rid].resolve) {
                pendingRequests[rid].resolve({ reply: 'Request cancelled.', _aborted: true });
              }
            } catch (_) {}
            try { delete pendingRequests[rid]; } catch (_) {}
          }, { once: true });
        } catch (e) { /* best-effort */ }
      }

      pendingRequests[rid] = {
        resolve: resolve,
        onStreamStart: callbacks.onStreamStart || null,
        onChunk: callbacks.onChunk || null,
        onDone: callbacks.onDone || null,
        onError: callbacks.onError || null,
        onQueued: callbacks.onQueued || null
      };

      var sent = webrtcClient.send({
        type: 'chat',
        message: message,
        sessionId: sid,
        profile: getProfile(),
        goals: getGoals(),
        requestId: rid
      });

      if (!sent && callbacks.onQueued) {
        callbacks.onQueued('WebRTC message queued');
      }

      // Timeout safety
      setTimeout(function () {
        if (pendingRequests[rid]) {
          if (pendingRequests[rid].onError) {
            pendingRequests[rid].onError('WebRTC request timed out');
          }
          pendingRequests[rid].resolve({ 
            reply: 'Request timed out. Falling back to WebSocket.', 
            _error: true,
            _retryable: true
          });
          delete pendingRequests[rid];
        }
      }, 120000); // 2 minute timeout
    });
  }

  /* ── WebSocket Layer (existing, unchanged) ── */

  function initWebSocket() {
    if (!window.CortexWsReconnect) {
      console.warn('[webrtc-dispatcher] CortexWsReconnect not loaded, WS disabled');
      return;
    }

    var reconnect = window.CortexWsReconnect;

    reconnect.on('stateChange', function (info) {
      updateConnectionStatus();
      if (window.CortexChat && window.CortexChat.onConnectionChange) {
        window.CortexChat.onConnectionChange(info.to, info);
      }
    });

    reconnect.on('reconnecting', function (info) {
      rejectPendingRequests('Connection lost. Reconnecting (attempt ' + info.attempt + '/' + info.maxAttempts + ')...');
    });

    reconnect.on('failed', function (info) {
      rejectPendingRequests(info.message || 'Connection failed after ' + info.attempts + ' attempts.');
    });

    reconnect.on('message', function (data) {
      handleWebSocketMessage(data);
    });

    reconnect.connect();
  }

  function handleWebSocketMessage(data) {
    var rid = data.requestId;
    var handler = rid ? pendingRequests[rid] : null;

    switch (data.type) {
      case 'connected':
        break;

      case 'pong':
        break;

      case 'keepalive':
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
          if (handler.resolve) handler.resolve({ 
            reply: data.reply, 
            sessionId: currentSessionId, 
            meta: data.meta 
          });
          delete pendingRequests[rid];
        }
        break;

      case 'queued':
        if (handler && handler.onQueued) handler.onQueued(data.position);
        break;

      case 'error':
        if (handler) {
          var errorPayload = data.code ? data : (data.error || 'An error occurred.');
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

  function rejectPendingRequests(errorMsg) {
    Object.keys(pendingRequests).forEach(function (rid) {
      var h = pendingRequests[rid];
      var errorObj = typeof errorMsg === 'string'
        ? { code: 'E101', error: errorMsg, hint: 'The connection will retry automatically.', retryable: true }
        : errorMsg;
      if (h.onError) h.onError(errorObj);
      if (h.resolve) h.resolve({ 
        reply: errorObj.error || errorMsg, 
        _error: true, 
        _retryable: true 
      });
      delete pendingRequests[rid];
    });
  }

  function sendViaWebSocket(message, callbacks, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var rid = options.requestId || options.clientRequestId || generateRequestId();
      var sid = getSessionId();

      if (options.signal && typeof options.signal.addEventListener === 'function') {
        try {
          if (options.signal.aborted) {
            resolve({ reply: 'Request cancelled.', _aborted: true });
            return;
          }
          options.signal.addEventListener('abort', function () {
            try {
              if (window.CortexWsReconnect) {
                window.CortexWsReconnect.send({ type: 'cancel', requestId: rid, sessionId: sid });
              }
            } catch (_) {}
            try {
              if (pendingRequests[rid] && pendingRequests[rid].resolve) {
                pendingRequests[rid].resolve({ reply: 'Request cancelled.', _aborted: true });
              }
            } catch (_) {}
            try { delete pendingRequests[rid]; } catch (_) {}
          }, { once: true });
        } catch (e) { /* best-effort */ }
      }

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

      if (!sent && callbacks.onQueued) {
        callbacks.onQueued('waiting');
      }

      setTimeout(function () {
        if (pendingRequests[rid]) {
          if (pendingRequests[rid].onError) {
            pendingRequests[rid].onError('Request timed out. Please try again.');
          }
          pendingRequests[rid].resolve({ 
            reply: 'Request timed out. Please try again.', 
            _error: true 
          });
          delete pendingRequests[rid];
        }
      }, 150000);
    });
  }

  /* ── SSE & HTTP Layers (existing, unchanged) ── */
  // [SSE and HTTP implementations remain the same as the original dispatcher]

  function sendViaSSE(message, callbacks, options) {
    options = options || {};
    if (!sseSupported || sseFailed) {
      return Promise.resolve({ 
        reply: 'SSE not available', 
        _error: true, 
        _sseFailed: true 
      });
    }

    var sid = getSessionId();
    var profile = getProfile();
    var goals = getGoals();
    var requestId = options.requestId || options.clientRequestId || generateRequestId();

    var controller = new AbortController();
    activeFetchControllers[requestId] = controller;

    if (options.signal && typeof options.signal.addEventListener === 'function') {
      try {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener('abort', function () { controller.abort(); }, { once: true });
      } catch (e) { /* best-effort */ }
    }

    var decoder = new TextDecoder();
    var resolved = false;

    return new Promise(function (done) {
      function finish(result) {
        if (resolved) return;
        resolved = true;
        try { delete activeFetchControllers[requestId]; } catch (_) {}
        done(result);
      }

      var timeout = setTimeout(function () {
        try { controller.abort(); } catch (_) {}
        finish({ reply: 'Request timed out.', _error: true });
      }, 150000);

      fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: message,
          sessionId: sid,
          profile: profile,
          goals: goals,
          requestId: requestId,
          clientRequestId: requestId
        })
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var reader = res.body.getReader();

        var currentEvent = null;

        function processSSE(chunk) {
          var lines = chunk.split('\n');
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
                finish({ 
                  reply: payload.reply, 
                  sessionId: currentSessionId, 
                  meta: payload.meta 
                });
              } else if (currentEvent === 'error') {
                if (callbacks.onError) callbacks.onError(payload.error);
                clearTimeout(timeout);
                finish({ 
                  reply: payload.error || 'An error occurred.', 
                  _error: true 
                });
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
                finish({ reply: 'Stream ended unexpectedly.', _error: true });
              }
              return;
            }
            processSSE(decoder.decode(result.value, { stream: true }));
            pump();
          }).catch(function (err) {
            if (!resolved) {
              clearTimeout(timeout);
              if (err && err.name === 'AbortError') {
                finish({ reply: 'Request cancelled.', _aborted: true });
              } else {
                finish({ reply: 'Connection error.', _error: true });
              }
            }
          });
        }

        pump();
      }).catch(function (err) {
        clearTimeout(timeout);
        if (err && err.name === 'AbortError') {
          finish({ reply: 'Request cancelled.', _aborted: true });
          return;
        }
        sseFailed = true;
        finish({ reply: 'Connection error.', _error: true, _sseFailed: true });
      });
    });
  }

  function sendViaChunked(message, callbacks, options) {
    options = options || {};
    var ChunkedStream = window.CortexFreelancer && window.CortexFreelancer.ChunkedStream;
    if (!ChunkedStream || !ChunkedStream.isSupported() || ChunkedStream.hasFailed()) {
      chunkedFailed = true;
      return Promise.resolve({ 
        reply: 'Chunked transfer unavailable', 
        _error: true, 
        _chunkedFailed: true 
      });
    }

    var sid = getSessionId();
    var requestId = options.requestId || options.clientRequestId || null;
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
        if (callbacks.onDone) callbacks.onDone(reply, meta);
      },
      onError: function (err) {
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

  async function sendViaHttp(message, options) {
    options = options || {};
    var sid = getSessionId();
    var profile = getProfile();
    var goals = getGoals();
    var history = window.CortexChatSessions ? 
      window.CortexChatSessions.getHistory(sid, 10) : [];

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
          history: history.map(function (m) {
            return { role: m.role, content: m.content };
          })
        })
      });

      var data = await res.json();
      if (data.sessionId) currentSessionId = data.sessionId;
      return {
        reply: data.reply || 'No response received.',
        sessionId: currentSessionId,
        meta: data.meta
      };
    } catch (e) {
      if (e && e.name === 'AbortError') {
        return { reply: 'Request cancelled.', _aborted: true };
      }
      throw e;
    } finally {
      try { delete activeFetchControllers[requestId]; } catch (_) {}
    }
  }

  /* ── Enhanced Transport Selection ── */

  async function send(message, callbacks, options) {
    callbacks = callbacks || {};
    options = options || {};

    // Stable id across transport fallback
    var clientRequestId = options.requestId || options.clientRequestId || generateRequestId();
    options.clientRequestId = clientRequestId;
    if (!options.requestId) options.requestId = clientRequestId;

    // Rate limiting
    if (window.CortexChatLimiter && !window.CortexChatLimiter.canSend()) {
      return { 
        reply: '⚡ Daily message limit reached. Upgrade to Pro for 200 messages/day! → /pricing', 
        _limited: true 
      };
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

      // Tier 1: WebRTC P2P (lowest latency)
      if (webrtcConnected && !webrtcFailed) {
        console.log('[webrtc-dispatcher] Using WebRTC transport');
        try {
          result = await sendViaWebRTC(message, callbacks, options);
        } catch (err) {
          console.warn('[webrtc-dispatcher] WebRTC failed, falling back:', err.message);
          webrtcFailed = true;
        }
      }

      // Tier 2: WebSocket (existing fallback)
      if (!result || result._error) {
        var wsConnected = window.CortexWsReconnect && window.CortexWsReconnect.isConnected();
        
        if (wsConnected) {
          console.log('[webrtc-dispatcher] Using WebSocket transport');
          result = await sendViaWebSocket(message, callbacks, options);
        } else if (window.CortexWsReconnect && 
                   window.CortexWsReconnect.getState() === 'reconnecting') {
          result = await sendViaWebSocket(message, callbacks, options);
        }
      }

      // Tier 3: SSE fallback
      if ((!result || result._error) && sseSupported && !sseFailed) {
        console.log('[webrtc-dispatcher] Using SSE transport');
        result = await sendViaSSE(message, callbacks, options);
        
        if (result._sseFailed) {
          // Tier 4: Chunked Transfer
          if (!chunkedFailed) {
            console.log('[webrtc-dispatcher] Using chunked transport');
            result = await sendViaChunked(message, callbacks, options);
            if (result._chunkedFailed) {
              result = await sendViaHttp(message, options);
            }
          } else {
            result = await sendViaHttp(message, options);
          }
        }
      }

      // Tier 4: Chunked Transfer (if SSE not tried yet)
      if ((!result || result._error) && !chunkedFailed) {
        console.log('[webrtc-dispatcher] Using chunked transport');
        result = await sendViaChunked(message, callbacks, options);
        if (result._chunkedFailed) {
          result = await sendViaHttp(message, options);
        }
      }

      // Tier 5: HTTP (last resort)
      if (!result || result._error) {
        console.log('[webrtc-dispatcher] Using HTTP transport (last resort)');
        result = await sendViaHttp(message, options);
      }

      // Save AI response
      if (window.CortexChatSessions && result.reply && !result._error) {
        window.CortexChatSessions.addMessage(sid, { 
          role: 'assistant', 
          content: result.reply 
        });
      }

      return result;
      
    } catch (e) {
      console.error('[webrtc-dispatcher] Send error:', e);
      return { 
        reply: 'Connection error. Please check your internet and try again.', 
        _error: true 
      };
    }
  }

  /* ── Cancellation (best-effort) ── */

  function cancelRequest(requestId) {
    if (!requestId) return false;

    // Pending streaming requests (WebRTC or WebSocket)
    var h = pendingRequests[requestId];
    if (h) {
      try {
        if (h.onError) h.onError({ code: 'CANCELLED', error: 'Request cancelled.', hint: 'Cancelled by user.', retryable: false });
        if (h.resolve) h.resolve({ reply: 'Request cancelled.', _aborted: true });
      } catch (_) {}
      delete pendingRequests[requestId];
    }

    // Fetch-based
    var ctrl = activeFetchControllers[requestId];
    if (ctrl) {
      try { ctrl.abort(); } catch (_) {}
      try { delete activeFetchControllers[requestId]; } catch (_) {}
    }

    // Chunked
    try {
      if (window.CortexFreelancer && window.CortexFreelancer.ChunkedStream && window.CortexFreelancer.ChunkedStream.isStreaming()) {
        window.CortexFreelancer.ChunkedStream.abort();
      }
    } catch (_) {}

    // Best-effort signal cancel to active transport
    try {
      if (webrtcClient && webrtcConnected) {
        webrtcClient.send({ type: 'cancel', requestId: requestId, sessionId: getSessionId() });
      }
    } catch (_) {}

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

  /* ── Connection Status Management ── */

  function updateConnectionStatus() {
    var mode = getConnectionMode();
    
    if (window.CortexChat && window.CortexChat.onConnectionChange) {
      window.CortexChat.onConnectionChange(mode, {
        webrtc: webrtcConnected,
        websocket: isWebSocketConnected(),
        transport: mode
      });
    }
  }

  function isWebSocketConnected() {
    return window.CortexWsReconnect ? window.CortexWsReconnect.isConnected() : false;
  }

  function getConnectionMode() {
    if (webrtcConnected && !webrtcFailed) return TransportStates.WEBRTC;
    if (isWebSocketConnected()) return TransportStates.WEBSOCKET;
    if (window.CortexWsReconnect && 
        window.CortexWsReconnect.getState() === 'reconnecting') {
      return TransportStates.RECONNECTING;
    }
    if (sseSupported && !sseFailed) return TransportStates.SSE;
    if (!chunkedFailed && 
        window.CortexFreelancer && 
        window.CortexFreelancer.ChunkedStream && 
        window.CortexFreelancer.ChunkedStream.isSupported()) {
      return TransportStates.CHUNKED;
    }
    return TransportStates.HTTP;
  }

  /* ── Initialization ── */

  function init() {
    // Initialize WebRTC first
    if (window.CortexWebRTCClient) {
      setTimeout(initWebRTC, 100);
    }

    // Initialize WebSocket as fallback
    if (typeof WebSocket !== 'undefined') {
      setTimeout(initWebSocket, 500);
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  /* ── Public API ── */

  window.CortexWebRTCDispatcher = {
    send: send,
    cancelRequest: cancelRequest,
    getSessionId: getSessionId,
    newSession: newSession,
    isWebSocketConnected: isWebSocketConnected,
    isWebRTCConnected: function() { return webrtcConnected; },
    getConnectionMode: getConnectionMode,
    getConnectionStats: function() {
      return {
        webrtc: {
          connected: webrtcConnected,
          failed: webrtcFailed,
          stats: webrtcClient ? webrtcClient.getStats() : null
        },
        websocket: {
          connected: isWebSocketConnected(),
          state: window.CortexWsReconnect ? 
            window.CortexWsReconnect.getState() : 'unavailable'
        },
        activeTransport: getConnectionMode()
      };
    },
    reconnect: function () {
      if (webrtcClient && webrtcFailed) {
        webrtcFailed = false;
        config.webrtcMaxRetries = 3;
        retryWebRTCConnection();
      }
      if (window.CortexWsReconnect) {
        window.CortexWsReconnect.resetAndReconnect();
      }
    },
    enableWebRTC: function(enabled) {
      config.enableWebRTC = enabled;
      if (enabled && !webrtcClient && window.CortexWebRTCClient) {
        initWebRTC();
      } else if (!enabled && webrtcClient) {
        webrtcClient.close();
        webrtcClient = null;
        webrtcConnected = false;
      }
      updateConnectionStatus();
    }
  };

  console.log('[webrtc-dispatcher] Enhanced dispatcher loaded with WebRTC support');

})();