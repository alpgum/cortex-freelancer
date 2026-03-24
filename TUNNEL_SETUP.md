# BRIDGE-002: Network Tunnel Setup Guide

> Cortex Freelancer → Alp's Local OpenClaw bağlantısı için tunnel kurulumu

## Prerequisites

- OpenClaw API `localhost:8080` üzerinde çalışıyor olmalı (BRIDGE-001)
- Node.js 18+
- Internet bağlantısı

---

## Option 1: Cloudflare Tunnel (Recommended)

### Installation

```bash
# macOS
brew install cloudflared

# Verify
cloudflared --version
```

### Start Tunnel

```bash
cloudflared tunnel --url http://localhost:8080
```

Output'ta şöyle bir satır göreceksin:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://random-words-here.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

Bu URL'i kopyala — Vercel'e set edeceğiz.

### Why Cloudflare?

- No account required (quick tunnel)
- Free, no bandwidth limit
- Auto-reconnect on network changes
- HTTPS by default

---

## Option 2: ngrok (Fallback)

### Installation

```bash
# macOS
brew install ngrok

# Auth (free account gerekli: https://ngrok.com)
ngrok config add-authtoken YOUR_TOKEN
```

### Start Tunnel

```bash
ngrok http 8080
```

Output'taki `Forwarding` satırından URL'i al:

```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:8080
```

### ngrok Limitations

- Free plan: random URL her restart'ta değişir
- 1 tunnel limit (free)
- Rate limit: 40 req/min (free)

---

## Vercel Environment Variable Setup

Tunnel URL'i aldıktan sonra:

### Via CLI

```bash
# Set for production
cd projects/cortex-freelancer
vercel env add OPENCLAW_BRIDGE_URL production
# Prompt'a tunnel URL'i yapıştır: https://random-words.trycloudflare.com

# Redeploy to pick up new env var
vercel --prod
```

### Via Vercel Dashboard

1. [vercel.com](https://vercel.com) → Project → Settings → Environment Variables
2. Key: `OPENCLAW_BRIDGE_URL`
3. Value: tunnel URL (e.g. `https://random-words.trycloudflare.com`)
4. Environment: Production
5. Save → Redeploy

---

## Test Steps

### 1. Local API Test

```bash
curl -s -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hello", "sessionId": "test-001"}' | jq .
```

Expected:
```json
{
  "response": "...",
  "sessionId": "test-001",
  "timestamp": 1711300000000
}
```

### 2. Tunnel Test

```bash
# Replace with your actual tunnel URL
TUNNEL_URL="https://random-words.trycloudflare.com"

curl -s -X POST "$TUNNEL_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "hello", "sessionId": "test-002"}' | jq .
```

Same response expected. Eğer tunnel çalışıyorsa, local ile aynı response gelir.

### 3. End-to-End (Cortex → OpenClaw)

```bash
# After Vercel redeploy with OPENCLAW_BRIDGE_URL set
curl -s -X POST "https://cortex-freelancer.vercel.app/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I price my freelance services?"}' | jq .
```

---

## Troubleshooting

### Tunnel starts but requests fail

```bash
# Check if local API is actually running
curl http://localhost:8080/api/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"ping"}'
```

Eğer `Connection refused` → OpenClaw API'yi başlat (BRIDGE-001).

### Cloudflared: `connection reset by peer`

```bash
# Restart tunnel
pkill cloudflared
cloudflared tunnel --url http://localhost:8080
```

Network değişikliği (WiFi switch, VPN toggle) sonrası olabilir.

### ngrok: `ERR_NGROK_8012 - tunnel not found`

Free plan'da URL her restart'ta değişir. Yeni URL'i Vercel'e tekrar set et.

### Vercel: `504 Gateway Timeout`

- Tunnel açık mı kontrol et
- OpenClaw response süresi 10s'yi aşıyorsa Vercel timeout verir
- Vercel serverless function timeout: max 10s (hobby), 60s (pro)

### CORS errors in browser

Cortex API zaten proxy olarak çalışıyor, browser doğrudan tunnel'a gitmemeli. Eğer CORS hatası varsa:

```bash
# cloudflared supports --origin-server-name for custom headers
# but normally not needed since Cortex API proxies the request
```

### Tunnel URL changed (cloudflare quick tunnel)

Quick tunnel URL her restart'ta değişir. Kalıcı URL için:

```bash
# Named tunnel (requires Cloudflare account)
cloudflared tunnel create openclaw-bridge
cloudflared tunnel route dns openclaw-bridge bridge.yourdomain.com
cloudflared tunnel run openclaw-bridge --url http://localhost:8080
```

---

## Quick Reference

| Step | Command |
|------|---------|
| Start OpenClaw API | `cd ~/workspace && node api/chat.js` |
| Start Cloudflare Tunnel | `cloudflared tunnel --url http://localhost:8080` |
| Start ngrok (fallback) | `ngrok http 8080` |
| Set Vercel env var | `vercel env add OPENCLAW_BRIDGE_URL production` |
| Deploy Cortex | `vercel --prod` |
| Test local | `curl -X POST localhost:8080/api/chat -d '{"message":"hi"}'` |
| Test tunnel | `curl -X POST TUNNEL_URL/api/chat -d '{"message":"hi"}'` |
