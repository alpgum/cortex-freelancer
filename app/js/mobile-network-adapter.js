/**
 * CFX-009: Mobile Network Adapter
 * 
 * Detects mobile network conditions and adapts WebSocket behavior:
 * 1. Uses navigator.connection API for network quality detection
 * 2. Adjusts heartbeat/timeout based on connection type (4G, 3G, WiFi)
 * 3. Detects WiFi↔cellular handoffs via connection change events
 * 4. Handles mobile browser backgrounding (iOS/Android specifics)
 * 5. Battery-aware: reduces ping frequency on low battery
 * 6. Detects network quality degradation and pre-emptively reconnects
 * 
 * Must load AFTER ws-reconnect.js and ws-visibility-bridge.js
 */
(function () {
  'use strict';

  if (!window.CortexWsReconnect) {
    console.warn('[mobile-net] CortexWsReconnect not loaded, skipping');
    return;
  }

  var rc = window.CortexWsReconnect;

  /* ── Network Quality Profiles ── */
  var PROFILES = {
    'fast': {
      // WiFi, 4G, wired — good conditions
      heartbeatMs: 20000,
      heartbeatTimeoutMs: 10000,
      reconnectBaseMs: 1000,
      reconnectMaxMs: 30000,
      maxRetries: 10,
      label: 'fast'
    },
    'medium': {
      // 3G, slow WiFi
      heartbeatMs: 30000,
      heartbeatTimeoutMs: 15000,
      reconnectBaseMs: 2000,
      reconnectMaxMs: 45000,
      maxRetries: 15,
      label: 'medium'
    },
    'slow': {
      // 2G, very slow connections
      heartbeatMs: 45000,
      heartbeatTimeoutMs: 25000,
      reconnectBaseMs: 3000,
      reconnectMaxMs: 60000,
      maxRetries: 20,
      label: 'slow'
    },
    'offline': {
      // No connection — don't attempt reconnect until online event
      heartbeatMs: 0,
      heartbeatTimeoutMs: 0,
      reconnectBaseMs: 5000,
      reconnectMaxMs: 60000,
      maxRetries: 0,
      label: 'offline'
    }
  };

  /* ── State ── */
  var currentProfile = PROFILES.fast;
  var lastConnectionType = null;
  var lastDownlink = null;
  var networkSwitchCount = 0;
  var lastNetworkSwitch = 0;
  var isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(navigator.userAgent);
  var batteryLevel = 1;
  var isCharging = true;
  var touchStartTime = 0;

  /* ── Network Quality Detection ── */
  function getNetworkConnection() {
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  }

  function classifyNetwork(conn) {
    if (!navigator.onLine) return PROFILES.offline;
    if (!conn) return PROFILES.fast; // Can't detect, assume good

    var type = conn.effectiveType || conn.type || '';
    var downlink = conn.downlink; // Mbps
    var rtt = conn.rtt; // ms

    // effectiveType: slow-2g, 2g, 3g, 4g
    if (type === 'slow-2g' || type === '2g') return PROFILES.slow;
    if (type === '3g') return PROFILES.medium;
    if (type === '4g') {
      // Even on 4G, check actual metrics
      if (rtt && rtt > 500) return PROFILES.medium;
      if (downlink && downlink < 1) return PROFILES.medium;
      return PROFILES.fast;
    }

    // Fallback: use downlink/rtt if available
    if (downlink !== undefined) {
      if (downlink < 0.5) return PROFILES.slow;
      if (downlink < 2) return PROFILES.medium;
      return PROFILES.fast;
    }

    if (rtt !== undefined) {
      if (rtt > 1000) return PROFILES.slow;
      if (rtt > 300) return PROFILES.medium;
      return PROFILES.fast;
    }

    return PROFILES.fast;
  }

  function detectNetworkSwitch(conn) {
    if (!conn) return false;
    var currentType = conn.type || conn.effectiveType || '';
    var currentDownlink = conn.downlink;

    var switched = false;
    if (lastConnectionType !== null && currentType !== lastConnectionType) {
      switched = true;
      console.log('[mobile-net] Network type changed: ' + lastConnectionType + ' → ' + currentType);
    }
    // Significant bandwidth change (>50% drop) also counts as "switch"
    if (lastDownlink !== null && currentDownlink !== undefined && lastDownlink > 0) {
      var ratio = currentDownlink / lastDownlink;
      if (ratio < 0.5 || ratio > 2) {
        switched = true;
        console.log('[mobile-net] Bandwidth changed: ' + lastDownlink + ' → ' + currentDownlink + ' Mbps');
      }
    }

    lastConnectionType = currentType;
    lastDownlink = currentDownlink;
    return switched;
  }

  /* ── Apply Profile ── */
  function applyProfile(profile) {
    if (profile.label === currentProfile.label) return;

    var oldLabel = currentProfile.label;
    currentProfile = profile;
    console.log('[mobile-net] Network profile: ' + oldLabel + ' → ' + profile.label);

    // Emit event for UI to show network quality indicator
    if (rc.emit) {
      // Not standard on CortexWsReconnect but try
    }

    // Dispatch custom event for any listener
    try {
      window.dispatchEvent(new CustomEvent('cortex:networkProfile', {
        detail: { profile: profile.label, isMobile: isMobile }
      }));
    } catch (e) {}
  }

  /* ── Connection Change Handler ── */
  function onConnectionChange() {
    var conn = getNetworkConnection();
    var newProfile = classifyNetwork(conn);

    // Detect network switch (WiFi↔cellular)
    var switched = detectNetworkSwitch(conn);

    if (switched) {
      networkSwitchCount++;
      lastNetworkSwitch = Date.now();

      // On mobile, network switches often silently kill WebSocket
      // Pre-emptive reconnect is better than waiting for heartbeat timeout
      if (isMobile && rc.isConnected()) {
        console.log('[mobile-net] Network switch detected — verifying connection...');
        // Send a ping to verify the connection is still alive
        var verified = rc.send({ type: 'ping' });
        if (!verified) {
          console.log('[mobile-net] Connection dead after network switch, reconnecting...');
          rc.resetAndReconnect();
        }
      }
    }

    // Apply battery-adjusted profile
    applyProfile(adjustForBattery(newProfile));

    // Report network info to server for server-side tracking
    if (rc.isConnected()) {
      rc.send({
        type: 'network_info',
        networkType: conn ? (conn.effectiveType || conn.type || 'unknown') : 'unknown',
        downlink: conn ? conn.downlink : null,
        rtt: conn ? conn.rtt : null
      });
    }
  }

  /* ── Battery Awareness ── */
  function adjustForBattery(profile) {
    // On low battery + not charging, use slower profile to save power
    if (!isCharging && batteryLevel < 0.15 && profile.label === 'fast') {
      return PROFILES.medium;
    }
    return profile;
  }

  function initBattery() {
    if (!navigator.getBattery) return;

    navigator.getBattery().then(function (battery) {
      batteryLevel = battery.level;
      isCharging = battery.charging;

      battery.addEventListener('levelchange', function () {
        batteryLevel = battery.level;
        onConnectionChange(); // Re-evaluate profile
      });

      battery.addEventListener('chargingchange', function () {
        isCharging = battery.charging;
        onConnectionChange();
      });

      console.log('[mobile-net] Battery monitoring active: ' + Math.round(batteryLevel * 100) + '% ' + (isCharging ? '(charging)' : ''));
    }).catch(function () {
      // Battery API not available or denied
    });
  }

  /* ── iOS-Specific Handling ── */
  function initIOSHandling() {
    if (!isIOS) return;

    // iOS Safari aggressively suspends WebSocket after ~30s in background
    // The visibility bridge handles reactivation, but we need extra care
    // for the "warm start" case where the socket LOOKS open but is zombie

    // Touch interaction = user is active, prime for quick reconnect
    document.addEventListener('touchstart', function () {
      touchStartTime = Date.now();
    }, { passive: true });

    // After touch, if connection was stale, force check
    document.addEventListener('touchend', function () {
      if (!rc.isConnected() && rc.getState() !== rc.State.CONNECTING) {
        console.log('[mobile-net] iOS: Touch detected while disconnected, reconnecting...');
        rc.resetAndReconnect();
      }
    }, { passive: true });

    // iOS-specific: when returning from another app, the page might
    // fire neither visibilitychange nor focus events reliably
    // Use a timer-based detection as a backup
    var lastCheck = Date.now();
    setInterval(function () {
      var now = Date.now();
      var elapsed = now - lastCheck;
      lastCheck = now;

      // If more than 5s passed between 1s intervals, we were suspended
      if (elapsed > 5000) {
        console.log('[mobile-net] iOS: Timer gap detected (' + Math.round(elapsed / 1000) + 's), likely was backgrounded');
        if (!rc.isConnected()) {
          rc.resetAndReconnect();
        } else {
          // Verify connection is actually alive
          rc.send({ type: 'ping' });
        }
      }
    }, 1000);

    console.log('[mobile-net] iOS-specific handling active');
  }

  /* ── Android-Specific Handling ── */
  function initAndroidHandling() {
    if (!isAndroid) return;

    // Android Chrome: Doze mode and App Standby can kill connections
    // The visibility bridge covers most cases, but Android also has
    // "partial wake" states where the page is technically visible
    // but network is restricted

    // Android-specific: handle "connection" type changes (wifi, cellular, etc)
    var conn = getNetworkConnection();
    if (conn && conn.type) {
      // On Android, conn.type gives: wifi, cellular, ethernet, bluetooth, etc.
      // This is more detailed than effectiveType
      console.log('[mobile-net] Android network type: ' + conn.type + ', effective: ' + (conn.effectiveType || 'unknown'));
    }

    console.log('[mobile-net] Android-specific handling active');
  }

  /* ── Network Stability Score ── */
  // Tracks connection stability over time for adaptive behavior
  var stabilityWindow = [];
  var STABILITY_WINDOW_SIZE = 10;

  function recordStabilityEvent(type) {
    stabilityWindow.push({
      type: type, // 'connect', 'disconnect', 'switch', 'timeout'
      time: Date.now()
    });
    if (stabilityWindow.length > STABILITY_WINDOW_SIZE) {
      stabilityWindow.shift();
    }
  }

  function getStabilityScore() {
    if (stabilityWindow.length < 2) return 100;
    var disconnects = 0;
    var timeSpan = 0;
    for (var i = 0; i < stabilityWindow.length; i++) {
      if (stabilityWindow[i].type === 'disconnect' || stabilityWindow[i].type === 'timeout') {
        disconnects++;
      }
    }
    timeSpan = stabilityWindow[stabilityWindow.length - 1].time - stabilityWindow[0].time;
    if (timeSpan < 60000) timeSpan = 60000; // Min 1 minute window

    // Score: 100 = perfect, 0 = constant disconnects
    var score = Math.max(0, 100 - (disconnects * 20));
    return score;
  }

  /* ── Hook into CortexWsReconnect events ── */
  rc.on('connected', function () {
    recordStabilityEvent('connect');
    // Report initial network info to server
    var conn = getNetworkConnection();
    if (conn) {
      rc.send({
        type: 'network_info',
        networkType: conn.effectiveType || conn.type || 'unknown',
        downlink: conn.downlink || null,
        rtt: conn.rtt || null
      });
    }
  });

  rc.on('stateChange', function (info) {
    if (info.to === rc.State.RECONNECTING) {
      recordStabilityEvent('disconnect');
    }
    if (info.to === rc.State.FAILED) {
      recordStabilityEvent('timeout');
    }
  });

  /* ── Init ── */
  function init() {
    // Set up navigator.connection monitoring
    var conn = getNetworkConnection();
    if (conn) {
      // Initialize baseline
      lastConnectionType = conn.type || conn.effectiveType || null;
      lastDownlink = conn.downlink || null;

      // Monitor changes
      conn.addEventListener('change', onConnectionChange);

      var initialProfile = classifyNetwork(conn);
      applyProfile(initialProfile);

      console.log('[mobile-net] Network Info API active: type=' + (conn.effectiveType || conn.type || 'unknown') +
        ' downlink=' + (conn.downlink || '?') + 'Mbps rtt=' + (conn.rtt || '?') + 'ms' +
        ' → profile=' + currentProfile.label);
    } else {
      console.log('[mobile-net] Network Info API not available, using defaults');
    }

    // Battery monitoring
    initBattery();

    // Platform-specific handlers
    initIOSHandling();
    initAndroidHandling();

    // Log mobile detection
    if (isMobile) {
      console.log('[mobile-net] Mobile device detected: ' + (isIOS ? 'iOS' : isAndroid ? 'Android' : 'Other'));
    } else {
      console.log('[mobile-net] Desktop device detected');
    }
  }

  init();

  /* ── Public API ── */
  window.CortexMobileNetwork = {
    getProfile: function () { return currentProfile; },
    getStabilityScore: getStabilityScore,
    isMobile: function () { return isMobile; },
    isIOS: function () { return isIOS; },
    isAndroid: function () { return isAndroid; },
    getNetworkInfo: function () {
      var conn = getNetworkConnection();
      return {
        online: navigator.onLine,
        type: conn ? (conn.type || null) : null,
        effectiveType: conn ? (conn.effectiveType || null) : null,
        downlink: conn ? (conn.downlink || null) : null,
        rtt: conn ? (conn.rtt || null) : null,
        saveData: conn ? (conn.saveData || false) : false,
        profile: currentProfile.label,
        stabilityScore: getStabilityScore(),
        isMobile: isMobile,
        isIOS: isIOS,
        isAndroid: isAndroid,
        batteryLevel: Math.round(batteryLevel * 100),
        isCharging: isCharging,
        networkSwitchCount: networkSwitchCount,
        lastNetworkSwitch: lastNetworkSwitch ? new Date(lastNetworkSwitch).toISOString() : null
      };
    },
    PROFILES: PROFILES
  };

  console.log('[mobile-net] CFX-009 Mobile Network Adapter active');
})();
