/**
 * CFX-020: Alert Manager
 * 
 * Threshold-based alerting with cooldown periods.
 * Sends notifications via webhook (Slack, Discord, email via Zapier, etc.)
 */

'use strict';

const https = require('https');
const http = require('http');

// ── Default Thresholds ──
const DEFAULT_THRESHOLDS = {
  errorRate: { warning: 1, critical: 5 },           // percentage
  responseTimeP95: { warning: 500, critical: 2000 }, // ms
  memoryPercent: { warning: 80, critical: 95 },      // %
  eventLoopLag: { warning: 50, critical: 200 },      // ms
  wsConnections: { warning: 800, critical: 950 },    // count (of ~1000 limit)
  cpuLoad: { warning: 2.0, critical: 4.0 },          // load average
  diskPercent: { warning: 80, critical: 90 },         // %
};

class AlertManager {
  constructor(options = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    this.webhookUrl = options.webhookUrl || process.env.ALERT_WEBHOOK_URL;
    this.emailWebhookUrl = options.emailWebhookUrl || process.env.ALERT_EMAIL_WEBHOOK_URL;
    this.cooldownMs = options.cooldownMs || 5 * 60 * 1000; // 5 min cooldown per alert type
    this.enabled = options.enabled !== false;

    // Track last alert times to prevent spam
    this._lastAlertTime = {};
    // Track current alert states (for recovery notifications)
    this._activeAlerts = new Map();
    // Alert history
    this._history = [];
    this._maxHistory = 500;
  }

  /**
   * Evaluate metrics against thresholds.
   * Call this periodically (e.g., every minute from metrics collector).
   */
  evaluate(metrics) {
    if (!this.enabled) return;

    const alerts = [];

    // Error rate
    if (metrics.current?.errorRate !== undefined) {
      alerts.push(...this._check('errorRate', metrics.current.errorRate, '%'));
    }

    // Response time P95
    if (metrics.current?.latency?.p95 !== undefined) {
      alerts.push(...this._check('responseTimeP95', metrics.current.latency.p95, 'ms'));
    }

    // Memory
    if (metrics.system?.memory?.heapPercent !== undefined) {
      alerts.push(...this._check('memoryPercent', metrics.system.memory.heapPercent, '%'));
    }

    // CPU load
    if (metrics.system?.cpu?.loadAvg1m !== undefined) {
      alerts.push(...this._check('cpuLoad', metrics.system.cpu.loadAvg1m, ''));
    }

    // WebSocket connections
    if (metrics.connections?.websocket !== undefined) {
      alerts.push(...this._check('wsConnections', metrics.connections.websocket, ' connections'));
    }

    // Check for recoveries
    this._checkRecoveries(metrics);

    // Send any new alerts
    for (const alert of alerts) {
      this._sendAlert(alert);
    }

    return alerts;
  }

  _check(metricName, value, unit) {
    const threshold = this.thresholds[metricName];
    if (!threshold) return [];

    const alerts = [];

    if (value >= threshold.critical) {
      const alert = {
        level: 'critical',
        metric: metricName,
        value,
        threshold: threshold.critical,
        unit,
        message: `🚨 CRITICAL: ${metricName} = ${value}${unit} (threshold: ${threshold.critical}${unit})`,
        timestamp: new Date().toISOString(),
      };
      if (this._shouldAlert(metricName, 'critical')) {
        alerts.push(alert);
        this._activeAlerts.set(metricName, alert);
      }
    } else if (value >= threshold.warning) {
      const alert = {
        level: 'warning',
        metric: metricName,
        value,
        threshold: threshold.warning,
        unit,
        message: `⚠️ WARNING: ${metricName} = ${value}${unit} (threshold: ${threshold.warning}${unit})`,
        timestamp: new Date().toISOString(),
      };
      if (this._shouldAlert(metricName, 'warning')) {
        alerts.push(alert);
        this._activeAlerts.set(metricName, alert);
      }
    }

    return alerts;
  }

  _checkRecoveries(metrics) {
    for (const [metricName, activeAlert] of this._activeAlerts.entries()) {
      const threshold = this.thresholds[metricName];
      if (!threshold) continue;

      let currentValue;
      switch (metricName) {
        case 'errorRate': currentValue = metrics.current?.errorRate; break;
        case 'responseTimeP95': currentValue = metrics.current?.latency?.p95; break;
        case 'memoryPercent': currentValue = metrics.system?.memory?.heapPercent; break;
        case 'cpuLoad': currentValue = metrics.system?.cpu?.loadAvg1m; break;
        case 'wsConnections': currentValue = metrics.connections?.websocket; break;
        default: continue;
      }

      if (currentValue !== undefined && currentValue < threshold.warning) {
        // Recovered!
        const recovery = {
          level: 'recovery',
          metric: metricName,
          value: currentValue,
          previousValue: activeAlert.value,
          message: `✅ RECOVERED: ${metricName} back to ${currentValue}${activeAlert.unit} (was ${activeAlert.value}${activeAlert.unit})`,
          timestamp: new Date().toISOString(),
        };
        this._sendAlert(recovery);
        this._activeAlerts.delete(metricName);
      }
    }
  }

  _shouldAlert(metricName, level) {
    const key = `${metricName}:${level}`;
    const lastTime = this._lastAlertTime[key];
    const now = Date.now();

    if (lastTime && (now - lastTime) < this.cooldownMs) {
      return false; // In cooldown
    }

    this._lastAlertTime[key] = now;
    return true;
  }

  async _sendAlert(alert) {
    // Add to history
    this._history.push(alert);
    if (this._history.length > this._maxHistory) {
      this._history = this._history.slice(-Math.floor(this._maxHistory / 2));
    }

    // Log locally
    console.log(`[ALERT] ${alert.message}`);

    // Send to webhook if configured
    if (this.webhookUrl) {
      try {
        await this._postWebhook(this.webhookUrl, {
          text: alert.message,
          // Slack-compatible format
          blocks: [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${alert.level.toUpperCase()}*\n${alert.message}`,
            },
          }],
          // Discord-compatible format
          content: alert.message,
          embeds: [{
            title: `${alert.level.toUpperCase()}: ${alert.metric}`,
            description: alert.message,
            color: alert.level === 'critical' ? 0xFF4757
              : alert.level === 'warning' ? 0xFFC107
              : 0x00D26A,
            timestamp: alert.timestamp,
          }],
        });
      } catch (err) {
        console.error('[ALERT] Webhook delivery failed:', err.message);
      }
    }
  }

  _postWebhook(url, payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;

      const req = transport.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 5000,
      }, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Webhook returned ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Webhook timeout')); });
      req.write(data);
      req.end();
    });
  }

  // ── Public API ──
  getActiveAlerts() {
    return Array.from(this._activeAlerts.values());
  }

  getHistory(limit = 50) {
    return this._history.slice(-limit);
  }

  getThresholds() {
    return { ...this.thresholds };
  }

  updateThreshold(metric, level, value) {
    if (this.thresholds[metric] && this.thresholds[metric][level] !== undefined) {
      this.thresholds[metric][level] = value;
      return true;
    }
    return false;
  }
}

module.exports = AlertManager;
