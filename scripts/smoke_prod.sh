#!/bin/bash
# [399] Production smoke test script
# Checks core URLs return 200 and key DOM markers exist
#
# Usage: ./scripts/smoke_prod.sh [base_url]
# Default: https://cortexfreelancer.com

set -e

BASE_URL="${1:-https://cortexfreelancer.com}"
PASS=0
FAIL=0
TOTAL=0

check_url() {
  local url="$1"
  local expected_status="${2:-200}"
  local dom_marker="$3"
  TOTAL=$((TOTAL + 1))

  local status
  status=$(curl -s -o /tmp/smoke_body.html -w "%{http_code}" "$url" 2>/dev/null)

  if [ "$status" = "$expected_status" ]; then
    if [ -n "$dom_marker" ]; then
      if grep -q "$dom_marker" /tmp/smoke_body.html 2>/dev/null; then
        echo "  [PASS] $url (${status}, marker found)"
        PASS=$((PASS + 1))
      else
        echo "  [FAIL] $url (${status}, missing marker: $dom_marker)"
        FAIL=$((FAIL + 1))
      fi
    else
      echo "  [PASS] $url (${status})"
      PASS=$((PASS + 1))
    fi
  else
    echo "  [FAIL] $url (expected ${expected_status}, got ${status})"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Cortex Freelancer — Production Smoke Test ==="
echo "Base URL: $BASE_URL"
echo ""

echo "--- Core Pages ---"
check_url "$BASE_URL/" 200 "CORTEX"
check_url "$BASE_URL/pricing" 200 "pricing"
check_url "$BASE_URL/app" 200 ""
check_url "$BASE_URL/login" 200 ""
check_url "$BASE_URL/contact" 200 ""
check_url "$BASE_URL/changelog" 200 ""
check_url "$BASE_URL/status" 200 ""

echo ""
echo "--- Tools ---"
check_url "$BASE_URL/tools/invoice" 200 "Invoice"
check_url "$BASE_URL/tools/proposal" 200 "Proposal"
check_url "$BASE_URL/tools/rate-calculator" 200 ""
check_url "$BASE_URL/tools/fee-calculator" 200 ""
check_url "$BASE_URL/tools/contract-review" 200 ""

echo ""
echo "--- API ---"
check_url "$BASE_URL/api/health" 200 ""

echo ""
echo "--- Error Pages ---"
check_url "$BASE_URL/this-should-not-exist-xyz" 404 "404"

echo ""
echo "--- Security Headers ---"
HEADERS=$(curl -sI "$BASE_URL/" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if echo "$HEADERS" | grep -qi "x-content-type-options"; then
  echo "  [PASS] Security headers present"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Missing security headers"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed, $TOTAL total ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo "All smoke tests passed!"
