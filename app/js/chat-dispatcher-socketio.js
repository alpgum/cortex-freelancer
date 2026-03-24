/**
 * CFX-024: Socket.io Dispatcher Integration
 * 
 * Extends the existing chat-dispatcher to support Socket.io as a transport tier.
 * Transport priority: Socket.io → WebSocket → SSE → HTTP long-polling → HTTP chunked → HTTP POST
 * 
 * This module patches CortexChat.send() to attempt Socket.io first when available,
 * falling back to existing transports transparently.
 * 
 * Load AFTER both chat-dispatcher.js and socketio-client.js.
 */
(function () {
  'use strict';

  // Wait for both modules
  if (!window.CortexSocketIO) {
    console.warn('[dispatcher-socketio] CortexSocketIO not loaded, skipping integration');
    return;
  }

  var originalSend = null;
  var socketioEnabled = true;
  var socketioFailed = false;
  var failCount = 0;
  var MAX_FAIL_BEFORE_FALLBACK = 3;

  /**
   * Initialize Socket.io as the primary transport.
   * If Socket.io fails repeatedly, falls back to existing dispatcher.
   */
  function init() {
    // Connect Socket.io
    var userId = null;
    try {
      var profile = window.CortexFreelancer && window.CortexFreelancer.getProfile();
      userId = profile && profile.uid;
    } catch (e) { /* ignore */ }

    window.CortexSocketIO.connect({ userId: userId });

    // Listen for connection failures to trigger fallback
    window.CortexSocketIO.on('reconnectFailed', function () {
      console.warn('[dispatcher-socketio] Socket.io reconnect failed, falling back');
      socketioFailed = true;
    });

    window.CortexSocketIO.on('error', function (err) {
      if (err.error === 'CONNECT_ERROR') {
        failCount++;
        if (failCount >= MAX_FAIL_BEFORE_FALLBACK) {
          console.warn('[dispatcher-socketio] Too many Socket.io failures, falling back');
          socketioFailed = true;
        }
      }
    });

    // Reset fail count on successful connection
    window.CortexSocketIO.on('connected', function () {
      failCount = 0;
      socketioFailed = false;
    });

    // Patch CortexChat.send if it exists
    if (window.CortexChat && typeof window.CortexChat.send === 'function') {
      originalSend = window.CortexChat.send;
      window.CortexChat.send = patchedSend;
      console.log('[dispatcher-socketio] Patched CortexChat.send with Socket.io transport');
    }

    console.log('[dispatcher-socketio] Initialized');
  }

  /**
   * Patched send function that tries Socket.io first.
   */
  function patchedSend(text, opts) {
    // Use Socket.io if available and not failed
    if (socketioEnabled && !socketioFailed && window.CortexSocketIO.isConnected()) {
      var requestId = window.CortexSocketIO.sendMessage(text);
      if (requestId) {
        return requestId;
      }
    }

    // Fall back to original dispatcher
    if (originalSend) {
      return originalSend.call(window.CortexChat, text, opts);
    }
  }

  /**
   * Enable/disable Socket.io transport (for A/B testing or manual override).
   */
  function setEnabled(enabled) {
    socketioEnabled = !!enabled;
    console.log('[dispatcher-socketio] Socket.io transport ' + (socketioEnabled ? 'enabled' : 'disabled'));
  }

  /**
   * Get transport status for debugging.
   */
  function getStatus() {
    return {
      enabled: socketioEnabled,
      failed: socketioFailed,
      failCount: failCount,
      connected: window.CortexSocketIO.isConnected(),
      transport: window.CortexSocketIO.getTransport(),
      state: window.CortexSocketIO.getState(),
    };
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging and configuration
  window.CortexSocketIODispatcher = {
    setEnabled: setEnabled,
    getStatus: getStatus,
    init: init,
  };

})();
