#!/usr/bin/env bash
# monitoring.sh — Resource monitoring and alerting for Cortex VPS
# Usage: ./monitoring.sh [--check|--install-cron|--report]
set -euo pipefail

# ── Thresholds ──
CPU_WARN=80
MEM_WARN=85
DISK_WARN=80
CONTAINER_NAME="cortex-app"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

check_resources() {
    echo "=== Cortex VPS Health Report ==="
    echo "Date: $(date -u '+%Y-%m-%d %H:%M UTC')"
    echo ""
    
    # CPU
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print int($2 + $4)}')
    if [ "$CPU_USAGE" -gt "$CPU_WARN" ]; then
        echo -e "${RED}⚠ CPU: ${CPU_USAGE}% (threshold: ${CPU_WARN}%)${NC}"
    else
        echo -e "${GREEN}✓ CPU: ${CPU_USAGE}%${NC}"
    fi
    
    # Memory
    MEM_USAGE=$(free | awk '/Mem:/ {printf "%d", $3/$2 * 100}')
    MEM_TOTAL=$(free -h | awk '/Mem:/ {print $2}')
    MEM_USED=$(free -h | awk '/Mem:/ {print $3}')
    if [ "$MEM_USAGE" -gt "$MEM_WARN" ]; then
        echo -e "${RED}⚠ Memory: ${MEM_USAGE}% (${MEM_USED}/${MEM_TOTAL}) (threshold: ${MEM_WARN}%)${NC}"
    else
        echo -e "${GREEN}✓ Memory: ${MEM_USAGE}% (${MEM_USED}/${MEM_TOTAL})${NC}"
    fi
    
    # Disk
    DISK_USAGE=$(df / | awk 'NR==2 {print int($5)}')
    if [ "$DISK_USAGE" -gt "$DISK_WARN" ]; then
        echo -e "${RED}⚠ Disk: ${DISK_USAGE}% (threshold: ${DISK_WARN}%)${NC}"
    else
        echo -e "${GREEN}✓ Disk: ${DISK_USAGE}%${NC}"
    fi
    
    # Docker containers
    echo ""
    echo "=== Container Status ==="
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Size}}' 2>/dev/null || echo "Docker not accessible"
    
    # Container resource usage
    echo ""
    echo "=== Container Resources ==="
    docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}' 2>/dev/null || echo "Docker stats not accessible"
    
    # App health
    echo ""
    echo "=== App Health ==="
    HTTP_CODE=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost:3847/api/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Health endpoint: HTTP $HTTP_CODE${NC}"
    else
        echo -e "${RED}⚠ Health endpoint: HTTP $HTTP_CODE${NC}"
    fi
    
    # Uptime
    echo ""
    echo "=== System Uptime ==="
    uptime
}

install_cron() {
    # Check every 5 minutes, log to file
    SCRIPT_PATH=$(readlink -f "$0")
    CRON_LINE="*/5 * * * * $SCRIPT_PATH --check >> /var/log/cortex-monitor.log 2>&1"
    
    (crontab -l 2>/dev/null | grep -v "cortex-monitor"; echo "$CRON_LINE") | crontab -
    echo "✅ Monitoring cron installed (every 5 minutes)"
    echo "Logs: /var/log/cortex-monitor.log"
}

case "${1:-}" in
    --check)
        check_resources
        ;;
    --install-cron)
        install_cron
        ;;
    --report)
        check_resources
        ;;
    *)
        echo "Usage: $0 [--check|--install-cron|--report]"
        ;;
esac
