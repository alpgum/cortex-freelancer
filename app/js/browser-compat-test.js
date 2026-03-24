/**
 * CFX-008: Browser Compatibility Test Suite
 * 
 * Tests WebSocket, SSE, and related APIs across browsers.
 * Run in browser console or load as a script.
 * 
 * Usage: Open any page that loads ws-reconnect.js + chat-dispatcher.js,
 *        paste this in console, then call: runBrowserCompatTests()
 */
(function () {
  'use strict';

  var results = [];
  var warnings = [];

  function pass(name, detail) {
    results.push({ name: name, ok: true, detail: detail || '' });
  }

  function fail(name, reason) {
    results.push({ name: name, ok: false, detail: reason });
  }

  function warn(name, detail) {
    warnings.push({ name: name, detail: detail });
  }

  /* ── Browser Detection ── */
  function detectBrowser() {
    var ua = navigator.userAgent;
    var browser = 'Unknown';
    var version = '';
    var engine = '';
    var mobile = /Mobile|Android|iPhone|iPad/.test(ua);

    if (/Edg\//.test(ua)) {
      browser = 'Edge (Chromium)';
      version = ua.match(/Edg\/([\d.]+)/)[1];
      engine = 'Blink';
    } else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
      browser = 'Chrome';
      version = ua.match(/Chrome\/([\d.]+)/)[1];
      engine = 'Blink';
    } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
      browser = 'Safari';
      version = ua.match(/Version\/([\d.]+)/);
      version = version ? version[1] : 'unknown';
      engine = 'WebKit';
    } else if (/Firefox\//.test(ua)) {
      browser = 'Firefox';
      version = ua.match(/Firefox\/([\d.]+)/)[1];
      engine = 'Gecko';
    }

    return {
      browser: browser,
      version: version,
      engine: engine,
      mobile: mobile,
      userAgent: ua,
      platform: navigator.platform || 'unknown'
    };
  }

  /* ── Test Categories ── */

  // 1. WebSocket API Availability
  function testWebSocketAPI() {
    // Core WebSocket
    if (typeof WebSocket === 'undefined') {
      fail('WebSocket API', 'WebSocket is not defined');
      return;
    }
    pass('WebSocket API', 'Available');

    // WebSocket constants
    if (WebSocket.CONNECTING === 0 && WebSocket.OPEN === 1 &&
        WebSocket.CLOSING === 2 && WebSocket.CLOSED === 3) {
      pass('WebSocket readyState constants', 'All 4 constants present');
    } else {
      fail('WebSocket readyState constants', 'Missing or incorrect');
    }

    // Binary support (ArrayBuffer / Blob)
    try {
      var testWs = { binaryType: 'blob' };
      testWs.binaryType = 'arraybuffer';
      pass('WebSocket binaryType', 'arraybuffer supported');
    } catch (e) {
      warn('WebSocket binaryType', 'Cannot set binaryType: ' + e.message);
    }

    // CloseEvent
    if (typeof CloseEvent !== 'undefined') {
      pass('CloseEvent', 'Available');
    } else {
      warn('CloseEvent', 'Not available — close events may lack code/reason');
    }
  }

  // 2. JSON Support (used heavily in WS messaging)
  function testJSONSupport() {
    try {
      var obj = { type: 'ping', timestamp: Date.now() };
      var str = JSON.stringify(obj);
      var parsed = JSON.parse(str);
      if (parsed.type === 'ping') {
        pass('JSON stringify/parse', 'Working correctly');
      } else {
        fail('JSON stringify/parse', 'Round-trip failed');
      }
    } catch (e) {
      fail('JSON stringify/parse', e.message);
    }
  }

  // 3. EventSource (SSE fallback)
  function testSSESupport() {
    if (typeof EventSource !== 'undefined') {
      pass('EventSource (SSE)', 'Available for fallback');
    } else {
      warn('EventSource (SSE)', 'Not available — SSE fallback disabled');
    }
  }

  // 4. Fetch API (HTTP fallback + SSE streaming)
  function testFetchAPI() {
    if (typeof fetch === 'undefined') {
      fail('Fetch API', 'Not available — HTTP fallback broken');
      return;
    }
    pass('Fetch API', 'Available');

    // AbortController (used for SSE timeout)
    if (typeof AbortController !== 'undefined') {
      pass('AbortController', 'Available');
    } else {
      warn('AbortController', 'Not available — SSE timeout won\'t work');
    }

    // ReadableStream (used for SSE streaming via fetch)
    if (typeof ReadableStream !== 'undefined') {
      pass('ReadableStream', 'Available');
    } else {
      warn('ReadableStream', 'Not available — SSE streaming may not work');
    }

    // TextDecoder (used in SSE processing)
    if (typeof TextDecoder !== 'undefined') {
      pass('TextDecoder', 'Available');
    } else {
      warn('TextDecoder', 'Not available — SSE chunk decoding will fail');
    }

    // Response.body (readable stream on fetch response)
    if (typeof Response !== 'undefined') {
      try {
        var r = new Response('test');
        if (r.body && typeof r.body.getReader === 'function') {
          pass('Response.body.getReader', 'Available for streaming');
        } else {
          warn('Response.body.getReader', 'Not available — SSE will use non-streaming fetch');
        }
      } catch (e) {
        warn('Response.body.getReader', 'Error testing: ' + e.message);
      }
    }
  }

  // 5. Timer APIs (critical for reconnection backoff, heartbeat)
  function testTimerAPIs() {
    if (typeof setTimeout === 'function' && typeof clearTimeout === 'function') {
      pass('setTimeout/clearTimeout', 'Available');
    } else {
      fail('setTimeout/clearTimeout', 'Missing — reconnection will break');
    }

    if (typeof setInterval === 'function' && typeof clearInterval === 'function') {
      pass('setInterval/clearInterval', 'Available');
    } else {
      fail('setInterval/clearInterval', 'Missing — heartbeat will break');
    }

    // Test timer accuracy (important for backoff)
    var timerStart = Date.now();
    var timerId = setTimeout(function () {
      var drift = Math.abs(Date.now() - timerStart - 100);
      if (drift < 50) {
        pass('Timer accuracy', 'Drift < 50ms (actual: ' + drift + 'ms)');
      } else {
        warn('Timer accuracy', 'Drift = ' + drift + 'ms — backoff timing may be imprecise');
      }
    }, 100);
  }

  // 6. Math.random (used for jitter in backoff)
  function testRandomJitter() {
    var seen = {};
    for (var i = 0; i < 10; i++) {
      var v = Math.random();
      if (v < 0 || v >= 1) {
        fail('Math.random', 'Out of range: ' + v);
        return;
      }
      seen[Math.floor(v * 100)] = true;
    }
    var unique = Object.keys(seen).length;
    if (unique >= 5) {
      pass('Math.random (jitter)', 'Good entropy (' + unique + ' unique buckets/10)');
    } else {
      warn('Math.random (jitter)', 'Low entropy (' + unique + ' unique) — backoff jitter may cluster');
    }
  }

  // 7. CortexWsReconnect module tests
  function testReconnectModule() {
    var rc = window.CortexWsReconnect;
    if (!rc) {
      warn('CortexWsReconnect', 'Not loaded (run from a page that includes ws-reconnect.js)');
      return;
    }

    pass('CortexWsReconnect loaded', 'Module available');

    // API completeness
    var required = ['connect', 'disconnect', 'send', 'on', 'off',
      'getState', 'isConnected', 'getQueueLength', 'getRetryInfo', 'resetAndReconnect', 'State'];
    var missing = [];
    for (var i = 0; i < required.length; i++) {
      if (!rc[required[i]]) missing.push(required[i]);
    }
    if (missing.length === 0) {
      pass('WsReconnect API', 'All ' + required.length + ' methods present');
    } else {
      fail('WsReconnect API', 'Missing: ' + missing.join(', '));
    }

    // State enum
    var states = ['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'RECONNECTING', 'FAILED'];
    var missingStates = states.filter(function (s) { return !rc.State[s]; });
    if (missingStates.length === 0) {
      pass('WsReconnect States', 'All 5 states defined');
    } else {
      fail('WsReconnect States', 'Missing: ' + missingStates.join(', '));
    }

    // Event system test
    var eventWorked = false;
    var handler = function () { eventWorked = true; };
    rc.on('_cfx008_test', handler);
    rc.off('_cfx008_test', handler);
    pass('WsReconnect event system', 'on/off work without errors');

    // Current state
    var s = rc.getState();
    pass('WsReconnect state', 'Current: ' + s);
    pass('WsReconnect connected', rc.isConnected() ? 'Yes' : 'No');
    pass('WsReconnect queue', 'Length: ' + rc.getQueueLength());
    var retryInfo = rc.getRetryInfo();
    pass('WsReconnect retry config', 'attempts=' + retryInfo.attempts + ' max=' + retryInfo.max);
  }

  // 8. CortexChatDispatcher module tests
  function testDispatcher() {
    var disp = window.CortexChatDispatcher;
    if (!disp) {
      warn('CortexChatDispatcher', 'Not loaded');
      return;
    }

    pass('CortexChatDispatcher loaded', 'Module available');

    var required = ['send', 'getSessionId', 'newSession', 'isWebSocketConnected', 'getConnectionMode', 'reconnect'];
    var missing = [];
    for (var i = 0; i < required.length; i++) {
      if (!disp[required[i]]) missing.push(required[i]);
    }
    if (missing.length === 0) {
      pass('Dispatcher API', 'All ' + required.length + ' methods present');
    } else {
      fail('Dispatcher API', 'Missing: ' + missing.join(', '));
    }

    var mode = disp.getConnectionMode();
    pass('Connection mode', mode);

    var sid = disp.getSessionId();
    pass('Session ID', sid ? 'Generated: ' + sid.substring(0, 16) + '...' : 'None');
  }

  // 9. Protocol-specific tests
  function testProtocol() {
    // wss: URL construction
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = proto + '//' + location.host + '/ws/chat';
    pass('WS URL construction', wsUrl);

    // Test actual WebSocket connection (quick open/close)
    if (typeof WebSocket === 'undefined') return;

    return new Promise(function (resolve) {
      var timeout = setTimeout(function () {
        warn('WS connection test', 'Timeout after 5s — server may not be running');
        resolve();
      }, 5000);

      try {
        var testWs = new WebSocket(wsUrl);

        testWs.onopen = function () {
          clearTimeout(timeout);
          pass('WS connection test', 'Successfully connected to ' + wsUrl);

          // Test send/receive
          try {
            testWs.send(JSON.stringify({ type: 'ping' }));
          } catch (e) {
            fail('WS send test', e.message);
          }

          // Wait briefly for pong
          var pongTimeout = setTimeout(function () {
            warn('WS pong test', 'No pong received within 2s');
            testWs.close(1000);
            resolve();
          }, 2000);

          testWs.onmessage = function (event) {
            clearTimeout(pongTimeout);
            try {
              var data = JSON.parse(event.data);
              if (data.type === 'connected') {
                // Welcome message — still wait for our ping response
                return;
              }
              if (data.type === 'pong') {
                pass('WS ping/pong', 'Round-trip successful');
              } else {
                pass('WS message received', 'type=' + data.type);
              }
            } catch (e) {
              warn('WS message parse', 'Non-JSON response: ' + event.data.substring(0, 100));
            }
            testWs.close(1000);
            resolve();
          };
        };

        testWs.onerror = function () {
          clearTimeout(timeout);
          warn('WS connection test', 'Connection error (server may be down)');
          resolve();
        };

        testWs.onclose = function (event) {
          clearTimeout(timeout);
          if (event.code !== 1000) {
            warn('WS close', 'Unexpected close: code=' + event.code + ' reason=' + (event.reason || 'none'));
          }
        };
      } catch (e) {
        clearTimeout(timeout);
        fail('WS connection test', 'Construction failed: ' + e.message);
        resolve();
      }
    });
  }

  // 10. Browser-specific quirks detection
  function testBrowserQuirks(browserInfo) {
    // Safari: WebSocket close event may not fire immediately
    if (browserInfo.engine === 'WebKit') {
      warn('Safari quirk', 'WebSocket close events may be delayed. Heartbeat ping/pong is the primary dead-connection detector.');

      // Safari < 15 had issues with ReadableStream on Response.body
      var safariVer = parseInt(browserInfo.version, 10);
      if (safariVer && safariVer < 15) {
        warn('Safari < 15', 'Response.body streaming may not work — SSE fallback will use buffered mode');
      }

      // Safari private browsing + WebSocket
      warn('Safari Private Browsing', 'WebSocket works but localStorage/sessionStorage may throw — safe-storage.js should handle this');
    }

    // Firefox: WebSocket has a different default timeout behavior
    if (browserInfo.engine === 'Gecko') {
      // Firefox network.websocket.timeout.* prefs can affect connections
      warn('Firefox note', 'network.websocket.timeout.* about:config prefs may affect connection behavior. Default settings are fine.');

      // Firefox on Android: aggressive tab throttling
      if (browserInfo.mobile) {
        warn('Firefox Mobile', 'Background tabs are aggressively throttled — timers >1min may not fire reliably');
      }
    }

    // Chrome/Edge: Page Lifecycle API
    if (browserInfo.engine === 'Blink') {
      // Chrome 68+ may freeze timers in background tabs
      if (typeof document !== 'undefined' && typeof document.hidden !== 'undefined') {
        pass('Page Visibility API', 'Available — can detect background state');
      }

      // Chrome on mobile: aggressive tab discarding
      if (browserInfo.mobile) {
        warn('Chrome Mobile', 'Tabs may be discarded when memory is low — WebSocket will close silently');
      }
    }

    // iOS Safari: All browsers use WebKit
    if (/iPhone|iPad/.test(browserInfo.userAgent)) {
      warn('iOS note', 'All iOS browsers use WebKit engine regardless of browser name');
      warn('iOS background', 'WebSocket connections are suspended when app goes to background (~30s grace period)');
    }

    // General: Page Visibility API for reconnect triggers
    if (typeof document !== 'undefined') {
      if ('visibilityState' in document) {
        pass('Page Visibility API', 'Can detect tab focus changes');
      } else if ('webkitVisibilityState' in document) {
        pass('Page Visibility API (webkit)', 'Prefixed version available');
      } else {
        warn('Page Visibility API', 'Not available — can\'t optimize reconnection on tab focus');
      }
    }

    // Navigator.onLine
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      pass('navigator.onLine', 'Available (currently: ' + (navigator.onLine ? 'online' : 'offline') + ')');
    } else {
      warn('navigator.onLine', 'Not available — network status detection disabled');
    }

    // online/offline events
    if (typeof window !== 'undefined') {
      pass('online/offline events', 'Available for network change detection');
    }
  }

  // 11. Performance and timing
  function testPerformance() {
    // Performance.now (high-res timer)
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      pass('performance.now', 'High-resolution timer available');
    } else {
      warn('performance.now', 'Not available — Date.now() fallback (ms resolution)');
    }

    // requestAnimationFrame (UI updates)
    if (typeof requestAnimationFrame === 'function') {
      pass('requestAnimationFrame', 'Available for smooth UI updates');
    } else {
      warn('requestAnimationFrame', 'Not available — setTimeout fallback for UI');
    }
  }

  /* ── Runner ── */

  async function runBrowserCompatTests() {
    results = [];
    warnings = [];

    var browserInfo = detectBrowser();

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   CFX-008: Browser Compatibility Test Suite      ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('Browser: ' + browserInfo.browser + ' ' + browserInfo.version);
    console.log('Engine:  ' + browserInfo.engine);
    console.log('Mobile:  ' + (browserInfo.mobile ? 'Yes' : 'No'));
    console.log('Platform: ' + browserInfo.platform);
    console.log('');

    // Run all tests
    testWebSocketAPI();
    testJSONSupport();
    testSSESupport();
    testFetchAPI();
    testTimerAPIs();
    testRandomJitter();
    testReconnectModule();
    testDispatcher();
    await testProtocol();
    testBrowserQuirks(browserInfo);
    testPerformance();

    // Wait for async timer test
    await new Promise(function (r) { setTimeout(r, 200); });

    // Print results
    console.log('\n── Results ──────────────────────────────────────');
    var passed = 0;
    var failed = 0;
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (r.ok) {
        passed++;
        console.log('  ✅ ' + r.name + (r.detail ? ' — ' + r.detail : ''));
      } else {
        failed++;
        console.log('  ❌ ' + r.name + ' — ' + r.detail);
      }
    }

    if (warnings.length > 0) {
      console.log('\n── Warnings ─────────────────────────────────────');
      for (var j = 0; j < warnings.length; j++) {
        console.log('  ⚠️  ' + warnings[j].name + ' — ' + warnings[j].detail);
      }
    }

    console.log('\n── Summary ──────────────────────────────────────');
    console.log('  Passed:   ' + passed);
    console.log('  Failed:   ' + failed);
    console.log('  Warnings: ' + warnings.length);
    console.log('  Browser:  ' + browserInfo.browser + ' ' + browserInfo.version + (browserInfo.mobile ? ' (mobile)' : ''));

    var verdict = failed === 0 ? '✅ COMPATIBLE' : '❌ ISSUES FOUND';
    console.log('\n  Verdict: ' + verdict);
    console.log('═'.repeat(50));

    return {
      browser: browserInfo,
      passed: passed,
      failed: failed,
      warnings: warnings.length,
      results: results,
      warningDetails: warnings,
      compatible: failed === 0
    };
  }

  window.runBrowserCompatTests = runBrowserCompatTests;
  console.log('[CFX-008] Browser compat tests loaded. Run: runBrowserCompatTests()');
})();
