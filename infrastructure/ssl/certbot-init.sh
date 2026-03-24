#!/bin/bash
# CFX-018: Initial SSL Certificate Setup for DigitalOcean VPS
# Run ONCE on fresh VPS to obtain initial certificates
#
# Prerequisites:
#   - Docker and docker-compose installed
#   - DNS A record pointing to this VPS IP
#   - Port 80 open (for HTTP-01 challenge)
#
# Usage:
#   chmod +x certbot-init.sh
#   ./certbot-init.sh cortexfreelancer.com admin@cortexfreelancer.com

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"
STAGING="${3:-}"  # Pass "staging" for Let's Encrypt staging (testing)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
CERTBOT_WEBROOT="/var/www/certbot"
CERT_DIR="/etc/letsencrypt"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  CFX-018: SSL Certificate Setup                      ║"
echo "║  Domain: ${DOMAIN}                                   ║"
echo "║  Email:  ${EMAIL}                                    ║"
echo "╚══════════════════════════════════════════════════════╝"

# ── Step 1: Create directories ──
echo "[1/6] Creating directories..."
mkdir -p "$CERTBOT_WEBROOT"
mkdir -p "$CERT_DIR"

# ── Step 2: Generate DH parameters (if not exists) ──
DH_PARAM_PATH="$CERT_DIR/ssl-dhparams.pem"
if [ ! -f "$DH_PARAM_PATH" ]; then
    echo "[2/6] Generating DH parameters (2048-bit)..."
    openssl dhparam -out "$DH_PARAM_PATH" 2048
else
    echo "[2/6] DH parameters already exist, skipping."
fi

# ── Step 3: Create temporary self-signed cert for nginx to start ──
TEMP_CERT_DIR="$CERT_DIR/live/${DOMAIN}"
if [ ! -f "$TEMP_CERT_DIR/fullchain.pem" ]; then
    echo "[3/6] Creating temporary self-signed certificate..."
    mkdir -p "$TEMP_CERT_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout "$TEMP_CERT_DIR/privkey.pem" \
        -out "$TEMP_CERT_DIR/fullchain.pem" \
        -subj "/CN=localhost"
else
    echo "[3/6] Certificate already exists, skipping temp cert."
fi

# ── Step 4: Start nginx with temp cert ──
echo "[4/6] Starting nginx..."
cd "$PROJECT_DIR/infrastructure/digitalocean"
DOMAIN="$DOMAIN" docker compose up -d nginx
sleep 3

# ── Step 5: Request real certificate ──
echo "[5/6] Requesting Let's Encrypt certificate..."
STAGING_ARG=""
if [ "$STAGING" = "staging" ]; then
    STAGING_ARG="--staging"
    echo "  ⚠️  Using Let's Encrypt STAGING (not valid for production)"
fi

docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    $STAGING_ARG \
    -d "$DOMAIN" \
    -d "www.${DOMAIN}"

# ── Step 6: Reload nginx with real cert ──
echo "[6/6] Reloading nginx with production certificate..."
docker compose exec nginx nginx -s reload

echo ""
echo "✅ SSL certificate issued successfully!"
echo "   Domain: ${DOMAIN}"
echo "   Cert:   ${CERT_DIR}/live/${DOMAIN}/fullchain.pem"
echo "   Key:    ${CERT_DIR}/live/${DOMAIN}/privkey.pem"
echo ""
echo "📋 Next steps:"
echo "   1. Test: curl -I https://${DOMAIN}"
echo "   2. SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=${DOMAIN}"
echo "   3. Auto-renewal is handled by the certbot container (12h loop)"
