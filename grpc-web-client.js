/**
 * Cortex Freelancer gRPC-Web Client
 * 
 * Browser-compatible gRPC client for streaming chat with token-by-token delivery.
 * Connects to gRPC server through grpc-web proxy (Envoy or grpc-web library).
 * 
 * Features:
 * - Server-streaming RPC for real-time responses
 * - Connection health monitoring
 * - Automatic reconnection and retry logic
 * - Error handling with user-friendly messages
 * - Session persistence and restoration
 * 
 * CFX-027: gRPC Streaming Implementation
 */

class CortexGrpcClient {
  constructor(options = {}) {
    this.options = {
      serverUrl: options.serverUrl || 'http://localhost:8080', // grpc-web proxy URL
      enableDevtools: options.enableDevtools !== false,
      retryAttempts: options.retryAttempts || 3,
      retryDelayMs: options.retryDelayMs || 1000,
      heartbeatIntervalMs: options.heartbeatIntervalMs || 30000,
      sessionId: options.sessionId || this.generateSessionId(),
      ...options
    };
    
    this.client = null;
    this.isConnected = false;
    this.sessionId = this.options.sessionId;
    this.activeStreams = new Map();
    this.listeners = new Map();
    this.heartbeatInterval = null;
    this.retryCount = 0;
    this.lastError = null;
    
    this.init();
  }
  
  /**
   * Initialize the gRPC-web client
   */
  init() {
    try {
      // Import grpc-web client (must be loaded via script tag in browser)
      if (typeof grpc === 'undefined' || !grpc.web) {
        throw new Error('grpc-web library not loaded. Include the grpc-web client library.');
      }
      
      // Create client stub
      this.client = new grpc.web.ChatServiceClient(this.options.serverUrl);
      
      console.log('gRPC-web client initialized:', this.options.serverUrl);
      
      // Start health monitoring
      this.startHeartbeat();
      
    } catch (error) {
      console.error('Failed to initialize gRPC client:', error);
      this.lastError = error;
      this.emit('error', { type: 'init', error });
    }
  }
  
  /**
   * Send a chat message with streaming response
   */
  async sendMessage(message, options = {}) {
    const requestId = this.generateRequestId();
    const request = this.createChatRequest(message, options, requestId);
    
    console.log(`[${this.sessionId}] Sending message:`, message.substring(0, 100));
    
    try {
      const stream = this.client.streamChat(request, {});
      this.activeStreams.set(requestId, stream);
      
      // Set up stream event handlers
      this.setupStreamHandlers(stream, requestId);
      
      return {
        requestId,
        stream,
        cancel: () => this.cancelRequest(requestId)
      };
      
    } catch (error) {
      console.error(`[${this.sessionId}] Failed to send message:`, error);
      this.emit('error', { type: 'send', error, requestId });
      throw error;
    }
  }
  
  /**
   * Create chat request object
   */
  createChatRequest(message, options, requestId) {
    return {
      session_id: this.sessionId,
      message: message,
      request_id: requestId,
      timestamp: Date.now().toString(),
      context: {
        system_prompt: options.systemPrompt || 
          "You are Cortex, an AI freelance business manager. Help with proposals, rates, client communication, and strategy.",
        user_id: options.userId || 'anonymous',
        history: options.history || [],
        metadata: options.metadata || {}
      },
      settings: {
        model: options.model || 'claude-sonnet',
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000,
        stream_tokens: true,
        timeout_ms: options.timeoutMs || 120000,
        language: options.language || 'en'
      }
    };
  }
  
  /**
   * Set up stream event handlers
   */
  setupStreamHandlers(stream, requestId) {
    let responseBuffer = '';
    let startTime = Date.now();
    
    stream.on('data', (response) => {
      const responseData = this.processStreamResponse(response, requestId, responseBuffer, startTime);
      if (responseData) {
        responseBuffer = responseData.buffer;
      }
    });
    
    stream.on('status', (status) => {
      console.log(`[${this.sessionId}] Stream status:`, status);
      
      if (status.code !== 0) {
        this.emit('error', {
          type: 'stream',
          requestId,
          status,
          error: new Error(`gRPC error ${status.code}: ${status.details}`)
        });
      }
    });
    
    stream.on('end', () => {
      console.log(`[${this.sessionId}] Stream ended for request ${requestId}`);
      this.activeStreams.delete(requestId);
      this.emit('streamEnd', { requestId });
    });
    
    stream.on('error', (error) => {
      console.error(`[${this.sessionId}] Stream error:`, error);
      this.activeStreams.delete(requestId);
      this.emit('error', { type: 'stream', error, requestId });
      
      // Trigger retry if appropriate
      if (this.shouldRetry(error)) {
        this.scheduleRetry(requestId);
      }
    });
  }
  
