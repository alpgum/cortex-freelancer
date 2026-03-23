# Local Chrome Proxy for Upwork Scraping

## Problem

Upwork uses Cloudflare protection that blocks all cloud-based scraping approaches:
- Direct fetch → Cloudflare challenge
- Headless Chrome on Vercel → Cloudflare challenge
- Scrape.do / ScrapingBee → Cloudflare challenge

## Solution

A local Express server that connects to the **host Chrome browser** (already logged into Upwork with real cookies) via Chrome DevTools Protocol (CDP).

## Architecture

```
Vercel API  →  Tunnel (ngrok/Cloudflare)  →  Local Proxy (:3848)  →  Chrome CDP (:18800)
                                                                          ↓
                                                                   Upwork (real session)
```

## Quick Start

```bash
# 1. Start the local proxy
cd projects/cortex-freelancer
node scripts/upwork-local-proxy.js

# 2. Test locally
curl "http://localhost:3848/scrape?url=https://www.upwork.com/freelancers/~01example"

# 3. Expose via tunnel (see below)
```

## Exposing via Tunnel

The Vercel-deployed API needs to reach your local machine. Two options:

### Option A: Cloudflare Tunnel (recommended for production)

```bash
# Install cloudflared
brew install cloudflared

# Quick tunnel (no account needed)
cloudflared tunnel --url http://localhost:3848

# It will output something like:
# https://random-name.trycloudflare.com
```

Then set the Vercel environment variable:
```
UPWORK_PROXY_URL=https://random-name.trycloudflare.com/scrape
```

For a **persistent** tunnel with a custom domain:
```bash
cloudflared tunnel login
cloudflared tunnel create upwork-proxy
cloudflared tunnel route dns upwork-proxy proxy.yourdomain.com
cloudflared tunnel run upwork-proxy
```

### Option B: ngrok

```bash
# Install ngrok
brew install ngrok

# Start tunnel
ngrok http 3848

# Copy the https URL and set:
UPWORK_PROXY_URL=https://xxxx.ngrok-free.app/scrape
```

### Option C: Tailscale (if both machines are on Tailnet)

If your Vercel function can reach your Tailscale IP:
```
UPWORK_PROXY_URL=http://YOUR_TAILSCALE_IP:3848/scrape
```

## Vercel Environment Variable

Set `UPWORK_PROXY_URL` in your Vercel project:

```bash
vercel env add UPWORK_PROXY_URL
# Value: https://YOUR_TUNNEL_URL/scrape
```

Or via the Vercel dashboard: Settings → Environment Variables.

## How It Works

1. The Vercel API (`/api/upwork-profile`) tries direct fetch first (Stage 1)
2. If blocked by Cloudflare, it calls the local proxy (Stage 2) via `UPWORK_PROXY_URL`
3. The local proxy connects to Chrome via CDP (`ws://127.0.0.1:18800`)
4. Opens a new tab, navigates to the Upwork URL
5. Chrome uses its **real cookies and session** — no Cloudflare challenge
6. Extracts profile data from the rendered DOM
7. Returns JSON, closes the tab (not the browser)

## Requirements

- Chrome/OpenClaw browser running with remote debugging on port 18800
- The browser must be **logged into Upwork** (or at least have bypassed Cloudflare)
- Node.js with `express` and `puppeteer-core`

## Security Notes

- The proxy only accepts Upwork profile URLs (regex validated)
- CORS is open (`*`) — restrict in production if needed
- Consider adding an API key header for the tunnel:
  ```js
  // In upwork-local-proxy.js, add:
  if (req.headers['x-proxy-key'] !== process.env.PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  ```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Could not get WebSocket URL" | Ensure Chrome is running with `--remote-debugging-port=18800` |
| "Navigation timeout" | Upwork may be slow; increase timeout in script |
| "Could not extract profile data" | Check if Chrome is logged into Upwork |
| Tunnel URL changes | Use Cloudflare Tunnel with a persistent domain |
