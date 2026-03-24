#!/usr/bin/env node
/**
 * CFX-010: Concurrent User Stress Test
 * 
 * Tests multiple simultaneous WebSocket connections to identify
 * scaling bottlenecks and ensure stable performance.
 * 
 * Usage:
 *   node concurrent-stress-test.js [--url URL] [--clients N] [--scenario SCENARIO]
 * 
 * Scenarios:
 *   ramp       - Gradual ramp-up from 1 to N clients (default)
 *   burst      - All N clients connect simultaneously
 *   mixed      - Mix of idle, active, and reconnecting clients
 *   churn      - Rapid connect/disconnect cycles
 *   sustained  - Long-running connections with periodic messages
 *   queue-flood- All clients send messages to test queue handling
 */

const WebSocket = require('ws');
const os = require('os');

// ─── Configuration ───
const CONFIG = {
  url: process.env.WS_URL || 'ws://localhost:3847/ws/chat',
  clients: parseInt(process.env.CLIENTS || '20', 10),
  scenario: process.env.SCENARIO || 'ramp',
  connectTimeoutMs: 10000,
  messageTimeoutMs: 60000,
  testDurationMs: 120000,  // 2 minutes per scenario
  rampDelayMs: 500,        // delay between client connections in ramp
  statsIntervalMs: 5000,   // how often to print stats
};

// Parse CLI args
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--url' && process.argv[i + 1]) CONFIG.url = process.argv[++i];
  if (process.argv[i] === '--clients' && process.argv[i + 1]) CONFIG.clients = parseInt(process.argv[++i], 10);
  if (process.argv[i] === '--scenario' && process.argv[i + 1]) CONFIG.scenario = process.argv[++i];
  if (process.argv[i] === '--duration' && process.argv[i + 1]) CONFIG.testDurationMs = parseInt(process.argv[++i], 10) * 1000;
}

// ─── Metrics Collector ───
const metrics = {
  connectionsAttempted: 0,
  connectionsSucceeded: 0,
  connectionsFailed: 0,
  connectionsActive: 0,
  connectionsMax: 0,
  messagesSent: 0,
  messagesReceived: 0,
  errorsReceived: 0,
  queuedMessages: 0,
  connectTimes: [],
  responseTimes: [],
  bytesReceived: 0,
  bytesSent: 0,
  disconnects: 0,
  reconnects: 0,
  startTime: null,
  snapshots: [],       // periodic snapshots for time-series analysis
};

