#!/usr/bin/env node

/**
 * CFX-027: gRPC Streaming Performance Benchmarks
 * 
 * Measures latency, throughput, and concurrent connection handling.
 * Run against a live gRPC server on port 50051.
 * 
 * Usage:
 *   node tests/grpc-benchmark.test.js              # Full benchmark suite
 *   node tests/grpc-benchmark.test.js --quick       # Quick smoke test
 *   node tests/grpc-benchmark.test.js --concurrent  # Concurrent connections only
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { randomUUID } = require('crypto');

const PROTO_PATH = path.join(__dirname, '..', 'proto', 'chat.proto');
const SERVER_ADDR = process.env.GRPC_TEST_ADDR || 'localhost:50052';
const QUICK_MODE = process.argv.includes('--quick');
const CONCURRENT_ONLY = process.argv.includes('--concurrent');

let chatProto, server;

// ── Helpers ──

function createClient(addr) {
  return new chatProto.ChatService(addr || SERVER_ADDR, grpc.credentials.createInsecure());
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

function formatTable(rows) {
  console.log('');
  rows.forEach(r => console.log('  ' + r));
  console.log('');
}

// ── Mock Server (self-contained testing) ──

async function startMockServer() {
  const pkg = protoLoader.loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
  chatProto = grpc.loadPackageDefinition(pkg).cortex.chat;

  server = new grpc.Server();

  const mockTokens = 'When pricing a freelance project you should consider scope complexity timeline market rates your expertise level and the value you bring to the client'.split(' ');

  server.addService(chatProto.ChatService.service, {
    HealthCheck: (call, cb) => {
      cb(null, { status: 'SERVING', timestamp: Date.now().toString(), version: '1.0.0-bench', metrics: { active_connections: 0, total_requests: 0, avg_response_ms: 0, error_count: 0, uptime_ms: Date.now() } });
    },

    StreamChat: (call) => {
      const rid = call.request.request_id || randomUUID();
      const sid = call.request.session_id || randomUUID();
      const start = Date.now();

      call.write({ type: 'THINKING', session_id: sid, request_id: rid, timestamp: Date.now().toString(), thinking: 'Processing...' });

      let i = 0;
      const iv = setInterval(() => {
        if (i < mockTokens.length) {
          call.write({ type: 'TOKEN', session_id: sid, request_id: rid, timestamp: Date.now().toString(), token: mockTokens[i] + ' ' });
          i++;
        } else {
          clearInterval(iv);
          call.write({ type: 'COMPLETE', session_id: sid, request_id: rid, timestamp: Date.now().toString(), complete: { full_response: mockTokens.join(' '), total_tokens: mockTokens.length, response_time_ms: Date.now() - start, finish_reason: 'stop' } });
          call.write({ type: 'USAGE', session_id: sid, request_id: rid, timestamp: Date.now().toString(), usage: { input_tokens: 50, output_tokens: mockTokens.length, total_tokens: 50 + mockTokens.length, model: 'mock' } });
          call.end();
        }
      }, 5); // 5ms per token for fast benchmarks
    },

    InteractiveChat: (call) => {
      call.on('data', (req) => {
        call.write({ type: 'TOKEN', session_id: 'bench', request_id: req.request_id || randomUUID(), timestamp: Date.now().toString(), token: 'Echo: ' + req.message });
        call.write({ type: 'COMPLETE', session_id: 'bench', request_id: req.request_id || randomUUID(), timestamp: Date.now().toString(), complete: { full_response: 'Echo: ' + req.message, total_tokens: 2, response_time_ms: 1, finish_reason: 'stop' } });
      });
      call.on('end', () => call.end());
    },

    GetSessionMetrics: (call, cb) => {
      cb(null, { session_id: call.request.session_id, message_count: 0, avg_response_ms: 5, session_start_ms: Date.now(), last_activity_ms: Date.now(), total_usage: { total_tokens: 0, model: 'mock' } });
    }
  });

  return new Promise((resolve, reject) => {
    const port = parseInt(SERVER_ADDR.split(':')[1]) || 50052;
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return reject(err);
      console.log(`Mock gRPC server on port ${port}`);
      resolve();
    });
  });
}

// ── Benchmarks ──

async function benchHealthCheck(client, iterations = 100) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint();
    await new Promise((res, rej) => {
      client.HealthCheck({ service: 'bench', timestamp: Date.now().toString() }, (err, resp) => err ? rej(err) : res(resp));
    });
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return times;
}

async function benchStreamChat(client, iterations = 20) {
  const results = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint();
    let firstTokenMs = null;
    let totalTokens = 0;

    await new Promise((resolve, reject) => {
      const stream = client.StreamChat({
        session_id: 'bench-' + i,
        message: 'How do I price my freelance services?',
        request_id: 'req-' + i,
        timestamp: Date.now().toString(),
        settings: { model: 'mock', stream_tokens: true }
      });

      stream.on('data', (resp) => {
        if (resp.type === 'TOKEN') {
          if (firstTokenMs === null) firstTokenMs = Number(process.hrtime.bigint() - t0) / 1e6;
          totalTokens++;
        }
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const totalMs = Number(process.hrtime.bigint() - t0) / 1e6;
    results.push({ totalMs, firstTokenMs: firstTokenMs || totalMs, totalTokens });
  }
  return results;
}

async function benchConcurrent(client, concurrency = 10) {
  const t0 = process.hrtime.bigint();

  const promises = Array.from({ length: concurrency }, (_, i) => {
    return new Promise((resolve, reject) => {
      const stream = client.StreamChat({
        session_id: 'conc-' + i,
        message: 'Concurrent test message ' + i,
        request_id: 'conc-req-' + i,
        timestamp: Date.now().toString(),
        settings: { model: 'mock', stream_tokens: true }
      });

      let tokens = 0;
      const start = process.hrtime.bigint();

      stream.on('data', (resp) => { if (resp.type === 'TOKEN') tokens++; });
      stream.on('end', () => resolve({ tokens, ms: Number(process.hrtime.bigint() - start) / 1e6 }));
      stream.on('error', reject);
    });
  });

  const results = await Promise.all(promises);
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  return { results, wallMs, concurrency };
}

// ── Main ──

async function run() {
  console.log('═══════════════════════════════════════════');
  console.log('  CFX-027 gRPC Streaming Benchmark Suite');
  console.log('═══════════════════════════════════════════\n');

  await startMockServer();
  const client = createClient();

  // Warm up
  await benchHealthCheck(client, 5);

  if (!CONCURRENT_ONLY) {
    // 1. Health Check Latency
    console.log('── Health Check Latency ──');
    const iters = QUICK_MODE ? 20 : 100;
    const healthTimes = await benchHealthCheck(client, iters);
    formatTable([
      `Iterations:  ${iters}`,
      `Min:         ${Math.min(...healthTimes).toFixed(2)} ms`,
      `Median:      ${percentile(healthTimes, 50).toFixed(2)} ms`,
      `p95:         ${percentile(healthTimes, 95).toFixed(2)} ms`,
      `p99:         ${percentile(healthTimes, 99).toFixed(2)} ms`,
      `Max:         ${Math.max(...healthTimes).toFixed(2)} ms`,
      `Avg:         ${(healthTimes.reduce((a, b) => a + b, 0) / healthTimes.length).toFixed(2)} ms`,
    ]);

    // 2. Streaming Chat Latency
    console.log('── Streaming Chat Latency ──');
    const streamIters = QUICK_MODE ? 5 : 20;
    const streamResults = await benchStreamChat(client, streamIters);
    const firstTokenTimes = streamResults.map(r => r.firstTokenMs);
    const totalTimes = streamResults.map(r => r.totalMs);
    const tokenCounts = streamResults.map(r => r.totalTokens);
    formatTable([
      `Iterations:       ${streamIters}`,
      `First Token (med): ${percentile(firstTokenTimes, 50).toFixed(2)} ms`,
      `First Token (p95): ${percentile(firstTokenTimes, 95).toFixed(2)} ms`,
      `Full Response (med): ${percentile(totalTimes, 50).toFixed(2)} ms`,
      `Full Response (p95): ${percentile(totalTimes, 95).toFixed(2)} ms`,
      `Avg Tokens/resp:   ${(tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length).toFixed(0)}`,
      `Throughput:        ${(tokenCounts.reduce((a, b) => a + b, 0) / (totalTimes.reduce((a, b) => a + b, 0) / 1000)).toFixed(0)} tokens/sec`,
    ]);
  }

  // 3. Concurrent Connections
  console.log('── Concurrent Connection Test ──');
  const levels = QUICK_MODE ? [5, 10] : [5, 10, 25, 50];
  for (const n of levels) {
    const conc = await benchConcurrent(client, n);
    const perStreamMs = conc.results.map(r => r.ms);
    console.log(`  ${n} concurrent:`);
    console.log(`    Wall time:     ${conc.wallMs.toFixed(0)} ms`);
    console.log(`    Avg/stream:    ${(perStreamMs.reduce((a, b) => a + b, 0) / perStreamMs.length).toFixed(0)} ms`);
    console.log(`    Max/stream:    ${Math.max(...perStreamMs).toFixed(0)} ms`);
    console.log(`    Total tokens:  ${conc.results.reduce((a, r) => a + r.tokens, 0)}`);
    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('  Benchmark complete ✓');
  console.log('═══════════════════════════════════════════\n');

  // Cleanup
  server.tryShutdown(() => process.exit(0));
}

run().catch(err => {
  console.error('Benchmark failed:', err);
  if (server) server.tryShutdown(() => {});
  process.exit(1);
});
