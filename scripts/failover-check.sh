#!/bin/bash
# failover-check.sh — Health monitoring for multi-platform failover
# Checks Railway (primary) and Render (fallback) health endpoints.
# Returns status and can trigger DNS/proxy failover.
#
# Usage:
#   ./scripts/failover-check.sh              # One-shot check
#   ./scripts/failover-check.sh --loop 60    # Continuous (every 60s)
#   ./scripts/failover-check.sh --json       # JSON output

set -euo pipefail

# ── Platform URLs ──
RAILWAY_URL="${RAILWAY_URL:-https://cortex-freelancer-production.up.railway.app}"
RENDER_URL="${RENDER_URL:-https://cortex-freelancer.onrender.com}"
PRIMARY_DOMAIN="${PRIMARY_DOMAIN:-https://cortexfreelancer.com}"

TIMEOUT=10
JSON_MODE=false
LOOP_INTERVAL=0

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --json) JSON_MODE=true; shift ;;
    --loop) LOOP_INTERVAL="$2"; shift 2 ;;
    *) shift ;;
  esac
done

check_health() {
  local url="$1"
  local name="$2"
  local start_ms=$(date +%s%3N 2>/dev/null || date +%s)

  local http_code
  http_code=$(curl -sf -o /tmp/health_${name}.json -w "%{http_code}" \
    --connect-timeout $TIMEOUT --max-time $((TIMEOUT * 2)) \
    "${url}/api/health" 2>/dev/null || echo "000")

  local end_ms=$(date +%s%3N 2>/dev/null || date +%s)
  local latency=$((end_ms - start_ms))

  local status="down"
  local detail=""
  if [ "$http_code" = "200" ]; then
    status="up"
    detail=$(cat /tmp/health_${name}.json 2>/dev/null | head -1)
  elif [ "$http_code" = "000" ]; then
    status="unreachable"
  else
    status="error"
    detail="HTTP $http_code"
  fi

  echo "${name}|${status}|${http_code}|${latency}ms|${detail}"
}

check_websocket() {
  local url="$1"
  local name="$2"
  # WS health is an HTTP endpoint (not upgraded)
  local ws_url="${url}/ws/health"
  local http_code
  http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
    --connect-timeout $TIMEOUT "$ws_url" 2>/dev/null || echo "000")

  if [ "$http_code" = "200" ]; then
    echo "${name}_ws|up|${http_code}"
  else
    echo "${name}_ws|down|${http_code}"
  fi
}

run_check() {
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Check all platforms in parallel
  local railway_result=$(check_health "$RAILWAY_URL" "railway")
  local render_result=$(check_health "$RENDER_URL" "render")
  local railway_ws=$(check_websocket "$RAILWAY_URL" "railway")
  local render_ws=$(check_websocket "$RENDER_URL" "render")

  # Parse results
  local railway_status=$(echo "$railway_result" | cut -d'|' -f2)
  local render_status=$(echo "$render_result" | cut -d'|' -f2)
  local railway_latency=$(echo "$railway_result" | cut -d'|' -f4)
  local render_latency=$(echo "$render_result" | cut -d'|' -f4)

  # Determine active platform
  local active="railway"
  local failover_needed=false
  if [ "$railway_status" != "up" ] && [ "$render_status" = "up" ]; then
    active="render"
    failover_needed=true
  elif [ "$railway_status" != "up" ] && [ "$render_status" != "up" ]; then
    active="none"
    failover_needed=true
  fi

  if $JSON_MODE; then
    cat <<EOF
{
  "timestamp": "$timestamp",
  "primary": {
    "platform": "railway",
    "url": "$RAILWAY_URL",
    "status": "$railway_status",
    "latency": "$railway_latency",
    "ws": "$(echo $railway_ws | cut -d'|' -f2)"
  },
  "fallback": {
    "platform": "render",
    "url": "$RENDER_URL",
    "status": "$render_status",
    "latency": "$render_latency",
    "ws": "$(echo $render_ws | cut -d'|' -f2)"
  },
  "active": "$active",
  "failover_needed": $failover_needed
}
EOF
  else
    echo "═══════════════════════════════════════════"
    echo "  Platform Health Check — $timestamp"
    echo "═══════════════════════════════════════════"
    echo ""
    echo "  Railway (primary):  $railway_status ($railway_latency)"
    echo "    WS bridge:        $(echo $railway_ws | cut -d'|' -f2)"
    echo ""
    echo "  Render (fallback):  $render_status ($render_latency)"
    echo "    WS bridge:        $(echo $render_ws | cut -d'|' -f2)"
    echo ""
    echo "  Active platform:    $active"
    if $failover_needed; then
      echo "  ⚠ FAILOVER NEEDED"
    else
      echo "  ✓ Primary healthy"
    fi
    echo "═══════════════════════════════════════════"
  fi
}

# Execute
if [ "$LOOP_INTERVAL" -gt 0 ] 2>/dev/null; then
  echo "Starting continuous health check (every ${LOOP_INTERVAL}s)..."
  while true; do
    run_check
    sleep "$LOOP_INTERVAL"
  done
else
  run_check
fi
