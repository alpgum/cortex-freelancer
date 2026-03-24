#!/usr/bin/env bash
# CFX-016: Cloudflare Load Balancer Setup Script
# Creates pools, monitors, and load balancer via Cloudflare API
#
# Prerequisites:
#   - CLOUDFLARE_API_TOKEN (with Load Balancing permissions)
#   - CLOUDFLARE_ZONE_ID (cortexfreelancer.com zone)
#   - Origin URLs for each platform
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="your-token"
#   export CLOUDFLARE_ZONE_ID="your-zone-id"
#   ./setup-cloudflare-lb.sh

set -euo pipefail

# ── Configuration ──
CF_API="https://api.cloudflare.com/client/v4"
ZONE_ID="${CLOUDFLARE_ZONE_ID:?Set CLOUDFLARE_ZONE_ID}"
API_TOKEN="${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID}"

# Origin addresses — REPLACE these with actual deployment URLs
RAILWAY_ORIGIN="${RAILWAY_ORIGIN:-railway-app.up.railway.app}"
RENDER_ORIGIN="${RENDER_ORIGIN:-cortex-freelancer.onrender.com}"
DO_ORIGIN="${DO_ORIGIN:-0.0.0.0}"  # Replace with actual droplet IP

AUTH_HEADER="Authorization: Bearer ${API_TOKEN}"
CT_HEADER="Content-Type: application/json"

echo "═══════════════════════════════════════════════════════"
echo "CFX-016: Setting up Cloudflare Load Balancer"
echo "Zone: ${ZONE_ID}"
echo "═══════════════════════════════════════════════════════"

# ── Step 1: Create Health Monitor ──
echo ""
echo "▸ Step 1: Creating health monitor..."
MONITOR_RESPONSE=$(curl -s -X POST "${CF_API}/accounts/${ACCOUNT_ID}/load_balancers/monitors" \
  -H "${AUTH_HEADER}" \
  -H "${CT_HEADER}" \
  -d '{
    "type": "https",
    "description": "Cortex Freelancer health check",
    "method": "GET",
    "path": "/api/health",
    "port": 443,
    "expected_codes": "200",
    "expected_body": "\"status\":\"ok\"",
    "timeout": 5,
    "retries": 2,
    "interval": 60,
    "follow_redirects": true,
    "allow_insecure": false,
    "header": {
      "User-Agent": ["Cloudflare-Health-Check"],
      "Accept": ["application/json"]
    }
  }')

MONITOR_ID=$(echo "$MONITOR_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Monitor ID: ${MONITOR_ID}"

if [ -z "$MONITOR_ID" ]; then
  echo "  ❌ Failed to create monitor"
  echo "$MONITOR_RESPONSE" | head -5
  exit 1
fi
echo "  ✅ Monitor created"

# ── Step 2: Create Origin Pools ──
echo ""
echo "▸ Step 2: Creating origin pools..."

# Railway pool (primary)
RAILWAY_POOL=$(curl -s -X POST "${CF_API}/accounts/${ACCOUNT_ID}/load_balancers/pools" \
  -H "${AUTH_HEADER}" \
  -H "${CT_HEADER}" \
  -d "{
    \"name\": \"railway-primary\",
    \"description\": \"Railway.app primary deployment\",
    \"enabled\": true,
    \"minimum_origins\": 1,
    \"monitor\": \"${MONITOR_ID}\",
    \"notification_email\": \"admin@cortexfreelancer.com\",
    \"origins\": [{
      \"name\": \"railway-frankfurt\",
      \"address\": \"${RAILWAY_ORIGIN}\",
      \"enabled\": true,
      \"weight\": 1.0,
      \"header\": { \"Host\": [\"cortexfreelancer.com\"] }
    }]
  }")