function recordSnapshot() {
  const now = Date.now();
  metrics.snapshots.push({
    ts: now,
    elapsed: now - metrics.startTime,
    active: metrics.connectionsActive,
    sent: metrics.messagesSent,
    received: metrics.messagesReceived,
    errors: metrics.errorsReceived,
    queued: metrics.queuedMessages,
    memMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    sysMem: Math.round((1 - os.freemem() / os.totalmem()) * 100),
    sysLoad: os.loadavg()[0],
  });
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Client Factory ───
class TestClient {
  constructor(id, url) {
    this.id = id;
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.connectStart = null;
    this.pendingMessages = new Map(); // requestId → {sentAt, message}
    this.messagesReceived = 0;
    this.errors = 0;
    this.reconnectCount = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connectStart = Date.now();
      metrics.connectionsAttempted++;

      try {
        this.ws = new WebSocket(this.url);
      } catch (e) {
        metrics.connectionsFailed++;
        return reject(e);
      }

      const timeout = setTimeout(() => {
        if (!this.connected) {
          this.ws.terminate();
          metrics.connectionsFailed++;
          reject(new Error(`Client ${this.id}: connect timeout`));
        }
      }, CONFIG.connectTimeoutMs);

      this.ws.on('open', () => {
        // Wait for 'connected' message
      });

      this.ws.on('message', (raw) => {
        const size = raw.length || raw.byteLength || 0;
        metrics.bytesReceived += size;
        
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch { return; }

        if (msg.type === 'connected' && !this.connected) {
          clearTimeout(timeout);
          this.connected = true;
          const connectTime = Date.now() - this.connectStart;
          metrics.connectTimes.push(connectTime);
          metrics.connectionsSucceeded++;
          metrics.connectionsActive++;
          metrics.connectionsMax = Math.max(metrics.connectionsMax, metrics.connectionsActive);
          resolve(connectTime);
        }

        if (msg.type === 'stream_end' || msg.type === 'error') {
          const pending = this.pendingMessages.get(msg.requestId);
          if (pending) {
            const responseTime = Date.now() - pending.sentAt;
            metrics.responseTimes.push(responseTime);
            this.pendingMessages.delete(msg.requestId);
          }

          if (msg.type === 'stream_end') {
            metrics.messagesReceived++;
            this.messagesReceived++;
          }
          if (msg.type === 'error') {
            metrics.errorsReceived++;
            this.errors++;
          }
        }

        if (msg.type === 'queued') {
          metrics.queuedMessages++;
        }
      });

      this.ws.on('close', () => {
        if (this.connected) {
          metrics.connectionsActive--;
          metrics.disconnects++;
          this.connected = false;
        }
      });

      this.ws.on('error', (err) => {
        if (!this.connected) {
          clearTimeout(timeout);
          metrics.connectionsFailed++;
          reject(err);
        }
      });
    });
  }

  sendMessage(text) {
    if (!this.connected || this.ws.readyState !== WebSocket.OPEN) return null;
    const requestId = `req-${this.id}-${Date.now()}`;
    const payload = JSON.stringify({
      type: 'chat',
      message: text,
      requestId,
      sessionId: `stress-${this.id}`,
    });
    this.ws.send(payload);
    metrics.messagesSent++;
    metrics.bytesSent += payload.length;
    this.pendingMessages.set(requestId, { sentAt: Date.now(), message: text });
    return requestId;
  }

  sendPing() {
    if (!this.connected || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'ping' }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  async reconnect() {
    this.disconnect();
    await sleep(500);
    await this.connect();
    this.reconnectCount++;
    metrics.reconnects++;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Test Scenarios ───

async function scenarioRamp(numClients) {
  console.log(`\n📈 RAMP: Gradually connecting ${numClients} clients...`);
  const clients = [];

  for (let i = 0; i < numClients; i++) {
    const client = new TestClient(i, CONFIG.url);
    try {
      const t = await client.connect();
      clients.push(client);
      console.log(`  ✓ Client ${i} connected in ${t}ms (active: ${metrics.connectionsActive})`);
    } catch (e) {
      console.log(`  ✗ Client ${i} failed: ${e.message}`);
    }
    await sleep(CONFIG.rampDelayMs);
  }

  // Hold connections for 10s, send periodic pings
  console.log(`  Holding ${clients.length} connections for 10s...`);
  for (let t = 0; t < 10; t++) {
    await sleep(1000);
    clients.forEach(c => c.sendPing());
  }

  // Each client sends one message sequentially to test queue
  console.log(`  Sending messages from ${clients.length} clients...`);
  for (const client of clients) {
    client.sendMessage('Hello from stress test client ' + client.id);
    await sleep(200);
  }

  // Wait for responses
  console.log(`  Waiting for responses (60s max)...`);
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && metrics.messagesReceived + metrics.errorsReceived < clients.length) {
    await sleep(1000);
  }

  return clients;
}

async function scenarioBurst(numClients) {
  console.log(`\n💥 BURST: Connecting ${numClients} clients simultaneously...`);
  
  const connectPromises = [];
  const clients = [];
  const startTime = Date.now();

  for (let i = 0; i < numClients; i++) {
    const client = new TestClient(i, CONFIG.url);
    clients.push(client);
    connectPromises.push(
      client.connect()
        .then(t => ({ id: i, ok: true, time: t }))
        .catch(e => ({ id: i, ok: false, error: e.message }))
    );
  }

  const results = await Promise.all(connectPromises);
  const burstTime = Date.now() - startTime;
  const succeeded = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log(`  Burst connect: ${succeeded}/${numClients} in ${burstTime}ms (${failed} failed)`);

  // Hold for 5s
  await sleep(5000);

  // All clients send messages at once
  console.log(`  All clients sending messages simultaneously...`);
  const connected = clients.filter(c => c.connected);
  connected.forEach(c => c.sendMessage('Burst message from client ' + c.id));

  // Wait for responses
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline && metrics.messagesReceived + metrics.errorsReceived < connected.length) {
    await sleep(1000);
  }

  return clients;
}

