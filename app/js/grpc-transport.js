/**
 * CFX-027: gRPC Transport Adapter
 * 
 * Wraps CortexGrpcClient to match the transport manager interface.
 * Integrates gRPC-Web streaming into the unified fallback chain.
 * 
 * Priority: Between WebRTC (1) and Socket.io (2) — assigned priority 1.5
 * gRPC offers lower latency than WebSocket-based transports via HTTP/2 + binary protocol
 * but requires proxy infrastructure that may not always be available.
 */
(function () {
  'use strict';

  var client = null;
  var connected = false;
  var listeners = {};
  var stats = {
    transport: 'grpc',
    messagesIn: 0,
    messagesOut: 0,
    tokensReceived: 0,
    avgLatencyMs: 0,
    errors: 0,
    connectedAt: null,
    lastActivity: null,
    _latencies: []
  };

  // Default config — can be overridden via CortexGrpcTransport.configure()
  var config = {
    serverUrl: null, // Auto-detect from page or env
    retryAttempts: 3,
    retryDelayMs: 1000,
    heartbeatIntervalMs: 30000,
    connectTimeoutMs: 10000
  };

  /* ── Internal Event System ── */

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(function (f) { return f !== fn; });
  }

  function emit(event, data) {
    var fns = listeners[event] || [];
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](data); } catch (e) { console.error('[grpc-transport] listener error:', e); }
    }
  }

  /* ── Helpers ── */

  function detectServerUrl() {
    if (config.serverUrl) return config.serverUrl;

    // Check meta tag
    var meta = document.querySelector('meta[name="grpc-proxy-url"]');
    if (meta) return meta.getAttribute('content');

    // Check window config
    if (window.CORTEX_CONFIG && window.CORTEX_CONFIG.grpcProxyUrl) {
      return window.CORTEX_CONFIG.grpcProxyUrl;
    }

    // Default: same host, port 8080 (Envoy proxy)
    var loc = window.location;
    return loc.protocol + '//' + loc.hostname + ':8080';
  }

  function updateLatency(ms) {
    stats._latencies.push(ms);
    if (stats._latencies.length > 50) stats._latencies = stats._latencies.slice(-25);
    stats.avgLatencyMs = Math.round(
      stats._latencies.reduce(function (a, b) { return a + b; }, 0) / stats._latencies.length
    );
    stats.lastActivity = Date.now();
  }

  /* ── Public API ── */

  /**
   * Check if gRPC transport is available
   */
  function isSupported() {
    // Need CortexGrpcClient loaded and HTTP/2 support (modern browsers)
    return typeof CortexGrpcClient !== 'undefined' && typeof fetch !== 'undefined';
  }

  /**
   * Connect to gRPC server via proxy
   */
  function connect() {
    return new Promise(function (resolve, reject) {
      if (connected && client) {
        resolve({ transport: 'grpc' });
        return;
      }

      var serverUrl = detectServerUrl();
      console.log('[grpc-transport] Connecting to:', serverUrl);

      try {
        client = new CortexGrpcClient({
          serverUrl: serverUrl,
          retryAttempts: config.retryAttempts,
          retryDelayMs: config.retryDelayMs,
          heartbeatIntervalMs: config.heartbeatIntervalMs,
          enableDevtools: false
        });

        // Wire up events from gRPC client to transport events
        client.on('token', function (data) {
          stats.tokensReceived++;
          stats.lastActivity = Date.now();
          emit('stream-chunk', {
            token: data.token,
            buffer: data.buffer,
            requestId: data.requestId,
            timestamp: data.timestamp,
            transport: 'grpc'
          });
        });

        client.on('complete', function (data) {
          stats.messagesIn++;
          updateLatency(data.responseTime);
          emit('stream-end', {
            response: data.response,
            totalTokens: data.totalTokens,
            responseTime: data.responseTime,
            finishReason: data.finishReason,
            requestId: data.requestId,
            transport: 'grpc'
          });
          emit('chat-response', {
            text: data.response,
            tokens: data.totalTokens,
            latencyMs: data.responseTime,
            transport: 'grpc'
          });
        });

        client.on('thinking', function (data) {
          emit('stream-chunk', {
            type: 'thinking',
            message: data.message,
            requestId: data.requestId,
            transport: 'grpc'
          });
        });

        client.on('error', function (data) {
          stats.errors++;
          console.error('[grpc-transport] Error:', data);
          emit('stream-error', {
            error: data.error,
            requestId: data.requestId,
            transport: 'grpc'
          });
        });

        client.on('usage', function (data) {
          emit('usage', {
            usage: data.usage,
            requestId: data.requestId,
            transport: 'grpc'
          });
        });

        client.on('disconnected', function () {
          connected = false;
          emit('disconnected', { transport: 'grpc' });
        });

        // Verify connectivity with health check (with timeout)
        var healthTimeout = setTimeout(function () {
          console.warn('[grpc-transport] Health check timed out');
          connected = false;
          reject(new Error('gRPC health check timeout'));
        }, config.connectTimeoutMs);

        client.checkHealth()
          .then(function (health) {
            clearTimeout(healthTimeout);
            if (health.status === 'SERVING' || health.status === 1) {
              connected = true;
              stats.connectedAt = Date.now();
              console.log('[grpc-transport] Connected. Server status:', health.status);
              resolve({ transport: 'grpc', health: health });
            } else {
              connected = false;
              reject(new Error('gRPC server not serving: ' + health.status));
            }
          })
          .catch(function (err) {
            clearTimeout(healthTimeout);
            connected = false;
            console.warn('[grpc-transport] Health check failed:', err.message);
            reject(err);
          });

      } catch (err) {
        connected = false;
        reject(err);
      }
    });
  }

  /**
   * Send a chat message
   */
  function sendMessage(text, options) {
    if (!client || !connected) {
      emit('stream-error', { error: { message: 'gRPC not connected' }, transport: 'grpc' });
      return false;
    }

    stats.messagesOut++;
    options = options || {};

    client.sendMessage(text, {
      model: options.model || 'claude-sonnet',
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 4000,
      systemPrompt: options.systemPrompt,
      language: options.language || 'en',
      userId: options.userId,
      history: options.history,
      timeoutMs: options.timeoutMs || 120000
    }).catch(function (err) {
      stats.errors++;
      emit('stream-error', { error: err, transport: 'grpc' });
    });

    return true;
  }

  /**
   * Disconnect from gRPC server
   */
  function disconnect() {
    if (client) {
      client.disconnect();
      client = null;
    }
    connected = false;
    stats.connectedAt = null;
  }

  /**
   * Check if currently connected
   */
  function isConnected() {
    return connected && client !== null;
  }

  /**
   * Get transport statistics
   */
  function getStats() {
    return Object.assign({}, stats, {
      connected: connected,
      serverUrl: client ? client.options.serverUrl : null,
      activeStreams: client ? client.activeStreams.size : 0,
      sessionId: client ? client.sessionId : null
    });
  }

  /**
   * Configure transport options (call before connect)
   */
  function configure(opts) {
    Object.assign(config, opts);
  }

  /* ── Export ── */

  window.CortexGrpcTransport = {
    isSupported: isSupported,
    connect: connect,
    disconnect: disconnect,
    sendMessage: sendMessage,
    isConnected: isConnected,
    getStats: getStats,
    configure: configure,
    on: on,
    off: off
  };

})();