RAILWAY_POOL_ID=$(echo "$RAILWAY_POOL" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Railway pool: ${RAILWAY_POOL_ID}"

# Render pool (secondary)
RENDER_POOL=$(curl -s -X POST "${CF_API}/accounts/${ACCOUNT_ID}/load_balancers/pools" \
  -H "${AUTH_HEADER}" \
  -H "${CT_HEADER}" \
  -d "{
    \"name\": \"render-fallback\",
    \"description\": \"Render.com fallback deployment\",
    \"enabled\": true,
    \"minimum_origins\": 1,
    \"monitor\": \"${MONITOR_ID}\",
    \"notification_email\": \"admin@cortexfreelancer.com\",
    \"origins\": [{
      \"name\": \"render-frankfurt\",
      \"address\": \"${RENDER_ORIGIN}\",
      \"enabled\": true,
      \"weight\": 1.0,
      \"header\": { \"Host\": [\"cortexfreelancer.com\"] }
    }]
  }")

RENDER_POOL_ID=$(echo "$RENDER_POOL" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Render pool: ${RENDER_POOL_ID}"

# DigitalOcean pool (tertiary)
DO_POOL=$(curl -s -X POST "${CF_API}/accounts/${ACCOUNT_ID}/load_balancers/pools" \
  -H "${AUTH_HEADER}" \
  -H "${CT_HEADER}" \
  -d "{
    \"name\": \"digitalocean-backup\",
    \"description\": \"DigitalOcean droplet backup\",
    \"enabled\": true,
    \"minimum_origins\": 1,
    \"monitor\": \"${MONITOR_ID}\",
    \"notification_email\": \"admin@cortexfreelancer.com\",
    \"origins\": [{
      \"name\": \"do-amsterdam\",
      \"address\": \"${DO_ORIGIN}\",
      \"enabled\": true,
      \"weight\": 1.0,
      \"header\": { \"Host\": [\"cortexfreelancer.com\"] }
    }]
  }")

DO_POOL_ID=$(echo "$DO_POOL" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  DigitalOcean pool: ${DO_POOL_ID}"
echo "  ✅ All pools created"

# ── Step 3: Create Load Balancer ──
echo ""
echo "▸ Step 3: Creating load balancer..."

LB_RESPONSE=$(curl -s -X POST "${CF_API}/zones/${ZONE_ID}/load_balancers" \
  -H "${AUTH_HEADER}" \
  -H "${CT_HEADER}" \
  -d "{
    \"name\": \"cortexfreelancer.com\",
    \"description\": \"Cortex Freelancer multi-platform LB\",
    \"proxied\": true,
    \"ttl\": 30,
    \"steering_policy\": \"priority\",
    \"session_affinity\": \"ip_cookie\",
    \"session_affinity_ttl\": 1800,
    \"fallback_pool\": \"${RENDER_POOL_ID}\",
    \"default_pools\": [
      \"${RAILWAY_POOL_ID}\",
      \"${RENDER_POOL_ID}\",
      \"${DO_POOL_ID}\"
    ],
    \"adaptive_routing\": {
      \"failover_across_pools\": true
    }
  }")

LB_ID=$(echo "$LB_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$LB_ID" ]; then
  echo "  ✅ Load balancer created: ${LB_ID}"
else
  echo "  ❌ Failed to create load balancer"
  echo "$LB_RESPONSE" | head -10
  exit 1
fi

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════════════════"
echo "Setup Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Monitor:           ${MONITOR_ID}"
echo "  Railway Pool:      ${RAILWAY_POOL_ID}"
echo "  Render Pool:       ${RENDER_POOL_ID}"
echo "  DigitalOcean Pool: ${DO_POOL_ID}"
echo "  Load Balancer:     ${LB_ID}"
echo ""
echo "Next steps:"
echo "  1. Verify origins at: https://dash.cloudflare.com/${ACCOUNT_ID}/traffic/load-balancing"
echo "  2. Replace placeholder origin addresses with real deployment URLs"
echo "  3. Run failover-test.sh to verify"
echo "  4. Monitor health in Cloudflare dashboard"
echo ""
echo "Save these IDs to loadbalancer/state.json for future updates."

# Save state
cat > "$(dirname "$0")/state.json" <<EOF
{
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "monitor_id": "${MONITOR_ID}",
  "pools": {
    "railway_primary": "${RAILWAY_POOL_ID}",
    "render_fallback": "${RENDER_POOL_ID}",
    "digitalocean_backup": "${DO_POOL_ID}"
  },
  "load_balancer_id": "${LB_ID}",
  "zone_id": "${ZONE_ID}"
}
EOF

echo "State saved to loadbalancer/state.json"
