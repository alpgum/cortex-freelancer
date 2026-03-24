/**
 * CFX-007: Connection Status Manager
 * 
 * Provides a rich connection status overlay that:
 * - Shows real-time connection state with visual indicators
 * - Displays reconnection progress with countdown
 * - Enables offline message composition (queued messages)
 * - Shows service degradation warnings
 * - Provides actionable recovery guidance
 *
 * Integrates with: CortexWsReconnect, CortexChatDispatcher, CortexChat
 */
(function () {
  'use strict';

  /* ── State ── */
  var currentState = 'disconnected';
  var overlayEl = null;
  var bannerEl = null;
  var offlineQueueCount = 0;
  var lastConnectedAt = null;
  var degradedReason = null;

  /* ── State Descriptions ── */
  var STATE_INFO = {
    connected: {
      label: '● Connected',
      color: '#22c55e',
      bgColor: 'transparent',
      description: 'Live connection active',
      showBanner: false,
    },
    connecting: {
      label: '◌ Connecting...',
      color: '#eab308',
      bgColor: '#1a1a0d',
      description: 'Establishing connection to Cortex AI...',
      showBanner: true,
    },
    reconnecting: {
      label: '↻ Reconnecting...',
      color: '#f59e0b',
      bgColor: '#1a1a0d',
      description: 'Connection lost. Trying to reconnect...',
      showBanner: true,
    },
    degraded: {
      label: '◐ Degraded',
      color: '#f59e0b',
      bgColor: '#1a170d',
      description: 'Connection is unstable. Messages may be slow.',
      showBanner: true,
    },
    failed: {
      label: '✕ Offline',
      color: '#ef4444',
      bgColor: '#1a0d0d',
      description: 'Unable to connect. You can still compose messages — they\'ll send when reconnected.',
      showBanner: true,
    },
    disconnected: {
      label: '○ Offline',
      color: '#6b7280',
      bgColor: '#1a1a1a',
      description: 'Not connected to the server.',
      showBanner: false,
    },
  };

  /* ── Banner UI ── */

  function createBanner() {
    if (bannerEl) return bannerEl;

    bannerEl = document.createElement('div');
    bannerEl.id = 'cfx-connection-banner';
    bannerEl.setAttribute('role', 'status');
    bannerEl.setAttribute('aria-live', 'polite');
    bannerEl.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:10000;' +
      'padding:8px 16px;font-size:13px;font-family:system-ui,sans-serif;' +
      'display:flex;align-items:center;justify-content:space-between;gap:12px;' +
      'transition:all 0.3s ease;transform:translateY(-100%);opacity:0;';

    var leftGroup = document.createElement('div');
    leftGroup.style.cssText = 'display:flex;align-items:center;gap:8px;';
    leftGroup.innerHTML = '<span class="cfx-status-dot" style="width:8px;height:8px;border-radius:50%;"></span>' +
      '<span class="cfx-status-text"></span>' +
      '<span class="cfx-status-detail" style="color:#9ca3af;font-size:12px;"></span>';

    var rightGroup = document.createElement('div');
    rightGroup.style.cssText = 'display:flex;align-items:center;gap:8px;';
    rightGroup.innerHTML = '<span class="cfx-queue-badge" style="display:none;background:#374151;padding:2px 8px;border-radius:10px;font-size:11px;color:#d1d5db;"></span>' +
      '<button class="cfx-retry-btn" style="display:none;padding:4px 12px;background:#1f2937;color:#d1d5db;border:1px solid #374151;border-radius:4px;cursor:pointer;font-size:12px;">Retry Now</button>' +
      '<button class="cfx-dismiss-btn" style="padding:2px 8px;background:transparent;color:#6b7280;border:none;cursor:pointer;font-size:16px;line-height:1;">×</button>';

    bannerEl.appendChild(leftGroup);
    bannerEl.appendChild(rightGroup);

    // Wire dismiss
    var dismissBtn = bannerEl.querySelector('.cfx-dismiss-btn');
    dismissBtn.addEventListener('click', function () { hideBanner(); });

    // Wire retry
    var retryBtn = bannerEl.querySelector('.cfx-retry-btn');
    retryBtn.addEventListener('click', function () {
      if (window.CortexChatDispatcher && window.CortexChatDispatcher.reconnect) {
        window.CortexChatDispatcher.reconnect();
      } else if (window.CortexWsReconnect) {
        window.CortexWsReconnect.resetAndReconnect();
      }
    });

    // Insert at top of body
    if (document.body) {
      document.body.insertBefore(bannerEl, document.body.firstChild);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        document.body.insertBefore(bannerEl, document.body.firstChild);
      });
    }

    return bannerEl;
  }

  function showBanner() {
    if (!bannerEl) createBanner();
    bannerEl.style.transform = 'translateY(0)';
    bannerEl.style.opacity = '1';
  }

  function hideBanner() {
    if (bannerEl) {
      bannerEl.style.transform = 'translateY(-100%)';
      bannerEl.style.opacity = '0';
    }
  }

  function updateBanner(state, extra) {
    if (!bannerEl) createBanner();
    extra = extra || {};

    var info = STATE_INFO[state] || STATE_INFO.disconnected;

    // Update dot color
    var dot = bannerEl.querySelector('.cfx-status-dot');
    if (dot) {
      dot.style.backgroundColor = info.color;
      // Pulse animation for reconnecting
      dot.style.animation = state === 'reconnecting' ? 'cfxPulse 1.5s infinite' : 'none';
    }

    // Update text
    var textEl = bannerEl.querySelector('.cfx-status-text');
    if (textEl) {
      textEl.textContent = info.label;
      textEl.style.color = info.color;
    }

    // Update detail
    var detailEl = bannerEl.querySelector('.cfx-status-detail');
    if (detailEl) {
      var detail = info.description;
      if (state === 'reconnecting' && extra.attempt) {
        detail = 'Attempt ' + extra.attempt + '/' + (extra.maxAttempts || '10');
        if (extra.delayMs) {
          detail += ' · next in ' + Math.ceil(extra.delayMs / 1000) + 's';
        }
      }
      if (state === 'degraded' && degradedReason) {
        detail = degradedReason;
      }
      detailEl.textContent = detail;
    }

    // Update queue badge
    var badge = bannerEl.querySelector('.cfx-queue-badge');
    if (badge) {
      if (offlineQueueCount > 0) {
        badge.style.display = '';
        badge.textContent = offlineQueueCount + ' queued';
      } else {
        badge.style.display = 'none';
      }
    }

    // Show/hide retry button
    var retryBtn = bannerEl.querySelector('.cfx-retry-btn');
    if (retryBtn) {
      retryBtn.style.display = (state === 'failed') ? '' : 'none';
    }

    // Banner background
    bannerEl.style.backgroundColor = info.bgColor;
    bannerEl.style.borderBottom = info.showBanner ? '1px solid #374151' : 'none';

    if (info.showBanner) {
      showBanner();
    } else {
      // Brief show then hide for "connected" state
      if (state === 'connected' && currentState !== 'connected') {
        // Flash green for 2s to confirm reconnection
        showBanner();
        setTimeout(hideBanner, 2000);
      } else {
        hideBanner();
      }
    }

    currentState = state;
  }

  /* ── Wire to CortexWsReconnect ── */

  function init() {
    createBanner();

    // Inject pulse animation
    if (!document.getElementById('cfx007-pulse')) {
      var style = document.createElement('style');
      style.id = 'cfx007-pulse';
      style.textContent = '@keyframes cfxPulse{0%,100%{opacity:1}50%{opacity:0.4}}';
      document.head.appendChild(style);
    }

    if (!window.CortexWsReconnect) return;

    var reconnect = window.CortexWsReconnect;

    reconnect.on('stateChange', function (info) {
      updateBanner(info.to, info);
    });

    reconnect.on('reconnecting', function (info) {
      updateBanner('reconnecting', info);
    });

    reconnect.on('connected', function () {
      lastConnectedAt = Date.now();
      updateBanner('connected');
    });

    reconnect.on('failed', function (info) {
      updateBanner('failed', info);
    });

    reconnect.on('queueChange', function (info) {
      offlineQueueCount = info.length || 0;
      if (bannerEl) {
        var badge = bannerEl.querySelector('.cfx-queue-badge');
        if (badge) {
          badge.style.display = offlineQueueCount > 0 ? '' : 'none';
          badge.textContent = offlineQueueCount + ' queued';
        }
      }
    });

    // Set initial state
    var initialState = reconnect.getState();
    if (initialState && initialState !== 'disconnected') {
      updateBanner(initialState);
    }
  }

  /* ── Offline Composition Helper ── */

  /** Check if the user can compose messages offline */
  function canComposeOffline() {
    return currentState === 'failed' || currentState === 'reconnecting' || currentState === 'disconnected';
  }

  /** Get user-friendly status text for the input placeholder */
  function getInputPlaceholder() {
    switch (currentState) {
      case 'connected':
        return 'Ask Cortex anything...';
      case 'connecting':
        return 'Connecting... type your message anyway';
      case 'reconnecting':
        return 'Reconnecting... your message will send when ready';
      case 'failed':
        return 'Offline — type your message, it\'ll send when reconnected';
      case 'degraded':
        return 'Connection unstable — messages may be slow';
      default:
        return 'Type a message...';
    }
  }

  /* ── Service Status Check ── */

  /** Fetch server health status for degradation detection */
  function checkServiceStatus() {
    if (typeof fetch === 'undefined') return;

    fetch('/ws/health', { method: 'GET', signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.resources && data.resources.isDegraded) {
          degradedReason = 'Server under heavy load (CPU: ' + data.resources.loadAvg + ', Memory: ' +
            Math.round(data.resources.memUsageRatio * 100) + '%)';
          if (currentState === 'connected') {
            updateBanner('degraded');
          }
        }
        if (data.openclawAvailable === false) {
          degradedReason = 'AI service not configured on server';
          updateBanner('failed');
        }
      })
      .catch(function () { /* silent — WS handles connection state */ });
  }

  /* ── Init on DOM ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Periodic service health check (every 2 min when connected)
  setInterval(function () {
    if (currentState === 'connected' || currentState === 'degraded') {
      checkServiceStatus();
    }
  }, 120000);

  /* ── Export ── */
  window.CortexConnectionStatus = {
    init: init,
    updateBanner: updateBanner,
    hideBanner: hideBanner,
    canComposeOffline: canComposeOffline,
    getInputPlaceholder: getInputPlaceholder,
    getState: function () { return currentState; },
    checkServiceStatus: checkServiceStatus,
  };
})();