async function scenarioMixed(numClients) {
  console.log(`\n🔀 MIXED: ${numClients} clients with varied behavior...`);
  const clients = [];

  // Connect all clients
  for (let i = 0; i < numClients; i++) {
    const client = new TestClient(i, CONFIG.url);
    try {
      await client.connect();
      clients.push(client);
    } catch (e) {
      console.log(`  ✗ Client ${i} failed: ${e.message}`);
    }
    await sleep(100);
  }

  const connected = clients.filter(c => c.connected);
  const third = Math.ceil(connected.length / 3);

  // Split into groups
  const idle = connected.slice(0, third);
  const active = connected.slice(third, third * 2);
  const reconnectors = connected.slice(third * 2);

  console.log(`  Groups: ${idle.length} idle, ${active.length} active, ${reconnectors.length} reconnecting`);

  // Run mixed behavior for 30s
  const endTime = Date.now() + 30000;
  let round = 0;

  while (Date.now() < endTime) {
    round++;
    
    // Idle clients just ping
    idle.forEach(c => c.sendPing());

    // Active clients send messages
    for (const c of active) {
      c.sendMessage(`Mixed test round ${round} from active client ${c.id}`);
    }

    // Reconnectors disconnect and reconnect
    for (const c of reconnectors) {
      try {
        await c.reconnect();
      } catch (e) {
        // Expected some failures
      }
    }

    await sleep(5000);
  }

  return clients;
}

async function scenarioChurn(numClients) {
  console.log(`\n🔄 CHURN: Rapid connect/disconnect cycles with ${numClients} slots...`);
  
  let totalConnections = 0;
  let totalDisconnections = 0;
  const endTime = Date.now() + 30000;

  while (Date.now() < endTime) {
    // Connect a batch
    const batch = [];
    const batchSize = Math.min(numClients, 10);
    
    for (let i = 0; i < batchSize; i++) {
      const client = new TestClient(totalConnections++, CONFIG.url);
      try {
        await client.connect();
        batch.push(client);
      } catch (e) {
        // Expected
      }
    }

    // Hold briefly
    await sleep(1000);

    // Disconnect all
    batch.forEach(c => {
      c.disconnect();
      totalDisconnections++;
    });

    await sleep(500);
  }

  console.log(`  Churn cycles: ${totalConnections} connects, ${totalDisconnections} disconnects`);
  return [];
}

async function scenarioQueueFlood(numClients) {
  console.log(`\n🌊 QUEUE-FLOOD: ${numClients} clients all sending messages...`);
  const clients = [];

  // Connect all
  for (let i = 0; i < numClients; i++) {
    const client = new TestClient(i, CONFIG.url);
    try {
      await client.connect();
      clients.push(client);
    } catch (e) {
      console.log(`  ✗ Client ${i} failed: ${e.message}`);
    }
    await sleep(50);
  }

  const connected = clients.filter(c => c.connected);
  console.log(`  ${connected.length}/${numClients} connected. Flooding queue...`);

  // All send messages
  connected.forEach((c, i) => {
    c.sendMessage(`Queue flood test message ${i}: What is the best hourly rate for a web developer?`);
  });

  console.log(`  ${metrics.messagesSent} messages sent, waiting for processing...`);

  // Wait up to 3 minutes for all responses (single-threaded queue!)
  const deadline = Date.now() + 180000;
  let lastReceived = metrics.messagesReceived;
  let stalledCount = 0;

  while (Date.now() < deadline) {
    await sleep(5000);
    const current = metrics.messagesReceived + metrics.errorsReceived;
    
    if (current >= connected.length) break;
    
    if (current === lastReceived) {
      stalledCount++;
      if (stalledCount > 6) {
        console.log(`  ⚠️  Queue appears stalled after ${current}/${connected.length} responses`);
        break;
      }
    } else {
      stalledCount = 0;
    }
    lastReceived = current;
    
    console.log(`  Progress: ${current}/${connected.length} responses (${metrics.queuedMessages} queued)`);
  }

  return clients;
}

