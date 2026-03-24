#!/bin/bash
# CFX-018: Certbot Renewal Deploy Hook
# Called automatically by certbot after successful renewal
# Place at: /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
#
# This reloads nginx to pick up the new certificate without downtime.

set -euo pipefail

echo "[$(date)] Certificate renewed, reloading nginx..."

# Reload nginx (graceful — no dropped connections)
docker exec cortex-nginx nginx -s reload 2>/dev/null || \
    systemctl reload nginx 2>/dev/null || \
    nginx -s reload 2>/dev/null || \
    echo "WARNING: Could not reload nginx automatically"

echo "[$(date)] Nginx reloaded with new certificate"

# Optional: Send Slack notification
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    DOMAIN="${RENEWED_DOMAINS:-unknown}"
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-type: application/json' \
        -d "{\"text\":\"🔒 SSL certificate renewed for ${DOMAIN}\"}" > /dev/null 2>&1
fi
