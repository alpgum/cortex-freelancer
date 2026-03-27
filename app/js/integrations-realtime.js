// Cortex Freelancer — Integrations Realtime (Socket.io)
// Provides lightweight WebSocket tick + status updates for external integrations.
// Progressive enhancement: pages still work with HTTP polling.

(function () {
  'use strict';

  var socket = null;
  var listeners = {};
  var state = 'disconnected';
  var lastTick = 0;
  var subscribedUid = null;

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function emitLocal(event, data) {
    var fns = listeners[event] || [];
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](data); } catch (e) { /* ignore */ }
    }
  }

  function setState(next, meta) {
    if (state === next) return;
    state = next;
    emitLocal('state', { state: state, meta: meta || {} });
  }

  function connect(opts) {
    opts = opts || {};
    var uid = opts.uid;
    if (!uid) return;

    subscribedUid = uid;

    if (typeof window.io !== 'function') {
      setState('unavailable', { reason: 'socketio_missing' });
      return;
    }

    // Avoid double connect
    if (socket && socket.connected) {
      try {
        socket.emit('integrations:subscribe', { uid: uid });
      } catch (e) {}
      return;
    }

    try {
      setState('connecting');
      socket = window.io('/integrations', {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: { userId: uid },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        timeout: 15000,
      });

      socket.on('connect', function () {
        setState('connected', { id: socket.id });
        try {
          socket.emit('integrations:subscribe', { uid: uid }, function (ack) {
            emitLocal('subscribed', ack || {});
            if (ack && ack.status) emitLocal('status', ack.status);
          });
        } catch (e) {}
      });

      socket.on('disconnect', function (reason) {
        setState('disconnected', { reason: reason });
      });

      socket.on('connect_error', function (err) {
        setState('error', { message: (err && err.message) || 'connect_error' });
      });

      socket.on('integrations:tick', function (data) {
        lastTick = Date.now();
        emitLocal('tick', data || {});
      });

      socket.on('integrations:status', function (data) {
        emitLocal('status', data || {});
      });

      socket.on('integrations:notice', function (data) {
        emitLocal('notice', data || {});
      });

    } catch (e) {
      setState('error', { message: e.message || String(e) });
    }
  }

  function requestStatus(uid) {
    uid = uid || subscribedUid;
    if (!socket || !socket.connected || !uid) return;
    try {
      socket.emit('integrations:status', { uid: uid }, function (resp) {
        if (resp && resp.status) emitLocal('status', resp.status);
      });
    } catch (e) {}
  }

  function disconnect() {
    try {
      if (socket) socket.disconnect();
    } catch (e) {}
    socket = null;
    setState('disconnected', { reason: 'manual' });
  }

  function getInfo() {
    return {
      state: state,
      connected: !!(socket && socket.connected),
      socketId: socket ? socket.id : null,
      lastTick: lastTick,
    };
  }

  window.CortexIntegrationsRealtime = {
    on: on,
    connect: connect,
    requestStatus: requestStatus,
    disconnect: disconnect,
    getInfo: getInfo,
  };
})();
