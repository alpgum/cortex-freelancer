#!/usr/bin/env bash
# Cortex Freelancer — E2E Smoke Test v2
# Tests auth, Stripe, all tools, dashboard, APIs with timing.
# Usage: BASE_URL=https://cortexfreelancer.com ./scripts/e2e-smoke.sh
#        or: ./scripts/e2e-smoke.sh http://localhost:3000

set -euo pipefail

BASE="${1:-${BASE_URL:-http://localhost:3000}}"
PASS=0
FAIL=0
TOTAL=0
START_TIME=$(date +%s)

green='\033[0;32m'
red='\033[0;31m'
yellow='\033[0;33m'
cyan='\033[0;36m'
reset='\033[0m'

check() {
  local method="$1"
  local path="$2"
  local marker="$3"
  local expected_status="${4:-2xx}"
  local label="${method} ${path}"
  TOTAL=$((TOTAL + 1))

  local url="${BASE}${path}"
  local tmpfile
  tmpfile=$(mktemp)

  local t_start t_end elapsed
  t_start=$(date +%s%N 2>/dev/null || date +%s)

  local status
  if [ "$method" = "GET" ]; then
    status=$(curl -s -o "$tmpfile" -w '%{http_code}' --max-time 15 "$url" 2>/dev/null || echo "000")
  elif [ "$method" = "POST" ]; then
    status=$(curl -s -o "$tmpfile" -w '%{http_code}' --max-time 15 -X POST \
      -H "Content-Type: application/json" -d '{}' "$url" 2>/dev/null || echo "000")
  fi

  t_end=$(date +%s%N 2>/dev/null || date +%s)
  # Calculate ms if nanoseconds available, otherwise show seconds
  if [ ${#t_start} -gt 10 ]; then
    elapsed=$(( (t_end - t_start) / 1000000 ))
    local timing="${elapsed}ms"
  else
    elapsed=$(( t_end - t_start ))
    local timing="${elapsed}s"
  fi

  local body
  body=$(cat "$tmpfile" 2>/dev/null || true)
  rm -f "$tmpfile"

  # Check expected status
  local status_ok=false
  if [ "$expected_status" = "2xx" ]; then
    [ "$status" -ge 200 ] 2>/dev/null && [ "$status" -lt 400 ] 2>/dev/null && status_ok=true
  elif [ "$expected_status" = "4xx" ]; then
    [ "$status" -ge 400 ] 2>/dev/null && [ "$status" -lt 500 ] 2>/dev/null && status_ok=true
  else
    [ "$status" = "$expected_status" ] && status_ok=true
  fi

  if $status_ok; then
    if [ -z "$marker" ] || echo "$body" | grep -qi "$marker"; then
      printf "${green}PASS${reset}  [%s] %-45s ${cyan}%s${reset}\n" "$status" "$label" "$timing"
      PASS=$((PASS + 1))
    else
      printf "${red}FAIL${reset}  [%s] %-45s — missing marker: %s\n" "$status" "$label" "$marker"
      FAIL=$((FAIL + 1))
    fi
  else
    printf "${red}FAIL${reset}  [%s] %-45s (expected %s)\n" "$status" "$label" "$expected_status"
    FAIL=$((FAIL + 1))
  fi
}

section() {
  echo ""
  printf "${yellow}── %s ──${reset}\n" "$1"
}

echo "=========================================="
echo "  Cortex Freelancer — E2E Smoke Test v2"
echo "  Target: ${BASE}"
echo "  Date:   $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# ─────────────────────────────────────────────
section "Public Pages"
# ─────────────────────────────────────────────
check GET  "/"                    "Cortex"
check GET  "/pricing"             "Pro"
check GET  "/about"               "Cortex"
check GET  "/faq"                 "FAQ"
check GET  "/contact"             "Contact"
check GET  "/support"             "Support"
check GET  "/privacy"             "Privacy"
check GET  "/terms"               "Terms"
check GET  "/refund"              "Refund"
check GET  "/careers"             "Careers"
check GET  "/changelog"           "Changelog"
check GET  "/status"              "Status"
check GET  "/accessibility"       "Accessibility"
check GET  "/launch"              "Launch"
check GET  "/lifetime-deal"       "Lifetime"

# ─────────────────────────────────────────────
section "Blog"
# ─────────────────────────────────────────────
check GET  "/blog/"                                    "blog"
check GET  "/blog/how-to-price-freelance-work.html"    "price"
check GET  "/blog/freelance-invoice-guide.html"        "invoice"
check GET  "/blog/how-to-write-winning-proposals.html" "proposal"
check GET  "/blog/best-freelance-tools-2026.html"      "tools"
check GET  "/blog/upwork-profile-tips.html"            "Upwork"

# ─────────────────────────────────────────────
section "Comparisons"
# ─────────────────────────────────────────────
check GET  "/comparisons/cortex-vs-bonsai.html"     "Bonsai"
check GET  "/comparisons/cortex-vs-honeybook.html"  "HoneyBook"
check GET  "/comparisons/cortex-vs-andco.html"      "AND CO"

# ─────────────────────────────────────────────
section "Landing Pages"
# ─────────────────────────────────────────────
check GET  "/landing/turkey.html"    "Turkey"
check GET  "/landing/egypt.html"     "Egypt"
check GET  "/landing/pakistan.html"   "Pakistan"
check GET  "/landing/nigeria.html"   "Nigeria"

# ─────────────────────────────────────────────
section "Auth Pages"
# ─────────────────────────────────────────────
check GET  "/app/login"      "Login"
check GET  "/app/signup"     "Sign"

# ─────────────────────────────────────────────
section "App Dashboard & Core"
# ─────────────────────────────────────────────
check GET  "/app/"                 "Cortex"
check GET  "/app/dashboard"        "Dashboard"
check GET  "/app/chat"             "Chat"
check GET  "/app/agents"           "Agent"
check GET  "/app/referral"         "Referral"
check GET  "/app/onboarding"       "Onboarding"
check GET  "/app/share"            "Share"

# ─────────────────────────────────────────────
section "All Tools (25 pages)"
# ─────────────────────────────────────────────
check GET  "/app/tools/"                        "Tools"
check GET  "/app/tools/rate-calculator.html"    "Rate"
check GET  "/app/tools/invoice.html"            "Invoice"
check GET  "/app/tools/proposal.html"           "Proposal"
check GET  "/app/tools/scope-analyzer.html"     "Scope"
check GET  "/app/tools/bio-generator.html"      "Bio"
check GET  "/app/tools/email-writer.html"       "Email"
check GET  "/app/tools/fee-calculator.html"     "Fee"
check GET  "/app/tools/tax-estimator.html"      "Tax"
check GET  "/app/tools/sow-generator.html"      "Statement"
check GET  "/app/tools/project-brief.html"      "Brief"
check GET  "/app/tools/contract-review.html"    "Contract"
check GET  "/app/tools/time-tracker.html"       "Time"
check GET  "/app/tools/client-red-flags.html"   "Red Flag"
check GET  "/app/tools/meeting-notes.html"      "Meeting"
check GET  "/app/tools/payment-checker.html"    "Payment"
check GET  "/app/tools/portfolio-review.html"   "Portfolio"
check GET  "/app/tools/project-tracker.html"    "Project"
check GET  "/app/tools/job-scanner.html"        "Job"
check GET  "/app/tools/templates.html"          "Template"
check GET  "/app/tools/client-crm.html"         "CRM"
check GET  "/app/tools/job-digest.html"         "Digest"
check GET  "/app/tools/availability.html"       "Availability"
check GET  "/app/tools/income-dashboard.html"   "Income"
check GET  "/app/tools/weekly-summary.html"     "Weekly"

# ─────────────────────────────────────────────
section "Error Pages"
# ─────────────────────────────────────────────
check GET  "/404.html"    "404"
check GET  "/500.html"    "500"
check GET  "/offline.html" "offline"

# ─────────────────────────────────────────────
section "API Endpoints"
# ─────────────────────────────────────────────
check GET   "/api/health"              ""
check POST  "/api/checkout"            ""        "4xx"
check POST  "/api/track"               ""        "4xx"
check POST  "/api/contact"             ""        "4xx"
check POST  "/api/support"             ""        "4xx"
check POST  "/api/feedback"            ""        "4xx"
check POST  "/api/chat"                ""        "4xx"
check GET   "/api/stripe-config"       ""
check POST  "/api/waitlist"            ""        "4xx"
check GET   "/api/tool-stats"          ""

# ─────────────────────────────────────────────
section "Stripe Integration"
# ─────────────────────────────────────────────
check GET   "/api/stripe-config"       "publishable"
check GET   "/checkout-success"        "Checkout"
check POST  "/api/checkout"            ""        "4xx"

# ─────────────────────────────────────────────
# Results
# ─────────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=========================================="
printf "  Results: ${green}%d PASS${reset}  ${red}%d FAIL${reset}  (%d total)\n" "$PASS" "$FAIL" "$TOTAL"
printf "  Duration: %ds\n" "$DURATION"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  printf "${red}  SMOKE TEST FAILED${reset}\n"
  exit 1
else
  echo ""
  printf "${green}  ALL TESTS PASSED${reset}\n"
  exit 0
fi
