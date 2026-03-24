/**
 * Redis Client Manager
 * Cortex Freelancer - CFX-028
 * Handles Redis connection with cluster support and failover
 */

const Redis = require('ioredis');
const config = require('./config');

class RedisClientManager {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.isConnected = false;
    this.connectionListeners = new Set();
  }

  /**
   * Initialize Redis connections
   */
  async connect() {
    try {
      if (config.redis.cluster.enabled) {
        await this._connectCluster();
      } else {
        await this._connectStandalone();
      }

      this.isConnected = true;
      console.log('✅ Redis connected successfully');
      this._notifyListeners('connected');
      
      return true;
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      this.isConnected = false;
      this._notifyListeners('error', error);
      throw error;
    }
  }

  /**
   * Connect to Redis cluster
   */
  async _connectCluster() {
    const clusterOptions = {
      ...config.redis.options,
      redisOptions: {
        password: config.redis.password
      }
    };

    this.client = new Redis.Cluster(config.redis.cluster.nodes, clusterOptions);
    this.subscriber = new Redis.Cluster(config.redis.cluster.nodes, clusterOptions);
    this.publisher = new Redis.Cluster(config.redis.cluster.nodes, clusterOptions);

    await Promise.all([
      this.client.ping(),
      this.subscriber.ping(),
      this.publisher.ping()
    ]);
  }

  /**
   * Connect to standalone Redis
   */
  async _connectStandalone() {
    const connectionConfig = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      ...config.redis.options
    };

    this.client = new Redis(connectionConfig);
    this.subscriber = new Redis(connectionConfig);
    this.publisher = new Redis(connectionConfig);

    await Promise.all([
      this.client.ping(),
      this.subscriber.ping(),
      this.publisher.ping()
    ]);
  }

  /**
   * Get main Redis client
   */
  getClient() {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  /**
   * Get subscriber client (for pub/sub)
   */
  getSubscriber() {
    if (!this.isConnected) {
      throw new Error('Redis subscriber not connected');
    }
    return this.subscriber;
  }

  /**
   * Get publisher client (for pub/sub)
   */
  getPublisher() {
    if (!this.isConnected) {
      throw new Error('Redis publisher not connected');
    }
    return this.publisher;
  }

  /**
   * Add connection status listener
   */
  onConnectionChange(callback) {
    this.connectionListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  /**
   * Notify connection listeners
   */
  _notifyListeners(event, data) {
    this.connectionListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { healthy: false, error: 'Not connected' };
      }

      const startTime = Date.now();
      await this.client.ping();
      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency,
        connection: config.redis.cluster.enabled ? 'cluster' : 'standalone'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Graceful disconnect
   */
  async disconnect() {
    try {
      if (this.client) await this.client.quit();
      if (this.subscriber) await this.subscriber.quit();
      if (this.publisher) await this.publisher.quit();
      
      this.isConnected = false;
      console.log('🔌 Redis disconnected');
      this._notifyListeners('disconnected');
    } catch (error) {
      console.error('Error disconnecting Redis:', error);
    }
  }
}

// Singleton instance
const redisManager = new RedisClientManager();
module.exports = redisManager;