async function scenarioSustained(numClients) {
  console.log(`\n🕐 SUSTAINED: ${numClients} long-running connections...`);
  const clients = [];

  for (let i = 0; i < numClients; i++) {
    const client = new TestClient(i, CONFIG.url);
    try {
      await client.connect();
      clients.push(client);
    } catch (e) {
      console.log(`  ✗ Client ${i} failed: ${e.message}`);
    }
    await sleep(100);
  }

  const connected = clients.filter(c => c.connected);
  console.log(`  ${connected.length} connected. Running for 60s...`);

  // Run for 60s with periodic activity
  const endTime = Date.now() + 60000;
  let msgRound = 0;

  while (Date.now() < endTime) {
    // One random client sends a message per round
    const sender = connected[msgRound % connected.length];
    if (sender && sender.connected) {
      sender.sendMessage(`Sustained test round ${msgRound}`);
    }
    
    // All send pings
    connected.forEach(c => c.sendPing());
    
    msgRound++;
    await sleep(5000);
  }

  // Check how many are still alive
  const stillAlive = connected.filter(c => c.connected).length;
  console.log(`  After 60s: ${stillAlive}/${connected.length} still connected`);

  return clients;
}

// ─── Resource Monitor ───
function getSystemResources() {
  const mem = process.memoryUsage();
  return {
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
    sysMemUsed: Math.round((1 - os.freemem() / os.totalmem()) * 100),
    sysFreeMB: Math.round(os.freemem() / 1024 / 1024),
    loadAvg: os.loadavg().map(l => Math.round(l * 100) / 100),
    cpus: os.cpus().length,
  };
}

// ─── Report Generator ───
function generateReport() {
  const elapsed = Date.now() - metrics.startTime;
  const res = getSystemResources();

  const report = {
    summary: {
      scenario: CONFIG.scenario,
      targetClients: CONFIG.clients,
      url: CONFIG.url,
      durationMs: elapsed,
      durationSec: Math.round(elapsed / 1000),
    },
    connections: {
      attempted: metrics.connectionsAttempted,
      succeeded: metrics.connectionsSucceeded,
      failed: metrics.connectionsFailed,
      maxConcurrent: metrics.connectionsMax,
      disconnects: metrics.disconnects,
      reconnects: metrics.reconnects,
      successRate: metrics.connectionsAttempted > 0
        ? Math.round(metrics.connectionsSucceeded / metrics.connectionsAttempted * 100) + '%'
        : 'N/A',
    },
    connectLatency: metrics.connectTimes.length > 0 ? {
      min: Math.min(...metrics.connectTimes),
      max: Math.max(...metrics.connectTimes),
      avg: Math.round(metrics.connectTimes.reduce((a, b) => a + b, 0) / metrics.connectTimes.length),
      p50: percentile(metrics.connectTimes, 50),
      p95: percentile(metrics.connectTimes, 95),
      p99: percentile(metrics.connectTimes, 99),
    } : null,
    messages: {
      sent: metrics.messagesSent,
      received: metrics.messagesReceived,
      errors: metrics.errorsReceived,
      queued: metrics.queuedMessages,
      bytesReceived: metrics.bytesReceived,
      bytesSent: metrics.bytesSent,
    },
    responseLatency: metrics.responseTimes.length > 0 ? {
      min: Math.min(...metrics.responseTimes),
      max: Math.max(...metrics.responseTimes),
      avg: Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length),
      p50: percentile(metrics.responseTimes, 50),
      p95: percentile(metrics.responseTimes, 95),
      p99: percentile(metrics.responseTimes, 99),
    } : null,
    resources: res,
    timeSeries: metrics.snapshots,
  };

  return report;
}

