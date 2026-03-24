/**
 * Redis Queue System - Main Entry Point
 * Cortex Freelancer - CFX-028
 * Exports all components and provides easy initialization
 */

const redisManager = require('./redis-client');
const JobQueueManager = require('./job-queue');
const WorkerPoolManager = require('./worker-pool');
const HealthMonitor = require('./health-monitor');
const PubSubBroker = require('./pubsub-broker');
const RedisStreamsManager = require('./streams-manager');
const QueueServer = require('./queue-server');
const CortexQueueClient = require('./client-adapter');
const config = require('./config');

/**
 * Main queue system orchestrator
 */
class CortexQueueSystem {
  constructor(options = {}) {
    this.config = { ...config, ...options };
    this.initialized = false;
    
    // Core components
    this.redisManager = redisManager;
    this.jobQueue = new JobQueueManager();
    this.workerPool = new WorkerPoolManager();
    this.healthMonitor = new HealthMonitor();
    this.pubsubBroker = new PubSubBroker();
    this.streamsManager = new RedisStreamsManager();
    this.server = options.server ? new QueueServer(options.server) : null;
  }

  /**
   * Initialize the entire queue system
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️ Queue system already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing Cortex Queue System...');

      // Initialize Redis connection
      await this.redisManager.connect();
      
      // Initialize job queue
      await this.jobQueue.initialize();
      
      // Initialize pub/sub broker
      await this.pubsubBroker.initialize();
      
      // Initialize streams
      await this.streamsManager.initialize();
      
      // Initialize worker pool
      await this.workerPool.initialize();
      
      // Start health monitoring
      this.healthMonitor.start();
      
      console.log('✅ Cortex Queue System initialized successfully');
      this.initialized = true;
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize queue system:', error);
      throw error;
    }
  }

  /**
   * Start the complete system including HTTP server
   */
  async start(serverOptions = {}) {
    await this.initialize();
    
    if (this.server) {
      await this.server.start();
    } else {
      // Create and start server
      this.server = new QueueServer(serverOptions);
      await this.server.start();
    }
    
    // Set up graceful shutdown
    this.server.setupGracefulShutdown();
    
    console.log('🎉 Cortex Queue System fully operational');
  }

  /**
   * Submit a job (convenience method)
   */
  async submitJob(jobType, payload, options = {}) {
    if (!this.initialized) {
      throw new Error('Queue system not initialized');
    }
    
    return await this.jobQueue.submitJob(jobType, payload, options);
  }

  /**
   * Get system status
   */
  async getStatus() {
    if (!this.initialized) {
      return { initialized: false };
    }

    try {
      const [
        redisHealth,
        queueStats,
        workerStats,
        healthMetrics
      ] = await Promise.all([
        this.redisManager.healthCheck(),
        this.jobQueue.getQueueStats(),
        this.workerPool.getPoolStats(),
        this.healthMonitor.getHealthMetrics()
      ]);

      return {
        initialized: true,
        timestamp: Date.now(),
        redis: redisHealth,
        queues: queueStats,
        workers: workerStats,
        health: healthMetrics,
        server: {
          running: this.server?.isRunning || false,
          port: this.server?.port
        }
      };
    } catch (error) {
      return {
        initialized: true,
        error: error.message
      };
    }
  }

  /**
   * Shutdown the entire system
   */
  async shutdown() {
    if (!this.initialized) return;

    console.log('🛑 Shutting down Cortex Queue System...');
    
    try {
      // Stop server if running
      if (this.server) {
        await this.server.stop();
      }
      
      // Stop health monitoring
      this.healthMonitor.stop();
      
      // Shutdown worker pool
      await this.workerPool.shutdown();
      
      // Shutdown job queue
      await this.jobQueue.shutdown();
      
      // Cleanup pub/sub
      await this.pubsubBroker.cleanup();
      
      // Disconnect Redis
      await this.redisManager.disconnect();
      
      this.initialized = false;
      console.log('✅ Cortex Queue System shut down gracefully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

/**
 * Create a client instance
 */
function createClient(options = {}) {
  return new CortexQueueClient(options);
}

/**
 * Quick start function for development
 */
async function quickStart(options = {}) {
  const system = new CortexQueueSystem(options);
  await system.start({
    port: options.port || 3848
  });
  return system;
}

// Export everything
module.exports = {
  // Main system
  CortexQueueSystem,
  
  // Individual components
  redisManager,
  JobQueueManager,
  WorkerPoolManager,
  HealthMonitor,
  PubSubBroker,
  RedisStreamsManager,
  QueueServer,
  CortexQueueClient,
  
  // Configuration
  config,
  
  // Utilities
  createClient,
  quickStart
};

// CLI support
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      quickStart({
        port: parseInt(process.argv[3]) || 3848
      }).then(() => {
        console.log('Queue system started from CLI');
      }).catch(console.error);
      break;
      
    case 'test':
      // Run a simple test
      (async () => {
        const system = new CortexQueueSystem();
        await system.initialize();
        
        // Submit test job
        const result = await system.submitJob('test', { message: 'Hello World' });
        console.log('Test job submitted:', result);
        
        await system.shutdown();
      })().catch(console.error);
      break;
      
    default:
      console.log('Usage: node index.js [start|test] [port]');
  }
}