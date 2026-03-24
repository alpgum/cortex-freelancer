#!/usr/bin/env bash
# deploy.sh — Provision and deploy Cortex Freelancer to DigitalOcean Droplet
# Usage: ./deploy.sh [--init|--update|--ssl|--status]
set -euo pipefail

# ── Configuration ──
DROPLET_NAME="cortex-freelancer"
DOMAIN="cortexfreelancer.com"
EMAIL="alp@cortexfreelancer.com"      # For Let's Encrypt
REGION="fra1"                          # Frankfurt (closest to Istanbul)
SIZE="s-1vcpu-2gb"                     # $12/mo — 1 vCPU, 2GB RAM, 50GB SSD
IMAGE="docker-20-04"                   # DigitalOcean Docker on Ubuntu 20.04
SSH_KEY_NAME="cortex-deploy"           # Your SSH key name in DO

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Functions ──

check_doctl() {
    command -v doctl >/dev/null 2>&1 || err "doctl not installed. Run: brew install doctl"
    doctl auth list >/dev/null 2>&1 || err "doctl not authenticated. Run: doctl auth init"
}

create_droplet() {
    log "Creating droplet: $DROPLET_NAME ($SIZE in $REGION)..."
    
    # Get SSH key fingerprint
    SSH_FP=$(doctl compute ssh-key list --format FingerPrint,Name --no-header | grep "$SSH_KEY_NAME" | awk '{print $1}')
    [ -z "$SSH_FP" ] && err "SSH key '$SSH_KEY_NAME' not found. Add it: doctl compute ssh-key create"
    
    doctl compute droplet create "$DROPLET_NAME" \
        --region "$REGION" \
        --size "$SIZE" \
        --image "$IMAGE" \
        --ssh-keys "$SSH_FP" \
        --enable-monitoring \
        --enable-backups \
        --tag-names "cortex,production" \
        --wait
    
    # Get IP
    DROPLET_IP=$(doctl compute droplet get "$DROPLET_NAME" --format PublicIPv4 --no-header)
    log "Droplet created! IP: $DROPLET_IP"
    echo "$DROPLET_IP" > .droplet-ip
}

setup_firewall() {
    log "Setting up firewall..."
    
    doctl compute firewall create \
        --name "cortex-fw" \
        --droplet-ids "$(doctl compute droplet get "$DROPLET_NAME" --format ID --no-header)" \
        --inbound-rules "protocol:tcp,ports:22,address:0.0.0.0/0 protocol:tcp,ports:80,address:0.0.0.0/0 protocol:tcp,ports:443,address:0.0.0.0/0" \
        --outbound-rules "protocol:tcp,ports:all,address:0.0.0.0/0 protocol:udp,ports:all,address:0.0.0.0/0 protocol:icmp,address:0.0.0.0/0"
    
    log "Firewall configured (SSH + HTTP + HTTPS only)"
}

provision_server() {
    DROPLET_IP=$(cat .droplet-ip 2>/dev/null || doctl compute droplet get "$DROPLET_NAME" --format PublicIPv4 --no-header)
    log "Provisioning server at $DROPLET_IP..."
    
    ssh -o StrictHostKeyChecking=no root@"$DROPLET_IP" bash <<'REMOTE_SCRIPT'
set -euo pipefail

# System updates
apt-get update && apt-get upgrade -y

# Install docker-compose v2 plugin
apt-get install -y docker-compose-plugin fail2ban ufw

# Configure UFW (DigitalOcean firewall is first line, UFW is second)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable

# Configure fail2ban
cat > /etc/fail2ban/jail.local <<'F2B'
[sshd]
enabled = true
port = 22
maxretry = 5
bantime = 3600
findtime = 600
F2B
systemctl enable fail2ban && systemctl restart fail2ban

# Create deploy user
useradd -m -s /bin/bash -G docker deploy || true
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh

# SSH hardening
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Swap file (2GB — helps with Chromium memory spikes)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab

# Create app directory
mkdir -p /opt/cortex-freelancer
chown deploy:deploy /opt/cortex-freelancer

echo "✅ Server provisioned successfully"
REMOTE_SCRIPT
    
    log "Server provisioned! SSH: ssh deploy@$DROPLET_IP"
}

