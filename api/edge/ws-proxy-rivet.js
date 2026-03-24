/**
 * Vercel Edge Function — True WebSocket via Rivet Actors
 * CFX-013: WebSocket proxy using Rivet's tunneling approach
 *
 * Rivet (rivet.dev) enables real WebSocket connections on Vercel by using
 * a tunneling pattern where the Vercel function opens an outbound connection
 * to Rivet's gateway, which then forwards inbound WebSocket connections.
 *
 * Architecture:
 *   Browser → WebSocket → Rivet Gateway → Tunnel → Vercel Function → OpenClaw backend
 *
 * Prerequisites:
 *   1. npm install @rivet-dev/actor @rivet-dev/actor-vercel
 *   2. Sign up at rivet.dev and get RIVET_TOKEN
 *   3. Configure RIVET_TOKEN in Vercel env vars
 *
 * This is the RECOMMENDED approach for true WebSocket support on Vercel.
 * See: https://rivet.dev/docs/actors/quickstart/next-js/
 */

// NOTE: This is a reference implementation showing the Rivet Actor pattern.
// It requires @rivet-dev/actor and @rivet-dev/actor-vercel packages.

/*
import { Actor } from '@rivet-dev/actor';
import { setupVercel } from '@rivet-dev/actor-vercel';

class ChatProxy extends Actor {
  // State persisted across connections
  _state = {
    sessionId: null,
    messageHistory: [],
    connectedAt: null,
  };

  // Called when the actor starts
  async onStart() {
    this._state.connectedAt = Date.now();
    this._state.sessionId = `rivet-${crypto.randomUUID().slice(0, 8)}`;
    console.log(`[rivet-ws] Actor started: ${this._state.sessionId}`);
  }

  // Handle new WebSocket connections
  async onConnect(ws, request) {
    console.log(`[rivet-ws] Client connected to actor ${this._state.sessionId}`);
    
    // Send welcome
    ws.send(JSON.stringify({
      type: 'connected',
      sessionId: this._state.sessionId,
      timestamp: Date.now(),
    }));
  }

  // Handle incoming WebSocket messages
  async onMessage(ws, message) {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      return;
    }

    if (data.type !== 'chat' || !data.message?.trim()) {
      ws.send(JSON.stringify({ type: 'error', error: 'Send { type: "chat", message: "..." }' }));
      return;
    }

    // Store in history
    this._state.messageHistory.push({ role: 'user', content: data.message });
    if (this._state.messageHistory.length > 20) {
      this._state.messageHistory = this._state.messageHistory.slice(-20);
    }

    // Forward to OpenClaw backend
    const BACKEND_URL = process.env.OPENCLAW_BACKEND_URL || 'https://cortexfreelancer.com';
    const requestId = data.requestId || crypto.randomUUID().slice(0, 8);

    ws.send(JSON.stringify({
      type: 'stream_start',
      sessionId: this._state.sessionId,
      requestId,
    }));

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: data.message.trim().slice(0, 4000),
          sessionId: this._state.sessionId,
          profile: data.profile,
          goals: data.goals,
          source: 'rivet-ws-proxy',
        }),
      });

      if (!response.ok) {
        ws.send(JSON.stringify({
          type: 'error',
          error: `Backend returned ${response.status}`,
          requestId,
        }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let chunkIndex = 0;
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        fullText += text;
        ws.send(JSON.stringify({
          type: 'stream_chunk',
          chunk: text,
          index: chunkIndex++,
          requestId,
        }));
      }

      this._state.messageHistory.push({ role: 'assistant', content: fullText });

      ws.send(JSON.stringify({
        type: 'stream_end',
        reply: fullText,
        sessionId: this._state.sessionId,
        requestId,
      }));

    } catch (err) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Proxy error: ' + err.message,
        retryable: true,
        requestId,
      }));
    }
  }

  // Handle WebSocket disconnect
  async onDisconnect(ws) {
    console.log(`[rivet-ws] Client disconnected from ${this._state.sessionId}`);
  }
}

// Export for Vercel
export const { GET, POST } = setupVercel({ actors: { chat: ChatProxy } });
*/

// Placeholder export — uncomment above when Rivet is configured
export const config = { runtime: 'edge' };

export default function handler(request) {
  return Response.json({
    status: 'not_configured',
    message: 'Rivet WebSocket proxy requires @rivet-dev/actor package and RIVET_TOKEN. See comments in this file.',
    docs: 'https://rivet.dev/docs/actors/quickstart/next-js/',
  }, { status: 501 });
}
