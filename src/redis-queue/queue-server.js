/**
 * Queue Server - Express server with Redis queue endpoints
 * Cortex Freelancer - CFX-028
 * Provides HTTP/SSE endpoints for job submission and monitoring
 */

const express = require('express');
const cors = require('cors');
const redisManager = require('./redis-client');
const JobQueueManager = require('./job-queue');
const WorkerPoolManager = require('./worker-pool');
const HealthMonitor = require('./health-monitor');
const PubSubBroker = require('./pubsub-broker');
const RedisStreamsManager = require('./streams-manager');
const config = require('./config');

class QueueServer {
  constructor(options = {}) {
    this.app = express();
    this.server = null;
    this.port = options.port || 3848;
    this.isRunning = false;
    
    // Initialize components
    this.jobQueue = new JobQueueManager();
    this.workerPool = new WorkerPoolManager();
    this.healthMonitor = new HealthMonitor();
    this.pubsubBroker = new PubSubBroker();
    this.streamsManager = new RedisStreamsManager();
    
    // SSE connections
    this.sseClients = new Map();
    
    this._setupMiddleware();
    this._setupRoutes();
    this._setupErrorHandling();
  }

  /**
   * Set up Express middleware
   */
  _setupMiddleware() {
    // CORS
    this.app.use(cors({
      origin: true,
      credentials: true
    }));

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`📥 ${timestamp} ${req.method} ${req.path} - ${req.get('X-Client-ID') || 'unknown'}`);
      next();
    });

    // Client ID validation
    this.app.use('/api/queue', (req, res, next) => {
      if (!req.get('X-Client-ID')) {
        return res.status(400).json({
          success: false,
          error: 'X-Client-ID header required'
        });
      }
      next();
    });
  }

  /**
   * Set up API routes
   */
  _setupRoutes() {
    // Health check endpoint
    this.app.get('/api/queue/health', (req, res) => {
      const health = this.healthMonitor.getHealthMetrics();
      res.json(health);
    });

    // Submit job
    this.app.post('/api/queue/submit', async (req, res) => {
      try {
        const { jobType, payload, priority, timeout } = req.body;
        const clientId = req.get('X-Client-ID');

        if (!jobType || !payload) {
          return res.status(400).json({
            success: false,
            error: 'jobType and payload are required'
          });
        }

        const result = await this.jobQueue.submitJob(jobType, payload, {
          clientId,
          priority,
          timeout
        });

        res.json({
          success: true,
          ...result
        });
      } catch (error) {
        console.error('Job submission error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get job status
    this.app.get('/api/queue/status/:correlationId', async (req, res) => {
      try {
        const { correlationId } = req.params;
        // Implementation would check job status in Redis
        // For now, return placeholder
        res.json({
          correlationId,
          status: 'processing',
          submittedAt: Date.now(),
          estimatedCompletion: Date.now() + 30000
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get job result
    this.app.get('/api/queue/result/:correlationId', async (req, res) => {
      try {
        const { correlationId } = req.params;
        // Implementation would check for completed job result
        // For now, return not ready
        res.json({
          correlationId,
          completed: false,
          message: 'Job still processing'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Cancel job
    this.app.post('/api/queue/cancel/:correlationId', async (req, res) => {
      try {
        const { correlationId } = req.params;
        // Implementation would cancel job
        res.json({
          success: true,
          correlationId,
          message: 'Job cancelled'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get queue statistics
    this.app.get('/api/queue/stats', async (req, res) => {
      try {
        const [queueStats, poolStats, health] = await Promise.all([
          this.jobQueue.getQueueStats(),
          this.workerPool.getPoolStats(),
          this.healthMonitor.getHealthMetrics()
        ]);

        res.json({
          queues: queueStats,
          workers: poolStats,
          health,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Server-Sent Events endpoint
    this.app.get('/api/queue/events', (req, res) => {
      const clientId = req.query.clientId;
      if (!clientId) {
        return res.status(400).json({
          error: 'clientId query parameter required'
        });
      }

      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Store client connection
      this.sseClients.set(clientId, res);

      // Send initial connection message
      this._sendSSEMessage(res, 'connected', {
        clientId,
        timestamp: Date.now()
      });

      // Handle client disconnect
      req.on('close', () => {
        this.sseClients.delete(clientId);
        console.log(`📡 SSE client disconnected: ${clientId}`);
      });

      console.log(`📡 SSE client connected: ${clientId}`);
    });

    // Admin endpoints for monitoring
    this.app.get('/api/queue/admin/metrics', async (req, res) => {
      try {
        const metrics = this.healthMonitor.getHealthStatus();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/queue/admin/workers', async (req, res) => {
      try {
        const stats = await this.workerPool.getPoolStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Set up error handling
   */
  _setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('❌ Unhandled error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  /**
   * Send SSE message to client
   */
  _sendSSEMessage(res, type, data) {
    const message = {
      type,
      timestamp: Date.now(),
      ...data
    };

    res.write(`data: ${JSON.stringify(message)}\n\n`);
  }

  /**
   * Broadcast message to all SSE clients
   */
  _broadcastSSEMessage(type, data) {
    for (const [clientId, res] of this.sseClients) {
      try {
        this._sendSSEMessage(res, type, data);
      } catch (error) {
        console.error(`Error sending SSE to ${clientId}:`, error);
        this.sseClients.delete(clientId);
      }
    }
  }

  /**
   * Send message to specific SSE client
   */
  _sendToSSEClient(clientId, type, data) {
    const res = this.sseClients.get(clientId);
    if (res) {
      try {
        this._sendSSEMessage(res, type, data);
      } catch (error) {
        console.error(`Error sending SSE to ${clientId}:`, error);
        this.sseClients.delete(clientId);
      }
    }
  }

  /**
   * Start the queue server
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Queue server already running');
      return;
    }

    try {
      console.log('🚀 Starting queue server...');

      // Initialize all components
      await redisManager.connect();
      await this.jobQueue.initialize();
      await this.workerPool.initialize();
      await this.pubsubBroker.initialize();
      await this.streamsManager.initialize();

      // Start health monitoring
      this.healthMonitor.start();

      // Set up job completion notifications
      this._setupJobNotifications();

      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        console.log(`✅ Queue server running on port ${this.port}`);
        this.isRunning = true;
      });

      // Handle server errors
      this.server.on('error', (error) => {
        console.error('❌ Server error:', error);
      });

    } catch (error) {
      console.error('❌ Failed to start queue server:', error);
      throw error;
    }
  }

  /**
   * Set up job completion notifications
   */
  _setupJobNotifications() {
    // Listen for job responses and notify clients via SSE
    this.jobQueue.listenForResponses('*', (response) => {
      if (response.correlationId) {
        this._broadcastSSEMessage('job_completed', {
          correlationId: response.correlationId,
          payload: response
        });
      }
    });
  }

  /**
   * Stop the queue server
   */
  async stop() {
    if (!this.isRunning) return;

    console.log('🛑 Stopping queue server...');
    this.isRunning = false;

    try {
      // Close SSE connections
      for (const [clientId, res] of this.sseClients) {
        res.end();
      }
      this.sseClients.clear();

      // Stop health monitoring
      this.healthMonitor.stop();

      // Shutdown components
      await this.workerPool.shutdown();
      await this.jobQueue.shutdown();
      await this.pubsubBroker.cleanup();
      await redisManager.disconnect();

      // Close HTTP server
      if (this.server) {
        await new Promise((resolve, reject) => {
          this.server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      console.log('✅ Queue server stopped gracefully');
    } catch (error) {
      console.error('❌ Error stopping queue server:', error);
    }
  }

  /**
   * Graceful shutdown handler
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

module.exports = QueueServer;