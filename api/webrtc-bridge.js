/**
 * CFX-025: WebRTC Bridge - OpenClaw Integration
 * 
 * Integrates WebRTC data channel transport with OpenClaw spawning system.
 * Provides same interface as ws-bridge but over WebRTC P2P connections.
 * 
 * Features:
 * - WebRTC signaling integration
 * - OpenClaw process spawning and streaming
 * - Connection lifecycle management
 * - Error handling with structured codes
 * - Transport abstraction compatibility
 */

const { randomUUID } = require('crypto');
const { spawn } = require('child_process');
const { WebRTCTransport } = require('../src/transports/webrtc-transport');

// Track active WebRTC sessions
const webrtcSessions = new Map();
const pendingRequests = new Map();

// Error definitions (same as ws-bridge for consistency)
const ERROR_DEFS = {
  // Connection errors
  E201: { code: 'E201', category: 'connection', severity: 'error', message: 'WebRTC connection failed', hint: 'Check network connectivity and try again.' },
  E202: { code: 'E202', category: 'connection', severity: 'error', message: 'WebRTC transport not available', hint: 'WebRTC may not be supported.' },
  E203: { code: 'E203', category: 'connection', severity: 'warn', message: 'WebRTC connection timeout', hint: 'Connection setup took too long. Try again.' },
  
  // Spawn errors (reuse from ws-bridge)
  E101: { code: 'E101', category: 'spawn', severity: 'error', message: 'OpenClaw spawn failed', hint: 'The system is busy. Try again in a moment.' },
  E102: { code: 'E102', category: 'spawn', severity: 'warn', message: 'OpenClaw spawn timeout', hint: 'Request took too long. Please try again.' },
  E103: { code: 'E103', category: 'spawn', severity: 'error', message: 'OpenClaw process crashed', hint: 'The request failed unexpectedly. Please retry.' },
  
  // Message errors
  E301: { code: 'E301', category: 'message', severity: 'error', message: 'Invalid message format', hint: 'Message must be valid JSON with required fields.' },
  E302: { code: 'E302', category: 'message', severity: 'warn', message: 'Message too large', hint: 'Please shorten your message and try again.' },
  E303: { code: 'E303', category: 'message', severity: 'error', message: 'Send failed', hint: 'Failed to send message over WebRTC.' }
};

// Configuration 
const config = {
  spawnTimeout: process.env.OPENCLAW_SPAWN_TIMEOUT_MS ? parseInt(process.env.OPENCLAW_SPAWN_TIMEOUT_MS) : 180000,
  keepAliveInterval: 15000,
  maxMessageSize: 64 * 1024,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  maxSessions: 50
};

// Statistics
const stats = {
  sessionsCreated: 0,
  messagesProcessed: 0,
  errorsTotal: 0,
  activeSessions: 0,
  startTime: Date.now()
};

/**
 * WebRTC Session Manager
 */
class WebRTCSession {
  constructor(sessionId, signalingClient) {
    this.sessionId = sessionId;
    this.transport = null;
    this.signalingClient = signalingClient;
    this.connected = false;
    this.lastActivity = Date.now();
    this.messageCount = 0;
    this.createdAt = Date.now();
    
    console.log(`[webrtc-bridge] Session created: ${sessionId}`);
    stats.sessionsCreated++;
    stats.activeSessions++;
  }

  async initialize() {
    try {
      // Create WebRTC transport
      this.transport = new WebRTCTransport(this.sessionId, this.signalingClient);
      
      // Setup event handlers
      this.setupTransportHandlers();
      
      // Start connection
      await this.transport.connect();
      
      console.log(`[webrtc-bridge] Session initialized: ${this.sessionId}`);
      
    } catch (err) {
      console.error(`[webrtc-bridge] Failed to initialize session ${this.sessionId}:`, err);
      throw err;
    }
  }

  setupTransportHandlers() {
    this.transport.on('connected', () => {
      this.connected = true;
      this.lastActivity = Date.now();
      console.log(`[webrtc-bridge] Transport connected for session ${this.sessionId}`);
    });

    this.transport.on('disconnected', () => {
      this.connected = false;
      console.log(`[webrtc-bridge] Transport disconnected for session ${this.sessionId}`);
      this.cleanup();
    });

    this.transport.on('message', (data) => {
      this.handleMessage(data);
    });

    this.transport.on('error', (error) => {
      console.error(`[webrtc-bridge] Transport error for session ${this.sessionId}:`, error);
      this.sendError(ERROR_DEFS.E201, error.requestId);
    });
  }

