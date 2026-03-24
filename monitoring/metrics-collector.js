/**
 * CFX-020: Metrics Collector
 * 
 * In-memory metrics collection with rolling windows.
 * Collects HTTP latency, error rates, throughput, and resource usage.
 * Exposes via /api/metrics endpoint.
 */

'use strict';

const os = require('os');

// ── Ring Buffer for time-series data ──
class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.size = 0;
  }

  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) this.size++;
  }

  toArray() {
    if (this.size < this.capacity) {
      return this.buffer.slice(0, this.size);
    }
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head)
    ];
  }

  last(n) {
    const arr = this.toArray();
    return arr.slice(Math.max(0, arr.length - n));
  }
}

// ── Histogram for latency percentiles ──
class Histogram {
  constructor(maxSize = 10000) {
    this.values = [];
    this.maxSize = maxSize;
  }

  record(value) {
    this.values.push(value);
    if (this.values.length > this.maxSize) {
      // Keep last half when overflow
      this.values = this.values.slice(-Math.floor(this.maxSize / 2));
    }
  }

  percentile(p) {
    if (this.values.length === 0) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  reset() {
    this.values = [];
  }

  get count() { return this.values.length; }
  get mean() {
    if (this.values.length === 0) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }
}

// ── Main Metrics Store ──
class MetricsCollector {
  constructor() {
    // Request counters (rolling 1-minute windows)
    this.requestCount = 0;
    this.errorCount4xx = 0;
    this.errorCount5xx = 0;
    this.minuteStart = Date.now();

    // Per-minute history (24h = 1440 minutes)
    this.minuteHistory = new RingBuffer(1440);
    
    // Per-hour history (30 days = 720 hours)
    this.hourHistory = new RingBuffer(720);

    // Latency histograms (reset every minute)
    this.httpLatency = new Histogram(5000);
    this.wsLatency = new Histogram(2000);

    // Active connection gauges
    this.activeConnections = {
      http: 0,
      websocket: 0,
      sse: 0,
    };

    // Business counters
    this.business = {
      messagesProcessed: 0,
      chatSessions: 0,
      apiCalls: 0,
    };

    // Uptime tracking
    this.startTime = Date.now();
    this.healthCheckResults = new RingBuffer(1440); // 24h of per-minute checks

    // Status code distribution
    this.statusCodes = {};

    // Endpoint latencies
    this.endpointLatencies = {};

    // Start periodic collection
    this._startPeriodicCollection();
  }

