/**
 * CFX-025: WebRTC Signaling Server
 * 
 * Lightweight WebSocket-based signaling for SDP exchange and ICE candidates.
 * Enables peer-to-peer connection establishment between browser and server.
 * 
 * Features:
 * - SDP offer/answer exchange
 * - ICE candidate relay
 * - Connection lifecycle tracking
 * - Session management and cleanup
 * - Error handling with structured codes
 */

const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');
const EventEmitter = require('events');

// Connection states
const ConnectionState = {
  WAITING: 'waiting',
  SDP_EXCHANGE: 'sdp_exchange',
  ICE_EXCHANGE: 'ice_exchange', 
  CONNECTED: 'connected',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected'
};

// Track active signaling sessions
const signalingClients = new Map();
const pendingConnections = new Map(); // sessionId -> { server, client, state }

// Configuration
const config = {
  // Session timeout - clean up stale sessions
  sessionTimeout: 5 * 60 * 1000, // 5 minutes
  // ICE gathering timeout
  iceTimeout: 30 * 1000, // 30 seconds
  // Max ICE candidates per session
  maxIceCandidates: 50,
  // Heartbeat interval for signaling connection
  heartbeatInterval: 30 * 1000, // 30 seconds
};

// Create event emitter for bridge integration
const signalingEvents = new EventEmitter();

/**
 * Attach signaling server to existing HTTP server
 */
function attachSignalingServer(httpServer) {
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/signaling',
    clientTracking: true 
  });

  console.log('[signaling] WebRTC signaling server attached to /signaling');

  // Cleanup stale sessions periodically
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, conn] of pendingConnections.entries()) {
      if (now - conn.createdAt > config.sessionTimeout) {
        console.log(`[signaling] Cleaning up stale session: ${sessionId}`);
        cleanupSession(sessionId);
      }
    }
  }, 60000); // Check every minute

  wss.on('connection', (ws, req) => {
    const clientId = randomUUID();
    const clientInfo = {
      id: clientId,
      ws,
      role: null, // 'client' or 'server'
      sessionId: null,
      lastSeen: Date.now(),
      iceCandidates: []
    };

    signalingClients.set(clientId, clientInfo);
    
    console.log(`[signaling] Client connected: ${clientId} from ${req.socket.remoteAddress}`);

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(heartbeat);
      }
    }, config.heartbeatInterval);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleSignalingMessage(clientId, message);
      } catch (err) {
        console.error(`[signaling] Invalid JSON from ${clientId}:`, err.message);
        sendError(ws, 'INVALID_JSON', 'Message must be valid JSON');
      }
    });

    ws.on('close', () => {
      console.log(`[signaling] Client disconnected: ${clientId}`);
      clearInterval(heartbeat);
      
      // Clean up any pending connection for this client
      const client = signalingClients.get(clientId);
      if (client && client.sessionId) {
        cleanupSession(client.sessionId);
      }
      
      signalingClients.delete(clientId);
    });

    ws.on('error', (err) => {
      console.error(`[signaling] WebSocket error for ${clientId}:`, err.message);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      clientId,
      timestamp: Date.now()
    }));
  });

  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(cleanup);
    wss.close();
  });

  // Expose event emitter for bridge integration
  wss.signalingEvents = signalingEvents;
  
  return wss;
}

/**
 * Handle incoming signaling messages
 */
function handleSignalingMessage(clientId, message) {
  const client = signalingClients.get(clientId);
  if (!client) return;

  const ws = client.ws;
  client.lastSeen = Date.now();

  console.log(`[signaling] ${clientId} -> ${message.type}`);

  switch (message.type) {
    case 'pong':
      // Heartbeat response - no action needed
      break;

    case 'register':
      handleRegister(client, message);
      break;

    case 'offer':
      handleOffer(client, message);
      break;

    case 'answer':
      handleAnswer(client, message);
      break;

    case 'ice-candidate':
      handleIceCandidate(client, message);
      break;

    case 'disconnect':
      handleDisconnect(client, message);
      break;

    default:
      sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
  }
}

/**
 * Handle client/server registration
 */
function handleRegister(client, message) {
  const { role, sessionId } = message;
  
  if (!role || !['client', 'server'].includes(role)) {
    return sendError(client.ws, 'INVALID_ROLE', 'Role must be "client" or "server"');
  }

  if (!sessionId) {
    return sendError(client.ws, 'MISSING_SESSION_ID', 'Session ID is required');
  }

  client.role = role;
  client.sessionId = sessionId;

  // Initialize or update connection tracking
  if (!pendingConnections.has(sessionId)) {
    pendingConnections.set(sessionId, {
      sessionId,
      server: null,
      client: null,
      state: ConnectionState.WAITING,
      createdAt: Date.now(),
      iceCompleted: false
    });
  }

  const connection = pendingConnections.get(sessionId);
  connection[role] = client;

  console.log(`[signaling] ${client.id} registered as ${role} for session ${sessionId}`);

  // Check if both peers are ready
  if (connection.server && connection.client) {
    connection.state = ConnectionState.SDP_EXCHANGE;
    
    // Notify both peers that they can start
    sendToClient(connection.server.ws, {
      type: 'peer-ready',
      sessionId,
      peerRole: 'client'
    });
    
    sendToClient(connection.client.ws, {
      type: 'peer-ready', 
      sessionId,
      peerRole: 'server'
    });
  }

  sendToClient(client.ws, {
    type: 'registered',
    role,
    sessionId,
    waiting: !connection.server || !connection.client
  });

  // Emit registration event for bridge integration
  signalingEvents.emit('registration', {
    sessionId,
    role,
    clientId: client.id,
    signalingClient: {
      send: (data) => sendToClient(client.ws, data),
      on: (event, handler) => {
        if (event === 'disconnect') {
          client.ws.on('close', handler);
        }
      }
    }
  });
}

