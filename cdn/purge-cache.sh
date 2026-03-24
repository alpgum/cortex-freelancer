#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Cloudflare Cache Purge Script
# ═══════════════════════════════════════════════════════════════
# Purge CDN cache after deployments or content changes.
#
# Usage:
#   ./cdn/purge-cache.sh all                    # Purge everything
#   ./cdn/purge-cache.sh files /app/styles.css   # Purge specific files
#   ./cdn/purge-cache.sh tags app-assets         # Purge by tag (Enterprise)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# Load from env or .env
CF_API_TOKEN="${CF_API_TOKEN:-}"
CF_ZONE_ID="${CF_ZONE_ID:-}"
DOMAIN="${DOMAIN:-cortexfreelancer.com}"

if [ -z "$CF_API_TOKEN" ] || [ -z "$CF_ZONE_ID" ]; then
  echo "Error: CF_API_TOKEN and CF_ZONE_ID must be set"
  echo ""
  echo "Export them or add to .env:"
  echo "  export CF_API_TOKEN=your-token"
  echo "  export CF_ZONE_ID=your-zone-id"
  exit 1
fi

MODE="${1:-all}"
CF_API="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache"

case "$MODE" in
  all)
    echo "🔥 Purging ALL cache for zone $CF_ZONE_ID..."
    curl -s -X POST "$CF_API" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/json" \
      --data '{"purge_everything":true}' | jq .
    ;;
    
  files)
    shift
    FILES=("$@")
    if [ ${#FILES[@]} -eq 0 ]; then
      echo "Error: Specify files to purge"
      echo "  ./cdn/purge-cache.sh files /app/styles.css /app/engine.js"
      exit 1
    fi
    
    # Build JSON array of full URLs
    URLS=$(printf ',"https://%s%s"' "$DOMAIN" "${FILES[@]}" | sed 's/^,//')
    echo "🎯 Purging ${#FILES[@]} file(s)..."
    curl -s -X POST "$CF_API" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/json" \
      --data "{\"files\":[$URLS]}" | jq .
    ;;
    
  tags)
    shift
    TAGS=("$@")
    TAGS_JSON=$(printf '"%s",' "${TAGS[@]}" | sed 's/,$//')
    echo "🏷️  Purging by tags: ${TAGS[*]}..."
    curl -s -X POST "$CF_API" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/json" \
      --data "{\"tags\":[$TAGS_JSON]}" | jq .
    ;;
    
  *)
    echo "Usage: $0 {all|files|tags} [args...]"
    exit 1
    ;;
esac

echo ""
echo "✓ Cache purge request sent"
echo "  Note: Propagation takes ~30 seconds globally"
