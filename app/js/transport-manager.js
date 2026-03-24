/**
 * CFX-025: Transport Manager — Unified real-time transport with automatic fallback
 * 
 * Manages the transport fallback chain:
 *   1. WebRTC Data Channel (lowest latency, P2P when possible)
 *   2. Socket.io (battle-tested, automatic WS↔polling fallback)
 *   3. SSE (edge-compatible, wide support)
 *   4. HTTP Chunked Streaming (universal fallback)
 *   5. REST Polling (last resort)
 * 
 * Usage:
 *   CortexTransport.connect();
 *   CortexTransport.sendMessage('How do I price a project?');
 *   CortexTransport.on('stream-chunk', (data) => { ... });
 *   CortexTransport.on('stream-end', (data) => { ... });
 * 
 * The manager automatically selects the best available transport,
 * monitors connection health, and falls back gracefully.
 */
(function () {
  'use strict';

  /* ── Transport Registry ── */
  var TRANSPORTS = [
    {
      name: 'webrtc',
      priority: 1,
      check: function () { return typeof CortexWebRTC !== 'undefined' && CortexWebRTC.isSupported(); },
      connect: function () { return CortexWebRTC.connect(); },
      send: function (msg, opts) { return CortexWebRTC.sendMessage(msg, opts); },
      disconnect: function () { CortexWebRTC.disconnect(); },
      isConnected: function () { return CortexWebRTC.isConnected(); },
      getStats: function () { return CortexWebRTC.getStats(); },
    },
    {
      name: 'grpc',
      priority: 1.5, // Between WebRTC and Socket.io — HTTP/2 binary streaming
      check: function () { return typeof CortexGrpcTransport !== 'undefined' && CortexGrpcTransport.isSupported(); },
      connect: function () { return CortexGrpcTransport.connect(); },
      send: function (msg, opts) { return CortexGrpcTransport.sendMessage(msg, opts); },
      disconnect: function () { CortexGrpcTransport.disconnect(); },
      isConnected: function () { return CortexGrpcTransport.isConnected(); },
      getStats: function () { return CortexGrpcTransport.getStats(); },
    },
    {
      name: 'socketio',
      priority: 2,
      check: function () { return typeof CortexSocketIO !== 'undefined'; },
      connect: function () { return CortexSocketIO.connect(); },
      send: function (msg, opts) { return CortexSocketIO.sendMessage(msg, opts); },
      disconnect: function () { CortexSocketIO.disconnect(); },
      isConnected: function () { return CortexSocketIO.isConnected(); },
      getStats: function () { return CortexSocketIO.getStats(); },
    },
    {
      name: 'sse',
      priority: 3,
      check: function () { return typeof EventSource !== 'undefined'; },
      connect: function () { return Promise.resolve(); }, // SSE connects per-request
      send: function (msg, opts) {
        // SSE is receive-only; send via POST, receive via EventSource
        return typeof CortexSSE !== 'undefined' && CortexSSE.sendMessage(msg, opts);
      },
      disconnect: function () { if (typeof CortexSSE !== 'undefined') CortexSSE.disconnect(); },
      isConnected: function () { return true; }, // SSE is stateless
      getStats: function () { return { transport: 'sse' }; },
    },
    {
      name: 'http-chunked',
      priority: 4,
      check: function () { return typeof fetch !== 'undefined'; },
      connect: function () { return Promise.resolve(); },
      send: function (msg, opts) {
        return typeof CortexChunkedStream !== 'undefined' && CortexChunkedStream.sendMessage(msg, opts);
      },
      disconnect: function () { },
      isConnected: function () { return true; },
      getStats: function () { return { transport: 'http-chunked' }; },
    },
  ];

  /* ── State ── */
  var activeTransport = null;
  var listeners = {};
  var state = 'disconnected'; // disconnected | connecting | connected | degraded
  var transportHistory = []; // Track transport switches for diagnostics

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
      try { fns[i](data); } catch (e) { console.error('[transport] listener error:', e); }
    }
  }

  /* ── Transport Selection ── */

  function selectTransport(skipNames) {
    skipNames = skipNames || [];

    // CFX-045: Merge feature-flag-disabled transports into skip list
    if (typeof CortexFeatureFlags !== 'undefined' && CortexFeatureFlags.getDisabledTransports) {
      var ffDisabled = CortexFeatureFlags.getDisabledTransports();
      for (var d = 0; d < ffDisabled.length; d++) {
        if (skipNames.indexOf(ffDisabled[d]) === -1) {
          skipNames.push(ffDisabled[d]);
          console.log('[transport] Feature flag disabled: ' + ffDisabled[d]);
        }
      }
    }

    for (var i = 0; i < TRANSPORTS.length; i++) {
      var t = TRANSPORTS[i];
      if (skipNames.indexOf(t.name) === -1 && t.check()) {
        return t;
      }
    }
    return null;
  }

  /* ── Connect ── */

  function connect(options) {
    options = options || {};
    var preferredTransport = options.transport || null; // Force a specific transport
    var skipTransports = options.skip || [];

    state = 'connecting';
    emit('state-change', { state: state });

    var transport;
    if (preferredTransport) {
      transport = TRANSPORTS.find(function (t) { return t.name === preferredTransport && t.check(); });
    }
    if (!transport) {
      transport = selectTransport(skipTransports);
    }

    if (!transport) {
      state = 'disconnected';
      emit('error', { error: 'No transport available' });
      return Promise.reject(new Error('No transport available'));
    }

    console.log('[transport] Trying: ' + transport.name);

    // Wire up fallback listener for gRPC
    if (transport.name === 'grpc' && typeof CortexGrpcTransport !== 'undefined') {
      CortexGrpcTransport.on('stream-chunk', function (d) { emit('stream-chunk', d); });
      CortexGrpcTransport.on('stream-end', function (d) { emit('stream-end', d); });
      CortexGrpcTransport.on('stream-error', function (d) { emit('stream-error', d); });
      CortexGrpcTransport.on('chat-response', function (d) { emit('chat-response', d); });
      CortexGrpcTransport.on('usage', function (d) { emit('usage', d); });
    }

    // Wire up fallback listener for WebRTC
    if (transport.name === 'webrtc' && typeof CortexWebRTC !== 'undefined') {
      CortexWebRTC.on('fallback', function onFallback(data) {
        CortexWebRTC.off('fallback', onFallback);
        console.log('[transport] WebRTC fallback triggered: ' + data.reason);
        transportHistory.push({ from: 'webrtc', reason: data.reason, time: Date.now() });
        // Try next transport
        connect({ skip: ['webrtc'] });
      });

      // Forward WebRTC events
      CortexWebRTC.on('stream-chunk', function (d) { emit('stream-chunk', d); });
      CortexWebRTC.on('stream-end', function (d) { emit('stream-end', d); });
      CortexWebRTC.on('stream-error', function (d) { emit('stream-error', d); });
      CortexWebRTC.on('chat-response', function (d) { emit('chat-response', d); });
    }

    return transport.connect()
      .then(function () {
        activeTransport = transport;
        state = 'connected';
        emit('state-change', { state: state, transport: transport.name });
        emit('connected', { transport: transport.name });
        console.log('[transport] Connected via: ' + transport.name);
        return { transport: transport.name };
      })
      .catch(function (err) {
        console.log('[transport] ' + transport.name + ' failed: ' + err.message);
        transportHistory.push({ from: transport.name, reason: err.message, time: Date.now() });

        // Try fallback
        var nextSkip = skipTransports.concat([transport.name]);
        var next = selectTransport(nextSkip);
        if (next) {
          console.log('[transport] Falling back to: ' + next.name);
          return connect({ skip: nextSkip });
        }

        state = 'disconnected';
        emit('error', { error: 'All transports failed' });
        throw new Error('All transports failed');
      });
  }

  /* ── Send ── */

  function sendMessage(text, options) {
    if (!activeTransport) {
      emit('error', { error: 'Not connected' });
      return false;
    }
    return activeTransport.send(text, options);
  }

  /* ── Disconnect ── */

  function disconnect() {
    if (activeTransport) {
      activeTransport.disconnect();
      activeTransport = null;
    }
    state = 'disconnected';
    emit('state-change', { state: state });
  }

  /* ── Status ── */

  function getStatus() {
    return {
      state: state,
      transport: activeTransport ? activeTransport.name : null,
      stats: activeTransport ? activeTransport.getStats() : null,
      history: transportHistory.slice(-10),
      available: TRANSPORTS.filter(function (t) { return t.check(); }).map(function (t) { return t.name; }),
    };
  }

  /* ── Public API ── */
  window.CortexTransport = {
    connect: connect,
    disconnect: disconnect,
    sendMessage: sendMessage,
    on: on,
    off: off,
    getStatus: getStatus,
    isConnected: function () { return state === 'connected'; },
    getTransportName: function () { return activeTransport ? activeTransport.name : null; },
  };

})();
