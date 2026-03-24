/**
 * Client Adapter for Redis Queue System
 * Cortex Freelancer - CFX-028
 * Browser-side adapter that submits jobs and polls/streams for results
 */

class CortexQueueClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.clientId = options.clientId || this._generateClientId();
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || 30000;
    this.pollInterval = options.pollInterval || 1000;
    this.maxRetries = options.maxRetries || 3;

    // Transport selection:
    // - 'auto' (default): uses CortexABTesting transport_method_v1 if present
    // - 'sse' | 'polling' | 'socketio' | 'ws'
    this.transport = options.transport || 'auto';

    // Optional A/B + metrics hooks (client-side, no deps)
    this.ab = options.ab || (typeof window !== 'undefined' ? window.CortexABTesting : null);
    this.metrics = options.metrics || (typeof window !== 'undefined' ? window.CortexABMetrics : null);

    this.pendingRequests = new Map();
    this.eventSource = null;
    this.socket = null;
    this.ws = null;
    this.isConnected = false;
  }

  /**
   * Generate unique client ID
   */
  _generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize the client
   */
  async initialize() {
    try {
      // Test connection
      const health = await this._apiCall('GET', '/api/queue/health');
      if (health.status === 'healthy') {
        console.log('✅ Queue client connected');
        this.isConnected = true;
        
        // Choose transport (optionally via A/B test)
        const chosenTransport = this._chooseTransport();
        this.transport = chosenTransport;

        // Set up updates channel based on chosen transport
        await this._setupUpdatesTransport(chosenTransport);

        return true;
      } else {
        throw new Error('Queue system is not healthy');
      }
    } catch (error) {
      console.error('❌ Failed to initialize queue client:', error);
      throw error;
    }
  }

  /**
   * Choose updates transport.
   * If transport==='auto' and CortexABTesting is available, uses experiment transport_method_v1.
   */
  _chooseTransport() {
    try {
      if (this.transport && this.transport !== 'auto') return this.transport;
      if (this.ab && typeof this.ab.getVariant === 'function') {
        return this.ab.getVariant('transport_method_v1');
      }
    } catch (e) {
      // ignore and fallback
    }
    return 'sse';
  }

  /**
   * Initialize the chosen updates transport.
   * Always fails safe (falls back to SSE, then polling).
   */
  async _setupUpdatesTransport(transport) {
    const timer = (this.metrics && this.metrics.createTimer) ? this.metrics.createTimer({ name: 'updates_transport_setup', transport }) : null;
    try {
      if (transport === 'socketio') {
        const ok = this._setupSocketIO();
        if (!ok) throw new Error('socket.io client not available');
        this.metrics?.recordTransportEvent?.({ name: 'updates_transport_setup', transport, ok: true, latencyMs: timer?.end().durationMs });
        return;
      }

      if (transport === 'ws') {
        const ok = this._setupWebSocket();
        if (!ok) throw new Error('WebSocket not available');
        this.metrics?.recordTransportEvent?.({ name: 'updates_transport_setup', transport, ok: true, latencyMs: timer?.end().durationMs });
        return;
      }

      if (transport === 'polling') {
        // no-op: polling happens per request in _waitForJobCompletion
        this.metrics?.recordTransportEvent?.({ name: 'updates_transport_setup', transport, ok: true, latencyMs: timer?.end().durationMs });
        return;
      }

      // default: SSE
      this._setupSSE();
      this.metrics?.recordTransportEvent?.({ name: 'updates_transport_setup', transport: 'sse', ok: true, latencyMs: timer?.end().durationMs });
    } catch (error) {
      this.metrics?.recordTransportEvent?.({ name: 'updates_transport_setup', transport, ok: false, latencyMs: timer?.end().durationMs, error: error.message || error });
      // fallback: try SSE; if SSE isn't available we automatically poll
      try {
        this._setupSSE();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Set up Server-Sent Events for real-time updates
   */
  _setupSSE() {
    if (!window.EventSource) {
      console.warn('⚠️ Server-Sent Events not supported, falling back to polling');
      return;
    }

    const sseUrl = `${this.baseUrl}/api/queue/events?clientId=${this.clientId}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onopen = () => {
      console.log('📡 SSE connection opened');
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleServerMessage(data);
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // Auto-reconnect after delay
      setTimeout(() => {
        if (this.isConnected && !this.eventSource) {
          this._setupSSE();
        }
      }, 5000);
    };
  }

  /**
   * Optional: Socket.IO updates channel.
   * Requires Socket.IO client to be present on window.io.
   * Server support is optional; if connection fails it will fallback.
   */
  _setupSocketIO() {
    if (typeof window === 'undefined') return false;
    if (!window.io) {
      console.warn('⚠️ Socket.IO client (window.io) not found; cannot use socketio transport');
      return false;
    }

    const socket = window.io(this.baseUrl || window.location.origin, {
      transports: ['websocket', 'polling'],
      auth: { clientId: this.clientId }
    });

    this.socket = socket;

    socket.on('connect', () => {
      console.log('🔌 socket.io connected');
      // identify
      socket.emit('queue:subscribe', { clientId: this.clientId });
    });

    socket.on('queue:event', (data) => {
      // expects same shape as SSE payload
      this._handleServerMessage(data);
    });

    socket.on('connect_error', (err) => {
      console.warn('socket.io connect_error:', err?.message || err);
      // fallback to SSE
      if (!this.eventSource) this._setupSSE();
    });

    socket.on('disconnect', (reason) => {
      console.warn('socket.io disconnected:', reason);
    });

    return true;
  }

  /**
   * Optional: raw WebSocket updates channel.
   * Expects a server WS endpoint at /api/queue/ws?clientId=...
   */
  _setupWebSocket() {
    if (typeof window === 'undefined') return false;
    if (!window.WebSocket) return false;

    const origin = this.baseUrl || window.location.origin;
    const wsUrl = origin.replace(/^http/, 'ws') + `/api/queue/ws?clientId=${encodeURIComponent(this.clientId)}`;

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      console.log('🛰️ WS updates connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleServerMessage(data);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onerror = (err) => {
      console.warn('WS updates error:', err);
      if (!this.eventSource) this._setupSSE();
    };

    ws.onclose = () => {
      console.warn('WS updates closed');
    };

    return true;
  }

  /**
   * Submit job to queue
   */
  async submitJob(jobType, payload, options = {}) {
    try {
      const requestData = {
        jobType,
        payload,
        clientId: this.clientId,
        priority: options.priority || 'normal',
        timeout: options.timeout || this.timeout
      };

      const response = await this._apiCall('POST', '/api/queue/submit', requestData);
      
      if (response.success) {
        const { jobId, correlationId } = response;
        
        // Store pending request for tracking
        this.pendingRequests.set(correlationId, {
          jobId,
          correlationId,
          jobType,
          submittedAt: Date.now(),
          options
        });

        console.log(`📤 Job submitted: ${jobType} (${correlationId})`);
        
        // Return promise that resolves when job completes
        return this._waitForJobCompletion(correlationId, options);
      } else {
        throw new Error(response.error || 'Failed to submit job');
      }
    } catch (error) {
      console.error('❌ Job submission failed:', error);
      throw error;
    }
  }

  /**
   * Submit urgent job (high priority)
   */
  async submitUrgentJob(jobType, payload, options = {}) {
    return this.submitJob(jobType, payload, {
      ...options,
      priority: 'urgent'
    });
  }

  /**
   * Submit background job (low priority)
   */
  async submitBackgroundJob(jobType, payload, options = {}) {
    return this.submitJob(jobType, payload, {
      ...options,
      priority: 'background'
    });
  }

  /**
   * Wait for job completion
   */
  async _waitForJobCompletion(correlationId, options = {}) {
    const timeout = options.timeout || this.timeout;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        this.metrics?.recordTransportEvent?.({
          name: 'job_timeout',
          transport: this.transport,
          ok: false,
          latencyMs: timeout,
          error: `timeout_after_${timeout}ms`
        });
        reject(new Error(`Job timeout after ${timeout}ms`));
      }, timeout);

      // Store resolve/reject functions for later use
      const pendingRequest = this.pendingRequests.get(correlationId);
      if (pendingRequest) {
        pendingRequest.resolve = (result) => {
          clearTimeout(timeoutId);
          const latencyMs = Date.now() - (pendingRequest.submittedAt || Date.now());
          this.metrics?.recordTransportEvent?.({
            name: 'job_completed',
            transport: this.transport,
            ok: true,
            latencyMs
          });
          resolve(result);
        };
        pendingRequest.reject = (error) => {
          clearTimeout(timeoutId);
          const latencyMs = Date.now() - (pendingRequest.submittedAt || Date.now());
          this.metrics?.recordTransportEvent?.({
            name: 'job_completed',
            transport: this.transport,
            ok: false,
            latencyMs,
            error: error?.message || error
          });
          reject(error);
        };
      }

      // If no push channel is available, start polling
      if (!this.eventSource && !this.socket && !this.ws) {
        this._pollForResult(correlationId);
      }
    });
  }

  /**
   * Poll for job result (fallback when SSE is not available)
   */
  async _pollForResult(correlationId) {
    const pendingRequest = this.pendingRequests.get(correlationId);
    if (!pendingRequest) return;

    try {
      const result = await this._apiCall('GET', `/api/queue/result/${correlationId}`);
      
      if (result.completed) {
        this.pendingRequests.delete(correlationId);
        
        if (result.success) {
          pendingRequest.resolve?.(result.data);
        } else {
          pendingRequest.reject?.(new Error(result.error || 'Job failed'));
        }
      } else {
        // Continue polling
        setTimeout(() => {
          this._pollForResult(correlationId);
        }, this.pollInterval);
      }
    } catch (error) {
      pendingRequest.reject?.(error);
      this.pendingRequests.delete(correlationId);
    }
  }

  /**
   * Handle server message from SSE
   */
  _handleServerMessage(data) {
    const { type, correlationId, payload } = data;
    
    if (type === 'job_completed' && correlationId) {
      const pendingRequest = this.pendingRequests.get(correlationId);
      
      if (pendingRequest) {
        this.pendingRequests.delete(correlationId);
        
        if (payload.success) {
          pendingRequest.resolve?.(payload.result);
        } else {
          pendingRequest.reject?.(new Error(payload.error || 'Job failed'));
        }
      }
    } else if (type === 'job_progress' && correlationId) {
      const pendingRequest = this.pendingRequests.get(correlationId);
      
      if (pendingRequest && pendingRequest.options.onProgress) {
        pendingRequest.options.onProgress(payload);
      }
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(correlationId) {
    try {
      const result = await this._apiCall('GET', `/api/queue/status/${correlationId}`);
      return result;
    } catch (error) {
      console.error('Error getting job status:', error);
      throw error;
    }
  }

  /**
   * Cancel job
   */
  async cancelJob(correlationId) {
    try {
      const result = await this._apiCall('POST', `/api/queue/cancel/${correlationId}`);
      
      // Remove from pending requests
      this.pendingRequests.delete(correlationId);
      
      return result;
    } catch (error) {
      console.error('Error canceling job:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      return await this._apiCall('GET', '/api/queue/stats');
    } catch (error) {
      console.error('Error getting queue stats:', error);
      throw error;
    }
  }

  /**
   * Get client statistics
   */
  getClientStats() {
    return {
      clientId: this.clientId,
      isConnected: this.isConnected,
      pendingRequests: this.pendingRequests.size,
      sseConnected: this.eventSource?.readyState === EventSource.OPEN,
      requests: Array.from(this.pendingRequests.values()).map(req => ({
        correlationId: req.correlationId,
        jobType: req.jobType,
        waitingTime: Date.now() - req.submittedAt
      }))
    };
  }

  /**
   * Make API call
   */
  async _apiCall(method, endpoint, data = null, retryCount = 0) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': this.clientId
        }
      };

      if (this.apiKey) {
        options.headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Retry logic for network errors
      if (retryCount < this.maxRetries && this._isRetryableError(error)) {
        console.warn(`Retrying request (${retryCount + 1}/${this.maxRetries}):`, endpoint);
        await this._delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
        return this._apiCall(method, endpoint, data, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  _isRetryableError(error) {
    return error.message.includes('fetch') || 
           error.message.includes('network') ||
           error.message.includes('timeout');
  }

  /**
   * Utility delay function
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    this.isConnected = false;
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.socket) {
      try { this.socket.disconnect(); } catch {}
      this.socket = null;
    }

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    // Reject all pending requests
    for (const [correlationId, pendingRequest] of this.pendingRequests) {
      pendingRequest.reject?.(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();
    
    console.log('🔌 Queue client disconnected');
  }
}

// Node.js environment check
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CortexQueueClient;
}

// Browser environment
if (typeof window !== 'undefined') {
  window.CortexQueueClient = CortexQueueClient;
}