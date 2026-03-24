/**
 * Worker Pool Manager
 * Cortex Freelancer - CFX-028
 * Manages multiple workers for concurrent job processing
 */

const JobQueueManager = require('./job-queue');
const redisManager = require('./redis-client');
const config = require('./config');
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

class WorkerPoolManager {
  constructor() {
    this.workers = new Map();
    this.workerStats = new Map();
    this.isShuttingDown = false;
    this.totalWorkers = 0;
    this.activeJobs = 0;
    this.jobQueue = new JobQueueManager();
  }

  /**
   * Initialize worker pool
   */
  async initialize(workerCount = null) {
    try {
      // Determine optimal worker count
      const optimalWorkerCount = workerCount || this._calculateOptimalWorkerCount();
      
      // Initialize job queue system
      await this.jobQueue.initialize();
      
      console.log(`🏭 Initializing worker pool with ${optimalWorkerCount} workers`);
      
      // Create workers
      for (let i = 0; i < optimalWorkerCount; i++) {
        await this._createWorker(`worker-${i + 1}`);
      }

      // Start monitoring
      this._startHealthMonitoring();
      
      console.log(`✅ Worker pool initialized with ${this.workers.size} workers`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize worker pool:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal worker count based on system resources
   */
  _calculateOptimalWorkerCount() {
    const cpuCount = os.cpus().length;
    const memoryGB = Math.floor(os.totalmem() / (1024 * 1024 * 1024));
    
    // Conservative approach: 1 worker per 2 CPU cores, max based on available memory
    const cpuBasedCount = Math.max(1, Math.floor(cpuCount / 2));
    const memoryBasedCount = Math.max(1, Math.floor(memoryGB / 2)); // Assume 2GB per worker
    
    const optimalCount = Math.min(cpuBasedCount, memoryBasedCount, config.queue.worker.concurrency);
    
    console.log(`📊 Worker count calculation: CPU=${cpuCount} Memory=${memoryGB}GB Optimal=${optimalCount}`);
    return optimalCount;
  }

  /**
   * Create a new worker
   */
  async _createWorker(workerId) {
    try {
      const worker = await this.jobQueue.createWorker(
        async (jobData) => {
          return await this._processJob(workerId, jobData);
        },
        {
          name: workerId,
          concurrency: 1 // Each worker handles one job at a time
        }
      );

      // Set up worker event handlers
      worker.on('error', (error) => {
        console.error(`❌ Worker ${workerId} error:`, error);
        this._updateWorkerStats(workerId, 'error', error);
      });

      worker.on('failed', (job, error) => {
        console.error(`❌ Worker ${workerId} job failed:`, error);
        this._updateWorkerStats(workerId, 'failed', { job: job.id, error: error.message });
        this.activeJobs = Math.max(0, this.activeJobs - 1);
      });

      // Store worker info
      this.workers.set(workerId, {
        worker,
        createdAt: Date.now(),
        status: 'idle'
      });

      // Initialize worker stats
      this.workerStats.set(workerId, {
        jobsProcessed: 0,
        totalProcessingTime: 0,
        errors: 0,
        lastJobAt: null,
        averageProcessingTime: 0
      });

      this.totalWorkers++;
      console.log(`👷 Worker created: ${workerId}`);
      
      return worker;
    } catch (error) {
      console.error(`❌ Failed to create worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Process job in worker
   */
  async _processJob(workerId, jobData) {
    const startTime = Date.now();
    this.activeJobs++;
    
    // Update worker status
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.status = 'busy';
    }

    try {
      console.log(`🔧 Worker ${workerId} processing: ${jobData.jobType}`);
      
      // Route job to appropriate handler
      const result = await this._routeJob(jobData);
      
      const processingTime = Date.now() - startTime;
      this._updateWorkerStats(workerId, 'success', { processingTime });
      
      // Update worker status back to idle
      if (workerInfo) {
        workerInfo.status = 'idle';
      }
      
      this.activeJobs = Math.max(0, this.activeJobs - 1);
      
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this._updateWorkerStats(workerId, 'error', { processingTime, error: error.message });
      
      if (workerInfo) {
        workerInfo.status = 'error';
      }
      
      this.activeJobs = Math.max(0, this.activeJobs - 1);
      throw error;
    }
  }

  /**
   * Route job to appropriate handler based on job type
   */
  async _routeJob(jobData) {
    const { jobType, payload } = jobData;
    
    switch (jobType) {
      case 'openclaw_request':
        return await this._handleOpenClawRequest(payload);
      
      case 'freelancer_analysis':
        return await this._handleFreelancerAnalysis(payload);
      
      case 'proposal_generation':
        return await this._handleProposalGeneration(payload);
      
      case 'client_communication':
        return await this._handleClientCommunication(payload);
      
      case 'document_processing':
        return await this._handleDocumentProcessing(payload);
      
      case 'background_task':
        return await this._handleBackgroundTask(payload);
      
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  }

  /**
   * Handle OpenClaw request
   */
  async _handleOpenClawRequest(payload) {
    // This would integrate with the actual OpenClaw backend
    console.log('🤖 Processing OpenClaw request:', payload.prompt);
    
    // Simulate processing
    await this._simulateProcessing(1000, 3000);
    
    return {
      response: `Processed: ${payload.prompt}`,
      model: payload.model || 'claude-3.5-sonnet',
      usage: {
        input_tokens: 100,
        output_tokens: 150
      }
    };
  }

  /**
   * Handle freelancer analysis
   */
  async _handleFreelancerAnalysis(payload) {
    console.log('📊 Analyzing freelancer profile:', payload.profileId);
    
    await this._simulateProcessing(500, 2000);
    
    return {
      analysis: 'Profile analysis complete',
      strengths: ['Technical expertise', 'Communication skills'],
      recommendations: ['Update portfolio', 'Add certifications']
    };
  }

  /**
   * Handle proposal generation
   */
  async _handleProposalGeneration(payload) {
    console.log('📝 Generating proposal for:', payload.jobTitle);
    
    await this._simulateProcessing(2000, 5000);
    
    return {
      proposal: `Generated proposal for ${payload.jobTitle}`,
      sections: ['Introduction', 'Approach', 'Timeline', 'Pricing'],
      estimatedValue: payload.budget || 5000
    };
  }

  /**
   * Handle client communication
   */
  async _handleClientCommunication(payload) {
    console.log('📧 Processing client communication:', payload.communicationType);
    
    await this._simulateProcessing(500, 1500);
    
    return {
      messageId: `msg_${Date.now()}`,
      status: 'sent',
      type: payload.communicationType
    };
  }

  /**
   * Handle document processing
   */
  async _handleDocumentProcessing(payload) {
    console.log('📄 Processing document:', payload.documentType);
    
    await this._simulateProcessing(1000, 4000);
    
    return {
      documentId: `doc_${Date.now()}`,
      processed: true,
      extractedData: {},
      wordCount: 1200
    };
  }

  /**
   * Handle background task
   */
  async _handleBackgroundTask(payload) {
    console.log('🔄 Processing background task:', payload.taskType);
    
    await this._simulateProcessing(500, 2000);
    
    return {
      taskId: `task_${Date.now()}`,
      completed: true,
      result: 'Background task completed successfully'
    };
  }

  /**
   * Simulate processing time
   */
  async _simulateProcessing(minMs, maxMs) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Update worker statistics
   */
  _updateWorkerStats(workerId, event, data) {
    const stats = this.workerStats.get(workerId);
    if (!stats) return;

    const now = Date.now();

    switch (event) {
      case 'success':
        stats.jobsProcessed++;
        stats.totalProcessingTime += data.processingTime;
        stats.lastJobAt = now;
        stats.averageProcessingTime = stats.totalProcessingTime / stats.jobsProcessed;
        break;
      
      case 'error':
      case 'failed':
        stats.errors++;
        if (data.processingTime) {
          stats.totalProcessingTime += data.processingTime;
        }
        stats.lastJobAt = now;
        break;
    }
  }

  /**
   * Get worker pool statistics
   */
  async getPoolStats() {
    const queueStats = await this.jobQueue.getQueueStats();
    
    const workerStatsArray = Array.from(this.workerStats.entries()).map(([workerId, stats]) => {
      const workerInfo = this.workers.get(workerId);
      return {
        workerId,
        status: workerInfo?.status || 'unknown',
        ...stats
      };
    });

    return {
      totalWorkers: this.totalWorkers,
      activeJobs: this.activeJobs,
      workers: workerStatsArray,
      queues: queueStats,
      system: {
        cpuCount: os.cpus().length,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
  }

  /**
   * Scale worker pool
   */
  async scalePool(targetWorkerCount) {
    const currentCount = this.workers.size;
    
    if (targetWorkerCount > currentCount) {
      // Scale up
      const workersToAdd = targetWorkerCount - currentCount;
      console.log(`📈 Scaling up: adding ${workersToAdd} workers`);
      
      for (let i = 0; i < workersToAdd; i++) {
        const workerId = `worker-${currentCount + i + 1}`;
        await this._createWorker(workerId);
      }
    } else if (targetWorkerCount < currentCount) {
      // Scale down
      const workersToRemove = currentCount - targetWorkerCount;
      console.log(`📉 Scaling down: removing ${workersToRemove} workers`);
      
      // Remove excess workers (oldest first)
      const workerEntries = Array.from(this.workers.entries());
      workerEntries.sort((a, b) => a[1].createdAt - b[1].createdAt);
      
      for (let i = 0; i < workersToRemove; i++) {
        const [workerId, workerInfo] = workerEntries[i];
        await this._removeWorker(workerId, workerInfo);
      }
    }
    
    console.log(`⚖️ Pool scaled to ${this.workers.size} workers`);
  }

  /**
   * Remove a worker
   */
  async _removeWorker(workerId, workerInfo) {
    try {
      if (workerInfo.worker) {
        await workerInfo.worker.close();
      }
      
      this.workers.delete(workerId);
      this.workerStats.delete(workerId);
      this.totalWorkers--;
      
      console.log(`👷‍♂️ Worker removed: ${workerId}`);
    } catch (error) {
      console.error(`Error removing worker ${workerId}:`, error);
    }
  }

  /**
   * Start health monitoring
   */
  _startHealthMonitoring() {
    setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        const stats = await this.getPoolStats();
        
        // Check for unhealthy workers
        const unhealthyWorkers = stats.workers.filter(w => w.status === 'error');
        if (unhealthyWorkers.length > 0) {
          console.warn(`⚠️ Found ${unhealthyWorkers.length} unhealthy workers`);
        }
        
        // Auto-scaling logic could go here
        
      } catch (error) {
        console.error('Error in health monitoring:', error);
      }
    }, config.monitoring.healthCheckIntervalMs);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    console.log('🛑 Shutting down worker pool...');
    
    try {
      // Wait for active jobs to complete (with timeout)
      const shutdownTimeout = 30000; // 30 seconds
      const startTime = Date.now();
      
      while (this.activeJobs > 0 && (Date.now() - startTime) < shutdownTimeout) {
        console.log(`⏳ Waiting for ${this.activeJobs} active jobs to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Force close remaining workers
      for (const [workerId, workerInfo] of this.workers) {
        await this._removeWorker(workerId, workerInfo);
      }
      
      // Shutdown job queue
      await this.jobQueue.shutdown();
      
      console.log('✅ Worker pool shut down gracefully');
    } catch (error) {
      console.error('Error during worker pool shutdown:', error);
    }
  }
}

module.exports = WorkerPoolManager;