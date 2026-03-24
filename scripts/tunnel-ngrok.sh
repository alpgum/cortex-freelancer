#!/bin/bash
# CFX-003: ngrok tunnel for Cortex Freelancer WebSocket bridge
# Recommended alternative to Cloudflare tunnel for WebSocket support
#
# Prerequisites:
#   brew install ngrok
#   ngrok config add-authtoken YOUR_TOKEN  (get from https://dashboard.ngrok.com)
#
# Usage:
#   ./scripts/tunnel-ngrok.sh [port]
#
# Default port: 3847 (Cortex Freelancer server.js)

set -euo pipefail

PORT="${1:-3847}"
LOG_FILE="/tmp/ngrok-cortex.log"

echo "🔗 Starting ngrok tunnel for Cortex Freelancer..."
echo "   Local: http://localhost:${PORT}"
echo "   WebSocket: ws://localhost:${PORT}/ws/chat"
echo ""

# Check if server is running
if ! curl -sf "http://localhost:${PORT}/api/health" > /dev/null 2>&1; then
    echo "⚠️  Warning: No server detected on port ${PORT}"
    echo "   Start with: cd $(dirname "$0")/.. && node server.js"
    echo ""
fi

# Check ngrok auth
if ! ngrok config check > /dev/null 2>&1; then
    echo "❌ ngrok not configured. Run:"
    echo "   ngrok config add-authtoken YOUR_TOKEN"
    echo "   Get token: https://dashboard.ngrok.com/get-started/your-authtoken"
    exit 1
fi

# Start ngrok with WebSocket-friendly settings
echo "📡 Launching ngrok..."
echo "   Dashboard: http://localhost:4040"
echo ""

ngrok http "${PORT}" \
    --log "${LOG_FILE}" \
    --log-level info

# ngrok blocks here until Ctrl+C
