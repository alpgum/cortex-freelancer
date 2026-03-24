/**
 * CFX-008: Visibility & Network Bridge for WebSocket Reconnection
 * 
 * Fixes critical cross-browser issues:
 * 1. Background tab timer throttling (Chrome/Firefox/Safari)
 * 2. iOS/Android WebSocket suspension when app backgrounds
 * 3. Network change detection (WiFi→cellular, offline→online)
 * 4. Page freeze/resume lifecycle (Chrome Page Lifecycle API)
 * 
 * Must load AFTER ws-reconnect.js
 */
(function () {
  'use strict';

  if (!window.CortexWsReconnect) {
    console.warn('[ws-visibility] CortexWsReconnect not loaded, skipping');
    return;
  }

  var rc = window.CortexWsReconnect;
  var wasHidden = false;
  var wasOffline = false;
  var lastVisibleTime = Date.now();

  /* ── Page Visibility: Reconnect when tab becomes visible ── */
  function handleVisibilityChange() {
    var hidden = document.hidden || document.webkitHidden || false;

    if (hidden) {
      // Tab going to background — note the time
      wasHidden = true;
      lastVisibleTime = Date.now();
      console.log('[ws-visibility] Tab hidden');
    } else if (wasHidden) {
      // Tab returning to foreground
      wasHidden = false;
      var hiddenDuration = Date.now() - lastVisibleTime;
      console.log('[ws-visibility] Tab visible (was hidden ' + Math.round(hiddenDuration / 1000) + 's)');

      // If hidden for >30s, timers were likely throttled — check connection
      if (hiddenDuration > 30000) {
        if (!rc.isConnected()) {
          console.log('[ws-visibility] Connection lost during background, reconnecting...');
          rc.resetAndReconnect();
        } else {
          // Connection might look open but be zombie — send a ping to verify
          rc.send({ type: 'ping' });
        }
      }
    }
  }

  // Use the correct event name (standard vs webkit-prefixed)
  var visibilityEvent = 'visibilitychange';
  if (typeof document.hidden === 'undefined' && typeof document.webkitHidden !== 'undefined') {
    visibilityEvent = 'webkitvisibilitychange';
  }

  if ('hidden' in document || 'webkitHidden' in document) {
    document.addEventListener(visibilityEvent, handleVisibilityChange);
    console.log('[ws-visibility] Page Visibility monitoring active');
  }

  /* ── Network Change: Reconnect on online event ── */
  function handleOnline() {
    console.log('[ws-visibility] Network: online');
    if (wasOffline || !rc.isConnected()) {
      wasOffline = false;
      // Small delay to let the network stack stabilize
      setTimeout(function () {
        if (!rc.isConnected()) {
          console.log('[ws-visibility] Reconnecting after network restore...');
          rc.resetAndReconnect();
        }
      }, 1000);
    }
  }

  function handleOffline() {
    console.log('[ws-visibility] Network: offline');
    wasOffline = true;
  }

  if ('onLine' in navigator) {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    console.log('[ws-visibility] Network change monitoring active');
  }

  /* ── Page Lifecycle: Handle freeze/resume (Chrome 68+) ── */
  if ('onfreeze' in document) {
    document.addEventListener('freeze', function () {
      console.log('[ws-visibility] Page frozen by browser');
    });

    document.addEventListener('resume', function () {
      console.log('[ws-visibility] Page resumed');
      // After resume, connection is almost certainly dead
      setTimeout(function () {
        if (!rc.isConnected()) {
          rc.resetAndReconnect();
        }
      }, 500);
    });
    console.log('[ws-visibility] Page Lifecycle (freeze/resume) monitoring active');
  }

  /* ── Focus event: Lightweight check on window focus ── */
  window.addEventListener('focus', function () {
    // Only check if we think we might have a stale connection
    if (rc.getState() === rc.State.CONNECTED && rc.isConnected()) {
      // Quick health check — send a ping
      rc.send({ type: 'ping' });
    } else if (rc.getState() === rc.State.DISCONNECTED || rc.getState() === rc.State.FAILED) {
      // Explicit reconnect on focus if disconnected/failed
      rc.resetAndReconnect();
    }
  });

  console.log('[ws-visibility] CFX-008 bridge active — visibility + network + lifecycle monitoring');
})();
