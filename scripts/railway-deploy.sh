#!/bin/bash
# Railway deployment script for Cortex Freelancer
# Usage: ./scripts/railway-deploy.sh [--init|--deploy|--status|--logs|--env-setup]
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[railway]${NC} $1"; }
warn() { echo -e "${YELLOW}[railway]${NC} $1"; }
error() { echo -e "${RED}[railway]${NC} $1"; }

check_cli() {
  if ! command -v railway &>/dev/null; then
    error "Railway CLI not installed. Run: brew install railway"
    exit 1
  fi
  
  if ! railway whoami &>/dev/null 2>&1; then
    error "Not logged in. Run: railway login"
    exit 1
  fi
}

cmd_init() {
  log "Initializing Railway project..."
  check_cli
  
  # Create project (or link existing)
  railway init --name cortex-freelancer 2>/dev/null || {
    warn "Project may already exist. Linking..."
    railway link
  }
  
  log "Project initialized! Run: $0 --env-setup"
}

cmd_env_setup() {
  log "Setting up environment variables..."
  check_cli
  
  echo "Required environment variables for Railway:"
  echo "============================================"
  echo ""
  
  # List required vars
  local REQUIRED_VARS=(
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "STRIPE_PRICE_PRO_MONTHLY"
    "STRIPE_PRICE_PRO_ANNUAL"
    "ANTHROPIC_API_KEY"
    "FIREBASE_API_KEY"
    "FIREBASE_AUTH_DOMAIN"
    "FIREBASE_PROJECT_ID"
    "FIREBASE_STORAGE_BUCKET"
    "FIREBASE_MESSAGING_SENDER_ID"
    "FIREBASE_APP_ID"
    "FIREBASE_SERVICE_ACCOUNT_KEY"
    "RESEND_API_KEY"
    "CRON_SECRET"
    "ADMIN_TOKEN"
    "ADMIN_EMAIL"
  )
  
  local RAILWAY_SPECIFIC=(
    "RAILWAY_ENVIRONMENT=production"
    "NODE_ENV=production"
    "WS_TIMEOUT_PROFILE=production"
    "DOMAIN=https://cortex-freelancer.up.railway.app"
    "ANTHROPIC_MODEL=claude-sonnet-4-20250514"
  )
  
  echo "Railway-specific vars (auto-set):"
  for var in "${RAILWAY_SPECIFIC[@]}"; do
    local key="${var%%=*}"
    local value="${var#*=}"
    echo "  Setting $key=$value"
    railway variables set "$key=$value" 2>/dev/null || warn "Failed to set $key"
  done
  
  echo ""
  echo "Required vars to set manually (via Railway dashboard or CLI):"
  for var in "${REQUIRED_VARS[@]}"; do
    echo "  railway variables set $var=<value>"
  done
  
  echo ""
  echo "Optional: Set these via Railway dashboard → Variables"
  echo "  SLACK_WEBHOOK_URL, SENTRY_DSN, GA_MEASUREMENT_ID"
  
  log "Environment setup complete!"
}

cmd_deploy() {
  log "Deploying to Railway..."
  check_cli
  
  # Check if we have the required files
  if [[ ! -f "railway.json" ]]; then
    error "railway.json not found!"
    exit 1
  fi
  
  if [[ ! -f "Dockerfile.railway" ]]; then
    error "Dockerfile.railway not found!"
    exit 1
  fi
  
  # Deploy
  railway up --detach
  
  log "Deployment triggered! Check status with: $0 --status"
  log "View logs: $0 --logs"
}

cmd_status() {
  check_cli
  railway status
}

cmd_logs() {
  check_cli
  railway logs --tail 100
}

cmd_domain() {
  log "Setting up custom domain..."
  check_cli
  
  echo "To add a custom domain:"
  echo "1. railway domain  # generates a Railway subdomain"
  echo "2. For custom domain: Railway Dashboard → Settings → Domains → Add Custom Domain"
  echo "3. Add CNAME record: cortex.yourdomain.com → <railway-domain>"
  echo "4. Railway auto-provisions SSL"
  
  railway domain 2>/dev/null || warn "Run 'railway domain' to generate a subdomain"
}

cmd_rollback() {
  log "Rolling back to previous deployment..."
  check_cli
  railway rollback
}

# ── Main ──
case "${1:-}" in
  --init)       cmd_init ;;
  --deploy)     cmd_deploy ;;
  --status)     cmd_status ;;
  --logs)       cmd_logs ;;
  --env-setup)  cmd_env_setup ;;
  --domain)     cmd_domain ;;
  --rollback)   cmd_rollback ;;
  *)
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  --init       Initialize Railway project"
    echo "  --env-setup  Configure environment variables"
    echo "  --deploy     Deploy to Railway"
    echo "  --status     Check deployment status"
    echo "  --logs       View deployment logs"
    echo "  --domain     Setup custom domain"
    echo "  --rollback   Rollback to previous deployment"
    ;;
esac