/**
 * Handle SDP offer
 */
function handleOffer(client, message) {
  const { sessionId, sdp } = message;
  
  if (!sessionId || !sdp) {
    return sendError(client.ws, 'INVALID_OFFER', 'SessionId and SDP are required');
  }

  const connection = pendingConnections.get(sessionId);
  if (!connection) {
    return sendError(client.ws, 'SESSION_NOT_FOUND', `Session ${sessionId} not found`);
  }

  if (connection.state !== ConnectionState.SDP_EXCHANGE) {
    return sendError(client.ws, 'INVALID_STATE', `Cannot process offer in state: ${connection.state}`);
  }

  // Forward offer to the peer
  const peer = client.role === 'client' ? connection.server : connection.client;
  if (!peer) {
    return sendError(client.ws, 'PEER_NOT_FOUND', 'Peer not connected');
  }

  console.log(`[signaling] Forwarding offer from ${client.role} to ${peer.role} for session ${sessionId}`);

  sendToClient(peer.ws, {
    type: 'offer',
    sessionId,
    sdp,
    from: client.role
  });

  connection.state = ConnectionState.SDP_EXCHANGE;
}

/**
 * Handle SDP answer
 */
function handleAnswer(client, message) {
  const { sessionId, sdp } = message;
  
  if (!sessionId || !sdp) {
    return sendError(client.ws, 'INVALID_ANSWER', 'SessionId and SDP are required');
  }

  const connection = pendingConnections.get(sessionId);
  if (!connection) {
    return sendError(client.ws, 'SESSION_NOT_FOUND', `Session ${sessionId} not found`);
  }

  // Forward answer to the peer
  const peer = client.role === 'client' ? connection.server : connection.client;
  if (!peer) {
    return sendError(client.ws, 'PEER_NOT_FOUND', 'Peer not connected');
  }

  console.log(`[signaling] Forwarding answer from ${client.role} to ${peer.role} for session ${sessionId}`);

  sendToClient(peer.ws, {
    type: 'answer',
    sessionId,
    sdp,
    from: client.role
  });

  connection.state = ConnectionState.ICE_EXCHANGE;
}

/**
 * Handle ICE candidate
 */
function handleIceCandidate(client, message) {
  const { sessionId, candidate } = message;
  
  if (!sessionId) {
    return sendError(client.ws, 'MISSING_SESSION_ID', 'Session ID is required');
  }

  const connection = pendingConnections.get(sessionId);
  if (!connection) {
    return sendError(client.ws, 'SESSION_NOT_FOUND', `Session ${sessionId} not found`);
  }

  // Track ICE candidates count to prevent spam
  client.iceCandidates.push({
    candidate,
    timestamp: Date.now()
  });

  if (client.iceCandidates.length > config.maxIceCandidates) {
    return sendError(client.ws, 'TOO_MANY_ICE_CANDIDATES', 'ICE candidate limit exceeded');
  }

  // Forward to peer
  const peer = client.role === 'client' ? connection.server : connection.client;
  if (peer) {
    console.log(`[signaling] Forwarding ICE candidate from ${client.role} to ${peer.role}`);
    
    sendToClient(peer.ws, {
      type: 'ice-candidate',
      sessionId,
      candidate,
      from: client.role
    });
  }

  // Check for ICE completion (null candidate)
  if (!candidate) {
    console.log(`[signaling] ICE gathering completed for ${client.role} in session ${sessionId}`);
    connection.iceCompleted = true;
  }
}

/**
 * Handle peer disconnect
 */
function handleDisconnect(client, message) {
  const { sessionId } = message;
  
  if (sessionId) {
    cleanupSession(sessionId);
  }
}

/**
 * Clean up session and notify peers
 */
function cleanupSession(sessionId) {
  const connection = pendingConnections.get(sessionId);
  if (!connection) return;

  console.log(`[signaling] Cleaning up session: ${sessionId}`);

  // Notify peers of disconnection
  if (connection.server) {
    sendToClient(connection.server.ws, {
      type: 'peer-disconnected',
      sessionId
    });
  }

  if (connection.client) {
    sendToClient(connection.client.ws, {
      type: 'peer-disconnected',
      sessionId
    });
  }

  pendingConnections.delete(sessionId);
}

/**
 * Send message to client with error handling
 */
function sendToClient(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Send structured error to client
 */
function sendError(ws, code, message, details = {}) {
  sendToClient(ws, {
    type: 'error',
    code,
    message,
    timestamp: Date.now(),
    ...details
  });
}

/**
 * Get signaling statistics
 */
function getSignalingStats() {
  return {
    activeClients: signalingClients.size,
    pendingConnections: pendingConnections.size,
    connections: Array.from(pendingConnections.values()).map(conn => ({
      sessionId: conn.sessionId,
      state: conn.state,
      hasServer: !!conn.server,
      hasClient: !!conn.client,
      ageMs: Date.now() - conn.createdAt
    }))
  };
}

module.exports = {
  attachSignalingServer,
  getSignalingStats,
  ConnectionState
};