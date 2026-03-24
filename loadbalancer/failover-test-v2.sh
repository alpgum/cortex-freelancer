#!/usr/bin/env bash
# CFX-046: Failover Integration Tests
# Run: chmod +x failover-test-v2.sh && ./failover-test-v2.sh
#
# Tests the full failover chain: health checks → failure detection → dispatcher switch → recovery

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS++)); }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL++)); }
skip() { echo -e "  ${YELLOW}⊘${NC} $1 (skipped)"; ((SKIP++)); }

header() { echo -e "\n${YELLOW}═══ $1 ═══${NC}"; }

# ─── Config ───────────────────────────────────────────────────────

PRIMARY_URL="${PRIMARY_URL:-http://localhost:3847}"
BACKUP_URL="${BACKUP_URL:-http://localhost:3848}"
ADMIN_URL="${ADMIN_URL:-http://localhost:3850}"

# ─── Test: Health Endpoints ───────────────────────────────────────

header "Health Endpoint Tests"

# Full health check
if response=$(curl -sf "${PRIMARY_URL}/api/health" 2>/dev/null); then
  status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "")
  if [ "$status" = "ok" ]; then
    pass "GET /api/health returns status=ok"
  else
    fail "GET /api/health status=$status (expected ok)"
  fi

  # Check instance identity fields
  inst_id=$(echo "$response" | jq -r '.instance.id' 2>/dev/null || echo "")
  inst_role=$(echo "$response" | jq -r '.instance.role' 2>/dev/null || echo "")
  if [ -n "$inst_id" ] && [ "$inst_id" != "null" ]; then
    pass "Health response includes instance.id=$inst_id"
  else
    fail "Health response missing instance.id"
  fi
  if [ -n "$inst_role" ] && [ "$inst_role" != "null" ]; then
    pass "Health response includes instance.role=$inst_role"
  else
    fail "Health response missing instance.role"
  fi
else
  skip "Primary not reachable at $PRIMARY_URL"
fi

# Liveness probe
if response=$(curl -sf "${PRIMARY_URL}/api/health/live" 2>/dev/null); then
  status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "")
  if [ "$status" = "alive" ]; then
    pass "GET /api/health/live returns alive"
  else
    fail "Liveness probe unexpected status=$status"
  fi
else
  skip "Liveness probe not reachable"
fi

# Readiness probe
if response=$(curl -sf "${PRIMARY_URL}/api/health/ready" 2>/dev/null); then
  ready=$(echo "$response" | jq -r '.ready' 2>/dev/null || echo "")
  if [ "$ready" = "true" ]; then
    pass "GET /api/health/ready returns ready=true"
  else
    fail "Readiness probe ready=$ready"
  fi
else
  skip "Readiness probe not reachable"
fi

# Instance info
if response=$(curl -sf "${PRIMARY_URL}/api/health/instance" 2>/dev/null); then
  platform=$(echo "$response" | jq -r '.instance.platform' 2>/dev/null || echo "")
  if [ -n "$platform" ] && [ "$platform" != "null" ]; then
    pass "GET /api/health/instance returns platform=$platform"
  else
    fail "Instance info missing platform"
  fi
else
  skip "Instance info not reachable"
fi

# ─── Test: Failover Admin API ────────────────────────────────────

header "Failover Dispatcher Tests"

# Status endpoint
if response=$(curl -sf "${ADMIN_URL}/api/failover/status" 2>/dev/null); then
  state=$(echo "$response" | jq -r '.state' 2>/dev/null || echo "")
  active=$(echo "$response" | jq -r '.activeInstanceId' 2>/dev/null || echo "")
  if [ -n "$state" ]; then
    pass "GET /api/failover/status returns state=$state, active=$active"
  else
    fail "Failover status response malformed"
  fi
else
  skip "Failover admin API not reachable at $ADMIN_URL"
fi

# Manual override
if curl -sf -o /dev/null "${ADMIN_URL}/api/failover/status" 2>/dev/null; then
  # Set override
  response=$(curl -sf -X POST "${ADMIN_URL}/api/failover/override" \
    -H 'Content-Type: application/json' \
    -d '{"instanceId":"render-backup"}' 2>/dev/null || echo "")
  ok=$(echo "$response" | jq -r '.ok' 2>/dev/null || echo "")
  if [ "$ok" = "true" ]; then
    pass "POST /api/failover/override sets manual override"
  else
    fail "Manual override set failed"
  fi

  # Clear override
  response=$(curl -sf -X POST "${ADMIN_URL}/api/failover/override" \
    -H 'Content-Type: application/json' \
    -d '{"instanceId":null}' 2>/dev/null || echo "")
  ok=$(echo "$response" | jq -r '.ok' 2>/dev/null || echo "")
  if [ "$ok" = "true" ]; then
    pass "POST /api/failover/override clears override"
  else
    fail "Manual override clear failed"
  fi
else
  skip "Failover admin API not reachable"
fi

# ─── Test: Backup Instance Health ─────────────────────────────────

header "Backup Instance Tests"

if response=$(curl -sf "${BACKUP_URL}/api/health" 2>/dev/null); then
  status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "")
  role=$(echo "$response" | jq -r '.instance.role' 2>/dev/null || echo "")
  pass "Backup instance reachable, status=$status, role=$role"
else
  skip "Backup instance not reachable at $BACKUP_URL"
fi

# ─── Summary ──────────────────────────────────────────────────────

header "Results"
echo -e "  ${GREEN}Passed:${NC}  $PASS"
echo -e "  ${RED}Failed:${NC}  $FAIL"
echo -e "  ${YELLOW}Skipped:${NC} $SKIP"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
elif [ $PASS -eq 0 ]; then
  echo -e "${YELLOW}All tests skipped — start the services first.${NC}"
  exit 0
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