  /**
   * Process incoming stream response
   */
  processStreamResponse(response, requestId, responseBuffer, startTime) {
    const type = response.type;
    const timestamp = parseInt(response.timestamp);
    
    switch (type) {
      case 'TOKEN':
        responseBuffer += response.token;
        this.emit('token', {
          requestId,
          token: response.token,
          buffer: responseBuffer,
          timestamp
        });
        break;
        
      case 'THINKING':
        this.emit('thinking', {
          requestId,
          message: response.thinking,
          timestamp
        });
        break;
        
      case 'KEEPALIVE':
        this.emit('keepalive', {
          requestId,
          timestamp
        });
        break;
        
      case 'COMPLETE':
        const responseTime = Date.now() - startTime;
        this.emit('complete', {
          requestId,
          response: response.complete.full_response,
          totalTokens: response.complete.total_tokens,
          responseTime: responseTime,
          finishReason: response.complete.finish_reason,
          timestamp
        });
        break;
        
      case 'USAGE':
        this.emit('usage', {
          requestId,
          usage: response.usage,
          timestamp
        });
        break;
        
      case 'ERROR':
        this.emit('error', {
          type: 'response',
          requestId,
          error: response.error,
          timestamp
        });
        break;
        
      default:
        console.warn(`Unknown response type: ${type}`);
    }
    
    return { buffer: responseBuffer };
  }
  
  /**
   * Cancel a specific request
   */
  cancelRequest(requestId) {
    const stream = this.activeStreams.get(requestId);
    if (stream) {
      console.log(`[${this.sessionId}] Cancelling request ${requestId}`);
      stream.cancel();
      this.activeStreams.delete(requestId);
      this.emit('cancelled', { requestId });
    }
  }
  
  /**
   * Cancel all active requests
   */
  cancelAllRequests() {
    console.log(`[${this.sessionId}] Cancelling all active requests`);
    for (const [requestId, stream] of this.activeStreams) {
      stream.cancel();
      this.emit('cancelled', { requestId });
    }
    this.activeStreams.clear();
  }
  
  /**
   * Check server health
   */
  async checkHealth() {
    try {
      const request = {
        service: 'cortex.chat.ChatService',
        timestamp: Date.now().toString()
      };
      
      const response = await new Promise((resolve, reject) => {
        this.client.healthCheck(request, {}, (err, response) => {
          if (err) reject(err);
          else resolve(response);
        });
      });
      
      this.isConnected = response.status === 'SERVING';
      this.emit('healthCheck', {
        status: response.status,
        metrics: response.metrics,
        isConnected: this.isConnected
      });
      
      return response;
      
    } catch (error) {
      console.error(`[${this.sessionId}] Health check failed:`, error);
      this.isConnected = false;
      this.lastError = error;
      this.emit('healthCheck', {
        status: 'ERROR',
        error,
        isConnected: false
      });
      throw error;
    }
  }
  
  /**
   * Start periodic health checks
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.checkHealth();
        this.retryCount = 0; // Reset retry count on successful health check
      } catch (error) {
        console.warn(`[${this.sessionId}] Heartbeat failed:`, error.message);
        
        if (this.shouldRetry(error)) {
          this.scheduleRetry();
        }
      }
    }, this.options.heartbeatIntervalMs);
    
    // Initial health check
    setTimeout(() => this.checkHealth().catch(console.warn), 1000);
  }
  
  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  /**
   * Determine if error warrants retry
   */
  shouldRetry(error) {
    // Retry on network errors, timeouts, and server errors
    // Don't retry on client errors (4xx) or quota exhaustion
    if (error.code) {
      // gRPC status codes
      const retryableCodes = [
        14, // UNAVAILABLE
        13, // INTERNAL
        4,  // DEADLINE_EXCEEDED
        2   // UNKNOWN
      ];
      return retryableCodes.includes(error.code);
    }
    
    // HTTP errors
    if (error.status) {
      return error.status >= 500 || error.status === 408;
    }
    
    // Network errors
    return error.message?.includes('network') || 
           error.message?.includes('timeout') ||
           error.message?.includes('connection');
  }
  
  /**
   * Schedule retry with exponential backoff
   */
  scheduleRetry(requestId = null) {
    if (this.retryCount >= this.options.retryAttempts) {
      console.error(`[${this.sessionId}] Max retry attempts reached`);
      this.emit('retryExhausted', { retryCount: this.retryCount });
      return;
    }
    
    this.retryCount++;
    const delay = this.options.retryDelayMs * Math.pow(2, this.retryCount - 1);
    
    console.log(`[${this.sessionId}] Scheduling retry ${this.retryCount} in ${delay}ms`);
    
    setTimeout(() => {
      if (requestId) {
        this.emit('retrying', { requestId, attempt: this.retryCount });
      } else {
        this.emit('retrying', { attempt: this.retryCount });
        this.init(); // Reinitialize connection
      }
    }, delay);
  }
  
  /**
   * Event listener management
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Event listener error for ${event}:`, error);
        }
      });
    }
    
    // Log events in dev mode
    if (this.options.enableDevtools && event !== 'keepalive') {
      console.log(`[${this.sessionId}] Event:`, event, data);
    }
  }
  
  /**
   * Cleanup and disconnect
   */
  disconnect() {
    console.log(`[${this.sessionId}] Disconnecting gRPC client`);
    
    this.stopHeartbeat();
    this.cancelAllRequests();
    
    this.isConnected = false;
    this.client = null;
    
    this.emit('disconnected', { sessionId: this.sessionId });
  }
  
  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
  
  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return 'req_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
  
  /**
   * Get client status and metrics
   */
  getStatus() {
    return {
      sessionId: this.sessionId,
      isConnected: this.isConnected,
      activeStreams: this.activeStreams.size,
      retryCount: this.retryCount,
      lastError: this.lastError,
      serverUrl: this.options.serverUrl
    };
  }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CortexGrpcClient;
} else if (typeof window !== 'undefined') {
  window.CortexGrpcClient = CortexGrpcClient;
}