deploy_app() {
    DROPLET_IP=$(cat .droplet-ip 2>/dev/null || doctl compute droplet get "$DROPLET_NAME" --format PublicIPv4 --no-header)
    log "Deploying application to $DROPLET_IP..."
    
    # Sync project files (excluding node_modules, .git, etc.)
    rsync -avz --progress \
        --exclude node_modules \
        --exclude .git \
        --exclude .env.local \
        --exclude .env.production.local \
        -e ssh \
        ../../ deploy@"$DROPLET_IP":/opt/cortex-freelancer/
    
    # Copy production env file separately
    scp ../../.env.production.local deploy@"$DROPLET_IP":/opt/cortex-freelancer/.env.production.local
    
    # Build and start containers
    ssh deploy@"$DROPLET_IP" bash <<'REMOTE_DEPLOY'
cd /opt/cortex-freelancer
docker compose -f infrastructure/digitalocean/docker-compose.yml up -d --build
echo "✅ Application deployed"
REMOTE_DEPLOY
    
    log "Deployment complete!"
}

setup_ssl() {
    DROPLET_IP=$(cat .droplet-ip 2>/dev/null || doctl compute droplet get "$DROPLET_NAME" --format PublicIPv4 --no-header)
    log "Setting up SSL certificate for $DOMAIN..."
    
    # First, start nginx with HTTP-only config for ACME challenge
    ssh deploy@"$DROPLET_IP" bash <<REMOTE_SSL
cd /opt/cortex-freelancer

# Get initial certificate
docker compose -f infrastructure/digitalocean/docker-compose.yml run --rm certbot \
    certbot certonly --webroot -w /var/www/certbot \
    --email $EMAIL --agree-tos --no-eff-email \
    -d $DOMAIN -d www.$DOMAIN

# Restart nginx to pick up certs
docker compose -f infrastructure/digitalocean/docker-compose.yml restart nginx

echo "✅ SSL configured"
REMOTE_SSL
    
    log "SSL certificate installed!"
}

show_status() {
    DROPLET_IP=$(cat .droplet-ip 2>/dev/null || doctl compute droplet get "$DROPLET_NAME" --format PublicIPv4 --no-header)
    
    echo ""
    log "=== Cortex Freelancer VPS Status ==="
    echo ""
    doctl compute droplet get "$DROPLET_NAME" --format ID,Name,PublicIPv4,Status,Memory,VCPUs,Disk,Region
    echo ""
    
    log "Container status:"
    ssh deploy@"$DROPLET_IP" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" 2>/dev/null || \
    ssh root@"$DROPLET_IP" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" 2>/dev/null || \
    warn "Could not reach server"
    
    echo ""
    log "Health check:"
    curl -sf "https://$DOMAIN/api/health" 2>/dev/null && echo "" || warn "Health check failed (SSL may not be configured yet)"
}

# ── Main ──
check_doctl

case "${1:-}" in
    --init)
        log "Full initialization: Create → Provision → Deploy → SSL"
        create_droplet
        sleep 30  # Wait for droplet to fully boot
        setup_firewall
        provision_server
        deploy_app
        log "Next: Point DNS A record for $DOMAIN → $(cat .droplet-ip)"
        log "Then run: ./deploy.sh --ssl"
        ;;
    --update)
        deploy_app
        ;;
    --ssl)
        setup_ssl
        ;;
    --status)
        show_status
        ;;
    --firewall)
        setup_firewall
        ;;
    *)
        echo "Usage: $0 [--init|--update|--ssl|--status|--firewall]"
        echo ""
        echo "  --init      Full setup: create droplet + provision + deploy"
        echo "  --update    Deploy latest code to existing droplet"
        echo "  --ssl       Set up Let's Encrypt SSL certificate"
        echo "  --status    Show droplet and container status"
        echo "  --firewall  Reconfigure firewall rules"
        ;;
esac
