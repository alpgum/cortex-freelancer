/**
 * Redis Pub/Sub Message Broker
 * Cortex Freelancer - CFX-028
 * Real-time message broker between web client and OpenClaw backend
 */

const redisManager = require('./redis-client');
const { v4: uuidv4 } = require('uuid');

class PubSubBroker {
  constructor() {
    this.channels = new Map();
    this.subscriptions = new Map();
    this.correlationCallbacks = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize pub/sub system
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      await redisManager.connect();
      
      const subscriber = redisManager.getSubscriber();
      
      // Set up message handler
      subscriber.on('message', (channel, message) => {
        this._handleMessage(channel, message);
      });

      // Set up pattern message handler for correlation IDs
      subscriber.on('pmessage', (pattern, channel, message) => {
        this._handlePatternMessage(pattern, channel, message);
      });

      // Subscribe to correlation response pattern
      await subscriber.psubscribe('response:*');
      
      this.isInitialized = true;
      console.log('✅ Pub/Sub broker initialized');
    } catch (error) {
      console.error('❌ Failed to initialize pub/sub broker:', error);
      throw error;
    }
  }

  /**
   * Publish message to channel
   */
  async publish(channel, message, options = {}) {
    try {
      const publisher = redisManager.getPublisher();
      const messageId = uuidv4();
      
      const envelope = {
        messageId,
        channel,
        timestamp: Date.now(),
        correlationId: options.correlationId,
        clientId: options.clientId,
        messageType: options.messageType || 'generic',
        payload: message
      };

      const serialized = JSON.stringify(envelope);
      const result = await publisher.publish(channel, serialized);
      
      console.log(`📤 Published to ${channel}: ${messageId} (${result} subscribers)`);
      
      return {
        messageId,
        channel,
        subscribers: result
      };
    } catch (error) {
      console.error(`❌ Failed to publish to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel, callback) {
    try {
      const subscriber = redisManager.getSubscriber();
      
      // Store callback for this channel
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
        await subscriber.subscribe(channel);
        console.log(`🔔 Subscribed to channel: ${channel}`);
      }
      
      this.subscriptions.get(channel).add(callback);
      
      return () => this.unsubscribe(channel, callback);
    } catch (error) {
      console.error(`❌ Failed to subscribe to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel, callback) {
    try {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        
        // If no more callbacks for this channel, unsubscribe from Redis
        if (callbacks.size === 0) {
          const subscriber = redisManager.getSubscriber();
          await subscriber.unsubscribe(channel);
          this.subscriptions.delete(channel);
          console.log(`🔕 Unsubscribed from channel: ${channel}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to unsubscribe from ${channel}:`, error);
    }
  }

  /**
   * Publish request with correlation ID and wait for response
   */
  async publishAndWaitForResponse(channel, message, options = {}) {
    const correlationId = uuidv4();
    const timeout = options.timeout || 30000; // 30 seconds default
    
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.correlationCallbacks.delete(correlationId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      // Set up response callback
      this.correlationCallbacks.set(correlationId, (response) => {
        clearTimeout(timeoutId);
        this.correlationCallbacks.delete(correlationId);
        resolve(response);
      });

      // Publish the request
      this.publish(channel, message, {
        ...options,
        correlationId
      }).catch(reject);
    });
  }

  /**
   * Publish response with correlation ID
   */
  async publishResponse(correlationId, response, options = {}) {
    const responseChannel = `response:${correlationId}`;
    
    return this.publish(responseChannel, response, {
      ...options,
      correlationId,
      messageType: 'response'
    });
  }

  /**
   * Handle incoming message
   */
  _handleMessage(channel, message) {
    try {
      const envelope = JSON.parse(message);
      const callbacks = this.subscriptions.get(channel);
      
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(envelope);
          } catch (error) {
            console.error(`Error in message callback for ${channel}:`, error);
          }
        });
      }
    } catch (error) {
      console.error(`Error parsing message from ${channel}:`, error);
    }
  }

  /**
   * Handle pattern message (for correlation responses)
   */
  _handlePatternMessage(pattern, channel, message) {
    try {
      // Extract correlation ID from channel name (response:correlationId)
      const correlationId = channel.split(':')[1];
      const envelope = JSON.parse(message);
      
      const callback = this.correlationCallbacks.get(correlationId);
      if (callback) {
        callback(envelope);
      }
    } catch (error) {
      console.error(`Error handling pattern message ${pattern}:`, error);
    }
  }

  /**
   * Create a request/response channel pair for a client
   */
  async createClientChannels(clientId) {
    const channels = {
      request: `client:${clientId}:request`,
      response: `client:${clientId}:response`,
      broadcast: `client:${clientId}:broadcast`
    };

    // Subscribe to client request channel
    await this.subscribe(channels.request, (envelope) => {
      console.log(`📨 Request from client ${clientId}:`, envelope.messageType);
    });

    console.log(`📺 Client channels created for: ${clientId}`);
    return channels;
  }

  /**
   * Broadcast message to all clients
   */
  async broadcastToAllClients(message, options = {}) {
    return this.publish('broadcast:all', message, {
      ...options,
      messageType: 'broadcast'
    });
  }

  /**
   * Send message to specific client
   */
  async sendToClient(clientId, message, options = {}) {
    const channel = `client:${clientId}:response`;
    return this.publish(channel, message, {
      ...options,
      clientId,
      messageType: 'client_response'
    });
  }

  /**
   * Get active channels
   */
  getActiveChannels() {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get subscription count for channel
   */
  getSubscriptionCount(channel) {
    const callbacks = this.subscriptions.get(channel);
    return callbacks ? callbacks.size : 0;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const publisher = redisManager.getPublisher();
      const testChannel = 'health:check';
      const testMessage = { test: true, timestamp: Date.now() };
      
      const result = await publisher.publish(testChannel, JSON.stringify(testMessage));
      
      return {
        healthy: true,
        activeChannels: this.getActiveChannels().length,
        pendingCorrelations: this.correlationCallbacks.size,
        testPublishResult: result
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Clear all callbacks
      this.correlationCallbacks.clear();
      
      // Unsubscribe from all channels
      const subscriber = redisManager.getSubscriber();
      for (const channel of this.subscriptions.keys()) {
        await subscriber.unsubscribe(channel);
      }
      this.subscriptions.clear();
      
      console.log('🧹 Pub/Sub broker cleaned up');
    } catch (error) {
      console.error('Error during pub/sub cleanup:', error);
    }
  }
}

module.exports = PubSubBroker;