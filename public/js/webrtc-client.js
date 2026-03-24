/**
 * CFX-025: Client-side WebRTC Transport
 * 
 * Browser WebRTC client that establishes P2P data channels with the server.
 * Provides same interface as WebSocket transport for seamless integration.
 * 
 * Features:
 * - RTCPeerConnection with data channel
 * - STUN/TURN configuration for NAT traversal
 * - Automatic fallback to WebSocket/SSE
 * - Connection lifecycle management
 * - Transport abstraction layer
 * - Message queuing during connection setup
 */
(function() {
  'use strict';

  // Transport states
  var TransportState = {
    DISCONNECTED: 'disconnected',
    SIGNALING: 'signaling',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    FAILED: 'failed'
  };

  // STUN/TURN configuration
  var ICE_CONFIG = {
    iceServers: [
      // Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // Twilio STUN servers  
      { urls: 'stun:global.stun.twilio.com:3478' }
      
      // TURN servers would be added here if configured
    ]
  };

  // Configuration
  var config = {
    connectionTimeout: 30000,        // 30s to establish connection
    keepAliveInterval: 20000,        // 20s keepalive pings
    maxMessageQueue: 100,            // Max queued messages
    maxMessageSize: 64 * 1024,       // 64KB max message size
    iceGatheringTimeout: 15000,      // 15s for ICE gathering
    signalingTimeout: 10000,         // 10s for signaling operations
    maxRetries: 3                    // Max connection attempts
  };

  /**
   * WebRTC Client Transport
   */
  function WebRTCClient() {
    this.state = TransportState.DISCONNECTED;
    this.signalingWs = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.sessionId = null;
    this.connected = false;
    this.messageQueue = [];
    this.listeners = {};
    this.retryCount = 0;
    this.connectionTimer = null;
    this.keepAliveTimer = null;
    this.signalingTimer = null;
    this.stats = {
      messagesOut: 0,
      messagesIn: 0,
      bytesOut: 0,
      bytesIn: 0,
      connectionTime: null,
      lastActivity: null,
      retries: 0
    };

    console.log('[webrtc-client] Created');
  }

  /**
   * Check if WebRTC is supported
   */
  WebRTCClient.isSupported = function() {
    return !!(window.RTCPeerConnection && window.RTCDataChannel);
  };

  /**
   * Connect to WebRTC transport
   */
  WebRTCClient.prototype.connect = function() {
    var self = this;
    
    if (!WebRTCClient.isSupported()) {
      console.warn('[webrtc-client] WebRTC not supported in this browser');
      return Promise.reject(new Error('WebRTC not supported'));
    }

    return new Promise(function(resolve, reject) {
      self.connectPromise = { resolve: resolve, reject: reject };
      self._startConnection();
    });
  };

  /**
   * Start connection process
   */
  WebRTCClient.prototype._startConnection = function() {
    var self = this;

    try {
      self.setState(TransportState.SIGNALING);
      self.sessionId = 'webrtc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      
      console.log('[webrtc-client] Starting connection with session:', self.sessionId);

      // Set overall connection timeout
      self.connectionTimer = setTimeout(function() {
        self._handleConnectionTimeout();
      }, config.connectionTimeout);

      // Start signaling connection
      self._connectSignaling()
        .then(function() {
          return self._initWebRTC();
        })
        .then(function() {
          // WebRTC initialization successful, wait for data channel
        })
        .catch(function(err) {
          self._handleConnectionError(err);
        });

    } catch (err) {
      self._handleConnectionError(err);
    }
  };

  /**
   * Connect to signaling server
   */
  WebRTCClient.prototype._connectSignaling = function() {
    var self = this;
    
    return new Promise(function(resolve, reject) {
      var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      var signalingUrl = protocol + '//' + location.host + '/signaling';
      
      console.log('[webrtc-client] Connecting to signaling:', signalingUrl);
      
      self.signalingWs = new WebSocket(signalingUrl);
      
      // Signaling timeout
      self.signalingTimer = setTimeout(function() {
        reject(new Error('Signaling connection timeout'));
      }, config.signalingTimeout);

      self.signalingWs.onopen = function() {
        console.log('[webrtc-client] Signaling connected');
        clearTimeout(self.signalingTimer);
        
        // Register as client
        self.signalingWs.send(JSON.stringify({
          type: 'register',
          role: 'client',
          sessionId: self.sessionId
        }));
        
        resolve();
      };

      self.signalingWs.onmessage = function(event) {
        self._handleSignalingMessage(JSON.parse(event.data));
      };

      self.signalingWs.onclose = function() {
        console.log('[webrtc-client] Signaling disconnected');
      };

      self.signalingWs.onerror = function(err) {
        console.error('[webrtc-client] Signaling error:', err);
        clearTimeout(self.signalingTimer);
        reject(err);
      };
    });
  };

  /**
   * Handle signaling messages
   */
  WebRTCClient.prototype._handleSignalingMessage = function(message) {
    var self = this;
    
    console.log('[webrtc-client] Signaling:', message.type);

    switch (message.type) {
      case 'welcome':
        // Server welcome - no action needed
        break;

      case 'registered':
        console.log('[webrtc-client] Registered as client, waiting:', message.waiting);
        break;

      case 'peer-ready':
        console.log('[webrtc-client] Server peer ready, starting WebRTC negotiation');
        break;

      case 'offer':
        self._handleOffer(message.sdp);
        break;

      case 'answer':
        self._handleAnswer(message.sdp);
        break;

      case 'ice-candidate':
        self._handleIceCandidate(message.candidate);
        break;

      case 'peer-disconnected':
        self._handlePeerDisconnected();
        break;

      case 'error':
        console.error('[webrtc-client] Signaling error:', message.message);
        self._handleConnectionError(new Error(message.message));
        break;

      case 'ping':
        // Respond to signaling heartbeat
        if (self.signalingWs.readyState === WebSocket.OPEN) {
          self.signalingWs.send(JSON.stringify({ type: 'pong' }));
        }
        break;
    }
  };

  /**
   * Initialize WebRTC peer connection
   */
  WebRTCClient.prototype._initWebRTC = function() {
    var self = this;
    
    return new Promise(function(resolve, reject) {
      try {
        self.setState(TransportState.CONNECTING);
        
        // Create peer connection
        self.peerConnection = new RTCPeerConnection(ICE_CONFIG);
        
        // Setup peer connection handlers
        self._setupPeerConnectionHandlers();
        
        console.log('[webrtc-client] Peer connection created');
        resolve();
        
      } catch (err) {
        reject(err);
      }
    });
  };

  /**
   * Setup peer connection event handlers
   */
  WebRTCClient.prototype._setupPeerConnectionHandlers = function() {
    var self = this;

    self.peerConnection.onconnectionstatechange = function() {
      var state = self.peerConnection.connectionState;
      console.log('[webrtc-client] Connection state:', state);
      
      if (state === 'connected') {
        self._handleConnectionEstablished();
      } else if (state === 'failed' || state === 'disconnected') {
        self._handleConnectionLost();
      }
    };

    self.peerConnection.oniceconnectionstatechange = function() {
      console.log('[webrtc-client] ICE state:', self.peerConnection.iceConnectionState);
    };

    self.peerConnection.onicegatheringstatechange = function() {
      console.log('[webrtc-client] ICE gathering:', self.peerConnection.iceGatheringState);
    };

    self.peerConnection.onicecandidate = function(event) {
      if (event.candidate) {
        console.log('[webrtc-client] Sending ICE candidate');
        self._sendSignaling({
          type: 'ice-candidate',
          sessionId: self.sessionId,
          candidate: event.candidate
        });
      } else {
        console.log('[webrtc-client] ICE gathering completed');
        self._sendSignaling({
          type: 'ice-candidate', 
          sessionId: self.sessionId,
          candidate: null
        });
      }
    };

    // Handle incoming data channel
    self.peerConnection.ondatachannel = function(event) {
      console.log('[webrtc-client] Received data channel:', event.channel.label);
      self.dataChannel = event.channel;
      self._setupDataChannelHandlers();
    };
  };

  /**
   * Handle incoming offer
   */
  WebRTCClient.prototype._handleOffer = function(sdp) {
    var self = this;
    
    console.log('[webrtc-client] Received offer');
    
    self.peerConnection.setRemoteDescription({ type: 'offer', sdp: sdp })
      .then(function() {
        return self.peerConnection.createAnswer();
      })
      .then(function(answer) {
        return self.peerConnection.setLocalDescription(answer);
      })
      .then(function() {
        console.log('[webrtc-client] Sending answer');
        self._sendSignaling({
          type: 'answer',
          sessionId: self.sessionId,
          sdp: self.peerConnection.localDescription.sdp
        });
      })
      .catch(function(err) {
        console.error('[webrtc-client] Failed to handle offer:', err);
        self._handleConnectionError(err);
      });
  };

  /**
   * Handle incoming answer
   */
  WebRTCClient.prototype._handleAnswer = function(sdp) {
    console.log('[webrtc-client] Received answer');
    
    this.peerConnection.setRemoteDescription({ type: 'answer', sdp: sdp })
      .catch(function(err) {
        console.error('[webrtc-client] Failed to set remote description:', err);
      });
  };

  /**
   * Handle incoming ICE candidate
   */
  WebRTCClient.prototype._handleIceCandidate = function(candidate) {
    if (candidate) {
      console.log('[webrtc-client] Adding ICE candidate');
      this.peerConnection.addIceCandidate(candidate)
        .catch(function(err) {
          console.warn('[webrtc-client] Failed to add ICE candidate:', err);
        });
    }
  };

  /**
   * Setup data channel handlers
   */
  WebRTCClient.prototype._setupDataChannelHandlers = function() {
    var self = this;

    self.dataChannel.onopen = function() {
      console.log('[webrtc-client] Data channel opened');
      self._handleDataChannelOpen();
    };

    self.dataChannel.onmessage = function(event) {
      self._handleMessage(event.data);
    };

    self.dataChannel.onclose = function() {
      console.log('[webrtc-client] Data channel closed');
      self._handleConnectionLost();
    };

    self.dataChannel.onerror = function(error) {
      console.error('[webrtc-client] Data channel error:', error);
      self._handleConnectionError(error);
    };
  };

  /**
   * Data channel opened - transport is ready
   */
  WebRTCClient.prototype._handleDataChannelOpen = function() {
    this.setState(TransportState.CONNECTED);
    this.connected = true;
    
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    this.stats.connectionTime = Date.now();
    this.stats.lastActivity = Date.now();

    // Start keepalive
    this._startKeepAlive();

    // Process queued messages
    this._processMessageQueue();

    // Resolve connection promise
    if (this.connectPromise) {
      this.connectPromise.resolve();
      this.connectPromise = null;
    }

    this.emit('connected');
    this.emit('ready');
  };

  /**
   * Handle incoming message
   */
  WebRTCClient.prototype._handleMessage = function(data) {
    try {
      this.stats.messagesIn++;
      this.stats.bytesIn += data.length;
      this.stats.lastActivity = Date.now();

      var message = JSON.parse(data);
      
      if (message.type === 'ping') {
        // Respond to keepalive ping
        this.send({ type: 'pong', timestamp: Date.now() });
        return;
      }

      console.log('[webrtc-client] Received:', message.type);
      this.emit('message', message);
      
    } catch (err) {
      console.error('[webrtc-client] Failed to parse message:', err);
      this.emit('error', {
        code: 'INVALID_MESSAGE',
        message: 'Failed to parse incoming message',
        details: err.message
      });
    }
  };

  /**
   * Send message over data channel
   */
  WebRTCClient.prototype.send = function(message) {
    if (!this.connected || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      // Queue message if not connected yet
      if (this.messageQueue.length < config.maxMessageQueue) {
        this.messageQueue.push(message);
        return true;
      } else {
        console.warn('[webrtc-client] Message queue full, dropping message');
        return false;
      }
    }

    try {
      var data = JSON.stringify(message);
      
      if (data.length > config.maxMessageSize) {
        throw new Error('Message too large: ' + data.length + ' bytes > ' + config.maxMessageSize);
      }

      this.dataChannel.send(data);
      
      this.stats.messagesOut++;
      this.stats.bytesOut += data.length;
      this.stats.lastActivity = Date.now();
      
      return true;
      
    } catch (err) {
      console.error('[webrtc-client] Failed to send message:', err);
      this.emit('error', {
        code: 'SEND_FAILED',
        message: 'Failed to send message',
        details: err.message
      });
      return false;
    }
  };

  /**
   * Process queued messages
   */
  WebRTCClient.prototype._processMessageQueue = function() {
    while (this.messageQueue.length > 0 && this.connected) {
      var message = this.messageQueue.shift();
      this.send(message);
    }
  };

  /**
   * Start keepalive pings
   */
  WebRTCClient.prototype._startKeepAlive = function() {
    var self = this;
    self.keepAliveTimer = setInterval(function() {
      self.send({ type: 'ping', timestamp: Date.now() });
    }, config.keepAliveInterval);
  };

  /**
   * Handle connection established
   */
  WebRTCClient.prototype._handleConnectionEstablished = function() {
    console.log('[webrtc-client] Connection established');
  };

  /**
   * Handle connection timeout
   */
  WebRTCClient.prototype._handleConnectionTimeout = function() {
    console.error('[webrtc-client] Connection timeout');
    this.setState(TransportState.FAILED);
    
    var error = {
      code: 'CONNECTION_TIMEOUT',
      message: 'WebRTC connection timed out',
      retryable: true
    };
    
    this.emit('error', error);
    
    if (this.connectPromise) {
      this.connectPromise.reject(new Error(error.message));
      this.connectPromise = null;
    }
    
    this._cleanup();
  };

  /**
   * Handle connection lost
   */
  WebRTCClient.prototype._handleConnectionLost = function() {
    console.log('[webrtc-client] Connection lost');
    this.connected = false;
    this.setState(TransportState.DISCONNECTED);
    this.emit('disconnected');
    this._cleanup();
  };

  /**
   * Handle connection error
   */
  WebRTCClient.prototype._handleConnectionError = function(error) {
    console.error('[webrtc-client] Connection error:', error);
    this.setState(TransportState.FAILED);
    
    var errorObj = {
      code: 'CONNECTION_ERROR',
      message: 'WebRTC connection error',
      details: error.message || error,
      retryable: this.retryCount < config.maxRetries
    };
    
    this.emit('error', errorObj);
    
    if (this.connectPromise) {
      this.connectPromise.reject(error);
      this.connectPromise = null;
    }
    
    this._cleanup();
  };

  /**
   * Handle peer disconnected
   */
  WebRTCClient.prototype._handlePeerDisconnected = function() {
    console.log('[webrtc-client] Peer disconnected');
    this._handleConnectionLost();
  };

  /**
   * Send signaling message
   */
  WebRTCClient.prototype._sendSignaling = function(message) {
    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify(message));
    }
  };

  /**
   * Close connection
   */
  WebRTCClient.prototype.close = function() {
    console.log('[webrtc-client] Closing connection');
    this.setState(TransportState.DISCONNECTED);
    this.connected = false;
    this._cleanup();
  };

  /**
   * Cleanup resources
   */
  WebRTCClient.prototype._cleanup = function() {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    if (this.signalingTimer) {
      clearTimeout(this.signalingTimer);
      this.signalingTimer = null;
    }

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (err) {
        console.warn('[webrtc-client] Error closing data channel:', err);
      }
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (err) {
        console.warn('[webrtc-client] Error closing peer connection:', err);
      }
      this.peerConnection = null;
    }

    if (this.signalingWs) {
      try {
        this.signalingWs.close();
      } catch (err) {
        console.warn('[webrtc-client] Error closing signaling:', err);
      }
      this.signalingWs = null;
    }

    this.messageQueue = [];
  };

  /**
   * Set transport state
   */
  WebRTCClient.prototype.setState = function(newState) {
    if (this.state !== newState) {
      var oldState = this.state;
      this.state = newState;
      console.log('[webrtc-client] State: ' + oldState + ' → ' + newState);
      this.emit('stateChange', { from: oldState, to: newState });
    }
  };

  /**
   * Event emitter functionality
   */
  WebRTCClient.prototype.on = function(event, listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  };

  WebRTCClient.prototype.off = function(event, listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(function(l) { 
      return l !== listener; 
    });
  };

  WebRTCClient.prototype.emit = function(event, data) {
    var listeners = this.listeners[event] || [];
    var self = this;
    listeners.forEach(function(listener) {
      try {
        listener.call(self, data);
      } catch (err) {
        console.error('[webrtc-client] Listener error for ' + event + ':', err);
      }
    });
  };

  /**
   * Get transport statistics
   */
  WebRTCClient.prototype.getStats = function() {
    return {
      sessionId: this.sessionId,
      state: this.state,
      connected: this.connected,
      queuedMessages: this.messageQueue.length,
      stats: this.stats
    };
  };

  /**
   * Get connection status
   */
  WebRTCClient.prototype.getStatus = function() {
    return {
      state: this.state,
      connected: this.connected,
      queueSize: this.messageQueue.length,
      latency: this._getLatency(),
      stats: this.getStats()
    };
  };

  /**
   * Get latency estimation
   */
  WebRTCClient.prototype._getLatency = function() {
    if (!this.connected) return null;
    return this.stats.lastActivity ? Date.now() - this.stats.lastActivity : null;
  };

  // Export to global namespace
  window.CortexWebRTCClient = WebRTCClient;
  
  console.log('[webrtc-client] Module loaded');

})();