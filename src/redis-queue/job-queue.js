/**
 * Job Queue Manager with BullMQ
 * Cortex Freelancer - CFX-028
 */

const { Queue, Worker } = require('bullmq');
const redisManager = require('./redis-client');
const config = require('./config');
const { v4: uuidv4 } = require('uuid');

class JobQueueManager {
  constructor() {
    this.queues = new Map();
    this.workers = new Map();
    this.responseHandlers = new Map();
    this.isShuttingDown = false;
  }

  /**
   * Initialize the job queue system
   */
  async initialize() {
    try {
      // Ensure Redis is connected
      await redisManager.connect();
      
      // Create main job queue
      await this._createQueue(config.queue.names.cortex_jobs);
      
      // Create response queue for async responses
      await this._createQueue(config.queue.names.cortex_responses);
      
      // Create dead letter queue
      await this._createQueue(config.queue.names.cortex_deadletter);

      console.log('✅ Job queue system initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize job queue:', error);
      throw error;
    }
  }

  /**
   * Create a queue with configuration
   */
  async _createQueue(queueName) {
    const queue = new Queue(queueName, {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db
      },
      defaultJobOptions: config.queue.defaultJobOptions
    });

    this.queues.set(queueName, queue);
    return queue;
  }

  /**
   * Submit a job to the queue
   */
  async submitJob(jobType, payload, options = {}) {
    const queue = this.queues.get(config.queue.names.cortex_jobs);
    if (!queue) {
      throw new Error('Job queue not initialized');
    }

    const correlationId = uuidv4();
    const jobData = {
      correlationId,
      jobType,
      payload,
      timestamp: Date.now(),
      clientId: options.clientId || 'unknown'
    };

    const jobOptions = {
      priority: options.priority || config.queue.priorities.NORMAL,
      delay: options.delay || 0,
      attempts: options.attempts || config.queue.defaultJobOptions.attempts,
      removeOnComplete: options.removeOnComplete ?? config.queue.defaultJobOptions.removeOnComplete,
      removeOnFail: options.removeOnFail ?? config.queue.defaultJobOptions.removeOnFail,
      ...options.jobOptions
    };

    const job = await queue.add(jobType, jobData, jobOptions);
    
    console.log(`📤 Job submitted: ${jobType} (${correlationId})`);
    
    return {
      jobId: job.id,
      correlationId,
      queueName: config.queue.names.cortex_jobs
    };
  }

  /**
   * Submit a high priority urgent job
   */
  async submitUrgentJob(jobType, payload, options = {}) {
    return this.submitJob(jobType, payload, {
      ...options,
      priority: config.queue.priorities.URGENT,
      attempts: 5 // More attempts for urgent jobs
    });
  }

  /**
   * Submit a background job
   */
  async submitBackgroundJob(jobType, payload, options = {}) {
    return this.submitJob(jobType, payload, {
      ...options,
      priority: config.queue.priorities.BACKGROUND,
      delay: 5000, // 5 second delay
      attempts: 1 // Fewer attempts for background jobs
    });
  }

  /**
   * Create a worker to process jobs
   */
  async createWorker(jobProcessor, options = {}) {
    const workerName = options.name || `worker-${Date.now()}`;
    const concurrency = options.concurrency || config.queue.worker.concurrency;

    const worker = new Worker(
      config.queue.names.cortex_jobs,
      async (job) => {
        const startTime = Date.now();
        console.log(`🔧 Processing job: ${job.data.jobType} (${job.data.correlationId})`);
        
        try {
          // Process the job
          const result = await jobProcessor(job.data);
          
          const processingTime = Date.now() - startTime;
          console.log(`✅ Job completed: ${job.data.jobType} (${job.data.correlationId}) - ${processingTime}ms`);
          
          // Send response back via response queue
          await this._sendJobResponse(job.data.correlationId, {
            success: true,
            result,
            processingTime,
            jobType: job.data.jobType
          });

          return result;
        } catch (error) {
          const processingTime = Date.now() - startTime;
          console.error(`❌ Job failed: ${job.data.jobType} (${job.data.correlationId}) - ${error.message}`);
          
          // Send error response
          await this._sendJobResponse(job.data.correlationId, {
            success: false,
            error: error.message,
            processingTime,
            jobType: job.data.jobType
          });

          throw error; // Re-throw to trigger retry mechanism
        }
      },
      {
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          db: config.redis.db
        },
        concurrency,
        ...config.queue.worker.settings
      }
    );

    // Error handling
    worker.on('error', (error) => {
      console.error(`Worker ${workerName} error:`, error);
    });

    worker.on('failed', (job, error) => {
      console.error(`Job ${job.id} failed:`, error);
      this._handleJobFailure(job, error);
    });

    this.workers.set(workerName, worker);
    console.log(`👷 Worker created: ${workerName} (concurrency: ${concurrency})`);
    
    return worker;
  }

  /**
   * Send response via response queue
   */
  async _sendJobResponse(correlationId, responseData) {
    const responseQueue = this.queues.get(config.queue.names.cortex_responses);
    if (!responseQueue) return;

    await responseQueue.add('response', {
      correlationId,
      ...responseData,
      timestamp: Date.now()
    }, {
      removeOnComplete: 10,
      removeOnFail: 5
    });
  }

  /**
   * Listen for job responses
   */
  async listenForResponses(correlationId, callback) {
    this.responseHandlers.set(correlationId, callback);
    
    // Set up response worker if not already created
    if (!this.workers.has('response-worker')) {
      const responseWorker = new Worker(
        config.queue.names.cortex_responses,
        async (job) => {
          const { correlationId, ...responseData } = job.data;
          const handler = this.responseHandlers.get(correlationId);
          
          if (handler) {
            handler(responseData);
            this.responseHandlers.delete(correlationId);
          }
        },
        {
          connection: {
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db
          }
        }
      );

      this.workers.set('response-worker', responseWorker);
    }
  }

  /**
   * Handle job failure and dead letter queue
   */
  async _handleJobFailure(job, error) {
    const failureCount = await this._getJobFailureCount(job.data.correlationId);
    
    if (failureCount >= config.deadLetter.maxRetries) {
      // Move to dead letter queue
      const deadLetterQueue = this.queues.get(config.queue.names.cortex_deadletter);
      if (deadLetterQueue) {
        await deadLetterQueue.add('failed-job', {
          originalJob: job.data,
          error: error.message,
          failureCount,
          timestamp: Date.now()
        });
        
        console.log(`💀 Job moved to dead letter queue: ${job.data.correlationId}`);
      }
    }
  }

  /**
   * Get job failure count
   */
  async _getJobFailureCount(correlationId) {
    const redisClient = redisManager.getClient();
    const count = await redisClient.get(`failure_count:${correlationId}`);
    return parseInt(count) || 0;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const stats = {};
    
    for (const [queueName, queue] of this.queues) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ]);

        stats[queueName] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length
        };
      } catch (error) {
        stats[queueName] = { error: error.message };
      }
    }
    
    return stats;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    console.log('🛑 Shutting down job queue system...');
    
    try {
      // Close all workers
      for (const [name, worker] of this.workers) {
        console.log(`Closing worker: ${name}`);
        await worker.close();
      }
      
      // Close all queues
      for (const [name, queue] of this.queues) {
        console.log(`Closing queue: ${name}`);
        await queue.close();
      }
      
      console.log('✅ Job queue system shut down gracefully');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

module.exports = JobQueueManager;