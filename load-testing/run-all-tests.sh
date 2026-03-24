#!/bin/bash
# CFX-010: Run all stress test scenarios
# Usage: ./run-all-tests.sh [URL]
# Example: ./run-all-tests.sh ws://localhost:3847/ws/chat

URL="${1:-ws://localhost:3847/ws/chat}"
HEALTH_URL="${URL/ws:\/\//http://}"
HEALTH_URL="${HEALTH_URL/wss:\/\//https://}"
HEALTH_URL="${HEALTH_URL%/ws/chat}/ws/health"

DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$DIR/results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "╔══════════════════════════════════════════════╗"
echo "║   CFX-010: Full Stress Test Suite             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "URL: $URL"
echo "Health: $HEALTH_URL"
echo "Results: $RESULTS_DIR"
echo ""

# Function to run a scenario
run_scenario() {
  local scenario=$1
  local clients=$2
  local label="$scenario-$clients"
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Running: $scenario ($clients clients)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Start monitor in background
  node "$DIR/server-monitor.js" --url "$HEALTH_URL" --interval 3 --duration 120 &
  MONITOR_PID=$!
  
  # Run stress test
  WS_URL="$URL" CLIENTS=$clients SCENARIO=$scenario \
    node "$DIR/concurrent-stress-test.js" 2>&1 | tee "$RESULTS_DIR/$label.log"
  
  # Stop monitor
  kill $MONITOR_PID 2>/dev/null
  wait $MONITOR_PID 2>/dev/null
  
  # Move generated reports to results dir
  mv "$DIR"/report-*.json "$RESULTS_DIR/" 2>/dev/null
  mv "$DIR"/monitor-*.json "$RESULTS_DIR/" 2>/dev/null
  
  echo "  ✓ $label complete"
  sleep 5  # Cool down between scenarios
}

# ─── Run scenarios in order ───

# Phase 1: Connection scaling
echo "═══ Phase 1: Connection Scaling ═══"
run_scenario "ramp" 5
run_scenario "ramp" 10
run_scenario "ramp" 20
run_scenario "ramp" 50

# Phase 2: Burst testing
echo ""
echo "═══ Phase 2: Burst Testing ═══"
run_scenario "burst" 10
run_scenario "burst" 20
run_scenario "burst" 50

# Phase 3: Mixed workloads
echo ""
echo "═══ Phase 3: Mixed Workloads ═══"
run_scenario "mixed" 20

# Phase 4: Churn testing
echo ""
echo "═══ Phase 4: Churn (connect/disconnect) ═══"
run_scenario "churn" 20

# Phase 5: Queue testing
echo ""
echo "═══ Phase 5: Queue Flood ═══"
run_scenario "queue-flood" 10
run_scenario "queue-flood" 20

# Phase 6: Sustained load
echo ""
echo "═══ Phase 6: Sustained Load ═══"
run_scenario "sustained" 20

echo ""
echo "═══════════════════════════════════════════"
echo "  All scenarios complete!"
echo "  Results: $RESULTS_DIR"
echo "═══════════════════════════════════════════"
