/**
 * Health Monitor for Redis Queue System
 * Cortex Freelancer - CFX-028
 * Monitors queue depth, processing latency, worker health, and system metrics
 */

const redisManager = require('./redis-client');
const config = require('./config');

class HealthMonitor {
  constructor() {
    this.metrics = new Map();
    this.alerts = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.lastHealthCheck = null;
    this.startTime = Date.now();
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.isMonitoring) {
      console.log('⚠️ Health monitoring already started');
      return;
    }

    this.isMonitoring = true;
    console.log('🔍 Starting health monitoring...');

    // Start periodic health checks
    this.monitoringInterval = setInterval(() => {
      this._performHealthCheck();
    }, config.monitoring.healthCheckIntervalMs);

    // Perform initial check
    this._performHealthCheck();
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('🔍 Health monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async _performHealthCheck() {
    try {
      const timestamp = Date.now();
      
      // Collect all metrics
      const [
        redisHealth,
        queueMetrics,
        systemMetrics,
        performanceMetrics
      ] = await Promise.all([
        this._checkRedisHealth(),
        this._collectQueueMetrics(),
        this._collectSystemMetrics(),
        this._collectPerformanceMetrics()
      ]);

      // Combine all metrics
      const healthReport = {
        timestamp,
        uptime: timestamp - this.startTime,
        redis: redisHealth,
        queues: queueMetrics,
        system: systemMetrics,
        performance: performanceMetrics
      };

      // Store latest metrics
      this.metrics.set(timestamp, healthReport);
      this.lastHealthCheck = healthReport;

      // Check for alerts
      await this._checkAlertConditions(healthReport);

      // Clean up old metrics (keep last 100 entries)
      if (this.metrics.size > 100) {
        const oldestKey = this.metrics.keys().next().value;
        this.metrics.delete(oldestKey);
      }

      // Log health status
      this._logHealthStatus(healthReport);

    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  /**
   * Check Redis health
   */
  async _checkRedisHealth() {
    try {
      const health = await redisManager.healthCheck();
      const redis = redisManager.getClient();
      
      const info = await redis.info();
      const memoryUsage = await redis.memory('usage');
      
      return {
        ...health,
        info: this._parseRedisInfo(info),
        memoryUsage: memoryUsage || 0
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  _parseRedisInfo(infoString) {
    const info = {};
    const lines = infoString.split('\r\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#') && line.includes(':')) {
        const [key, value] = line.split(':');
        info[key] = isNaN(value) ? value : Number(value);
      }
    }
    
    return {
      version: info.redis_version,
      connectedClients: info.connected_clients,
      usedMemory: info.used_memory,
      totalCommandsProcessed: info.total_commands_processed,
      instantaneousOpsPerSec: info.instantaneous_ops_per_sec
    };
  }

  /**
   * Collect queue metrics
   */
  async _collectQueueMetrics() {
    try {
      const redis = redisManager.getClient();
      const queueNames = Object.values(config.queue.names);
      const metrics = {};

      for (const queueName of queueNames) {
        try {
          // Get queue lengths using Redis LIST operations
          const [waiting, failed] = await Promise.all([
            redis.llen(`bull:${queueName}:waiting`),
            redis.llen(`bull:${queueName}:failed`)
          ]);

          metrics[queueName] = {
            waiting: waiting || 0,
            failed: failed || 0,
            healthy: true
          };
        } catch (error) {
          metrics[queueName] = {
            waiting: 0,
            failed: 0,
            healthy: false,
            error: error.message
          };
        }
      }

      return metrics;
    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  /**
   * Collect system metrics
   */
  async _collectSystemMetrics() {
    const os = require('os');
    
    return {
      cpu: {
        count: os.cpus().length,
        loadAverage: os.loadavg(),
        model: os.cpus()[0]?.model || 'unknown'
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      platform: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release()
      }
    };
  }

  /**
   * Collect performance metrics
   */
  async _collectPerformanceMetrics() {
    try {
      const redis = redisManager.getClient();
      
      // Get performance stats from Redis
      const latencyKey = 'cortex:performance:latency';
      const throughputKey = 'cortex:performance:throughput';
      
      const [latencyData, throughputData] = await Promise.all([
        redis.lrange(latencyKey, 0, 99), // Last 100 latency measurements
        redis.lrange(throughputKey, 0, 99) // Last 100 throughput measurements
      ]);

      const latencies = latencyData.map(Number).filter(n => !isNaN(n));
      const throughputs = throughputData.map(Number).filter(n => !isNaN(n));

      return {
        latency: {
          samples: latencies.length,
          average: latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 0,
          min: latencies.length > 0 ? Math.min(...latencies) : 0,
          max: latencies.length > 0 ? Math.max(...latencies) : 0
        },
        throughput: {
          samples: throughputs.length,
          average: throughputs.length > 0 ? throughputs.reduce((a, b) => a + b) / throughputs.length : 0,
          current: throughputs.length > 0 ? throughputs[throughputs.length - 1] : 0
        }
      };
    } catch (error) {
      return {
        latency: { error: error.message },
        throughput: { error: error.message }
      };
    }
  }

  /**
   * Check alert conditions
   */
  async _checkAlertConditions(healthReport) {
    const alerts = [];
    const thresholds = config.monitoring.thresholds;

    // Check queue depth alerts
    if (healthReport.queues) {
      for (const [queueName, queueData] of Object.entries(healthReport.queues)) {
        const totalDepth = (queueData.waiting || 0) + (queueData.failed || 0);
        
        if (totalDepth >= thresholds.queueDepthCritical) {
          alerts.push({
            level: 'critical',
            type: 'queue_depth',
            message: `Queue ${queueName} depth critical: ${totalDepth}`,
            value: totalDepth,
            threshold: thresholds.queueDepthCritical
          });
        } else if (totalDepth >= thresholds.queueDepthWarning) {
          alerts.push({
            level: 'warning',
            type: 'queue_depth',
            message: `Queue ${queueName} depth warning: ${totalDepth}`,
            value: totalDepth,
            threshold: thresholds.queueDepthWarning
          });
        }
      }
    }

    // Check latency alerts
    if (healthReport.performance?.latency?.average) {
      const avgLatency = healthReport.performance.latency.average;
      
      if (avgLatency >= thresholds.avgLatencyCriticalMs) {
        alerts.push({
          level: 'critical',
          type: 'latency',
          message: `Average latency critical: ${avgLatency}ms`,
          value: avgLatency,
          threshold: thresholds.avgLatencyCriticalMs
        });
      } else if (avgLatency >= thresholds.avgLatencyWarningMs) {
        alerts.push({
          level: 'warning',
          type: 'latency',
          message: `Average latency warning: ${avgLatency}ms`,
          value: avgLatency,
          threshold: thresholds.avgLatencyWarningMs
        });
      }
    }

    // Check Redis health
    if (!healthReport.redis?.healthy) {
      alerts.push({
        level: 'critical',
        type: 'redis_health',
        message: `Redis unhealthy: ${healthReport.redis?.error || 'Unknown error'}`,
        value: false
      });
    }

    // Check memory usage
    if (healthReport.system?.memory?.usagePercent > 90) {
      alerts.push({
        level: 'critical',
        type: 'memory',
        message: `High memory usage: ${healthReport.system.memory.usagePercent.toFixed(1)}%`,
        value: healthReport.system.memory.usagePercent
      });
    }

    // Store and log alerts
    if (alerts.length > 0) {
      this.alerts.push(...alerts);
      this._logAlerts(alerts);
    }

    return alerts;
  }

  /**
   * Log health status
   */
  _logHealthStatus(healthReport) {
    const redisStatus = healthReport.redis?.healthy ? '✅' : '❌';
    const memoryPercent = healthReport.system?.memory?.usagePercent?.toFixed(1) || 'N/A';
    const avgLatency = healthReport.performance?.latency?.average?.toFixed(1) || 'N/A';
    
    console.log(`🔍 Health: Redis ${redisStatus} | Memory ${memoryPercent}% | Latency ${avgLatency}ms`);
  }

  /**
   * Log alerts
   */
  _logAlerts(alerts) {
    for (const alert of alerts) {
      const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
      console.log(`${emoji} ALERT [${alert.level}] ${alert.message}`);
    }
  }

  /**
   * Record performance metric
   */
  async recordLatency(latencyMs) {
    try {
      const redis = redisManager.getClient();
      const latencyKey = 'cortex:performance:latency';
      
      // Add latency measurement
      await redis.lpush(latencyKey, latencyMs);
      
      // Keep only last 100 measurements
      await redis.ltrim(latencyKey, 0, 99);
    } catch (error) {
      console.error('Error recording latency:', error);
    }
  }

  /**
   * Record throughput metric
   */
  async recordThroughput(requestsPerSecond) {
    try {
      const redis = redisManager.getClient();
      const throughputKey = 'cortex:performance:throughput';
      
      await redis.lpush(throughputKey, requestsPerSecond);
      await redis.ltrim(throughputKey, 0, 99);
    } catch (error) {
      console.error('Error recording throughput:', error);
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return {
      isMonitoring: this.isMonitoring,
      lastCheck: this.lastHealthCheck,
      recentAlerts: this.alerts.slice(-10), // Last 10 alerts
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Get health metrics for API endpoint
   */
  getHealthMetrics() {
    const latest = this.lastHealthCheck;
    if (!latest) {
      return {
        status: 'unknown',
        message: 'No health data available'
      };
    }

    const isHealthy = latest.redis?.healthy && 
                     latest.system?.memory?.usagePercent < 95 &&
                     (latest.performance?.latency?.average || 0) < config.monitoring.thresholds.avgLatencyCriticalMs;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: latest.timestamp,
      uptime: latest.uptime,
      redis: {
        connected: latest.redis?.healthy || false,
        latency: latest.redis?.latency || null
      },
      system: {
        memory: latest.system?.memory?.usagePercent || null,
        cpu: latest.system?.cpu?.loadAverage?.[0] || null
      },
      performance: {
        avgLatency: latest.performance?.latency?.average || null,
        throughput: latest.performance?.throughput?.current || null
      },
      alerts: this.alerts.slice(-5) // Last 5 alerts
    };
  }
}

module.exports = HealthMonitor;