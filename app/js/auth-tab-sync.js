/**
 * CF-214: Auth State Sync Across Browser Tabs
 * Uses BroadcastChannel API to sync login/logout state across
 * all open tabs. Falls back to localStorage events for older browsers.
 *
 * @namespace window.CortexFreelancer.AuthTabSync
 */
(function () {
  'use strict';

  var CHANNEL_NAME = 'cortex_auth_sync';
  var STORAGE_KEY = 'cortex_auth_sync_event';
  var AUTH_USER_KEY = 'cortex_user';

  var channel = null;
  var listeners = [];
  var useBroadcastChannel = typeof BroadcastChannel !== 'undefined';

  // ─── Helpers ───────────────────────────────────────────

  function getStoredUser() {
    try {
      var raw = localStorage.getItem(AUTH_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  // ─── Event Dispatch ────────────────────────────────────

  function notifyListeners(event) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](event);
      } catch (e) {
        console.error('[AuthTabSync] Listener error:', e);
      }
    }
  }

  // ─── BroadcastChannel Transport ────────────────────────

  function initBroadcastChannel() {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = function (e) {
        handleIncomingMessage(e.data);
      };
    } catch (e) {
      console.warn('[AuthTabSync] BroadcastChannel failed, using localStorage fallback');
      useBroadcastChannel = false;
      initStorageFallback();
    }
  }

  function sendViaBroadcastChannel(msg) {
    if (channel) {
      try {
        channel.postMessage(msg);
      } catch (e) {
        console.error('[AuthTabSync] postMessage error:', e);
      }
    }
  }

  // ─── localStorage Fallback Transport ───────────────────

  function onStorageEvent(e) {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      var msg = JSON.parse(e.newValue);
      handleIncomingMessage(msg);
    } catch (err) {
      // Ignore malformed events
    }
  }

  function initStorageFallback() {
    window.addEventListener('storage', onStorageEvent);
  }

  function sendViaStorage(msg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(msg));
      // Remove immediately so future sets trigger the event again
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('[AuthTabSync] localStorage fallback error:', e);
    }
  }

  // ─── Message Handling ──────────────────────────────────

  function handleIncomingMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'login':
        try {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(msg.user));
        } catch (e) { /* ignore */ }
        notifyListeners({ type: 'login', user: msg.user });
        break;

      case 'logout':
        try {
          localStorage.removeItem(AUTH_USER_KEY);
        } catch (e) { /* ignore */ }
        notifyListeners({ type: 'logout' });
        break;

      case 'session_update':
        try {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(msg.user));
        } catch (e) { /* ignore */ }
        notifyListeners({ type: 'session_update', user: msg.user });
        break;

      case 'request_state':
        // Another tab is asking for current state — reply if we have a user
        var currentUser = getStoredUser();
        if (currentUser) {
          broadcast({ type: 'state_response', user: currentUser, requestId: msg.requestId });
        }
        break;

      case 'state_response':
        notifyListeners({ type: 'state_response', user: msg.user, requestId: msg.requestId });
        break;
    }
  }

  function broadcast(msg) {
    msg.timestamp = Date.now();
    if (useBroadcastChannel) {
      sendViaBroadcastChannel(msg);
    } else {
      sendViaStorage(msg);
    }
  }

  // ─── Public API ────────────────────────────────────────

  /**
   * Broadcast login event to all other tabs.
   * @param {Object} user - The logged-in user object
   */
  function broadcastLogin(user) {
    if (!user) return;
    try {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } catch (e) { /* ignore */ }
    broadcast({ type: 'login', user: user });
  }

  /**
   * Broadcast logout event to all other tabs.
   */
  function broadcastLogout() {
    try {
      localStorage.removeItem(AUTH_USER_KEY);
    } catch (e) { /* ignore */ }
    broadcast({ type: 'logout' });
  }

  /**
   * Broadcast session update (e.g. plan change, profile update).
   * @param {Object} user - Updated user object
   */
  function broadcastSessionUpdate(user) {
    if (!user) return;
    try {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } catch (e) { /* ignore */ }
    broadcast({ type: 'session_update', user: user });
  }

  /**
   * Request current auth state from other tabs.
   * @param {Function} callback - Called with user object if a tab responds
   * @param {number} [timeout=2000] - Timeout in ms
   */
  function requestState(callback, timeout) {
    var requestId = generateId();
    var timer = null;
    var handler = function (event) {
      if (event.type === 'state_response' && event.requestId === requestId) {
        clearTimeout(timer);
        removeListener(handler);
        callback(event.user);
      }
    };
    addListener(handler);
    timer = setTimeout(function () {
      removeListener(handler);
      callback(null);
    }, timeout || 2000);
    broadcast({ type: 'request_state', requestId: requestId });
  }

  /**
   * Add a listener for auth sync events.
   * @param {Function} fn
   */
  function addListener(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  /**
   * Remove a listener.
   * @param {Function} fn
   */
  function removeListener(fn) {
    listeners = listeners.filter(function (l) { return l !== fn; });
  }

  // ─── Init / Destroy ────────────────────────────────────

  function init() {
    if (useBroadcastChannel) {
      initBroadcastChannel();
    } else {
      initStorageFallback();
    }
    console.log('[AuthTabSync] Module initialized (' + (useBroadcastChannel ? 'BroadcastChannel' : 'localStorage fallback') + ')');
  }

  function destroy() {
    if (channel) {
      channel.close();
      channel = null;
    }
    window.removeEventListener('storage', onStorageEvent);
    listeners = [];
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.AuthTabSync = {
    init: init,
    destroy: destroy,
    broadcastLogin: broadcastLogin,
    broadcastLogout: broadcastLogout,
    broadcastSessionUpdate: broadcastSessionUpdate,
    requestState: requestState,
    addListener: addListener,
    removeListener: removeListener
  };
})();
