#!/bin/bash
# CFX-018: Wildcard Certificate via DNS-01 Challenge
# For *.cortexfreelancer.com — requires DNS provider API access
#
# Supports: Cloudflare DNS (most common), DigitalOcean DNS, Route53
#
# Usage:
#   export CF_API_TOKEN="your-cloudflare-api-token"
#   ./certbot-wildcard.sh cortexfreelancer.com admin@cortexfreelancer.com cloudflare

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> <email> <dns-provider>}"
EMAIL="${2:?Usage: $0 <domain> <email> <dns-provider>}"
DNS_PROVIDER="${3:-cloudflare}"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  CFX-018: Wildcard SSL Certificate (DNS-01)          ║"
echo "║  Domain: *.${DOMAIN}                                 ║"
echo "║  DNS:    ${DNS_PROVIDER}                             ║"
echo "╚══════════════════════════════════════════════════════╝"

case "$DNS_PROVIDER" in
    cloudflare)
        if [ -z "${CF_API_TOKEN:-}" ]; then
            echo "❌ CF_API_TOKEN environment variable required"
            echo "   Create at: https://dash.cloudflare.com/profile/api-tokens"
            echo "   Permissions: Zone:DNS:Edit"
            exit 1
        fi
        
        # Create Cloudflare credentials file
        CREDS_FILE="/tmp/cf-credentials.ini"
        echo "dns_cloudflare_api_token = ${CF_API_TOKEN}" > "$CREDS_FILE"
        chmod 600 "$CREDS_FILE"
        
        docker run --rm \
            -v "/etc/letsencrypt:/etc/letsencrypt" \
            -v "$CREDS_FILE:/tmp/cf-credentials.ini:ro" \
            certbot/dns-cloudflare certonly \
            --dns-cloudflare \
            --dns-cloudflare-credentials /tmp/cf-credentials.ini \
            --dns-cloudflare-propagation-seconds 30 \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN" \
            -d "*.${DOMAIN}"
        
        rm -f "$CREDS_FILE"
        ;;
    
    digitalocean)
        if [ -z "${DO_AUTH_TOKEN:-}" ]; then
            echo "❌ DO_AUTH_TOKEN environment variable required"
            exit 1
        fi
        
        CREDS_FILE="/tmp/do-credentials.ini"
        echo "dns_digitalocean_token = ${DO_AUTH_TOKEN}" > "$CREDS_FILE"
        chmod 600 "$CREDS_FILE"
        
        docker run --rm \
            -v "/etc/letsencrypt:/etc/letsencrypt" \
            -v "$CREDS_FILE:/tmp/do-credentials.ini:ro" \
            certbot/dns-digitalocean certonly \
            --dns-digitalocean \
            --dns-digitalocean-credentials /tmp/do-credentials.ini \
            --dns-digitalocean-propagation-seconds 30 \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN" \
            -d "*.${DOMAIN}"
        
        rm -f "$CREDS_FILE"
        ;;
    
    *)
        echo "❌ Unsupported DNS provider: $DNS_PROVIDER"
        echo "   Supported: cloudflare, digitalocean"
        exit 1
        ;;
esac

echo ""
echo "✅ Wildcard certificate issued!"
echo "   Covers: ${DOMAIN} + *.${DOMAIN}"
echo "   Cert:   /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
echo ""
echo "⚠️  DNS-01 renewal requires the same API credentials."
echo "   Store them securely and ensure the renewal cron has access."
