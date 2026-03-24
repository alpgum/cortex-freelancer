/**
 * CFX-026: Rate Limiter
 * 
 * Simple IP-based rate limiting with sliding window.
 * Prevents abuse and ensures fair resource allocation.
 */

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 5 * 60 * 1000; // 5 minutes
    this.maxRequests = options.maxRequests || 20; // 20 requests per window
    this.cleanupInterval = options.cleanupInterval || 60 * 1000; // 1 minute cleanup
    
    // Client tracking: clientKey -> { requests: [timestamp], blocked: boolean, blockedUntil: timestamp }
    this.clients = new Map();
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      uniqueClients: 0
    };
    
    // Start cleanup interval
    this.startCleanup();
    
    console.log(`[RateLimit] Initialized: ${this.maxRequests} requests per ${this.windowMs / 1000}s window`);
  }

  /**
   * Check if a client is within rate limits
   * @param {string} clientKey - Client identifier (IP address)
   * @returns {Object} - { allowed: boolean, remaining: number, resetTime: number, retryAfter?: number }
   */
  checkLimit(clientKey) {
    this.stats.totalRequests++;
    
    const now = Date.now();
    let client = this.clients.get(clientKey);
    
    // Initialize new client
    if (!client) {
      client = {
        requests: [],
        blocked: false,
        blockedUntil: 0
      };
      this.clients.set(clientKey, client);
      this.stats.uniqueClients = this.clients.size;
    }

    // Check if client is temporarily blocked
    if (client.blocked && now < client.blockedUntil) {
      this.stats.blockedRequests++;
      return {
        allowed: false,
        remaining: 0,
        resetTime: client.blockedUntil,
        retryAfter: Math.ceil((client.blockedUntil - now) / 1000),
        limit: this.maxRequests
      };
    }

    // Remove expired requests from sliding window
    const windowStart = now - this.windowMs;
    client.requests = client.requests.filter(timestamp => timestamp > windowStart);
    
    // Clear blocked status if expired
    if (client.blocked && now >= client.blockedUntil) {
      client.blocked = false;
      client.blockedUntil = 0;
    }

    // Check if within limits
    if (client.requests.length >= this.maxRequests) {
      // Block client for remaining window time
      const oldestRequest = Math.min(...client.requests);
      const blockUntil = oldestRequest + this.windowMs;
      
      client.blocked = true;
      client.blockedUntil = blockUntil;
      
      this.stats.blockedRequests++;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockUntil,
        retryAfter: Math.ceil((blockUntil - now) / 1000),
        limit: this.maxRequests
      };
    }

    // Allow request and record timestamp
    client.requests.push(now);
    this.stats.allowedRequests++;
    
    const remaining = this.maxRequests - client.requests.length;
    const oldestRequest = client.requests[0] || now;
    const resetTime = oldestRequest + this.windowMs;
    
    return {
      allowed: true,
      remaining,
      resetTime,
      limit: this.maxRequests
    };
  }

  /**
   * Get current rate limit status for a client
   */
  getStatus(clientKey) {
    const client = this.clients.get(clientKey);
    const now = Date.now();
    
    if (!client) {
      return {
        remaining: this.maxRequests,
        resetTime: now + this.windowMs,
        limit: this.maxRequests,
        blocked: false
      };
    }

    // Remove expired requests
    const windowStart = now - this.windowMs;
    client.requests = client.requests.filter(timestamp => timestamp > windowStart);
    
    const remaining = Math.max(0, this.maxRequests - client.requests.length);
    const oldestRequest = client.requests[0] || now;
    const resetTime = oldestRequest + this.windowMs;
    const blocked = client.blocked && now < client.blockedUntil;

    return {
      remaining,
      resetTime,
      limit: this.maxRequests,
      blocked,
      blockedUntil: client.blockedUntil
    };
  }

  /**
   * Manually block a client (for abuse prevention)
   */
  blockClient(clientKey, durationMs = 60 * 60 * 1000) {
    let client = this.clients.get(clientKey);
    
    if (!client) {
      client = { requests: [], blocked: false, blockedUntil: 0 };
      this.clients.set(clientKey, client);
    }

    client.blocked = true;
    client.blockedUntil = Date.now() + durationMs;
    
    console.log(`[RateLimit] Manually blocked client ${clientKey} for ${durationMs / 1000}s`);
  }

  /**
   * Unblock a client
   */
  unblockClient(clientKey) {
    const client = this.clients.get(clientKey);
    if (client) {
      client.blocked = false;
      client.blockedUntil = 0;
      console.log(`[RateLimit] Unblocked client ${clientKey}`);
    }
  }

  /**
   * Get all currently blocked clients
   */
  getBlockedClients() {
    const now = Date.now();
    const blocked = [];
    
    for (const [clientKey, client] of this.clients.entries()) {
      if (client.blocked && now < client.blockedUntil) {
        blocked.push({
          clientKey,
          blockedUntil: client.blockedUntil,
          remainingMs: client.blockedUntil - now
        });
      }
    }
    
    return blocked;
  }

  /**
   * Get rate limiter statistics
   */
  getStats() {
    const now = Date.now();
    let activeClients = 0;
    let blockedClients = 0;
    let totalRequests = 0;

    for (const client of this.clients.values()) {
      // Count requests in current window
      const windowStart = now - this.windowMs;
      const recentRequests = client.requests.filter(timestamp => timestamp > windowStart);
      
      if (recentRequests.length > 0) {
        activeClients++;
        totalRequests += recentRequests.length;
      }
      
      if (client.blocked && now < client.blockedUntil) {
        blockedClients++;
      }
    }

    return {
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
      clients: {
        total: this.clients.size,
        active: activeClients,
        blocked: blockedClients
      },
      requests: {
        currentWindow: totalRequests,
        ...this.stats
      }
    };
  }

  /**
   * Clean up old clients and expired data
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let removedClients = 0;
    let cleanedRequests = 0;

    for (const [clientKey, client] of this.clients.entries()) {
      // Clean old requests
      const originalLength = client.requests.length;
      client.requests = client.requests.filter(timestamp => timestamp > windowStart);
      cleanedRequests += originalLength - client.requests.length;

      // Clear expired blocks
      if (client.blocked && now >= client.blockedUntil) {
        client.blocked = false;
        client.blockedUntil = 0;
      }

      // Remove clients with no recent activity and not blocked
      if (client.requests.length === 0 && !client.blocked) {
        this.clients.delete(clientKey);
        removedClients++;
      }
    }

    this.stats.uniqueClients = this.clients.size;

    if (removedClients > 0 || cleanedRequests > 0) {
      console.log(`[RateLimit] Cleanup: removed ${removedClients} clients, ${cleanedRequests} old requests`);
    }

    return { removedClients, cleanedRequests };
  }

  /**
   * Start automatic cleanup
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval).unref();
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Reset all rate limiting data
   */
  reset() {
    this.clients.clear();
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      uniqueClients: 0
    };
    console.log('[RateLimit] Reset all data');
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, client] of this.clients.entries()) {
      totalSize += key.length * 2; // String key
      totalSize += client.requests.length * 8; // Timestamps (8 bytes each)
      totalSize += 24; // Object overhead
    }

    return {
      clients: this.clients.size,
      estimatedBytes: totalSize,
      estimatedMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
    };
  }
}

module.exports = RateLimiter;