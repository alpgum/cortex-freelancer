#!/bin/bash
# CFX-018: SSL Certificate Monitoring & Alerting
# Checks certificate expiration, configuration, and health across all platforms
#
# Usage:
#   ./ssl-monitor.sh                          # Check all domains
#   ./ssl-monitor.sh --alert-days 14          # Alert if expiring within 14 days
#   ./ssl-monitor.sh --slack                  # Send alerts to Slack
#   ./ssl-monitor.sh --json                   # Output as JSON
#
# Cron (daily at 06:00):
#   0 6 * * * /path/to/ssl-monitor.sh --alert-days 14 --slack >> /var/log/ssl-monitor.log 2>&1

set -euo pipefail

# ── Configuration ──
DOMAINS=(
    "cortexfreelancer.com"
    "www.cortexfreelancer.com"
    "api.cortexfreelancer.com"
)

ALERT_DAYS="${ALERT_DAYS:-14}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
OUTPUT_JSON=false
VERBOSE=false

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --alert-days) ALERT_DAYS="$2"; shift 2 ;;
        --slack) ;; # uses SLACK_WEBHOOK_URL env var
        --json) OUTPUT_JSON=true; shift ;;
        --verbose) VERBOSE=true; shift ;;
        *) shift ;;
    esac
done

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ALERT_MESSAGES=()
JSON_RESULTS=()
NOW=$(date +%s)

check_domain() {
    local domain="$1"
    local port="${2:-443}"
    
    # Get certificate info
    local cert_info
    cert_info=$(echo | timeout 10 openssl s_client -servername "$domain" -connect "${domain}:${port}" 2>/dev/null) || {
        echo -e "${RED}✗ ${domain}:${port} — connection failed${NC}"
        ALERT_MESSAGES+=("🔴 ${domain}:${port} — SSL connection FAILED")
        return 1
    }
    
    # Extract expiry date
    local expiry_date
    expiry_date=$(echo "$cert_info" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2) || {
        echo -e "${RED}✗ ${domain} — cannot read certificate${NC}"
        ALERT_MESSAGES+=("🔴 ${domain} — Cannot read SSL certificate")
        return 1
    }
    
    local expiry_epoch
    expiry_epoch=$(date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry_date" +%s 2>/dev/null || \
                   date -d "$expiry_date" +%s 2>/dev/null)
    
    local days_left=$(( (expiry_epoch - NOW) / 86400 ))
    
    # Extract issuer & subject
    local issuer
    issuer=$(echo "$cert_info" | openssl x509 -noout -issuer 2>/dev/null | sed 's/issuer=//')
    local subject
    subject=$(echo "$cert_info" | openssl x509 -noout -subject 2>/dev/null | sed 's/subject=//')
    
    # Check TLS version
    local tls_version
    tls_version=$(echo "$cert_info" | grep "Protocol" | awk '{print $NF}')
    
    # Check HSTS
    local hsts
    hsts=$(curl -sI "https://${domain}" 2>/dev/null | grep -i "strict-transport-security" | head -1) || hsts=""
    
    # Status
    local status_color status_icon status_text
    if [ "$days_left" -lt 0 ]; then
        status_color="$RED"; status_icon="✗"; status_text="EXPIRED"
        ALERT_MESSAGES+=("🔴 ${domain} — Certificate EXPIRED ${days_left} days ago!")
    elif [ "$days_left" -lt 7 ]; then
        status_color="$RED"; status_icon="⚠"; status_text="CRITICAL"
        ALERT_MESSAGES+=("🔴 ${domain} — Expires in ${days_left} days! Renewal needed NOW")
    elif [ "$days_left" -lt "$ALERT_DAYS" ]; then
        status_color="$YELLOW"; status_icon="⚠"; status_text="WARNING"
        ALERT_MESSAGES+=("🟡 ${domain} — Expires in ${days_left} days")
    else
        status_color="$GREEN"; status_icon="✓"; status_text="OK"
    fi
    
    echo -e "${status_color}${status_icon} ${domain}${NC}"
    echo "    Expires: ${expiry_date} (${days_left} days)"
    echo "    Issuer:  ${issuer}"
    echo "    TLS:     ${tls_version:-unknown}"
    echo "    HSTS:    ${hsts:-not set}"
    echo ""
    
    if $OUTPUT_JSON; then
        JSON_RESULTS+=("{\"domain\":\"${domain}\",\"days_left\":${days_left},\"status\":\"${status_text}\",\"tls\":\"${tls_version}\",\"issuer\":\"${issuer}\"}")
    fi
}

echo "╔══════════════════════════════════════════════════════╗"
echo "║  CFX-018: SSL Certificate Monitor                    ║"
echo "║  $(date '+%Y-%m-%d %H:%M:%S %Z')                    ║"
echo "║  Alert threshold: ${ALERT_DAYS} days                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

for domain in "${DOMAINS[@]}"; do
    check_domain "$domain" || true
done

# ── Summary ──
if [ ${#ALERT_MESSAGES[@]} -gt 0 ]; then
    echo -e "${RED}═══ ALERTS ═══${NC}"
    for msg in "${ALERT_MESSAGES[@]}"; do
        echo "  $msg"
    done
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK" ]; then
        SLACK_TEXT="*SSL Certificate Alert*\n"
        for msg in "${ALERT_MESSAGES[@]}"; do
            SLACK_TEXT+="${msg}\n"
        done
        
        curl -s -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            -d "{\"text\":\"${SLACK_TEXT}\"}" > /dev/null 2>&1 || true
        
        echo ""
        echo "📤 Slack alert sent"
    fi
    
    exit 1
else
    echo -e "${GREEN}✅ All certificates healthy (>${ALERT_DAYS} days remaining)${NC}"
fi

# ── JSON output ──
if $OUTPUT_JSON; then
    echo ""
    echo "--- JSON ---"
    echo "[$(IFS=,; echo "${JSON_RESULTS[*]}")]"
fi
