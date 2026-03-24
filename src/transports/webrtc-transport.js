/**
 * CFX-025: Server-side WebRTC Transport
 * 
 * Node.js WebRTC peer that establishes data channels with browser clients.
 * Provides same interface as WebSocket transport for seamless integration.
 * 
 * Features:
 * - RTCPeerConnection with data channel
 * - STUN/TURN server configuration
 * - Connection lifecycle management
 * - Transport abstraction layer
 * - Graceful fallback on WebRTC failures
 * - Message queuing during connection setup
 */

const { randomUUID } = require('crypto');

// Use node-datachannel for Node.js WebRTC implementation
let nodeDataChannel;
try {
  nodeDataChannel = require('node-datachannel');
} catch (err) {
  console.warn('[webrtc-transport] node-datachannel not available. Run: npm install node-datachannel');
  nodeDataChannel = null;
}

// Transport state machine
const TransportState = {
  DISCONNECTED: 'disconnected',
  SIGNALING: 'signaling',
  CONNECTING: 'connecting', 
  CONNECTED: 'connected',
  FAILED: 'failed'
};

// STUN/TURN configuration
const ICE_CONFIG = {
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // Twilio STUN servers
    { urls: 'stun:global.stun.twilio.com:3478' },
    
    // Add TURN servers if credentials are provided
    ...(process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL ? [{
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    }] : [])
  ]
};

// Configuration
const config = {
  connectionTimeout: 30 * 1000,     // 30s to establish connection
  keepAliveInterval: 20 * 1000,     // 20s keepalive pings
  maxMessageQueue: 100,             // Max queued messages
  maxMessageSize: 64 * 1024,        // 64KB max message size
  iceGatheringTimeout: 15 * 1000,   // 15s for ICE gathering
  dataChannelTimeout: 10 * 1000,    // 10s for data channel open
};

/**
 * WebRTC Transport Class
 */
class WebRTCTransport {
  constructor(sessionId, signalingClient) {
    this.sessionId = sessionId;
    this.signalingClient = signalingClient;
    this.state = TransportState.DISCONNECTED;
    this.peerConnection = null;
    this.dataChannel = null;
    this.messageQueue = [];
    this.listeners = {};
    this.connected = false;
    this.connectionTimer = null;
    this.keepAliveTimer = null;
    this.stats = {
      messagesOut: 0,
      messagesIn: 0,
      bytesOut: 0,
      bytesIn: 0,
      connectionTime: null,
      lastActivity: null
    };

    console.log(`[webrtc-transport] Created for session ${sessionId}`);
  }

  /**
   * Check if WebRTC is supported
   */
  static isSupported() {
    return nodeDataChannel !== null;
  }

  /**
   * Start WebRTC connection process
   */
  async connect() {
    if (!nodeDataChannel) {
      throw new Error('WebRTC not supported - node-datachannel not available');
    }

    try {
      this.setState(TransportState.SIGNALING);
      
      // Create peer connection
      this.peerConnection = new nodeDataChannel.PeerConnection('cortex-server', ICE_CONFIG);
      
      // Set connection timeout
      this.connectionTimer = setTimeout(() => {
        this.handleConnectionTimeout();
      }, config.connectionTimeout);

      // Setup event handlers
      this.setupPeerConnectionHandlers();
      
      // Create data channel 
      this.dataChannel = this.peerConnection.createDataChannel('chat', {
        ordered: true,
        maxRetransmits: 3
      });

      this.setupDataChannelHandlers();

      console.log(`[webrtc-transport] Starting connection for session ${this.sessionId}`);
      
      // Create offer
      const offer = await this.createOffer();
      
      // Send offer through signaling
      this.signalingClient.send({
        type: 'offer',
        sessionId: this.sessionId,
        sdp: offer
      });

      this.setState(TransportState.CONNECTING);
      
    } catch (err) {
      console.error(`[webrtc-transport] Connection failed:`, err);
      this.setState(TransportState.FAILED);
      this.emit('error', {
        code: 'WEBRTC_CONNECTION_FAILED',
        message: 'Failed to establish WebRTC connection',
        details: err.message
      });
      throw err;
    }
  }