  handleMessage(data) {
    try {
      this.lastActivity = Date.now();
      this.messageCount++;
      stats.messagesProcessed++;

      console.log(`[webrtc-bridge] Message received:`, data.type);

      switch (data.type) {
        case 'chat':
          this.handleChatMessage(data);
          break;

        case 'cancel':
          this.handleCancel(data);
          break;
          
        case 'ping':
          this.handlePing(data);
          break;
          
        default:
          console.warn(`[webrtc-bridge] Unknown message type: ${data.type}`);
          this.sendError(ERROR_DEFS.E301, data.requestId);
      }
      
    } catch (err) {
      console.error(`[webrtc-bridge] Error handling message:`, err);
      this.sendError(ERROR_DEFS.E301, data.requestId);
    }
  }

  async handleChatMessage(data) {
    const { message, requestId, profile, goals, sessionId } = data;

    if (!message || !requestId) {
      this.sendError(ERROR_DEFS.E301, requestId);
      return;
    }

    try {
      console.log(`[webrtc-bridge] Processing chat message: ${message.slice(0, 100)}...`);
      
      // Send stream start notification
      this.send({
        type: 'stream_start',
        requestId,
        timestamp: Date.now()
      });

      // Spawn OpenClaw process
      await this.spawnOpenClaw(message, requestId, profile, goals, sessionId);
      
    } catch (err) {
      console.error(`[webrtc-bridge] Chat processing failed:`, err);
      this.sendError(ERROR_DEFS.E101, requestId);
    }
  }

  async spawnOpenClaw(message, requestId, profile, goals, sessionId) {
    return new Promise((resolve, reject) => {
      const spawnTimer = setTimeout(() => {
        openclaw?.kill?.('SIGTERM');
        this.sendError(ERROR_DEFS.E102, requestId);
        reject(new Error('Spawn timeout'));
      }, config.spawnTimeout);

      // Build OpenClaw command
      const args = [
        'chat',
        message,
        '--model', process.env.WEBRTC_MODEL || 'anthropic/claude-sonnet-4-20250514',
        '--stream'
      ];

      if (profile) {
        args.push('--context', `Profile: ${JSON.stringify(profile)}`);
      }
      
      if (goals) {
        args.push('--context', `Goals: ${JSON.stringify(goals)}`);
      }

      console.log(`[webrtc-bridge] Spawning OpenClaw: openclaw ${args.slice(0, 2).join(' ')}...`);

      const openclaw = spawn('openclaw', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          OPENCLAW_SESSION_ID: sessionId || this.sessionId
        }
      });

      // Track active process for cancellation
      pendingRequests.set(requestId, openclaw);

      let outputBuffer = '';
      let chunkIndex = 0;
      let fullReply = '';

      openclaw.stdout.on('data', (data) => {
        outputBuffer += data.toString();
        
        // Process complete lines
        let lines = outputBuffer.split('\n');
        outputBuffer = lines.pop() || ''; // Keep incomplete line
        
        for (const line of lines) {
          if (line.trim()) {
            fullReply += line + '\n';
            
            this.send({
              type: 'stream_chunk',
              requestId,
              chunk: line + '\n',
              index: chunkIndex++
            });
          }
        }
      });

      openclaw.stderr.on('data', (data) => {
        console.error(`[webrtc-bridge] OpenClaw stderr: ${data}`);
      });

      openclaw.on('close', (code) => {
        clearTimeout(spawnTimer);
        pendingRequests.delete(requestId);
        
        if (code === 0) {
          this.send({
            type: 'stream_end',
            requestId,
            reply: fullReply.trim(),
            sessionId: sessionId || this.sessionId,
            meta: {
              chunks: chunkIndex,
              transport: 'webrtc'
            }
          });
          resolve();
        } else {
          console.error(`[webrtc-bridge] OpenClaw exited with code ${code}`);
          this.sendError(ERROR_DEFS.E103, requestId);
          reject(new Error(`OpenClaw exit code: ${code}`));
        }
      });

      openclaw.on('error', (err) => {
        clearTimeout(spawnTimer);
        pendingRequests.delete(requestId);
        console.error(`[webrtc-bridge] OpenClaw spawn error:`, err);
        this.sendError(ERROR_DEFS.E101, requestId);
        reject(err);
      });
    });
  }

  handlePing(data) {
    this.send({
      type: 'pong',
      requestId: data.requestId,
      timestamp: Date.now()
    });
  }

  handleCancel(data) {
    const requestId = data && data.requestId;
    if (!requestId) return;

    const proc = pendingRequests.get(requestId);
    if (proc) {
      try { proc.kill('SIGTERM'); } catch (_) {}
      pendingRequests.delete(requestId);
    }

    // Ack cancellation (client may already have abandoned UI)
    this.send({
      type: 'cancelled',
      requestId,
      timestamp: Date.now()
    });
  }

  send(message) {
    if (this.transport && this.connected) {
      const success = this.transport.send(message);
      if (!success) {
        console.warn(`[webrtc-bridge] Failed to send message type: ${message.type}`);
      }
      return success;
    }
    return false;
  }

  sendError(errorDef, requestId) {
    stats.errorsTotal++;
    
    this.send({
      type: 'error',
      code: errorDef.code,
      error: errorDef.message,
      hint: errorDef.hint,
      retryable: errorDef.category !== 'client',
      requestId,
      timestamp: Date.now()
    });
  }

  getStats() {
    return {
      sessionId: this.sessionId,
      connected: this.connected,
      messageCount: this.messageCount,
      lastActivity: this.lastActivity,
      uptime: Date.now() - this.createdAt,
      transport: this.transport ? this.transport.getStats() : null
    };
  }

  cleanup() {
    console.log(`[webrtc-bridge] Cleaning up session: ${this.sessionId}`);
    
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    
    webrtcSessions.delete(this.sessionId);
    stats.activeSessions = Math.max(0, stats.activeSessions - 1);
  }
}

