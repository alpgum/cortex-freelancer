/**
 * CFX-025: WebRTC Signaling Server
 * 
 * Lightweight signaling endpoint for WebRTC peer connection establishment.
 * Uses HTTP POST for offer/answer/ICE candidate exchange (no persistent WS needed).
 * 
 * Architecture:
 *   Client A ──offer──> Signaling Server ──offer──> Client B (or AI relay peer)
 *   Client B ──answer─> Signaling Server ──answer─> Client A
 *   Both sides exchange ICE candidates via this endpoint.
 * 
 * For Cortex Freelancer, the "peer" is a server-side relay that bridges
 * WebRTC data channels to the Anthropic API. True P2P between browser clients
 * is also supported for collaborative sessions.
 * 
 * Endpoints (mounted at /api/webrtc-signaling):
 *   POST /api/webrtc-signaling  { action: 'create-room' | 'offer' | 'answer' | 'ice-candidate' | 'poll' }
 * 
 * Dependencies: None (pure Node.js, no external WebRTC libraries on server)
 */

'use strict';

const { randomUUID } = require('crypto');

// ─── In-memory signaling store (replace with Redis for multi-instance) ───
const rooms = new Map();
const ROOM_TTL = 5 * 60 * 1000;  // 5 min room expiry
const MAX_ROOMS = 500;
const MAX_ICE_CANDIDATES = 50;

// ─── STUN/TURN configuration sent to clients ───
const ICE_SERVERS = [
  // Free public STUN servers
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
];

// Add TURN server if configured (essential for corporate firewalls)
if (process.env.TURN_SERVER_URL) {
  ICE_SERVERS.push({
    urls: process.env.TURN_SERVER_URL,
    username: process.env.TURN_USERNAME || '',
    credential: process.env.TURN_CREDENTIAL || '',
  });
}

// ─── Cleanup stale rooms ───
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL) {
      rooms.delete(id);
    }
  }
}, 60_000);

// ─── CORS headers ───
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

// ─── Main handler ───
module.exports = function webrtcSignaling(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders());
    return res.end(JSON.stringify({ error: 'POST only' }));
  }

  const headers = corsHeaders();

  try {
    const body = req.body;
    if (!body || !body.action) {
      res.writeHead(400, headers);
      return res.end(JSON.stringify({ error: 'Missing action' }));
    }

    switch (body.action) {
      case 'create-room':
        return handleCreateRoom(body, res, headers);
      case 'offer':
        return handleOffer(body, res, headers);
      case 'answer':
        return handleAnswer(body, res, headers);
      case 'ice-candidate':
        return handleIceCandidate(body, res, headers);
      case 'poll':
        return handlePoll(body, res, headers);
      case 'config':
        return handleConfig(res, headers);
      default:
        res.writeHead(400, headers);
        return res.end(JSON.stringify({ error: `Unknown action: ${body.action}` }));
    }
  } catch (err) {
    console.error('[webrtc-signaling] Error:', err);
    res.writeHead(500, headers);
    return res.end(JSON.stringify({ error: 'Internal signaling error' }));
  }
};

// ─── Action handlers ───

function handleCreateRoom(body, res, headers) {
  if (rooms.size >= MAX_ROOMS) {
    res.writeHead(503, headers);
    return res.end(JSON.stringify({ error: 'Too many active rooms' }));
  }

  const roomId = randomUUID();
  const peerId = body.peerId || randomUUID();

  rooms.set(roomId, {
    id: roomId,
    createdAt: Date.now(),
    peers: new Map([[peerId, { id: peerId, role: 'initiator', joinedAt: Date.now() }]]),
    offer: null,
    answer: null,
    iceCandidates: { initiator: [], responder: [] },
    state: 'waiting', // waiting | offered | answered | connected | closed
  });

  res.writeHead(200, headers);
  return res.end(JSON.stringify({
    roomId,
    peerId,
    iceServers: ICE_SERVERS,
    state: 'waiting',
  }));
}

function handleOffer(body, res, headers) {
  const { roomId, peerId, sdp } = body;
  if (!roomId || !sdp) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Missing roomId or sdp' }));
  }

  const room = rooms.get(roomId);
  if (!room) {
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Room not found' }));
  }

  room.offer = { sdp, peerId, timestamp: Date.now() };
  room.state = 'offered';

  res.writeHead(200, headers);
  return res.end(JSON.stringify({ ok: true, state: room.state }));
}

function handleAnswer(body, res, headers) {
  const { roomId, peerId, sdp } = body;
  if (!roomId || !sdp) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Missing roomId or sdp' }));
  }

  const room = rooms.get(roomId);
  if (!room) {
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Room not found' }));
  }

  // Register responder peer
  const responderPeerId = peerId || randomUUID();
  if (!room.peers.has(responderPeerId)) {
    room.peers.set(responderPeerId, { id: responderPeerId, role: 'responder', joinedAt: Date.now() });
  }

  room.answer = { sdp, peerId: responderPeerId, timestamp: Date.now() };
  room.state = 'answered';

  res.writeHead(200, headers);
  return res.end(JSON.stringify({ ok: true, state: room.state }));
}

function handleIceCandidate(body, res, headers) {
  const { roomId, peerId, candidate, role } = body;
  if (!roomId || !candidate) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Missing roomId or candidate' }));
  }

  const room = rooms.get(roomId);
  if (!room) {
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Room not found' }));
  }

  const side = role === 'responder' ? 'responder' : 'initiator';
  if (room.iceCandidates[side].length < MAX_ICE_CANDIDATES) {
    room.iceCandidates[side].push({ candidate, peerId, timestamp: Date.now() });
  }

  res.writeHead(200, headers);
  return res.end(JSON.stringify({ ok: true }));
}

function handlePoll(body, res, headers) {
  const { roomId, role, lastPollTimestamp } = body;
  if (!roomId) {
    res.writeHead(400, headers);
    return res.end(JSON.stringify({ error: 'Missing roomId' }));
  }

  const room = rooms.get(roomId);
  if (!room) {
    res.writeHead(404, headers);
    return res.end(JSON.stringify({ error: 'Room not found' }));
  }

  const since = lastPollTimestamp || 0;
  const isInitiator = role === 'initiator';

  // Initiator polls for answer + responder's ICE candidates
  // Responder polls for offer + initiator's ICE candidates
  const result = {
    state: room.state,
    peerCount: room.peers.size,
  };

  if (isInitiator) {
    if (room.answer && room.answer.timestamp > since) {
      result.answer = room.answer.sdp;
    }
    result.iceCandidates = room.iceCandidates.responder
      .filter(c => c.timestamp > since)
      .map(c => c.candidate);
  } else {
    if (room.offer && room.offer.timestamp > since) {
      result.offer = room.offer.sdp;
    }
    result.iceCandidates = room.iceCandidates.initiator
      .filter(c => c.timestamp > since)
      .map(c => c.candidate);
  }

  result.pollTimestamp = Date.now();

  res.writeHead(200, headers);
  return res.end(JSON.stringify(result));
}

function handleConfig(res, headers) {
  res.writeHead(200, headers);
  return res.end(JSON.stringify({
    iceServers: ICE_SERVERS,
    maxMessageSize: 256 * 1024, // 256KB data channel message limit
    supportedProtocols: ['cortex-chat-v1'],
  }));
}