  /**
   * Setup peer connection event handlers
   */
  setupPeerConnectionHandlers() {
    this.peerConnection.onStateChange((state) => {
      console.log(`[webrtc-transport] Peer connection state: ${state}`);
      
      if (state === 'connected') {
        this.handleConnectionEstablished();
      } else if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionLost();
      }
    });

    this.peerConnection.onIceStateChange((state) => {
      console.log(`[webrtc-transport] ICE state: ${state}`);
    });

    this.peerConnection.onGatheringStateChange((state) => {
      console.log(`[webrtc-transport] Gathering state: ${state}`);
    });

    // Handle incoming data channel from remote peer
    this.peerConnection.onDataChannel((dc) => {
      console.log(`[webrtc-transport] Received data channel: ${dc.getLabel()}`);
      this.dataChannel = dc;
      this.setupDataChannelHandlers();
    });
  }

  /**
   * Setup data channel event handlers
   */
  setupDataChannelHandlers() {
    if (!this.dataChannel) return;

    this.dataChannel.onOpen(() => {
      console.log(`[webrtc-transport] Data channel opened for session ${this.sessionId}`);
      this.handleDataChannelOpen();
    });

    this.dataChannel.onMessage((message) => {
      this.handleMessage(message);
    });

    this.dataChannel.onClosed(() => {
      console.log(`[webrtc-transport] Data channel closed for session ${this.sessionId}`);
      this.handleConnectionLost();
    });

    this.dataChannel.onError((error) => {
      console.error(`[webrtc-transport] Data channel error:`, error);
      this.handleConnectionError(error);
    });
  }

  /**
   * Create SDP offer
   */
  async createOffer() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Offer creation timeout'));
      }, 5000);

      this.peerConnection.onLocalDescription((sdp, type) => {
        clearTimeout(timeout);
        console.log(`[webrtc-transport] Created ${type}: ${sdp.slice(0, 100)}...`);
        resolve(sdp);
      });

      this.peerConnection.onLocalDescriptionCollected((sdp, type) => {
        console.log(`[webrtc-transport] Local description collected`);
      });
    });
  }

  /**
   * Handle remote SDP answer
   */
  async handleAnswer(sdp) {
    try {
      console.log(`[webrtc-transport] Setting remote description: ${sdp.slice(0, 100)}...`);
      this.peerConnection.setRemoteDescription(sdp, 'answer');
    } catch (err) {
      console.error(`[webrtc-transport] Failed to set remote description:`, err);
      this.setState(TransportState.FAILED);
      throw err;
    }
  }

  /**
   * Handle remote ICE candidate
   */
  addIceCandidate(candidate) {
    try {
      if (candidate) {
        this.peerConnection.addRemoteCandidate(candidate);
      } else {
        console.log(`[webrtc-transport] ICE gathering completed by remote peer`);
      }
    } catch (err) {
      console.warn(`[webrtc-transport] Failed to add ICE candidate:`, err);
    }
  }

  /**
   * Connection established - start keepalive and process queue
   */
  handleConnectionEstablished() {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    this.stats.connectionTime = Date.now();
    this.stats.lastActivity = Date.now();
    
    console.log(`[webrtc-transport] Connection established for session ${this.sessionId}`);
    
    this.emit('connected');
  }

  /**
   * Data channel opened - transport is ready
   */
  handleDataChannelOpen() {
    this.setState(TransportState.CONNECTED);
    this.connected = true;

    // Start keepalive
    this.startKeepAlive();

    // Process queued messages
    this.processMessageQueue();

    this.emit('ready');
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    try {
      this.stats.messagesIn++;
      this.stats.bytesIn += data.length;
      this.stats.lastActivity = Date.now();

      const message = JSON.parse(data);
      
      if (message.type === 'ping') {
        // Respond to ping with pong
        this.send({ type: 'pong', timestamp: Date.now() });
        return;
      }

      console.log(`[webrtc-transport] Received: ${message.type}`);
      this.emit('message', message);
      
    } catch (err) {
      console.error(`[webrtc-transport] Failed to parse message:`, err);
      this.emit('error', {
        code: 'INVALID_MESSAGE',
        message: 'Failed to parse incoming message',
        details: err.message
      });
    }
  }

  /**
   * Send message over data channel
   */
  send(message) {
    if (!this.connected || !this.dataChannel) {
      // Queue message if not connected yet
      if (this.messageQueue.length < config.maxMessageQueue) {
        this.messageQueue.push(message);
        return true;
      } else {
        console.warn(`[webrtc-transport] Message queue full, dropping message`);
        return false;
      }
    }

    try {
      const data = JSON.stringify(message);
      
      if (data.length > config.maxMessageSize) {
        throw new Error(`Message too large: ${data.length} bytes > ${config.maxMessageSize}`);
      }

      this.dataChannel.sendMessage(data);
      
      this.stats.messagesOut++;
      this.stats.bytesOut += data.length;
      this.stats.lastActivity = Date.now();
      
      return true;
      
    } catch (err) {
      console.error(`[webrtc-transport] Failed to send message:`, err);
      this.emit('error', {
        code: 'SEND_FAILED',
        message: 'Failed to send message',
        details: err.message
      });
      return false;
    }
  }

  /**
   * Process queued messages
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.connected) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Start keepalive ping/pong
   */
  startKeepAlive() {
    this.keepAliveTimer = setInterval(() => {
      this.send({ type: 'ping', timestamp: Date.now() });
    }, config.keepAliveInterval);
  }

  /**
   * Handle connection timeout
   */
  handleConnectionTimeout() {
    console.error(`[webrtc-transport] Connection timeout for session ${this.sessionId}`);
    this.setState(TransportState.FAILED);
    this.emit('error', {
      code: 'CONNECTION_TIMEOUT',
      message: 'WebRTC connection timed out',
      retryable: true
    });
    this.close();
  }

  /**
   * Handle connection lost
   */
  handleConnectionLost() {
    console.log(`[webrtc-transport] Connection lost for session ${this.sessionId}`);
    this.connected = false;
    this.setState(TransportState.DISCONNECTED);
    this.emit('disconnected');
    this.cleanup();
  }

  /**
   * Handle connection error
   */
  handleConnectionError(error) {
    console.error(`[webrtc-transport] Connection error:`, error);
    this.emit('error', {
      code: 'CONNECTION_ERROR',
      message: 'WebRTC connection error',
      details: error
    });
  }

  /**
   * Close connection
   */
  close() {
    console.log(`[webrtc-transport] Closing connection for session ${this.sessionId}`);
    this.setState(TransportState.DISCONNECTED);
    this.connected = false;
    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (err) {
        console.warn(`[webrtc-transport] Error closing data channel:`, err);
      }
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (err) {
        console.warn(`[webrtc-transport] Error closing peer connection:`, err);
      }
      this.peerConnection = null;
    }

    this.messageQueue = [];
  }

  /**
   * Set transport state
   */
  setState(newState) {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      console.log(`[webrtc-transport] State: ${oldState} → ${newState}`);
      this.emit('stateChange', { from: oldState, to: newState });
    }
  }

  /**
   * Event emitter functionality
   */
  on(event, listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event, listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  emit(event, data) {
    const listeners = this.listeners[event] || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (err) {
        console.error(`[webrtc-transport] Listener error for ${event}:`, err);
      }
    });
  }

  /**
   * Get transport statistics
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      state: this.state,
      connected: this.connected,
      queuedMessages: this.messageQueue.length,
      ...this.stats
    };
  }

  /**
   * Get connection status info
   */
  getStatus() {
    return {
      state: this.state,
      connected: this.connected,
      latency: this.getLatency(),
      queueSize: this.messageQueue.length,
      stats: this.getStats()
    };
  }

  /**
   * Measure latency (if supported)
   */
  getLatency() {
    // Basic implementation - could be enhanced with real RTT measurement
    if (!this.connected) return null;
    return this.stats.lastActivity ? Date.now() - this.stats.lastActivity : null;
  }
}

module.exports = {
  WebRTCTransport,
  TransportState,
  ICE_CONFIG,
  config
};