/**
 * Vercel Edge Function — SSE Chat Endpoint (Production-Ready)
 * CFX-013: Global edge-distributed chat via Server-Sent Events
 *
 * This is the PRODUCTION implementation for Cortex Freelancer.
 * Uses SSE (not WebSocket) which is fully supported on Vercel Edge.
 *
 * Client-side usage:
 *   const es = new EventSource('/api/edge/chat-sse?message=...&sessionId=...');
 *   es.addEventListener('stream_chunk', (e) => { ... });
 *   es.addEventListener('stream_end', (e) => { es.close(); });
 *
 * Or POST for more complex payloads (profile, goals, etc.)
 */

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'cdg1', 'hnd1', 'syd1'],
};

const BACKEND_URL = process.env.OPENCLAW_BACKEND_URL || 'https://cortexfreelancer.com';

export default async function handler(request) {
  const url = new URL(request.url);

  // CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Health
  if (url.pathname.endsWith('/health')) {
    return Response.json({
      ok: true,
      edge: true,
      region: process.env.VERCEL_REGION || 'unknown',
      ts: Date.now(),
    }, { headers: corsHeaders() });
  }

  // Accept GET (EventSource) or POST
  let message, sessionId, profile, goals;

  if (request.method === 'GET') {
    message = url.searchParams.get('message');
    sessionId = url.searchParams.get('sessionId');
  } else if (request.method === 'POST') {
    try {
      const body = await request.json();
      message = body.message;
      sessionId = body.sessionId;
      profile = body.profile;
      goals = body.goals;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders() });
    }
  } else {
    return Response.json({ error: 'Use GET or POST' }, { status: 405, headers: corsHeaders() });
  }

  if (!message?.trim()) {
    return Response.json({ error: 'message required' }, { status: 400, headers: corsHeaders() });
  }

  const edgeRegion = process.env.VERCEL_REGION || 'unknown';
  const sid = sessionId || `edge-${crypto.randomUUID().slice(0, 8)}`;
  const startTime = Date.now();

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  // Stream in background
  streamChat(writer, enc, { message, sid, profile, goals, edgeRegion, startTime });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Edge-Region': edgeRegion,
      ...corsHeaders(),
    },
  });
}

async function streamChat(writer, enc, ctx) {
  const { message, sid, profile, goals, edgeRegion, startTime } = ctx;

  try {
    await sse(writer, enc, 'stream_start', { sessionId: sid, edgeRegion });

    // Forward to backend
    const resp = await fetch(`${BACKEND_URL}/api/chat-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Edge-Region': edgeRegion,
      },
      body: JSON.stringify({
        message: message.trim().slice(0, 4000),
        sessionId: sid,
        profile,
        goals,
      }),
      signal: AbortSignal.timeout(25000), // Edge timeout safety (30s limit - 5s buffer)
    });

    if (!resp.ok) {
      await sse(writer, enc, 'error', {
        code: 'E_BACKEND',
        error: `Backend ${resp.status}`,
        retryable: resp.status >= 500,
      });
      return;
    }

    // Stream response
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let idx = 0;
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      await sse(writer, enc, 'stream_chunk', { chunk, index: idx++ });
    }

    await sse(writer, enc, 'stream_end', {
      reply: fullText,
      sessionId: sid,
      latencyMs: Date.now() - startTime,
      edgeRegion,
    });

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    await sse(writer, enc, 'error', {
      code: isTimeout ? 'E_TIMEOUT' : 'E_PROXY',
      error: isTimeout ? 'Request timed out at edge' : err.message,
      retryable: true,
      edgeRegion,
    });
  } finally {
    try { await writer.close(); } catch {}
  }
}

async function sse(writer, enc, event, data) {
  await writer.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
