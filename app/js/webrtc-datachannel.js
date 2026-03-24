/**
 * CFX-025: WebRTC Data Channel Client
 * 
 * Peer-to-peer data channel for Cortex Freelancer chat.
 * Provides low-latency, direct communication when network conditions allow.
 * Falls back to SSE/Socket.io/HTTP when WebRTC cannot establish a connection.
 * 
 * Architecture:
 *   Browser ←─ WebRTC Data Channel ─→ Server Relay Peer (bridges to Anthropic API)
 *   Browser ←─ WebRTC Data Channel ─→ Browser (collaborative sessions)
 * 
 * Protocol: cortex-chat-v1
 *   Messages are JSON: { type, payload, id, timestamp }
 *   Types: chat-message, stream-chunk, stream-end, stream-error, ping, pong, typing
 * 
 * Usage:
 *   CortexWebRTC.connect();
 *   CortexWebRTC.sendMessage('How do I price a logo design?');
 *   CortexWebRTC.on('stream-chunk', (data) => { ... });
 * 
 * Fallback chain: WebRTC → Socket.io → SSE → HTTP chunked → REST polling
 */
(function () {
  'use strict';

  /* ── Feature detection ── */
  var HAS_WEBRTC = !!(
    window.RTCPeerConnection &&
    window.RTCSessionDescription &&
    window.RTCIceCandidate
  );

  /* ── State ── */
  var peerConnection = null;
  var dataChannel = null;
  var roomId = null;
  var peerId = null;
  var role = null; // 'initiator' | 'responder'
  var connectionState = 'disconnected'; // disconnected | connecting | connected | failed | closed
  var iceServers = [];
  var listeners = {};
  var pendingMessages = [];
  var pollTimer = null;
  var lastPollTimestamp = 0;
  var reconnectAttempts = 0;
  var messageIdCounter = 0;
  var stats = { messagesSent: 0, messagesReceived: 0, bytesTransferred: 0, connectionTime: 0 };

  /* ── Configuration ── */
  var CONFIG = {
    signalingUrl: '/api/webrtc-signaling',
    pollIntervalMs: 500,        // Poll signaling server every 500ms during setup
    maxReconnectAttempts: 3,     // WebRTC is experimental — don't retry too hard
    reconnectDelayMs: 2000,
    maxMessageSize: 256 * 1024,  // 256KB
    keepAliveIntervalMs: 15000,  // Ping every 15s to detect dead connections
    connectionTimeoutMs: 10000,  // Give up connecting after 10s
    protocol: 'cortex-chat-v1',
    // Data channel options
    channelConfig: {
      ordered: true,             // Guaranteed order for chat messages
      maxRetransmits: 3,         // Retry delivery up to 3 times
    },
  };

  /* ── Event System ── */
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
      try { fns[i](data); } catch (e) { console.error('[webrtc] listener error:', e); }
    }
  }

  /* ── Utility ── */
  function log(msg, data) {
    if (typeof console !== 'undefined') {
      if (data) console.log('[webrtc] ' + msg, data);
      else console.log('[webrtc] ' + msg);
    }
  }

  function generateMessageId() {
    return 'msg-' + (++messageIdCounter) + '-' + Date.now().toString(36);
  }

  /* ── Signaling API ── */
  function signalingPost(body) {
    return fetch(CONFIG.signalingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) throw new Error('Signaling error: ' + r.status);
      return r.json();
    });
  }

  /* ── Connection Flow ── */

  /**
   * Start a WebRTC connection as initiator.
   * 1. Create signaling room
   * 2. Create RTCPeerConnection + data channel
   * 3. Create offer → send to signaling server
   * 4. Poll for answer + ICE candidates
   */
  function connect(options) {
    options = options || {};

    if (!HAS_WEBRTC) {
      log('WebRTC not supported — falling back');
      emit('fallback', { reason: 'no-webrtc-support' });
      return Promise.reject(new Error('WebRTC not supported'));
    }

    if (connectionState === 'connected' || connectionState === 'connecting') {
      return Promise.resolve({ state: connectionState });
    }

    setState('connecting');
    log('Starting WebRTC connection (initiator)...');

    return signalingPost({ action: 'create-room' })
      .then(function (result) {
        roomId = result.roomId;
        peerId = result.peerId;
        iceServers = result.iceServers || [];
        role = 'initiator';

        log('Room created: ' + roomId);
        return createPeerConnection();
      })
      .then(function () {
        // Create data channel (only initiator creates it)
        dataChannel = peerConnection.createDataChannel(CONFIG.protocol, CONFIG.channelConfig);
        setupDataChannel(dataChannel);

        // Create and send offer
        return peerConnection.createOffer();
      })
      .then(function (offer) {
        return peerConnection.setLocalDescription(offer);
      })
      .then(function () {
        return signalingPost({
          action: 'offer',
          roomId: roomId,
          peerId: peerId,
          sdp: peerConnection.localDescription,
        });
      })
      .then(function () {
        log('Offer sent, polling for answer...');
        startPolling();
        return startConnectionTimeout();
      })
      .catch(function (err) {
        log('Connection failed: ' + err.message);
        setState('failed');
        emit('error', { error: err.message, phase: 'connect' });
        emit('fallback', { reason: 'connection-failed', error: err.message });
        cleanup();
        throw err;
      });
  }

  /**
   * Join an existing room as responder.
   * Used for collaborative P2P sessions (browser-to-browser).
   */
  function join(targetRoomId) {
    if (!HAS_WEBRTC) {
      emit('fallback', { reason: 'no-webrtc-support' });
      return Promise.reject(new Error('WebRTC not supported'));
    }

    setState('connecting');
    roomId = targetRoomId;
    role = 'responder';
    peerId = 'peer-' + Date.now().toString(36);

    log('Joining room: ' + roomId + ' as responder');

    return createPeerConnection()
      .then(function () {
        startPolling();
        return { roomId: roomId, peerId: peerId };
      });
  }

  /* ── RTCPeerConnection Setup ── */

  function createPeerConnection() {
    var config = {
      iceServers: iceServers.length > 0 ? iceServers : [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 2,
    };

    peerConnection = new RTCPeerConnection(config);

    // ICE candidate handling
    peerConnection.onicecandidate = function (event) {
      if (event.candidate) {
        log('ICE candidate found');
        signalingPost({
          action: 'ice-candidate',
          roomId: roomId,
          peerId: peerId,
          role: role,
          candidate: event.candidate,
        }).catch(function (err) {
          log('Failed to send ICE candidate: ' + err.message);
        });
      }
    };

    // Connection state changes
    peerConnection.onconnectionstatechange = function () {
      var state = peerConnection.connectionState;
      log('Connection state: ' + state);

      switch (state) {
        case 'connected':
          setState('connected');
          stats.connectionTime = Date.now();
          stopPolling();
          startKeepAlive();
          flushPendingMessages();
          break;
        case 'disconnected':
          log('Peer disconnected — waiting for recovery...');
          break;
        case 'failed':
          setState('failed');
          emit('fallback', { reason: 'connection-failed' });
          cleanup();
          break;
        case 'closed':
          setState('closed');
          cleanup();
          break;
      }
    };

    peerConnection.oniceconnectionstatechange = function () {
      log('ICE state: ' + peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'failed') {
        // Try ICE restart
        if (role === 'initiator' && reconnectAttempts < CONFIG.maxReconnectAttempts) {
          log('ICE failed — attempting restart');
          reconnectAttempts++;
          peerConnection.restartIce();
        }
      }
    };

    // Responder receives data channel from initiator
    peerConnection.ondatachannel = function (event) {
      log('Data channel received');
      dataChannel = event.channel;
      setupDataChannel(dataChannel);
    };

    return Promise.resolve();
  }

  /* ── Data Channel Setup ── */

  function setupDataChannel(channel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = function () {
      log('Data channel open ✓');
      setState('connected');
      emit('open', { protocol: CONFIG.protocol, roomId: roomId });
    };

    channel.onclose = function () {
      log('Data channel closed');
      if (connectionState !== 'closed') {
        setState('disconnected');
        emit('close', { reason: 'channel-closed' });
      }
    };

    channel.onerror = function (err) {
      log('Data channel error', err);
      emit('error', { error: err.message || 'Data channel error', phase: 'channel' });
    };

    channel.onmessage = function (event) {
      handleIncomingMessage(event.data);
    };
  }

  /* ── Message Protocol ── */

  function handleIncomingMessage(rawData) {
    try {
      var msg = JSON.parse(rawData);
      stats.messagesReceived++;
      stats.bytesTransferred += rawData.length;

      switch (msg.type) {
        case 'stream-chunk':
          emit('stream-chunk', { text: msg.payload.text, id: msg.id });
          break;
        case 'stream-end':
          emit('stream-end', {
            fullText: msg.payload.fullText,
            usage: msg.payload.usage,
            id: msg.id,
          });
          break;
        case 'stream-error':
          emit('stream-error', { error: msg.payload.error, id: msg.id });
          break;
        case 'chat-response':
          emit('chat-response', msg.payload);
          break;
        case 'pong':
          // Keep-alive acknowledged
          break;
        case 'typing':
          emit('typing', msg.payload);
          break;
        default:
          log('Unknown message type: ' + msg.type);
          emit('message', msg);
      }
    } catch (e) {
      log('Failed to parse message: ' + e.message);
    }
  }

  function sendRaw(type, payload) {
    var msg = JSON.stringify({
      type: type,
      payload: payload,
      id: generateMessageId(),
      timestamp: Date.now(),
      protocol: CONFIG.protocol,
    });

    if (msg.length > CONFIG.maxMessageSize) {
      emit('error', { error: 'Message too large', phase: 'send' });
      return false;
    }

    if (dataChannel && dataChannel.readyState === 'open') {
      try {
        dataChannel.send(msg);
        stats.messagesSent++;
        stats.bytesTransferred += msg.length;
        return true;
      } catch (e) {
        log('Send failed: ' + e.message);
        return false;
      }
    } else {
      // Queue for when channel opens
      pendingMessages.push({ type: type, payload: payload });
      return false;
    }
  }

  /**
   * Send a chat message over the data channel.
   * The server-side relay peer will forward to Anthropic and stream back.
   */
  function sendMessage(text, options) {
    options = options || {};

    var payload = {
      message: text,
      sessionId: options.sessionId || null,
      profile: options.profile || null,
      goals: options.goals || null,
    };

    var sent = sendRaw('chat-message', payload);

    if (!sent && connectionState !== 'connected') {
      log('Not connected — triggering fallback');
      emit('fallback', { reason: 'not-connected', message: text });
    }

    return sent;
  }

  /* ── Signaling Polling ── */

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      signalingPost({
        action: 'poll',
        roomId: roomId,
        role: role,
        lastPollTimestamp: lastPollTimestamp,
      }).then(function (result) {
        lastPollTimestamp = result.pollTimestamp || Date.now();

        // Process answer (initiator waiting for responder)
        if (result.answer && role === 'initiator') {
          log('Received answer');
          peerConnection.setRemoteDescription(new RTCSessionDescription(result.answer))
            .catch(function (err) { log('Failed to set remote desc: ' + err.message); });
        }

        // Process offer (responder joining)
        if (result.offer && role === 'responder' && !peerConnection.remoteDescription) {
          log('Received offer');
          peerConnection.setRemoteDescription(new RTCSessionDescription(result.offer))
            .then(function () { return peerConnection.createAnswer(); })
            .then(function (answer) { return peerConnection.setLocalDescription(answer); })
            .then(function () {
              return signalingPost({
                action: 'answer',
                roomId: roomId,
                peerId: peerId,
                sdp: peerConnection.localDescription,
              });
            })
            .then(function () { log('Answer sent'); })
            .catch(function (err) { log('Answer flow failed: ' + err.message); });
        }

        // Process ICE candidates from remote peer
        if (result.iceCandidates && result.iceCandidates.length > 0) {
          result.iceCandidates.forEach(function (candidate) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
              .catch(function (err) { log('Failed to add ICE candidate: ' + err.message); });
          });
        }
      }).catch(function (err) {
        log('Poll error: ' + err.message);
      });
    }, CONFIG.pollIntervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* ── Keep-Alive ── */

  var keepAliveTimer = null;

  function startKeepAlive() {
    stopKeepAlive();
    keepAliveTimer = setInterval(function () {
      sendRaw('ping', { timestamp: Date.now() });
    }, CONFIG.keepAliveIntervalMs);
  }

  function stopKeepAlive() {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  }

  /* ── Connection Timeout ── */

  function startConnectionTimeout() {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () {
        if (connectionState !== 'connected') {
          log('Connection timeout — no P2P established');
          setState('failed');
          emit('fallback', { reason: 'timeout' });
          cleanup();
          reject(new Error('WebRTC connection timeout'));
        }
      }, CONFIG.connectionTimeoutMs);

      // Resolve immediately on connect
      on('open', function onOpen() {
        clearTimeout(timeout);
        off('open', onOpen);
        resolve({ state: 'connected', roomId: roomId });
      });
    });
  }

  /* ── Flush Pending ── */

  function flushPendingMessages() {
    while (pendingMessages.length > 0) {
      var msg = pendingMessages.shift();
      sendRaw(msg.type, msg.payload);
    }
  }

  /* ── State Management ── */

  function setState(newState) {
    var prev = connectionState;
    connectionState = newState;
    if (prev !== newState) {
      emit('state-change', { from: prev, to: newState });
      log('State: ' + prev + ' → ' + newState);
    }
  }

  /* ── Cleanup ── */

  function cleanup() {
    stopPolling();
    stopKeepAlive();

    if (dataChannel) {
      try { dataChannel.close(); } catch (e) { /* ignore */ }
      dataChannel = null;
    }

    if (peerConnection) {
      try { peerConnection.close(); } catch (e) { /* ignore */ }
      peerConnection = null;
    }

    roomId = null;
    peerId = null;
    role = null;
    lastPollTimestamp = 0;
  }

  function disconnect() {
    log('Disconnecting...');
    setState('closed');
    cleanup();
    pendingMessages = [];
    reconnectAttempts = 0;
  }

  /* ── Connection Quality ── */

  function getStats() {
    var result = {
      connectionState: connectionState,
      transport: 'webrtc-datachannel',
      roomId: roomId,
      role: role,
      stats: Object.assign({}, stats),
      supported: HAS_WEBRTC,
    };

    if (peerConnection && connectionState === 'connected') {
      result.iceState = peerConnection.iceConnectionState;
      result.signalingState = peerConnection.signalingState;
    }

    if (dataChannel) {
      result.channelState = dataChannel.readyState;
      result.channelLabel = dataChannel.label;
      result.bufferedAmount = dataChannel.bufferedAmount;
    }

    return result;
  }

  /**
   * Get detailed RTCPeerConnection stats (async).
   */
  function getDetailedStats() {
    if (!peerConnection) return Promise.resolve(null);

    return peerConnection.getStats().then(function (statsReport) {
      var result = {};
      statsReport.forEach(function (report) {
        if (report.type === 'data-channel') {
          result.dataChannel = {
            messagesSent: report.messagesSent,
            messagesReceived: report.messagesReceived,
            bytesSent: report.bytesSent,
            bytesReceived: report.bytesReceived,
          };
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          result.candidatePair = {
            localCandidateId: report.localCandidateId,
            remoteCandidateId: report.remoteCandidateId,
            roundTripTime: report.currentRoundTripTime,
            availableOutgoingBitrate: report.availableOutgoingBitrate,
          };
        }
      });
      return result;
    });
  }

  /* ── Public API ── */
  window.CortexWebRTC = {
    connect: connect,
    join: join,
    disconnect: disconnect,
    sendMessage: sendMessage,
    sendRaw: sendRaw,
    on: on,
    off: off,
    getStats: getStats,
    getDetailedStats: getDetailedStats,
    isSupported: function () { return HAS_WEBRTC; },
    isConnected: function () { return connectionState === 'connected'; },
    getState: function () { return connectionState; },
    getRoomId: function () { return roomId; },
    CONFIG: CONFIG,
  };

})();
