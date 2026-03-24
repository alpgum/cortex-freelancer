/**
 * CFX-026: Request Queue Manager
 * 
 * Manages the in-memory queue for chat requests with:
 * - FIFO processing order
 * - TTL-based expiration
 * - Status tracking through lifecycle
 * - Memory management and cleanup
 */

class QueueManager {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.requestTTL = options.requestTTL || 10 * 60 * 1000; // 10 minutes
    this.completedTTL = options.completedTTL || 5 * 60 * 1000; // 5 minutes
    
    // Request storage
    this.requests = new Map(); // id -> request object
    this.queue = []; // Array of request IDs in FIFO order
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      processedRequests: 0,
      erroredRequests: 0,
      expiredRequests: 0,
      cancelledRequests: 0
    };
    
    console.log('[Queue] Initialized with max size:', this.maxSize);
  }

  /**
   * Add a request to the queue
   */
  enqueue(request) {
    if (this.requests.size >= this.maxSize) {
      throw new Error('Queue is full');
    }

    // Set initial metadata
    request.status = 'queued';
    request.queuedAt = Date.now();
    request.expiresAt = Date.now() + this.requestTTL;

    // Store request and add to queue
    this.requests.set(request.id, request);
    this.queue.push(request.id);
    this.stats.totalRequests++;

    const position = this.queue.length;
    
    console.log(`[Queue] Enqueued request ${request.id} (position: ${position})`);
    
    return {
      position,
      estimatedWaitMs: Math.max(0, (position - 1) * 2000), // Rough estimate
      pollInterval: position === 1 ? 1000 : 2000
    };
  }

  /**
   * Get the next request to process (FIFO)
   */
  getNextRequest() {
    while (this.queue.length > 0) {
      const requestId = this.queue.shift();
      const request = this.requests.get(requestId);
      
      if (!request) {
        // Request was removed (cancelled/expired)
        continue;
      }

      if (this.isExpired(request)) {
        this.expireRequest(requestId);
        continue;
      }

      if (request.status !== 'queued') {
        // Request was already processed or cancelled
        continue;
      }

      return request;
    }
    
    return null;
  }

  /**
   * Get a request by ID
   */
  getRequest(requestId) {
    const request = this.requests.get(requestId);
    
    if (!request) {
      return null;
    }

    // Check if expired
    if (this.isExpired(request)) {
      this.expireRequest(requestId);
      return null;
    }

    return request;
  }

  /**
   * Update request status and metadata
   */
  updateStatus(requestId, status, metadata = {}) {
    const request = this.requests.get(requestId);
    if (!request) {
      console.warn(`[Queue] Attempted to update non-existent request: ${requestId}`);
      return false;
    }

    const oldStatus = request.status;
    request.status = status;
    request.lastUpdated = Date.now();

    // Apply metadata
    Object.assign(request, metadata);

    // Update statistics
    if (status === 'complete' && oldStatus !== 'complete') {
      this.stats.processedRequests++;
      
      // Set expiration for completed requests
      request.expiresAt = Date.now() + this.completedTTL;
    } else if (status === 'error' && oldStatus !== 'error') {
      this.stats.erroredRequests++;
      
      // Set expiration for errored requests
      request.expiresAt = Date.now() + this.completedTTL;
    }

    console.log(`[Queue] Request ${requestId}: ${oldStatus} → ${status}`);
    return true;
  }

  /**
   * Get position of a request in the queue
   */
  getPosition(requestId) {
    const index = this.queue.indexOf(requestId);
    return index === -1 ? 0 : index + 1;
  }

  /**
   * Cancel a request
   */
  cancelRequest(requestId) {
    const request = this.requests.get(requestId);
    
    if (!request) {
      return { found: false, message: 'Request not found' };
    }

    // Remove from queue if still queued
    const queueIndex = this.queue.indexOf(requestId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    // Cancel any running process
    if (request._process && typeof request._process.kill === 'function') {
      try {
        request._process.kill('SIGTERM');
        console.log(`[Queue] Killed process for request ${requestId}`);
      } catch (error) {
        console.warn(`[Queue] Failed to kill process for ${requestId}:`, error.message);
      }
    }

    // Update status
    this.updateStatus(requestId, 'cancelled');
    this.stats.cancelledRequests++;

    console.log(`[Queue] Cancelled request ${requestId}`);
    
    return { 
      found: true, 
      message: 'Request cancelled successfully' 
    };
  }

  /**
   * Check if we can accept new requests
   */
  canAcceptRequest() {
    return this.requests.size < this.maxSize;
  }

  /**
   * Check if a request has expired
   */
  isExpired(request) {
    return Date.now() > request.expiresAt;
  }

  /**
   * Mark a request as expired
   */
  expireRequest(requestId) {
    const request = this.requests.get(requestId);
    if (!request) return;

    // Remove from queue
    const queueIndex = this.queue.indexOf(requestId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    // Cancel any running process
    if (request._process && typeof request._process.kill === 'function') {
      try {
        request._process.kill('SIGTERM');
      } catch (error) {
        // Ignore kill errors
      }
    }

    this.updateStatus(requestId, 'expired');
    this.stats.expiredRequests++;
    
    console.log(`[Queue] Expired request ${requestId}`);
  }

  /**
   * Clean up expired requests and old completed requests
   */
  cleanup() {
    const now = Date.now();
    const initialSize = this.requests.size;
    let cleanedCount = 0;

    for (const [requestId, request] of this.requests.entries()) {
      if (now > request.expiresAt) {
        // Remove from queue if still there
        const queueIndex = this.queue.indexOf(requestId);
        if (queueIndex !== -1) {
          this.queue.splice(queueIndex, 1);
        }

        // Cancel any running process
        if (request._process && typeof request._process.kill === 'function') {
          try {
            request._process.kill('SIGTERM');
          } catch (error) {
            // Ignore kill errors during cleanup
          }
        }

        this.requests.delete(requestId);
        cleanedCount++;

        if (request.status === 'queued' || request.status === 'processing') {
          this.stats.expiredRequests++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Queue] Cleanup: removed ${cleanedCount} expired requests (${initialSize} → ${this.requests.size})`);
    }

    return cleanedCount;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const now = Date.now();
    let queuedCount = 0;
    let processingCount = 0;
    let completeCount = 0;
    let errorCount = 0;
    let oldestQueuedMs = 0;

    for (const request of this.requests.values()) {
      switch (request.status) {
        case 'queued':
          queuedCount++;
          if (request.queuedAt) {
            const waitTime = now - request.queuedAt;
            oldestQueuedMs = Math.max(oldestQueuedMs, waitTime);
          }
          break;
        case 'processing':
          processingCount++;
          break;
        case 'complete':
          completeCount++;
          break;
        case 'error':
          errorCount++;
          break;
      }
    }

    return {
      size: this.requests.size,
      maxSize: this.maxSize,
      queueLength: this.queue.length,
      utilization: Math.round((this.requests.size / this.maxSize) * 100),
      status: {
        queued: queuedCount,
        processing: processingCount,
        complete: completeCount,
        error: errorCount
      },
      oldestQueuedMs,
      total: this.stats
    };
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const request of this.requests.values()) {
      // Rough estimation of request size in memory
      totalSize += JSON.stringify(request).length * 2; // Rough Unicode factor
    }

    return {
      requestCount: this.requests.size,
      estimatedBytes: totalSize,
      estimatedMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
    };
  }

  /**
   * Shutdown cleanup
   */
  shutdown() {
    console.log(`[Queue] Shutting down with ${this.requests.size} active requests`);
    
    // Cancel all running processes
    let killedCount = 0;
    for (const request of this.requests.values()) {
      if (request._process && typeof request._process.kill === 'function') {
        try {
          request._process.kill('SIGTERM');
          killedCount++;
        } catch (error) {
          // Ignore errors during shutdown
        }
      }
    }

    if (killedCount > 0) {
      console.log(`[Queue] Killed ${killedCount} running processes`);
    }

    // Clear everything
    this.requests.clear();
    this.queue.length = 0;
  }
}

module.exports = QueueManager;