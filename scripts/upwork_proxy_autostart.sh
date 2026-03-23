#!/usr/bin/env bash
set -euo pipefail

# Upwork Proxy Autostart
# - Starts local Chrome proxy (port 3848)
# - Starts a quick Cloudflare tunnel to it
# - Extracts the trycloudflare URL
# - Updates Vercel env UPWORK_PROXY_URL and redeploys

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROXY_PORT="${PROXY_PORT:-3848}"
CDP_ENDPOINT="${CDP_ENDPOINT:-http://127.0.0.1:18800}"
TUNNEL_LOG="${TUNNEL_LOG:-/tmp/upwork-cloudflared.log}"
PROXY_LOG="${PROXY_LOG:-/tmp/upwork-local-proxy.log}"
URL_OUT="${URL_OUT:-/tmp/upwork-tunnel-url.txt}"

cd "$ROOT_DIR"

echo "[upwork-autostart] ROOT_DIR=$ROOT_DIR"

# 1) Start / restart proxy
pkill -f "scripts/upwork-local-proxy.js" 2>/dev/null || true

export PORT="$PROXY_PORT"
export CDP_ENDPOINT="$CDP_ENDPOINT"

nohup node scripts/upwork-local-proxy.js >"$PROXY_LOG" 2>&1 &

# 2) Start / restart cloudflared quick tunnel
pkill -f "cloudflared tunnel --url http://localhost:${PROXY_PORT}" 2>/dev/null || true

nohup cloudflared tunnel --url "http://localhost:${PROXY_PORT}" >"$TUNNEL_LOG" 2>&1 &

# 3) Extract URL
echo "[upwork-autostart] Waiting for trycloudflare URL..."
URL=""
for i in $(seq 1 40); do
  URL=$(grep -Eo 'https://[^ ]+\.trycloudflare\.com' "$TUNNEL_LOG" | tail -1 || true)
  if [[ -n "$URL" ]]; then
    break
  fi
  sleep 0.5
done

if [[ -z "$URL" ]]; then
  echo "[upwork-autostart] ERROR: could not find tunnel URL in $TUNNEL_LOG"
  tail -n 50 "$TUNNEL_LOG" || true
  exit 1
fi

echo "$URL" > "$URL_OUT"
echo "[upwork-autostart] Tunnel URL: $URL"

# 4) Update Vercel env + redeploy
# NOTE: Removing then adding ensures we don't accumulate duplicates.
vercel env rm UPWORK_PROXY_URL production -y >/dev/null 2>&1 || true
printf "%s" "${URL}/scrape" | vercel env add UPWORK_PROXY_URL production >/dev/null

echo "[upwork-autostart] Redeploying to apply env..."
vercel --prod --yes >/dev/null

echo "[upwork-autostart] DONE"