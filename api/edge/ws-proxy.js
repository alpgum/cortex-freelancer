/**
 * Vercel Edge Function — WebSocket-to-SSE Bridge Proxy
 * CFX-013: Serverless WebSocket proxy for global distribution
 *
 * IMPORTANT: Vercel Functions do NOT natively support WebSocket upgrade.
 * This edge function implements a WebSocket-to-SSE (Server-Sent Events) bridge
 * pattern, which is the closest serverless approximation.
 *
 * Architecture:
 *   Browser → SSE connection → Vercel Edge (global) → HTTP POST → OpenClaw backend
 *
 * For true WebSocket support on Vercel, use Rivet (rivet.dev) which provides
 * WebSocket servers via a tunneling pattern. See ws-proxy-rivet.js for that approach.
 *
 * Edge Runtime: V8 isolates (not Node.js), ~0ms cold start, 30s execution limit (Hobby)
 */

export const config = {
  runtime: 'edge',
  // Deploy to multiple regions for global low-latency
  regions: ['iad1', 'sfo1', 'cdg1', 'hnd1', 'syd1', 'gru1'],
};

// Backend OpenClaw instance URL (set via Vercel env vars)
const BACKEND_URL = process.env.OPENCLAW_BACKEND_URL || 'https://cortexfreelancer.com';
const API_SECRET = process.env.EDGE_API_SECRET || '';

/**
 * SSE Stream Handler — Edge function that proxies chat requests
 * Client connects via EventSource/SSE, edge forwards to backend HTTP API
 */
export default async function handler(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  // Health check
  const url = new URL(request.url);
  if (url.pathname.endsWith('/health')) {
    return Response.json({
      status: 'ok',
      runtime: 'edge',
      region: process.env.VERCEL_REGION || 'unknown',
      timestamp: Date.now(),
    }, { headers: corsHeaders() });
  }

  // Only POST for chat messages
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed. Use POST with { message, sessionId }' },
      { status: 405, headers: corsHeaders() }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders() }
    );
  }

  const { message, sessionId, profile, goals } = body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return Response.json(
      { error: 'message is required' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // Create SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Start background proxy to backend
  const edgeRegion = process.env.VERCEL_REGION || 'unknown';
  const startTime = Date.now();

  // Non-blocking: start streaming response while proxying
  (async () => {
    try {
      // Send initial event
      await writeSSE(writer, encoder, 'stream_start', {
        sessionId: sessionId || 'edge-' + crypto.randomUUID().slice(0, 8),
        edgeRegion,
        timestamp: startTime,
      });

      // Forward to backend OpenClaw HTTP API
      const backendResponse = await fetch(`${BACKEND_URL}/api/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Edge-Region': edgeRegion,
          'X-Edge-Secret': API_SECRET,
          'X-Forwarded-For': request.headers.get('x-forwarded-for') || 'unknown',
        },
        body: JSON.stringify({
          message: message.trim().slice(0, 4000),
          sessionId,
          profile,
          goals,
          source: 'edge-proxy',
        }),
      });

      if (!backendResponse.ok) {
        await writeSSE(writer, encoder, 'error', {
          code: 'E_BACKEND',
          error: `Backend returned ${backendResponse.status}`,
          retryable: backendResponse.status >= 500,
          edgeRegion,
        });
        await writer.close();
        return;
      }

      // Stream backend response chunks to client via SSE
      const reader = backendResponse.body.getReader();
      const decoder = new TextDecoder();
      let chunkIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        await writeSSE(writer, encoder, 'stream_chunk', {
          chunk: text,
          index: chunkIndex++,
        });
      }

      // Send completion event
      const elapsed = Date.now() - startTime;
      await writeSSE(writer, encoder, 'stream_end', {
        edgeRegion,
        latencyMs: elapsed,
        timestamp: Date.now(),
      });

    } catch (err) {
      await writeSSE(writer, encoder, 'error', {
        code: 'E_PROXY',
        error: 'Edge proxy error: ' + (err.message || 'unknown'),
        retryable: true,
        edgeRegion,
      });
    } finally {
      try { await writer.close(); } catch {}
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Edge-Region': edgeRegion,
      ...corsHeaders(),
    },
  });
}

/** Write a Server-Sent Event */
async function writeSSE(writer, encoder, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  await writer.write(encoder.encode(payload));
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
