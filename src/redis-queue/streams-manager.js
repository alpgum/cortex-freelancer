/**
 * Redis Streams Manager
 * Cortex Freelancer - CFX-028
 * Handles ordered, persistent message delivery via Redis Streams
 */

const redisManager = require('./redis-client');
const config = require('./config');
const { v4: uuidv4 } = require('uuid');

class RedisStreamsManager {
  constructor() {
    this.streamName = 'cortex-messages';
    this.consumerGroup = config.streams.consumer.group;
    this.consumerName = config.streams.consumer.name;
    this.isConsuming = false;
    this.messageHandlers = new Map();
  }

  /**
   * Initialize Redis Streams
   */
  async initialize() {
    try {
      const redis = redisManager.getClient();
      
      // Create consumer group (ignore error if already exists)
      try {
        await redis.xgroup('CREATE', this.streamName, this.consumerGroup, '0', 'MKSTREAM');
        console.log(`✅ Consumer group created: ${this.consumerGroup}`);
      } catch (error) {
        if (!error.message.includes('BUSYGROUP')) {
          throw error;
        }
        console.log(`ℹ️ Consumer group already exists: ${this.consumerGroup}`);
      }
      
      console.log('✅ Redis Streams initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Redis Streams:', error);
      throw error;
    }
  }

  /**
   * Add message to stream
   */
  async addMessage(messageType, payload, options = {}) {
    const redis = redisManager.getClient();
    const messageId = uuidv4();
    
    const streamData = [
      'messageId', messageId,
      'messageType', messageType,
      'payload', JSON.stringify(payload),
      'timestamp', Date.now(),
      'clientId', options.clientId || 'unknown',
      'priority', options.priority || 'normal'
    ];

    const streamId = await redis.xadd(
      this.streamName,
      'MAXLEN', '~', config.streams.maxLen,
      '*', // Auto-generate ID
      ...streamData
    );

    console.log(`📡 Message added to stream: ${messageType} (${messageId}) -> ${streamId}`);
    
    return {
      streamId,
      messageId,
      messageType
    };
  }

  /**
   * Start consuming messages from stream
   */
  async startConsuming(messageProcessor) {
    if (this.isConsuming) {
      console.log('⚠️ Already consuming messages');
      return;
    }

    this.isConsuming = true;
    console.log(`🔄 Starting message consumption: ${this.consumerName}`);

    const redis = redisManager.getClient();

    // Process pending messages first
    await this._processPendingMessages(redis, messageProcessor);

    // Start consuming new messages
    this._consumeLoop(redis, messageProcessor);
  }

  /**
   * Process pending messages (messages that were delivered but not acknowledged)
   */
  async _processPendingMessages(redis, messageProcessor) {
    try {
      const pendingMessages = await redis.xreadgroup(
        'GROUP', this.consumerGroup, this.consumerName,
        'COUNT', 10,
        'STREAMS', this.streamName, '0'
      );

      if (pendingMessages && pendingMessages.length > 0) {
        const messages = pendingMessages[0][1];
        console.log(`🔄 Processing ${messages.length} pending messages`);
        
        for (const [messageId, fields] of messages) {
          await this._processMessage(redis, messageId, fields, messageProcessor);
        }
      }
    } catch (error) {
      console.error('Error processing pending messages:', error);
    }
  }

  /**
   * Main consumption loop
   */
  async _consumeLoop(redis, messageProcessor) {
    while (this.isConsuming) {
      try {
        const messages = await redis.xreadgroup(
          'GROUP', this.consumerGroup, this.consumerName,
          'COUNT', 1,
          'BLOCK', config.streams.consumer.blockTimeoutMs,
          'STREAMS', this.streamName, '>'
        );

        if (messages && messages.length > 0) {
          const streamMessages = messages[0][1];
          
          for (const [messageId, fields] of streamMessages) {
            await this._processMessage(redis, messageId, fields, messageProcessor);
          }
        }
      } catch (error) {
        if (this.isConsuming) {
          console.error('Error in consume loop:', error);
          await this._sleep(1000); // Wait before retrying
        }
      }
    }
  }

  /**
   * Process individual message
   */
  async _processMessage(redis, streamMessageId, fields, messageProcessor) {
    try {
      const message = this._parseStreamMessage(fields);
      console.log(`📨 Processing message: ${message.messageType} (${message.messageId})`);
      
      const startTime = Date.now();
      await messageProcessor(message);
      const processingTime = Date.now() - startTime;
      
      // Acknowledge message
      await redis.xack(this.streamName, this.consumerGroup, streamMessageId);
      
      console.log(`✅ Message processed: ${message.messageType} (${message.messageId}) - ${processingTime}ms`);
    } catch (error) {
      console.error(`❌ Error processing message ${streamMessageId}:`, error);
      // Message will remain in pending list for retry
    }
  }

  /**
   * Parse stream message fields into object
   */
  _parseStreamMessage(fields) {
    const message = {};
    
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      
      if (key === 'payload') {
        try {
          message[key] = JSON.parse(value);
        } catch (error) {
          message[key] = value;
        }
      } else if (key === 'timestamp') {
        message[key] = parseInt(value);
      } else {
        message[key] = value;
      }
    }
    
    return message;
  }

  /**
   * Register message handler for specific message type
   */
  registerHandler(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
    console.log(`📋 Handler registered for: ${messageType}`);
  }

  /**
   * Unregister message handler
   */
  unregisterHandler(messageType) {
    this.messageHandlers.delete(messageType);
    console.log(`📋 Handler unregistered for: ${messageType}`);
  }

  /**
   * Route message to appropriate handler
   */
  async routeMessage(message) {
    const handler = this.messageHandlers.get(message.messageType);
    
    if (handler) {
      return await handler(message);
    } else {
      console.warn(`⚠️ No handler registered for message type: ${message.messageType}`);
      return null;
    }
  }

  /**
   * Get stream information
   */
  async getStreamInfo() {
    try {
      const redis = redisManager.getClient();
      
      const [streamInfo, groupInfo] = await Promise.all([
        redis.xinfo('STREAM', this.streamName),
        redis.xinfo('GROUPS', this.streamName)
      ]);

      return {
        stream: this._parseStreamInfo(streamInfo),
        groups: groupInfo.map(group => this._parseGroupInfo(group))
      };
    } catch (error) {
      console.error('Error getting stream info:', error);
      return null;
    }
  }

  /**
   * Parse stream info response
   */
  _parseStreamInfo(info) {
    const result = {};
    for (let i = 0; i < info.length; i += 2) {
      result[info[i]] = info[i + 1];
    }
    return result;
  }

  /**
   * Parse group info response
   */
  _parseGroupInfo(info) {
    const result = {};
    for (let i = 0; i < info.length; i += 2) {
      result[info[i]] = info[i + 1];
    }
    return result;
  }

  /**
   * Stop consuming messages
   */
  stopConsuming() {
    this.isConsuming = false;
    console.log('🛑 Stopping message consumption');
  }

  /**
   * Trim stream to manage memory usage
   */
  async trimStream(maxLength = config.streams.maxLen) {
    const redis = redisManager.getClient();
    const trimmed = await redis.xtrim(this.streamName, 'MAXLEN', '~', maxLength);
    console.log(`✂️ Stream trimmed: ${trimmed} messages removed`);
    return trimmed;
  }

  /**
   * Utility sleep function
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RedisStreamsManager;