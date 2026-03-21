#!/usr/bin/env bash
# [325] Live mode smoke tests — quick curl checks for pages + API endpoints
set -euo pipefail

BASE_URL="${1:-https://cortexfreelancer.com}"
PASS=0
FAIL=0
ERRORS=""

check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"

  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected" ]; then
    printf "  ✓ %-35s %s\n" "$label" "$status"
    PASS=$((PASS + 1))
  else
    printf "  ✗ %-35s %s (expected %s)\n" "$label" "$status" "$expected"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $label: got $status, expected $expected"
  fi
}

echo "============================================"
echo " Cortex Freelancer — Live Smoke Tests"
echo " Target: $BASE_URL"
echo " Time:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
echo ""

echo "── Pages ──"
check "Homepage"               "$BASE_URL/"
check "Pricing"                "$BASE_URL/pricing"
check "App (tools index)"      "$BASE_URL/app"
check "Login"                  "$BASE_URL/app/login.html"
check "Admin"                  "$BASE_URL/admin.html"
check "Blog"                   "$BASE_URL/blog/"
check "Checkout Success"       "$BASE_URL/checkout-success.html"
check "Terms"                  "$BASE_URL/terms"
check "Privacy"                "$BASE_URL/privacy"
check "Contact"                "$BASE_URL/contact"
check "FAQ"                    "$BASE_URL/faq"
check "Status"                 "$BASE_URL/status"
check "Changelog"              "$BASE_URL/changelog"
check "404 page"               "$BASE_URL/nonexistent-page-xyz" "404"

echo ""
echo "── API Endpoints ──"
check "GET /api/health"        "$BASE_URL/api/health"
check "GET /api/stripe-config" "$BASE_URL/api/stripe-config"
check "GET /api/tool-stats"    "$BASE_URL/api/tool-stats"
check "GET /api/stats"         "$BASE_URL/api/stats"

echo ""
echo "── API POST (expect 4xx without body) ──"
check "POST /api/checkout (no body)"  "$BASE_URL/api/checkout" "400"
check "POST /api/portal (no body)"    "$BASE_URL/api/portal" "400"
check "POST /api/webhook (no sig)"    "$BASE_URL/api/webhook" "400"

echo ""
echo "============================================"
echo " Results: $PASS passed, $FAIL failed"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  printf "\nFailed checks:$ERRORS\n"
  exit 1
fi

echo ""
echo "All checks passed!"
exit 0
