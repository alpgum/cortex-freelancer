#!/usr/bin/env bash
# Cortex Freelancer — E2E Smoke Test
# Curls key pages and checks for 200 status + expected content markers.
# Usage: BASE_URL=https://cortexfreelancer.com ./scripts/e2e-smoke.sh
#        or: ./scripts/e2e-smoke.sh http://localhost:3000

set -euo pipefail

BASE="${1:-${BASE_URL:-http://localhost:3000}}"
PASS=0
FAIL=0
TOTAL=0

green='\033[0;32m'
red='\033[0;31m'
reset='\033[0m'

check() {
  local method="$1"
  local path="$2"
  local marker="$3"
  local label="${method} ${path}"
  TOTAL=$((TOTAL + 1))

  local url="${BASE}${path}"
  local tmpfile
  tmpfile=$(mktemp)

  local status
  if [ "$method" = "GET" ]; then
    status=$(curl -s -o "$tmpfile" -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "000")
  elif [ "$method" = "POST" ]; then
    status=$(curl -s -o "$tmpfile" -w '%{http_code}' --max-time 10 -X POST \
      -H "Content-Type: application/json" -d '{}' "$url" 2>/dev/null || echo "000")
  fi

  local body
  body=$(cat "$tmpfile" 2>/dev/null || true)
  rm -f "$tmpfile"

  # Check status (200-299 or 301/302 redirects are OK for pages)
  if [ "$status" -ge 200 ] && [ "$status" -lt 400 ] 2>/dev/null; then
    # Check content marker
    if [ -z "$marker" ] || echo "$body" | grep -qi "$marker"; then
      printf "${green}PASS${reset}  [%s] %s\n" "$status" "$label"
      PASS=$((PASS + 1))
    else
      printf "${red}FAIL${reset}  [%s] %s — missing marker: %s\n" "$status" "$label" "$marker"
      FAIL=$((FAIL + 1))
    fi
  else
    printf "${red}FAIL${reset}  [%s] %s\n" "$status" "$label"
    FAIL=$((FAIL + 1))
  fi
}

echo "=========================================="
echo "  Cortex Freelancer — E2E Smoke Test"
echo "  Target: ${BASE}"
echo "=========================================="
echo ""

# ── Pages ──
check GET  "/"                    "Cortex"
check GET  "/pricing"             "Pro"
check GET  "/pricing.html"        "Pro"
check GET  "/app/"                "Cortex"
check GET  "/app/dashboard"       "Dashboard"
check GET  "/app/dashboard.html"  "Dashboard"
check GET  "/blog/"               "blog"
check GET  "/blog/index.html"     "blog"
check GET  "/faq"                 "FAQ"
check GET  "/faq.html"            "FAQ"

# ── Tool pages ──
check GET  "/app/tools/"                      "Tools"
check GET  "/app/tools/rate-calculator.html"  "Rate"
check GET  "/app/tools/invoice.html"          "Invoice"
check GET  "/app/tools/proposal.html"         "Proposal"
check GET  "/app/tools/scope-analyzer.html"   "Scope"

# ── API endpoints ──
check GET  "/api/health"       ""
check POST "/api/checkout"     ""

echo ""
echo "=========================================="
printf "  Results: ${green}%d PASS${reset}  ${red}%d FAIL${reset}  (%d total)\n" "$PASS" "$FAIL" "$TOTAL"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
