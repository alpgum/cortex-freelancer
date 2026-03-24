/**
 * CFX-024: Socket.io Client — Battle-tested real-time transport
 * 
 * Provides CortexSocketIO global with:
 * - Automatic connection with auth
 * - Transport fallback (WebSocket → polling) handled by Socket.io
 * - Built-in reconnection (no custom reconnect logic needed)
 * - Event-based streaming API matching existing dispatcher interface
 * - Connection status management
 * - Integration with CortexChatUI for rendering
 * 
 * Usage:
 *   <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
 *   <script src="/app/js/socketio-client.js"></script>
 *   CortexSocketIO.connect();
 *   CortexSocketIO.sendMessage('How do I price a logo design?');
 * 
 * Depends on: socket.io client library (loaded via CDN or bundled)
 */
(function () {
  'use strict';

  /* ── State ── */
  var socket = null;
  var currentSessionId = null;
  var connectionState = 'disconnected'; // disconnected | connecting | connected | reconnecting
  var listeners = {};
  var pendingMessages = [];
  var transportType = 'unknown';

  /* ── Configuration ── */
  var CONFIG = {
    namespace: '/chat',
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.2,
    timeout: 15000,
    transports: ['websocket', 'polling'], // Try WS first, fall back to polling
  };

  /* ── Event System ── */
  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(function (f) { return f !== fn; });
  }

  function emit(event, data) {
    var fns = listeners[event] || [];
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](data); } catch (e) { console.error('[socketio-client] listener error:', e); }
    }
  }

  /* ── State Management ── */
  function setState(newState) {
    if (connectionState === newState) return;
    var oldState = connectionState;
    connectionState = newState;
    console.log('[socketio-client] ' + oldState + ' → ' + newState);
    emit('stateChange', { from: oldState, to: newState, transport: transportType });
    updateStatusUI(newState);
  }

  function updateStatusUI(state) {
    // Integration with existing connection status display
    var statusEl = document.getElementById('connection-status');
    if (!statusEl) return;

    var labels = {
      disconnected: '⚫ Disconnected',
      connecting: '🟡 Connecting…',
      connected: '🟢 Connected' + (transportType !== 'unknown' ? ' (' + transportType + ')' : ''),
      reconnecting: '🟠 Reconnecting…',
    };

    statusEl.textContent = labels[state] || state;
    statusEl.className = 'connection-status connection-status--' + state;
  }

  /* ── Session Management ── */
  function getSessionId() {
    if (!currentSessionId) {
      // Try existing session store
      if (window.CortexChatSessions) {
        var sessions = window.CortexChatSessions.listSessions();
        if (sessions.length > 0 && sessions[0].msgCount < 50) {
          currentSessionId = sessions[0].id;
        } else {
          currentSessionId = window.CortexChatSessions.uuid();
        }
      } else {
        currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      }
    }
    return currentSessionId;
  }

  function newSession() {
    if (socket && socket.connected) {
      socket.emit('chat:newSession', {}, function (res) {
        if (res && res.sessionId) {
          currentSessionId = res.sessionId;
          emit('newSession', { sessionId: currentSessionId });
        }
      });
    } else {
      currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      emit('newSession', { sessionId: currentSessionId });
    }
    return currentSessionId;
  }

  /* ── Profile / Goals Helpers ── */
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

  /* ── Connect ── */
  function connect(opts) {
    if (socket && socket.connected) {
      console.log('[socketio-client] Already connected');
      return;
    }

    if (typeof io === 'undefined') {
      console.error('[socketio-client] socket.io client library not loaded');
      emit('error', { error: 'MISSING_LIB', message: 'Socket.io client not loaded' });
      return;
    }

    setState('connecting');

    var url = (location.protocol === 'https:' ? 'https:' : 'http:') + '//' + location.host + CONFIG.namespace;
    
    socket = io(url, {
      reconnection: CONFIG.reconnection,
      reconnectionAttempts: CONFIG.reconnectionAttempts,
      reconnectionDelay: CONFIG.reconnectionDelay,
      reconnectionDelayMax: CONFIG.reconnectionDelayMax,
      randomizationFactor: CONFIG.randomizationFactor,
      timeout: CONFIG.timeout,
      transports: CONFIG.transports,
      auth: {
        userId: opts?.userId || null,
        sessionId: getSessionId(),
      },
    });

    // ─── Connection Events ───
    socket.on('connect', function () {
      transportType = socket.io.engine.transport.name;
      setState('connected');
      emit('connected', { transport: transportType, id: socket.id });
      
      // Flush pending messages
      while (pendingMessages.length > 0) {
        var msg = pendingMessages.shift();
        sendMessage(msg.text, msg.callback);
      }
    });

    socket.io.engine.on('upgrade', function (transport) {
      transportType = transport.name;
      console.log('[socketio-client] Transport upgraded to: ' + transportType);
      emit('transportUpgrade', { transport: transportType });
      updateStatusUI('connected');
    });

    socket.on('disconnect', function (reason) {
      console.log('[socketio-client] Disconnected: ' + reason);
      setState('disconnected');
      emit('disconnected', { reason: reason });
    });

    socket.io.on('reconnect_attempt', function (attempt) {
      setState('reconnecting');
      emit('reconnecting', { attempt: attempt, maxAttempts: CONFIG.reconnectionAttempts });
    });

    socket.io.on('reconnect', function (attempt) {
      transportType = socket.io.engine.transport.name;
      setState('connected');
      emit('reconnected', { attempt: attempt, transport: transportType });
    });

    socket.io.on('reconnect_failed', function () {
      setState('disconnected');
      emit('reconnectFailed', {});
    });

    socket.on('connect_error', function (err) {
      console.error('[socketio-client] Connection error:', err.message);
      emit('error', { error: 'CONNECT_ERROR', message: err.message });
    });

    // ─── Chat Stream Events ───
    socket.on('chat:stream:start', function (data) {
      emit('streamStart', data);
      // Integration with CortexChatUI
      if (window.CortexChatUI && typeof window.CortexChatUI.showTypingIndicator === 'function') {
        window.CortexChatUI.showTypingIndicator();
      }
    });

    socket.on('chat:stream:token', function (data) {
      emit('streamToken', data);
      // Render token in UI
      if (window.CortexChatUI && typeof window.CortexChatUI.appendStreamToken === 'function') {
        window.CortexChatUI.appendStreamToken(data.text, data.requestId);
      }
    });

    socket.on('chat:stream:end', function (data) {
      emit('streamEnd', data);
      // Finalize in UI
      if (window.CortexChatUI && typeof window.CortexChatUI.finalizeStream === 'function') {
        window.CortexChatUI.finalizeStream(data.requestId);
      }
    });

    socket.on('chat:stream:error', function (data) {
      emit('streamError', data);
      if (window.CortexChatUI && typeof window.CortexChatUI.showError === 'function') {
        window.CortexChatUI.showError(data.message || 'Something went wrong');
      }
    });

    // ─── Typing Indicators ───
    socket.on('chat:userTyping', function (data) {
      emit('userTyping', data);
    });
  }

  /* ── Send Message ── */
  function sendMessage(text, callback) {
    text = (text || '').trim();
    if (!text) return;

    // Queue if not connected
    if (!socket || !socket.connected) {
      if (pendingMessages.length < 50) {
        pendingMessages.push({ text: text, callback: callback });
      }
      emit('queued', { text: text, queueSize: pendingMessages.length });
      return;
    }

    var requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    var sessionId = getSessionId();

    socket.emit('chat:message', {
      message: text,
      requestId: requestId,
      sessionId: sessionId,
      profile: getProfile(),
      goals: getGoals(),
    }, function (ack) {
      if (ack && ack.error) {
        emit('error', ack);
        if (callback) callback(ack, null);
      } else {
        emit('messageSent', { requestId: requestId, sessionId: sessionId });
        if (callback) callback(null, { requestId: requestId });
      }
    });

    return requestId;
  }

  /* ── Disconnect ── */
  function disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    setState('disconnected');
  }

  /* ── Expose API ── */
  window.CortexSocketIO = {
    connect: connect,
    disconnect: disconnect,
    sendMessage: sendMessage,
    newSession: newSession,
    getSessionId: getSessionId,
    getState: function () { return connectionState; },
    getTransport: function () { return transportType; },
    isConnected: function () { return socket && socket.connected; },
    on: on,
    off: off,

    // For dispatcher integration
    TRANSPORT_NAME: 'socketio',
  };

})();