  // ── HTTP Request Tracking (Express middleware) ──
  middleware() {
    return (req, res, next) => {
      const start = process.hrtime.bigint();
      this.requestCount++;
      this.activeConnections.http++;

      // Track response
      const originalEnd = res.end;
      res.end = (...args) => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        this.activeConnections.http--;

        // Record latency
        this.httpLatency.record(durationMs);

        // Track per-endpoint latency
        const route = req.route?.path || req.path;
        if (!this.endpointLatencies[route]) {
          this.endpointLatencies[route] = new Histogram(1000);
        }
        this.endpointLatencies[route].record(durationMs);

        // Track status codes
        const code = res.statusCode;
        this.statusCodes[code] = (this.statusCodes[code] || 0) + 1;

        if (code >= 400 && code < 500) this.errorCount4xx++;
        if (code >= 500) this.errorCount5xx++;

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  // ── WebSocket Connection Tracking ──
  trackWsConnect() {
    this.activeConnections.websocket++;
  }

  trackWsDisconnect() {
    this.activeConnections.websocket = Math.max(0, this.activeConnections.websocket - 1);
  }

  trackWsMessage(latencyMs) {
    this.business.messagesProcessed++;
    if (latencyMs !== undefined) {
      this.wsLatency.record(latencyMs);
    }
  }

  // ── SSE Connection Tracking ──
  trackSseConnect() {
    this.activeConnections.sse++;
  }

  trackSseDisconnect() {
    this.activeConnections.sse = Math.max(0, this.activeConnections.sse - 1);
  }

  // ── Business Metric Tracking ──
  trackChatSession() {
    this.business.chatSessions++;
  }

  trackApiCall() {
    this.business.apiCalls++;
  }

  // ── Periodic Data Collection ──
  _startPeriodicCollection() {
    // Every minute: snapshot and rotate
    this._minuteInterval = setInterval(() => this._minuteSnapshot(), 60_000);

    // Every hour: aggregate minute data
    this._hourInterval = setInterval(() => this._hourSnapshot(), 3600_000);

    // Prevent intervals from keeping process alive
    if (this._minuteInterval.unref) this._minuteInterval.unref();
    if (this._hourInterval.unref) this._hourInterval.unref();
  }

  _minuteSnapshot() {
    const now = Date.now();
    const elapsed = (now - this.minuteStart) / 1000; // seconds

    const snapshot = {
      timestamp: new Date(now).toISOString(),
      requests: this.requestCount,
      rps: elapsed > 0 ? Math.round((this.requestCount / elapsed) * 100) / 100 : 0,
      errors4xx: this.errorCount4xx,
      errors5xx: this.errorCount5xx,
      errorRate: this.requestCount > 0
        ? Math.round((this.errorCount5xx / this.requestCount) * 10000) / 100
        : 0,
      latency: {
        p50: Math.round(this.httpLatency.percentile(50) * 100) / 100,
        p95: Math.round(this.httpLatency.percentile(95) * 100) / 100,
        p99: Math.round(this.httpLatency.percentile(99) * 100) / 100,
        mean: Math.round(this.httpLatency.mean * 100) / 100,
      },
      connections: { ...this.activeConnections },
      system: this._getSystemMetrics(),
    };

    this.minuteHistory.push(snapshot);

    // Reset minute counters
    this.requestCount = 0;
    this.errorCount4xx = 0;
    this.errorCount5xx = 0;
    this.httpLatency.reset();
    this.wsLatency.reset();
    this.minuteStart = now;
  }

  _hourSnapshot() {
    const minutes = this.minuteHistory.last(60);
    if (minutes.length === 0) return;

    const totalRequests = minutes.reduce((s, m) => s + m.requests, 0);
    const totalErrors = minutes.reduce((s, m) => s + m.errors5xx, 0);
    const avgLatency = minutes.reduce((s, m) => s + m.latency.p50, 0) / minutes.length;
    const maxLatency = Math.max(...minutes.map(m => m.latency.p99));

    this.hourHistory.push({
      timestamp: new Date().toISOString(),
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 10000) / 100 : 0,
      avgLatencyP50: Math.round(avgLatency * 100) / 100,
      maxLatencyP99: Math.round(maxLatency * 100) / 100,
      avgConnections: {
        websocket: Math.round(minutes.reduce((s, m) => s + m.connections.websocket, 0) / minutes.length),
        sse: Math.round(minutes.reduce((s, m) => s + m.connections.sse, 0) / minutes.length),
      },
    });
  }

  _getSystemMetrics() {
    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 10) / 10,
        rssMB: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
        heapPercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
      },
      cpu: {
        loadAvg1m: os.loadavg()[0],
        loadAvg5m: os.loadavg()[1],
        loadAvg15m: os.loadavg()[2],
        userMs: Math.round(cpuUsage.user / 1000),
        systemMs: Math.round(cpuUsage.system / 1000),
      },
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      platform: process.env.RAILWAY_ENVIRONMENT ? 'railway'
        : process.env.RENDER ? 'render'
        : process.env.DIGITALOCEAN ? 'digitalocean'
        : process.env.VERCEL ? 'vercel'
        : 'local',
    };
  }

  // ── Get Current Snapshot ──
  getCurrentMetrics() {
    const now = Date.now();
    const elapsed = (now - this.minuteStart) / 1000;

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.round((now - this.startTime) / 1000),
      current: {
        rps: elapsed > 0 ? Math.round((this.requestCount / elapsed) * 100) / 100 : 0,
        requests: this.requestCount,
        errors4xx: this.errorCount4xx,
        errors5xx: this.errorCount5xx,
        errorRate: this.requestCount > 0
          ? Math.round((this.errorCount5xx / this.requestCount) * 10000) / 100
          : 0,
        latency: {
          p50: Math.round(this.httpLatency.percentile(50) * 100) / 100,
          p95: Math.round(this.httpLatency.percentile(95) * 100) / 100,
          p99: Math.round(this.httpLatency.percentile(99) * 100) / 100,
          mean: Math.round(this.httpLatency.mean * 100) / 100,
          count: this.httpLatency.count,
        },
        wsLatency: {
          p50: Math.round(this.wsLatency.percentile(50) * 100) / 100,
          p95: Math.round(this.wsLatency.percentile(95) * 100) / 100,
        },
      },
      connections: { ...this.activeConnections },
      business: { ...this.business },
      system: this._getSystemMetrics(),
      statusCodes: { ...this.statusCodes },
    };
  }

  // ── Get Historical Data ──
  getHistory(period = '1h') {
    switch (period) {
      case '1h':
        return this.minuteHistory.last(60);
      case '6h':
        return this.minuteHistory.last(360);
      case '24h':
        return this.minuteHistory.toArray();
      case '7d':
        return this.hourHistory.last(168);
      case '30d':
        return this.hourHistory.toArray();
      default:
        return this.minuteHistory.last(60);
    }
  }

  // ── Top Slow Endpoints ──
  getSlowEndpoints(limit = 10) {
    return Object.entries(this.endpointLatencies)
      .map(([path, hist]) => ({
        path,
        p50: Math.round(hist.percentile(50) * 100) / 100,
        p95: Math.round(hist.percentile(95) * 100) / 100,
        p99: Math.round(hist.percentile(99) * 100) / 100,
        count: hist.count,
      }))
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, limit);
  }

  // ── Cleanup ──
  destroy() {
    clearInterval(this._minuteInterval);
    clearInterval(this._hourInterval);
  }
}

// Singleton instance
const collector = new MetricsCollector();

module.exports = collector;
module.exports.MetricsCollector = MetricsCollector;
