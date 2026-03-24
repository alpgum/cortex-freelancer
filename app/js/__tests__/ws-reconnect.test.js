/**
 * CFX-004: WebSocket Reconnection Tests
 * Run in browser console or via test harness.
 * 
 * Usage: Open chat.html, paste this in console, call runReconnectTests()
 */

(function () {
  'use strict';

  var results = [];
  var testCount = 0;

  function assert(condition, name) {
    testCount++;
    if (condition) {
      results.push('✅ ' + name);
    } else {
      results.push('❌ ' + name);
    }
  }

  function printResults() {
    var passed = results.filter(function (r) { return r.startsWith('✅'); }).length;
    console.log('\n=== CFX-004 Reconnection Tests ===');
    results.forEach(function (r) { console.log(r); });
    console.log('\n' + passed + '/' + testCount + ' passed\n');
    return { passed: passed, total: testCount, results: results };
  }

  async function runReconnectTests() {
    results = [];
    testCount = 0;
    var rc = window.CortexWsReconnect;

    // Test 1: Module loaded
    assert(rc !== undefined, 'CortexWsReconnect module loaded');

    // Test 2: State enum exists
    assert(rc.State.CONNECTED === 'connected', 'State enum has CONNECTED');
    assert(rc.State.RECONNECTING === 'reconnecting', 'State enum has RECONNECTING');
    assert(rc.State.FAILED === 'failed', 'State enum has FAILED');

    // Test 3: Initial state
    var initialState = rc.getState();
    assert(
      initialState === 'connected' || initialState === 'connecting' || initialState === 'disconnected',
      'Initial state is valid (' + initialState + ')'
    );

    // Test 4: Event system
    var eventFired = false;
    function testListener() { eventFired = true; }
    rc.on('stateChange', testListener);
    // We can't easily trigger without breaking connection, just verify listener was added
    assert(typeof rc.on === 'function', 'Event system: on() exists');
    assert(typeof rc.off === 'function', 'Event system: off() exists');
    rc.off('stateChange', testListener);

    // Test 5: Queue system
    assert(rc.getQueueLength() >= 0, 'Queue length is non-negative');
    assert(typeof rc.getRetryInfo === 'function', 'getRetryInfo() exists');

    var retryInfo = rc.getRetryInfo();
    assert(retryInfo.max === 10, 'Max retry attempts is 10');

    // Test 6: isConnected helper
    assert(typeof rc.isConnected() === 'boolean', 'isConnected() returns boolean');

    // Test 7: Dispatcher integration
    var disp = window.CortexChatDispatcher;
    assert(disp !== undefined, 'CortexChatDispatcher loaded');
    assert(typeof disp.getConnectionMode === 'function', 'getConnectionMode() exists');
    var mode = disp.getConnectionMode();
    assert(
      ['websocket', 'reconnecting', 'sse', 'http'].indexOf(mode) !== -1,
      'Connection mode is valid (' + mode + ')'
    );

    // Test 8: UI status element
    var statusEl = document.getElementById('chat-status');
    assert(statusEl !== null, 'Chat status element exists in DOM');
    if (statusEl) {
      assert(
        statusEl.className.indexOf('chat-status') !== -1,
        'Status element has correct base class'
      );
    }

    // Test 9: Simulate disconnect/reconnect flow
    console.log('\n--- Simulating disconnect ---');
    if (rc.isConnected()) {
      rc.disconnect();
      await new Promise(function (r) { setTimeout(r, 100); });
      assert(rc.getState() === 'disconnected', 'After disconnect(): state is disconnected');
      assert(!rc.isConnected(), 'After disconnect(): isConnected() is false');

      // Test message queueing during disconnect
      rc.send({ type: 'chat', message: 'test-queued', requestId: 'test_q1' });
      assert(rc.getQueueLength() >= 1, 'Message queued while disconnected');

      // Reconnect
      console.log('--- Reconnecting ---');
      rc.resetAndReconnect();
      await new Promise(function (r) { setTimeout(r, 3000); });
      
      var postState = rc.getState();
      assert(
        postState === 'connected' || postState === 'connecting',
        'After resetAndReconnect(): state progressed (' + postState + ')'
      );

      if (rc.isConnected()) {
        assert(rc.getQueueLength() === 0, 'Queue flushed after reconnection');
      }
    } else {
      console.log('(Skipping disconnect sim — not connected)');
    }

    return printResults();
  }

  window.runReconnectTests = runReconnectTests;
  console.log('[CFX-004] Reconnection tests loaded. Run: runReconnectTests()');
})();
