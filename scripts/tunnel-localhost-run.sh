#!/bin/bash
# CFX-003: localhost.run tunnel for Cortex Freelancer
# Zero-install alternative — just needs SSH
#
# Usage:
#   ./scripts/tunnel-localhost-run.sh [port]
#
# Limitations:
#   - Random URL each time (no stable URL on free tier)
#   - WebSocket timeout behavior undocumented
#   - Less reliable than ngrok for production use

set -euo pipefail

PORT="${1:-3847}"

echo "🔗 Starting localhost.run tunnel..."
echo "   Local: http://localhost:${PORT}"
echo ""
echo "   Look for the tunnel URL in the output below."
echo "   It will look like: https://xxxx.lhr.life"
echo ""

ssh -R 80:localhost:${PORT} nokey@localhost.run
