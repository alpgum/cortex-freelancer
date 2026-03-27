#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Cortex Freelancer — Deploy Script
# Usage:
#   ./scripts/deploy.sh              # preview deploy
#   ./scripts/deploy.sh production   # production deploy
#   ./scripts/deploy.sh staging      # staging/preview deploy
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ENV="${1:-preview}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "╔══════════════════════════════════════╗"
echo "║  Cortex Freelancer Deploy            ║"
echo "║  Environment: $ENV"
echo "╚══════════════════════════════════════╝"

# ── Pre-deploy checks ───────────────────────────────────────
echo ""
echo "▸ Running pre-deploy validation..."
node scripts/pre-deploy.js
if [ $? -ne 0 ]; then
  echo "Deploy aborted — pre-deploy checks failed"
  exit 1
fi

# ── Verify Vercel CLI ────────────────────────────────────────
if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm i -g vercel@latest
fi

echo ""
echo "▸ Vercel CLI: $(vercel --version)"
echo "▸ Account: $(vercel whoami 2>/dev/null || echo 'not logged in — run: vercel login')"

# ── Deploy ───────────────────────────────────────────────────
echo ""
if [ "$ENV" = "production" ]; then
  echo "▸ Deploying to PRODUCTION..."
  echo "  ⚠ This will update the live site!"
  read -p "  Continue? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
  URL=$(vercel deploy --prod 2>&1 | tail -1)
else
  echo "▸ Deploying preview..."
  URL=$(vercel deploy 2>&1 | tail -1)
fi

echo ""
echo "▸ Deployed: $URL"

# ── Post-deploy smoke test ───────────────────────────────────
echo ""
echo "▸ Running smoke tests..."
sleep 5

PASS=0
FAIL=0

check_route() {
  local route="$1"
  local expected="${2:-200}"
  local status
  status=$(curl -sf -o /dev/null -w "%{http_code}" "$URL$route" 2>/dev/null || echo "000")
  if [ "$status" = "$expected" ]; then
    echo "  ✓ $route → $status"
    ((PASS++))
  else
    echo "  ✗ $route → $status (expected $expected)"
    ((FAIL++))
  fi
}

check_route "/"
check_route "/api/health"
check_route "/pricing"
check_route "/tools"
check_route "/app"
check_route "/login"

echo ""
echo "▸ Smoke tests: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "⚠ Some routes failed — check deployment logs"
  echo "  vercel logs $URL"
fi

echo ""
echo "═══════════════════════════════════════"
echo "  Deploy complete: $URL"
echo "  Health: $URL/api/health"
echo "  Logs:   vercel logs $URL"
echo "═══════════════════════════════════════"
