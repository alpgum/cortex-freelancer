#!/usr/bin/env bash
# deploy-check.sh — Pre-deploy checklist for Cortex Freelancer
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0
WARN=0

pass()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
warn()  { WARN=$((WARN+1)); echo "  ⚠ $1"; }

# ── 1. Required environment variables ────────────────────────────
echo ""
echo "▸ Environment Variables"

REQUIRED_VARS=(
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  ANTHROPIC_API_KEY
  ADMIN_TOKEN
  FIREBASE_SERVICE_ACCOUNT_KEY
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -n "${!var:-}" ]; then
    pass "$var is set"
  else
    fail "$var is NOT set"
  fi
done

# ── 2. Lint: no console.log in api/ ─────────────────────────────
echo ""
echo "▸ Lint — no console.log in api/"

CONSOLE_HITS=$(grep -rn 'console\.log' "$PROJECT_ROOT/api/" --include='*.js' || true)
if [ -z "$CONSOLE_HITS" ]; then
  pass "No console.log found in api/"
else
  COUNT=$(echo "$CONSOLE_HITS" | wc -l | tr -d ' ')
  fail "$COUNT console.log occurrence(s) in api/:"
  echo "$CONSOLE_HITS" | while IFS= read -r line; do
    echo "      $line"
  done
fi

# ── 3. vercel.json route validation ─────────────────────────────
echo ""
echo "▸ vercel.json Routes"

VERCEL_JSON="$PROJECT_ROOT/vercel.json"

if [ ! -f "$VERCEL_JSON" ]; then
  fail "vercel.json not found"
else
  pass "vercel.json exists"

  # Check it's valid JSON
  if python3 -c "import json; json.load(open('$VERCEL_JSON'))" 2>/dev/null; then
    pass "vercel.json is valid JSON"
  else
    fail "vercel.json is NOT valid JSON"
  fi

  # Verify route destinations point to existing files
  DESTS=$(python3 -c "
import json, re
with open('$VERCEL_JSON') as f:
    data = json.load(f)
for r in data.get('routes', []):
    d = r.get('dest', '')
    if d and not '\$' in d and d != '/api/\$1' and 'handle' not in r:
        print(d)
" 2>/dev/null || true)

  MISSING=0
  if [ -n "$DESTS" ]; then
    while IFS= read -r dest; do
      target="$PROJECT_ROOT$dest"
      if [ ! -f "$target" ]; then
        fail "Route dest missing: $dest"
        MISSING=$((MISSING+1))
      fi
    done <<< "$DESTS"
  fi

  if [ "$MISSING" -eq 0 ]; then
    pass "All route destinations exist"
  fi

  # Verify API catch-all route exists
  if grep -q '"/api/(.*)' "$VERCEL_JSON"; then
    pass "API catch-all route present"
  else
    warn "No API catch-all route found"
  fi
fi

# ── 4. Package sanity ───────────────────────────────────────────
echo ""
echo "▸ Package Checks"

if [ -f "$PROJECT_ROOT/package.json" ]; then
  pass "package.json exists"
else
  fail "package.json not found"
fi

if [ -d "$PROJECT_ROOT/node_modules" ]; then
  pass "node_modules present"
else
  warn "node_modules missing — run npm install"
fi

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PASS: $PASS  |  FAIL: $FAIL  |  WARN: $WARN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "  ❌ NO-GO — Fix $FAIL failure(s) before deploying"
  echo ""
  exit 1
else
  echo ""
  echo "  ✅ GO — All checks passed"
  echo ""
  exit 0
fi