/**
 * Handle new WebRTC signaling connections
 */
function handleSignalingConnection(signalingClient, sessionId, role) {
  if (role !== 'server') {
    console.log(`[webrtc-bridge] Ignoring non-server role: ${role}`);
    return;
  }

  console.log(`[webrtc-bridge] Server peer registered for session: ${sessionId}`);

  // Create WebRTC session
  const session = new WebRTCSession(sessionId, signalingClient);
  webrtcSessions.set(sessionId, session);

  // Initialize transport
  session.initialize()
    .then(() => {
      console.log(`[webrtc-bridge] WebRTC session ready: ${sessionId}`);
    })
    .catch((err) => {
      console.error(`[webrtc-bridge] Session initialization failed: ${sessionId}`, err);
      session.cleanup();
    });

  // Handle signaling client disconnect
  signalingClient.on('disconnect', () => {
    session.cleanup();
  });

  return session;
}

/**
 * Attach WebRTC bridge to signaling server
 */
function attachWebRTCBridge(signalingServer) {
  console.log('[webrtc-bridge] Attaching to signaling server');

  // Listen for new registrations
  signalingServer.on('registration', (clientInfo) => {
    const { sessionId, role, signalingClient } = clientInfo;
    handleSignalingConnection(signalingClient, sessionId, role);
  });

  // Cleanup stale sessions
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of webrtcSessions.entries()) {
      if (now - session.lastActivity > config.sessionTimeout) {
        console.log(`[webrtc-bridge] Cleaning up stale session: ${sessionId}`);
        session.cleanup();
      }
    }
  }, 60000); // Check every minute

  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
    for (const session of webrtcSessions.values()) {
      session.cleanup();
    }
  });

  return {
    getStats: () => ({
      ...stats,
      activeSessions: webrtcSessions.size,
      sessions: Array.from(webrtcSessions.values()).map(s => s.getStats())
    }),
    
    getSessions: () => Array.from(webrtcSessions.values()),
    
    getSession: (sessionId) => webrtcSessions.get(sessionId),
    
    closeSession: (sessionId) => {
      const session = webrtcSessions.get(sessionId);
      if (session) {
        session.cleanup();
        return true;
      }
      return false;
    }
  };
}

/**
 * Check if WebRTC transport is available
 */
function isWebRTCAvailable() {
  try {
    require('../src/transports/webrtc-transport');
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  attachWebRTCBridge,
  isWebRTCAvailable,
  WebRTCSession,
  ERROR_DEFS
};