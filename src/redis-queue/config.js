/**
 * Redis Queue Configuration
 * Cortex Freelancer - CFX-028
 */

module.exports = {
  redis: {
    // Redis connection configuration
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    
    // Redis cluster configuration
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES 
        ? process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
            const [host, port] = node.trim().split(':');
            return { host, port: parseInt(port) || 6379 };
          })
        : [{ host: 'localhost', port: 6379 }]
    },

    // Connection options
    options: {
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000
    }
  },

  queue: {
    // Queue names
    names: {
      cortex_jobs: 'cortex:jobs',
      cortex_responses: 'cortex:responses', 
      cortex_deadletter: 'cortex:deadletter'
    },

    // Job priorities
    priorities: {
      URGENT: 10,
      NORMAL: 5,
      BACKGROUND: 1
    },

    // Default job options
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
        setting: {}
      },
      removeOnComplete: 50,
      removeOnFail: 100,
      delay: 0
    },

    // Worker configuration
    worker: {
      concurrency: parseInt(process.env.QUEUE_WORKER_CONCURRENCY) || 4,
      maxStalledCount: 1,
      stalledInterval: 30000,
      settings: {
        stalledInterval: 30000,
        maxStalledCount: 1
      }
    },

    // Rate limiting
    rateLimiter: {
      max: parseInt(process.env.QUEUE_RATE_LIMIT_MAX) || 100,
      duration: parseInt(process.env.QUEUE_RATE_LIMIT_DURATION) || 60000 // 1 minute
    }
  },

  streams: {
    // Redis Streams configuration
    maxLen: parseInt(process.env.REDIS_STREAM_MAXLEN) || 10000,
    trimStrategy: 'MAXLEN',
    consumer: {
      group: 'cortex-workers',
      name: `worker-${process.pid}`,
      readTimeoutMs: 5000,
      blockTimeoutMs: 1000
    }
  },

  monitoring: {
    // Monitoring intervals
    healthCheckIntervalMs: 30000,
    metricsIntervalMs: 10000,
    
    // Alert thresholds
    thresholds: {
      queueDepthWarning: 100,
      queueDepthCritical: 500,
      avgLatencyWarningMs: 5000,
      avgLatencyCriticalMs: 10000,
      failureRateWarning: 0.05, // 5%
      failureRateCritical: 0.15  // 15%
    }
  },

  deadLetter: {
    // Dead letter queue configuration
    maxRetries: 3,
    retryDelay: 5000,
    poisonThreshold: 5, // Max failures before marking as poison
    cleanupIntervalMs: 3600000 // 1 hour
  }
};