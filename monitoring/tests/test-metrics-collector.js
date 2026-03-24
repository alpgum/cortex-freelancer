/**
 * CFX-020: Metrics Collector Tests
 */

'use strict';

const { MetricsCollector } = require('../metrics-collector');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

console.log('═══ CFX-020: Metrics Collector Tests ═══\n');

// Test 1: Initialization
{
  const mc = new MetricsCollector();
  assert(mc.requestCount === 0, 'Initial request count is 0');
  assert(mc.errorCount5xx === 0, 'Initial error count is 0');
  assert(typeof mc.middleware === 'function', 'Middleware is a function');
  mc.destroy();
}

// Test 2: Middleware tracks requests
{
  const mc = new MetricsCollector();
  const mw = mc.middleware();

  // Fake req/res
  const req = { path: '/api/test', route: null };
  const res = {
    statusCode: 200,
    end: function() {},
  };

  mw(req, res, () => {
    res.end(); // Trigger tracking
  });

  assert(mc.requestCount === 1, 'Request counted after middleware');
  assert(mc.httpLatency.count === 1, 'Latency recorded');
  assert(mc.statusCodes[200] === 1, 'Status code 200 tracked');
  mc.destroy();
}

// Test 3: Error tracking
{
  const mc = new MetricsCollector();
  const mw = mc.middleware();

  // 5xx error
  const req = { path: '/api/fail', route: null };
  const res = { statusCode: 500, end: function() {} };
  mw(req, res, () => { res.end(); });

  // 4xx error
  const req2 = { path: '/api/notfound', route: null };
  const res2 = { statusCode: 404, end: function() {} };
  mw(req2, res2, () => { res2.end(); });

  assert(mc.errorCount5xx === 1, '5xx error counted');
  assert(mc.errorCount4xx === 1, '4xx error counted');
  mc.destroy();
}

// Test 4: WebSocket tracking
{
  const mc = new MetricsCollector();
  mc.trackWsConnect();
  mc.trackWsConnect();
  assert(mc.activeConnections.websocket === 2, 'WS connections incremented');
  mc.trackWsDisconnect();
  assert(mc.activeConnections.websocket === 1, 'WS connections decremented');
  mc.trackWsMessage(15.5);
  assert(mc.business.messagesProcessed === 1, 'Message counted');
  assert(mc.wsLatency.count === 1, 'WS latency recorded');
  mc.destroy();
}

// Test 5: Current metrics snapshot
{
  const mc = new MetricsCollector();
  const snapshot = mc.getCurrentMetrics();
  assert(snapshot.timestamp !== undefined, 'Snapshot has timestamp');
  assert(snapshot.system !== undefined, 'Snapshot has system metrics');
  assert(snapshot.system.memory !== undefined, 'Snapshot has memory info');
  assert(snapshot.system.cpu !== undefined, 'Snapshot has CPU info');
  assert(snapshot.connections !== undefined, 'Snapshot has connections');
  assert(snapshot.business !== undefined, 'Snapshot has business metrics');
  mc.destroy();
}

// Test 6: History retrieval
{
  const mc = new MetricsCollector();
  const history1h = mc.getHistory('1h');
  assert(Array.isArray(history1h), 'History returns array');
  const history24h = mc.getHistory('24h');
  assert(Array.isArray(history24h), 'History 24h returns array');
  mc.destroy();
}

// Test 7: Slow endpoints
{
  const mc = new MetricsCollector();
  const mw = mc.middleware();

  // Simulate some requests
  for (let i = 0; i < 5; i++) {
    const req = { path: '/api/slow', route: { path: '/api/slow' } };
    const res = { statusCode: 200, end: function() {} };
    mw(req, res, () => { res.end(); });
  }

  const slow = mc.getSlowEndpoints(5);
  assert(slow.length >= 1, 'Slow endpoints tracked');
  assert(slow[0].path !== undefined, 'Endpoint has path');
  assert(slow[0].p95 !== undefined, 'Endpoint has P95');
  mc.destroy();
}

console.log(`\n═══ Results: ${passed}/${passed + failed} passed ═══`);
process.exit(failed > 0 ? 1 : 0);
