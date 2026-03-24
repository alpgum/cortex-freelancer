/**
 * CFX-004: Robust WebSocket Reconnection Manager
 * 
 * Features:
 * - Connection state machine: CONNECTING → CONNECTED → RECONNECTING → FAILED
 * - Exponential backoff: 1s, 2s, 4s, 8s... max 30s
 * - Heartbeat ping/pong to detect dead connections early
 * - Message queue during reconnection (no lost messages)
 * - Max retry limit with graceful failure
 * - Visual connection status updates
 */
(function () {
  'use strict';

  /* ── Constants ── */
  var INITIAL_BACKOFF_MS = 1000;
  var MAX_BACKOFF_MS = 30000;
  var BACKOFF_MULTIPLIER = 2;
  var MAX_RETRY_ATTEMPTS = 10;
  var HEARTBEAT_INTERVAL_MS = 20000;
  var HEARTBEAT_TIMEOUT_MS = 10000; // If no pong within 10s, connection is dead
  var MESSAGE_QUEUE_MAX = 50;

  /* ── State Machine ── */
  var State = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    FAILED: 'failed'
  };

  /* ── Internal state ── */
  var state = State.DISCONNECTED;
  var ws = null;
  var retryAttempts = 0;
  var reconnectTimer = null;
  var heartbeatTimer = null;
  var heartbeatTimeoutTimer = null;
  var messageQueue = [];
  var listeners = {};
  var wasEverConnected = false;
  var lastPongTime = 0;
  var intentionalClose = false;
  var connectStartTs = 0;

  /* ── Event system ── */
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
      try { fns[i](data); } catch (e) { console.error('[ws-reconnect] listener error:', e); }
    }
  }

  /* ── State transitions ── */
  function setState(newState) {
    if (state === newState) return;
    var oldState = state;
    state = newState;
    console.log('[ws-reconnect] ' + oldState + ' → ' + newState);
    emit('stateChange', { from: oldState, to: newState, retryAttempts: retryAttempts });
  }

  /* ── URL builder ── */
  function getWsUrl() {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws/chat';
  }

  /* ── Backoff calculation ── */
  function getBackoffDelay() {
    var delay = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, retryAttempts - 1);
    // Add jitter (±20%) to prevent thundering herd
    var jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.min(delay + jitter, MAX_BACKOFF_MS);
  }

  /* ── Heartbeat ── */
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(function () {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // Send ping
      try {
        ws.send(JSON.stringify({ type: 'ping' }));
      } catch (e) {
        console.warn('[ws-reconnect] Failed to send heartbeat ping');
        handleConnectionLost();
        return;
      }

      // Set timeout for pong response
      heartbeatTimeoutTimer = setTimeout(function () {
        var elapsed = Date.now() - lastPongTime;
        if (elapsed > HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS) {
          console.warn('[ws-reconnect] Heartbeat timeout — connection appears dead');
          handleConnectionLost();
        }
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (heartbeatTimeoutTimer) { clearTimeout(heartbeatTimeoutTimer); heartbeatTimeoutTimer = null; }
  }

  function handlePong() {
    lastPongTime = Date.now();
    if (heartbeatTimeoutTimer) { clearTimeout(heartbeatTimeoutTimer); heartbeatTimeoutTimer = null; }
  }

  /* ── Message Queue ── */
  function enqueueMessage(msg) {
    if (messageQueue.length >= MESSAGE_QUEUE_MAX) {
      console.warn('[ws-reconnect] Message queue full, dropping oldest message');
      messageQueue.shift();
    }
    messageQueue.push(msg);
    emit('queueChange', { length: messageQueue.length });
  }

  function flushQueue() {
    if (!ws || ws.readyState !== WebSocket.OPEN || messageQueue.length === 0) return;
    console.log('[ws-reconnect] Flushing ' + messageQueue.length + ' queued message(s)');
    while (messageQueue.length > 0) {
      var msg = messageQueue.shift();
      try {
        ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
      } catch (e) {
        console.error('[ws-reconnect] Failed to send queued message:', e);
        messageQueue.unshift(msg); // Put it back
        break;
      }
    }
    emit('queueChange', { length: messageQueue.length });
  }

  /* ── Connection lost handler ── */
  function handleConnectionLost() {
    stopHeartbeat();
    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }
    // Don't transition if we intentionally closed
    if (intentionalClose) return;

    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
      setState(State.RECONNECTING);
      scheduleReconnect();
    } else {
      setState(State.FAILED);
      emit('failed', { attempts: retryAttempts, message: 'Connection lost after ' + retryAttempts + ' attempts. Please refresh the page.' });
    }
  }

  /* ── Reconnect scheduling ── */
  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    retryAttempts++;
    var delay = getBackoffDelay();
    console.log('[ws-reconnect] Reconnecting in ' + Math.round(delay) + 'ms (attempt ' + retryAttempts + '/' + MAX_RETRY_ATTEMPTS + ')');
    emit('reconnecting', { attempt: retryAttempts, maxAttempts: MAX_RETRY_ATTEMPTS, delayMs: Math.round(delay) });

    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      doConnect();
    }, delay);
  }

  /* ── Core connect ── */
  function doConnect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

    setState(state === State.DISCONNECTED ? State.CONNECTING : State.RECONNECTING);
    intentionalClose = false;

    try {
      connectStartTs = Date.now();
      ws = new WebSocket(getWsUrl());
    } catch (e) {
      console.error('[ws-reconnect] WebSocket construction failed:', e);
      handleConnectionLost();
      return;
    }

    ws.onopen = function () {
      console.log('[ws-reconnect] Connected');
      setState(State.CONNECTED);
      retryAttempts = 0;
      wasEverConnected = true;
      lastPongTime = Date.now();
      startHeartbeat();
      emit('connected', {});
      if (connectStartTs) {
        emit('connectLatency', { ms: Date.now() - connectStartTs });
      }
      // Flush any queued messages
      flushQueue();
    };

    ws.onmessage = function (event) {
      var data;
      try { data = JSON.parse(event.data); } catch (e) { return; }

      // Handle pong for heartbeat
      if (data.type === 'pong') {
        handlePong();
      }

      // Forward all messages to listeners
      emit('message', data);
    };

    ws.onclose = function (event) {
      console.log('[ws-reconnect] Connection closed (code=' + event.code + ', reason=' + (event.reason || 'none') + ')');
      ws = null;
      stopHeartbeat();

      if (intentionalClose) {
        setState(State.DISCONNECTED);
        return;
      }

      // Normal closure (1000) or going away (1001) — try reconnect if we were connected
      if (wasEverConnected && retryAttempts < MAX_RETRY_ATTEMPTS) {
        setState(State.RECONNECTING);
        scheduleReconnect();
      } else if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
        setState(State.FAILED);
        emit('failed', { attempts: retryAttempts, message: 'Unable to reconnect. Please refresh the page.' });
      } else {
        setState(State.DISCONNECTED);
      }
    };

    ws.onerror = function () {
      // onclose will fire after this, which handles reconnection
      console.warn('[ws-reconnect] WebSocket error');
    };
  }

  /* ── Public API ── */

  function connect() {
    retryAttempts = 0;
    intentionalClose = false;
    doConnect();
  }

  function disconnect() {
    intentionalClose = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    stopHeartbeat();
    if (ws) {
      try { ws.close(1000, 'Client disconnect'); } catch (e) {}
      ws = null;
    }
    messageQueue = [];
    setState(State.DISCONNECTED);
  }

  function send(data) {
    var payload = typeof data === 'string' ? data : JSON.stringify(data);

    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
        return true;
      } catch (e) {
        console.warn('[ws-reconnect] Send failed, queueing message');
        enqueueMessage(data);
        handleConnectionLost();
        return false;
      }
    }

    // Not connected — queue the message
    console.log('[ws-reconnect] Not connected, queueing message');
    enqueueMessage(data);

    // Trigger reconnect if we're not already trying
    if (state !== State.CONNECTING && state !== State.RECONNECTING) {
      retryAttempts = 0;
      doConnect();
    }

    return false;
  }

  function getState() { return state; }
  function isConnected() { return state === State.CONNECTED && ws && ws.readyState === WebSocket.OPEN; }
  function getQueueLength() { return messageQueue.length; }

  /**
   * Remove queued messages matching a requestId (best-effort).
   * Useful to avoid late sends after user cancellation.
   */
  function removeQueuedByRequestId(requestId) {
    if (!requestId) return 0;
    var before = messageQueue.length;
    messageQueue = messageQueue.filter(function (m) {
      try {
        if (typeof m === 'string') {
          // Might be raw JSON string
          var obj = JSON.parse(m);
          return !(obj && obj.requestId === requestId);
        }
        return !(m && m.requestId === requestId);
      } catch (e) {
        return true;
      }
    });
    emit('queueChange', { length: messageQueue.length });
    return before - messageQueue.length;
  }
  function getRetryInfo() { return { attempts: retryAttempts, max: MAX_RETRY_ATTEMPTS }; }

  function resetAndReconnect() {
    disconnect();
    retryAttempts = 0;
    connect();
  }

  /* ── Export ── */
  window.CortexWsReconnect = {
    connect: connect,
    disconnect: disconnect,
    send: send,
    on: on,
    off: off,
    getState: getState,
    isConnected: isConnected,
    getQueueLength: getQueueLength,
    removeQueuedByRequestId: removeQueuedByRequestId,
    getRetryInfo: getRetryInfo,
    resetAndReconnect: resetAndReconnect,
    State: State
  };
})();