function printReport(report) {
  console.log('\n' + '═'.repeat(60));
  console.log('  CFX-010 STRESS TEST REPORT');
  console.log('═'.repeat(60));
  
  console.log(`\n  Scenario: ${report.summary.scenario}`);
  console.log(`  Target: ${report.summary.targetClients} clients → ${report.summary.url}`);
  console.log(`  Duration: ${report.summary.durationSec}s`);

  console.log('\n  📡 Connections:');
  console.log(`    Attempted: ${report.connections.attempted}`);
  console.log(`    Succeeded: ${report.connections.succeeded} (${report.connections.successRate})`);
  console.log(`    Failed: ${report.connections.failed}`);
  console.log(`    Max concurrent: ${report.connections.maxConcurrent}`);
  console.log(`    Disconnects: ${report.connections.disconnects}`);
  console.log(`    Reconnects: ${report.connections.reconnects}`);

  if (report.connectLatency) {
    console.log('\n  ⏱️  Connect Latency (ms):');
    console.log(`    Min: ${report.connectLatency.min} | Avg: ${report.connectLatency.avg} | Max: ${report.connectLatency.max}`);
    console.log(`    P50: ${report.connectLatency.p50} | P95: ${report.connectLatency.p95} | P99: ${report.connectLatency.p99}`);
  }

  console.log('\n  💬 Messages:');
  console.log(`    Sent: ${report.messages.sent}`);
  console.log(`    Received: ${report.messages.received}`);
  console.log(`    Errors: ${report.messages.errors}`);
  console.log(`    Queued: ${report.messages.queued}`);
  console.log(`    Bytes: ${report.messages.bytesSent} sent / ${report.messages.bytesReceived} received`);

  if (report.responseLatency) {
    console.log('\n  ⏱️  Response Latency (ms):');
    console.log(`    Min: ${report.responseLatency.min} | Avg: ${report.responseLatency.avg} | Max: ${report.responseLatency.max}`);
    console.log(`    P50: ${report.responseLatency.p50} | P95: ${report.responseLatency.p95} | P99: ${report.responseLatency.p99}`);
  }

  console.log('\n  🖥️  Resources (test client):');
  console.log(`    Heap: ${report.resources.heapUsedMB}/${report.resources.heapTotalMB} MB`);
  console.log(`    RSS: ${report.resources.rssMB} MB`);
  console.log(`    System memory: ${report.resources.sysMemUsed}% used (${report.resources.sysFreeMB} MB free)`);
  console.log(`    Load average: ${report.resources.loadAvg.join(' / ')} (${report.resources.cpus} CPUs)`);

  console.log('\n' + '═'.repeat(60));
}

// ─── Main ───
async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   CFX-010: Concurrent User Stress Test     ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`\nConfig: ${CONFIG.clients} clients, scenario=${CONFIG.scenario}, url=${CONFIG.url}`);
  console.log(`System: ${os.cpus().length} CPUs, ${Math.round(os.totalmem() / 1024 / 1024)} MB RAM`);

  metrics.startTime = Date.now();

  // Stats printer
  const statsTimer = setInterval(() => {
    recordSnapshot();
    const res = getSystemResources();
    console.log(`  [stats] active=${metrics.connectionsActive} sent=${metrics.messagesSent} recv=${metrics.messagesReceived} err=${metrics.errorsReceived} heap=${res.heapUsedMB}MB sys=${res.sysMemUsed}% load=${res.loadAvg[0]}`);
  }, CONFIG.statsIntervalMs);

  let clients = [];

  try {
    const scenarios = {
      ramp: scenarioRamp,
      burst: scenarioBurst,
      mixed: scenarioMixed,
      churn: scenarioChurn,
      sustained: scenarioSustained,
      'queue-flood': scenarioQueueFlood,
    };

    const scenarioFn = scenarios[CONFIG.scenario];
    if (!scenarioFn) {
      console.error(`Unknown scenario: ${CONFIG.scenario}. Available: ${Object.keys(scenarios).join(', ')}`);
      process.exit(1);
    }

    clients = await scenarioFn(CONFIG.clients);
  } catch (e) {
    console.error('Scenario error:', e.message);
  }

  clearInterval(statsTimer);
  recordSnapshot();

  // Cleanup
  clients.forEach(c => c.disconnect());
  await sleep(1000);

  // Generate and display report
  const report = generateReport();
  printReport(report);

  // Save report to file
  const reportPath = `${__dirname}/report-${CONFIG.scenario}-${CONFIG.clients}-${Date.now()}.json`;
  require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report saved: ${reportPath}`);

  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
