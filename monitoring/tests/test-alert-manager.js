/**
 * CFX-020: Alert Manager Tests
 */

'use strict';

const AlertManager = require('../alert-manager');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}`); failed++; }
}

console.log('═══ CFX-020: Alert Manager Tests ═══\n');

// Test 1: Initialization
{
  const am = new AlertManager({ enabled: true });
  assert(am.getActiveAlerts().length === 0, 'No active alerts initially');
  assert(am.getHistory().length === 0, 'No history initially');
  const thresholds = am.getThresholds();
  assert(thresholds.errorRate.warning === 1, 'Default error rate warning = 1%');
  assert(thresholds.errorRate.critical === 5, 'Default error rate critical = 5%');
}

// Test 2: Warning alert triggered
{
  const am = new AlertManager({ enabled: true, cooldownMs: 0 });
  const metrics = {
    current: { errorRate: 2, latency: { p95: 100 } },
    system: { memory: { heapPercent: 50 }, cpu: { loadAvg1m: 0.5 } },
    connections: { websocket: 10 },
  };

  const alerts = am.evaluate(metrics);
  assert(alerts.length === 1, 'One warning alert triggered');
  assert(alerts[0].level === 'warning', 'Alert level is warning');
  assert(alerts[0].metric === 'errorRate', 'Alert metric is errorRate');
}

// Test 3: Critical alert triggered
{
  const am = new AlertManager({ enabled: true, cooldownMs: 0 });
  const metrics = {
    current: { errorRate: 10, latency: { p95: 3000 } },
    system: { memory: { heapPercent: 96 }, cpu: { loadAvg1m: 5.0 } },
    connections: { websocket: 960 },
  };

  const alerts = am.evaluate(metrics);
  assert(alerts.length === 5, 'Multiple critical alerts triggered');
  assert(alerts.every(a => a.level === 'critical'), 'All are critical');
}

// Test 4: Cooldown prevents spam
{
  const am = new AlertManager({ enabled: true, cooldownMs: 60_000 });
  const metrics = {
    current: { errorRate: 2, latency: { p95: 100 } },
    system: { memory: { heapPercent: 50 }, cpu: { loadAvg1m: 0.5 } },
    connections: { websocket: 10 },
  };

  const first = am.evaluate(metrics);
  assert(first.length === 1, 'First evaluation triggers alert');

  const second = am.evaluate(metrics);
  assert(second.length === 0, 'Second evaluation within cooldown suppressed');
}

// Test 5: Recovery notification
{
  const am = new AlertManager({ enabled: true, cooldownMs: 0 });

  // Trigger alert
  am.evaluate({
    current: { errorRate: 10, latency: { p95: 100 } },
    system: { memory: { heapPercent: 50 }, cpu: { loadAvg1m: 0.5 } },
    connections: { websocket: 10 },
  });
  assert(am.getActiveAlerts().length === 1, 'Alert active after trigger');

  // Recover
  am.evaluate({
    current: { errorRate: 0, latency: { p95: 100 } },
    system: { memory: { heapPercent: 50 }, cpu: { loadAvg1m: 0.5 } },
    connections: { websocket: 10 },
  });
  assert(am.getActiveAlerts().length === 0, 'Alert cleared after recovery');

  const history = am.getHistory();
  const recoveries = history.filter(h => h.level === 'recovery');
  assert(recoveries.length === 1, 'Recovery notification sent');
}

// Test 6: Threshold update
{
  const am = new AlertManager({ enabled: true });
  const updated = am.updateThreshold('errorRate', 'warning', 3);
  assert(updated === true, 'Threshold update returns true');
  assert(am.getThresholds().errorRate.warning === 3, 'Threshold value updated');

  const invalid = am.updateThreshold('nonexistent', 'warning', 5);
  assert(invalid === false, 'Invalid threshold returns false');
}

// Test 7: Disabled alerts
{
  const am = new AlertManager({ enabled: false });
  const metrics = {
    current: { errorRate: 99 },
    system: { memory: { heapPercent: 99 }, cpu: { loadAvg1m: 10 } },
    connections: { websocket: 9999 },
  };
  am.evaluate(metrics);
  assert(am.getActiveAlerts().length === 0, 'No alerts when disabled');
}

console.log(`\n═══ Results: ${passed}/${passed + failed} passed ═══`);
process.exit(failed > 0 ? 1 : 0);
