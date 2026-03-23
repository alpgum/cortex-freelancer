# Upwork Proxy Autostart (local Chrome → Cloudflare tunnel → Vercel env)

## Why
Upwork blocks cloud scraping. We scrape via the host’s logged-in Chrome (CDP) and expose it to Vercel using a Cloudflare quick tunnel.

Quick tunnels change URL after restarts. This script re-creates the tunnel and updates Vercel `UPWORK_PROXY_URL` automatically.

## Script
`projects/cortex-freelancer/scripts/upwork_proxy_autostart.sh`

What it does:
1) Starts `node scripts/upwork-local-proxy.js` on port **3848**
2) Starts `cloudflared tunnel --url http://localhost:3848`
3) Extracts the `https://*.trycloudflare.com` URL from logs
4) Updates Vercel env:
   - `UPWORK_PROXY_URL=<tunnel>/scrape`
5) Triggers `vercel --prod` deploy

## Run manually
```bash
cd ~/.openclaw/workspace/projects/cortex-freelancer
./scripts/upwork_proxy_autostart.sh
```

## launchd (recommended)
Create a LaunchAgent to run this at login and keep it fresh.

Example plist path:
`~/Library/LaunchAgents/com.cortexfreelancer.upwork-proxy.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.cortexfreelancer.upwork-proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/alperengumusdograyan/.openclaw/workspace/projects/cortex-freelancer/scripts/upwork_proxy_autostart.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>1800</integer>
  <key>StandardOutPath</key><string>/tmp/upwork-proxy-autostart.log</string>
  <key>StandardErrorPath</key><string>/tmp/upwork-proxy-autostart-err.log</string>
</dict>
</plist>
```

Load/unload:
```bash
launchctl load -w ~/Library/LaunchAgents/com.cortexfreelancer.upwork-proxy.plist
launchctl unload -w ~/Library/LaunchAgents/com.cortexfreelancer.upwork-proxy.plist
```

## Notes
- Requires the OpenClaw Chrome (CDP on `http://127.0.0.1:18800`) to be running.
- Quick tunnels have no uptime guarantee; for production stability, prefer a **named Cloudflare tunnel** or **Tailscale**.
