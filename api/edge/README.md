# Edge Functions — CFX-013

## Overview

Vercel Edge Functions for global-distributed chat proxy. Since Vercel doesn't natively support WebSocket upgrade in serverless/edge functions, we implement two approaches:

### 1. SSE Bridge (Production-Ready) — `chat-sse.js`
- Uses Server-Sent Events instead of WebSocket
- Fully supported on Vercel Edge Runtime
- ~0ms cold start (V8 isolates, not containers)
- Deployed to 5+ regions globally
- Client connects via `EventSource` or `fetch` with streaming

### 2. Rivet WebSocket (Reference) — `ws-proxy-rivet.js`  
- True WebSocket support via Rivet Actors (rivet.dev)
- Requires `@rivet-dev/actor` package + Rivet account
- Uses tunneling pattern: function opens outbound tunnel to Rivet gateway
- Best for bidirectional real-time (collaborative features, multiplayer)

### 3. HTTP-to-SSE Proxy — `ws-proxy.js`
- POST-based SSE proxy pattern
- Simpler than Rivet, good for request/response chat

## Architecture

```
┌─────────┐     SSE/fetch      ┌──────────────┐     HTTP POST     ┌─────────────────┐
│ Browser  │ ←────────────────→ │ Vercel Edge  │ ────────────────→ │ OpenClaw Backend │
│          │   (global edge)    │ (V8 isolate) │   (origin fetch)  │ (Railway/Render) │
└─────────┘                     └──────────────┘                    └─────────────────┘
                                  iad1, sfo1,
                                  cdg1, hnd1, syd1
```

## Deployment

```bash
# Edge functions deploy automatically with `vercel deploy`
# Ensure env vars are set:
vercel env add OPENCLAW_BACKEND_URL   # e.g., https://your-railway-app.up.railway.app
vercel env add EDGE_API_SECRET        # optional, for backend auth
```

## Client Usage

```javascript
// SSE approach (recommended)
async function chatViaEdge(message, sessionId) {
  const response = await fetch('/api/edge/chat-sse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const text = decoder.decode(value);
    // Parse SSE events
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        handleEvent(data);
      }
    }
  }
}
```

## Limitations

| Aspect | Vercel Edge | Railway/Render |
|--------|------------|----------------|
| WebSocket | ❌ No native support | ✅ Full support |
| SSE | ✅ Full support | ✅ Full support |
| Cold start | ~0ms (V8 isolates) | ~2-5s (container) |
| Max duration | 30s (Hobby) / 5min (Pro) | Unlimited |
| Global regions | 5+ edge locations | 1 region |
| State | ❌ Stateless | ✅ In-memory |
| Cost | Free tier generous | $5-7/mo |
| Complexity | Low | Medium |
