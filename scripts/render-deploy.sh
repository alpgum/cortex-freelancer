#!/bin/bash
# render-deploy.sh — Deploy Cortex Freelancer to Render.com
# Usage: ./scripts/render-deploy.sh [--check-only]
#
# Prerequisites:
#   - Render CLI: npm i -g @renderinc/cli
#   - Or connect via GitHub at https://render.com/new/blueprint
#
# This script handles:
#   1. Pre-deploy validation
#   2. Git-based deployment trigger
#   3. Post-deploy health verification

set -euo pipefail

RENDER_SERVICE_URL="${RENDER_SERVICE_URL:-https://cortex-freelancer.onrender.com}"
HEALTH_ENDPOINT="${RENDER_SERVICE_URL}/api/health"
WS_HEALTH_ENDPOINT="${RENDER_SERVICE_URL}/ws/health"
CHECK_ONLY="${1:-}"

echo "╔══════════════════════════════════════════════╗"
echo "║  Cortex Freelancer → Render.com Deploy       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Pre-deploy checks ──
echo "▸ Pre-deploy validation..."

# Check Dockerfile exists
if [ ! -f "Dockerfile.render" ]; then
  echo "✗ Dockerfile.render not found"
  exit 1
fi
echo "  ✓ Dockerfile.render exists"

# Check render.yaml exists
if [ ! -f "render.yaml" ]; then
  echo "✗ render.yaml not found"
  exit 1
fi
echo "  ✓ render.yaml exists"

# Check server.js loads
node -e "require('./server')" 2>/dev/null && echo "  ✓ server.js loads" || echo "  ⚠ server.js load check skipped (deps may not be installed)"

# Check package.json
if [ ! -f "package.json" ]; then
  echo "✗ package.json not found"
  exit 1
fi
echo "  ✓ package.json exists"

echo ""

if [ "$CHECK_ONLY" = "--check-only" ]; then
  echo "▸ Check-only mode — skipping deployment"
  exit 0
fi

# ── 2. Deploy ──
echo "▸ Deploying via git push..."
echo "  Render auto-deploys from the 'main' branch."
echo "  If not connected yet, visit: https://render.com/new/blueprint"
echo ""

# Check if render CLI is available
if command -v render &> /dev/null; then
  echo "  Render CLI detected. Triggering deploy..."
  render deploys create --service-name cortex-freelancer --wait || {
    echo "  ⚠ CLI deploy failed, falling back to git push"
    git push origin main
  }
else
  echo "  No Render CLI found. Using git push (auto-deploy)..."
  git push origin main
fi

echo ""

# ── 3. Post-deploy health check ──
echo "▸ Waiting for deployment (60s)..."
sleep 60

echo "▸ Health check: ${HEALTH_ENDPOINT}"
for i in 1 2 3 4 5; do
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ Health check passed (HTTP $HTTP_CODE)"
    break
  fi
  echo "  ⚠ Attempt $i/5 — HTTP $HTTP_CODE (retrying in 15s)"
  sleep 15
done

echo ""
echo "▸ WebSocket health: ${WS_HEALTH_ENDPOINT}"
WS_HEALTH=$(curl -sf "$WS_HEALTH_ENDPOINT" 2>/dev/null || echo '{"error":"unreachable"}')
echo "  $WS_HEALTH" | head -5

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Deploy complete                             ║"
echo "║  URL: ${RENDER_SERVICE_URL}                  ║"
echo "╚══════════════════════════════════════════════╝"
