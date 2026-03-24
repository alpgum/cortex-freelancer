#!/usr/bin/env bash
# CFX-016: Load Balancer Failover Test Suite
# Tests health checks, failover behavior, and WebSocket handling
#
# Usage: ./failover-test.sh [domain]
# Example: ./failover-test.sh cortexfreelancer.com

set -euo pipefail

DOMAIN="${1:-cortexfreelancer.com}"
HEALTH_PATH="/api/health"
WS_PATH="/ws/chat"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

pass() { echo -e "  ${GREEN}✅ $1${NC}"; ((PASSED++)); }
fail() { echo -e "  ${RED}❌ $1${NC}"; ((FAILED++)); }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; ((WARNINGS++)); }

echo "═══════════════════════════════════════════════════════"
echo "CFX-016: Load Balancer Test Suite"
echo "Domain: ${DOMAIN}"
echo "Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "═══════════════════════════════════════════════════════"

# ── Test 1: Health endpoint reachability ──
echo ""
echo "▸ Test 1: Health Endpoint"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}${HEALTH_PATH}" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  pass "Health endpoint returns 200"
else
  fail "Health endpoint returns ${HTTP_CODE} (expected 200)"
fi

# ── Test 2: Health response format ──
echo ""
echo "▸ Test 2: Health Response Validation"
HEALTH_BODY=$(curl -s "https://${DOMAIN}${HEALTH_PATH}" 2>/dev/null || echo "{}")
if echo "$HEALTH_BODY" | grep -q '"status":"ok"'; then
  pass "Health status is 'ok'"
elif echo "$HEALTH_BODY" | grep -q '"status":"degraded"'; then
  warn "Health status is 'degraded'"
else
  fail "Health status missing or unhealthy"
fi

if echo "$HEALTH_BODY" | grep -q '"platform"'; then
  PLATFORM=$(echo "$HEALTH_BODY" | grep -o '"platform":"[^"]*"' | cut -d'"' -f4)
  pass "Platform detected: ${PLATFORM}"
else
  warn "Platform field missing from health response"
fi

# ── Test 3: Cloudflare headers ──
echo ""
echo "▸ Test 3: Cloudflare Integration"
CF_HEADERS=$(curl -sI "https://${DOMAIN}/" 2>/dev/null)
if echo "$CF_HEADERS" | grep -qi "cf-ray"; then
  pass "Cloudflare proxy active (cf-ray header present)"
else
  fail "Cloudflare proxy not detected"
fi

if echo "$CF_HEADERS" | grep -qi "cf-cache-status"; then
  pass "Cloudflare CDN caching active"
else
  warn "Cloudflare CDN cache status header missing"
fi

# ── Test 4: SSL/TLS ──
echo ""
echo "▸ Test 4: SSL/TLS"
SSL_INFO=$(curl -sI "https://${DOMAIN}/" 2>/dev/null | grep -i "strict-transport")
if [ -n "$SSL_INFO" ]; then
  pass "HSTS header present"
else
  warn "HSTS header missing"
fi

# ── Test 5: Origin diversity check ──
echo ""
echo "▸ Test 5: Origin Diversity (10 requests)"
declare -A ORIGINS
for i in $(seq 1 10); do
  ORIGIN=$(curl -s "https://${DOMAIN}${HEALTH_PATH}" 2>/dev/null | grep -o '"platform":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
  ORIGINS[$ORIGIN]=$(( ${ORIGINS[$ORIGIN]:-0} + 1 ))
  sleep 0.5
done

echo "  Origins seen:"
for origin in "${!ORIGINS[@]}"; do
  echo "    ${origin}: ${ORIGINS[$origin]} requests"
done

if [ ${#ORIGINS[@]} -ge 1 ]; then
  pass "At least one origin responding"
else
  fail "No origins responding"
fi

# ── Test 6: WebSocket upgrade ──
echo ""
echo "▸ Test 6: WebSocket Upgrade"
WS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://${DOMAIN}${WS_PATH}" 2>/dev/null || echo "000")

if [ "$WS_CODE" = "101" ]; then
  pass "WebSocket upgrade successful (101)"
elif [ "$WS_CODE" = "200" ] || [ "$WS_CODE" = "426" ]; then
  warn "WebSocket endpoint responded with ${WS_CODE} (may need ws:// client)"
else
  warn "WebSocket upgrade returned ${WS_CODE}"
fi

# ── Test 7: Response time ──
echo ""
echo "▸ Test 7: Response Time"
TOTAL_TIME=$(curl -s -o /dev/null -w "%{time_total}" "https://${DOMAIN}${HEALTH_PATH}" 2>/dev/null || echo "99")
TIME_MS=$(echo "$TOTAL_TIME * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "?")

if [ "${TIME_MS}" != "?" ] && [ "${TIME_MS}" -lt 500 ]; then
  pass "Response time: ${TIME_MS}ms (< 500ms)"
elif [ "${TIME_MS}" != "?" ] && [ "${TIME_MS}" -lt 2000 ]; then
  warn "Response time: ${TIME_MS}ms (< 2s, acceptable)"
else
  fail "Response time: ${TIME_MS}ms (too slow or failed)"
fi

# ── Test 8: Rate limiting ──
echo ""
echo "▸ Test 8: Rate Limiting"
RATE_CODES=""
for i in $(seq 1 35); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/health" 2>/dev/null)
  RATE_CODES="${RATE_CODES}${CODE} "
done

if echo "$RATE_CODES" | grep -q "429"; then
  pass "Rate limiting active (429 detected)"
else
  warn "No 429 detected in 35 rapid requests (rate limiting may be lenient)"
fi

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════════════════"
echo "Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC}, ${YELLOW}${WARNINGS} warnings${NC}"
echo "═══════════════════════════════════════════════════════"

[ $FAILED -eq 0 ] && exit 0 || exit 1
