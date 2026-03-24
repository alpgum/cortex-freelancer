#!/bin/bash
# CFX-018: SSL Configuration Test Suite
# Validates TLS setup, headers, mixed content, and generates SSL Labs link
#
# Usage:
#   ./ssl-test.sh cortexfreelancer.com

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain>}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
    local name="$1" result="$2" expected="$3"
    if echo "$result" | grep -qi "$expected"; then
        echo -e "  ${GREEN}✓${NC} $name"
        ((PASS++))
    else
        echo -e "  ${RED}✗${NC} $name (got: $result)"
        ((FAIL++))
    fi
}

warn_check() {
    local name="$1" result="$2" expected="$3"
    if echo "$result" | grep -qi "$expected"; then
        echo -e "  ${GREEN}✓${NC} $name"
        ((PASS++))
    else
        echo -e "  ${YELLOW}⚠${NC} $name (got: $result)"
        ((WARN++))
    fi
}

echo "╔══════════════════════════════════════════════════════╗"
echo "║  CFX-018: SSL Test Suite                             ║"
echo "║  Domain: ${DOMAIN}                                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Certificate Validity ──
echo "📜 Certificate Validation"
CERT_INFO=$(echo | timeout 10 openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" 2>/dev/null)

# Check if connection works
if [ -z "$CERT_INFO" ]; then
    echo -e "  ${RED}✗ Cannot connect to ${DOMAIN}:443${NC}"
    exit 1
fi

# Verify cert
VERIFY=$(echo "$CERT_INFO" | grep "Verify return code" | head -1)
check "Certificate valid" "$VERIFY" "0 (ok)"

# Check expiry
EXPIRY=$(echo "$CERT_INFO" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
echo -e "  ℹ️  Expires: ${EXPIRY}"

# Check subject
SUBJECT=$(echo "$CERT_INFO" | openssl x509 -noout -subject 2>/dev/null)
echo -e "  ℹ️  Subject: ${SUBJECT}"

# Check SANs
SANS=$(echo "$CERT_INFO" | openssl x509 -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | tail -1 | sed 's/^\s*//')
echo -e "  ℹ️  SANs: ${SANS}"

echo ""

# ── 2. TLS Protocol ──
echo "🔒 TLS Protocol"

# TLS 1.3
TLS13=$(echo | timeout 5 openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" -tls1_3 2>&1 | grep "Protocol" | awk '{print $NF}')
check "TLS 1.3 supported" "${TLS13:-none}" "TLSv1.3"

# TLS 1.2
TLS12=$(echo | timeout 5 openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" -tls1_2 2>&1 | grep "Protocol" | awk '{print $NF}')
check "TLS 1.2 supported" "${TLS12:-none}" "TLSv1.2"

# TLS 1.1 should FAIL
TLS11=$(echo | timeout 5 openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" -tls1_1 2>&1 | grep -c "alert" || true)
if [ "${TLS11:-0}" -gt 0 ] || ! echo | timeout 5 openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" -tls1_1 2>&1 | grep -q "Protocol.*TLSv1.1"; then
    echo -e "  ${GREEN}✓${NC} TLS 1.1 rejected (good)"
    ((PASS++))
else
    echo -e "  ${RED}✗${NC} TLS 1.1 still accepted (insecure!)"
    ((FAIL++))
fi

# TLS 1.0 should FAIL
TLS10=$(echo | timeout 5 openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" -tls1 2>&1 | grep -c "alert" || true)
if [ "${TLS10:-0}" -gt 0 ] || ! echo | timeout 5 openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" -tls1 2>&1 | grep -q "Protocol.*TLSv1$"; then
    echo -e "  ${GREEN}✓${NC} TLS 1.0 rejected (good)"
    ((PASS++))
else
    echo -e "  ${RED}✗${NC} TLS 1.0 still accepted (insecure!)"
    ((FAIL++))
fi

echo ""

# ── 3. Security Headers ──
echo "🛡️  Security Headers"
HEADERS=$(curl -sI "https://${DOMAIN}" 2>/dev/null)

check "HSTS" "$HEADERS" "strict-transport-security"
check "X-Content-Type-Options" "$HEADERS" "x-content-type-options"
check "X-Frame-Options" "$HEADERS" "x-frame-options"
warn_check "Referrer-Policy" "$HEADERS" "referrer-policy"
warn_check "Permissions-Policy" "$HEADERS" "permissions-policy"
warn_check "Content-Security-Policy" "$HEADERS" "content-security-policy"

# HSTS max-age check
HSTS_HEADER=$(echo "$HEADERS" | grep -i "strict-transport-security" | head -1)
if echo "$HSTS_HEADER" | grep -q "includeSubDomains"; then
    echo -e "  ${GREEN}✓${NC} HSTS includeSubDomains"
    ((PASS++))
else
    echo -e "  ${YELLOW}⚠${NC} HSTS missing includeSubDomains"
    ((WARN++))
fi

if echo "$HSTS_HEADER" | grep -q "preload"; then
    echo -e "  ${GREEN}✓${NC} HSTS preload"
    ((PASS++))
else
    echo -e "  ${YELLOW}⚠${NC} HSTS missing preload directive"
    ((WARN++))
fi

echo ""

# ── 4. HTTP → HTTPS Redirect ──
echo "🔄 Redirect Check"
HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" "http://${DOMAIN}" 2>/dev/null || echo "000")
HTTP_LOCATION=$(curl -sI "http://${DOMAIN}" 2>/dev/null | grep -i "location" | head -1 || true)

if [ "$HTTP_CODE" = "301" ]; then
    echo -e "  ${GREEN}✓${NC} HTTP → HTTPS redirect (301 permanent)"
    ((PASS++))
elif [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "308" ]; then
    echo -e "  ${YELLOW}⚠${NC} HTTP → HTTPS redirect ($HTTP_CODE — prefer 301)"
    ((WARN++))
else
    echo -e "  ${RED}✗${NC} No HTTP → HTTPS redirect (status: $HTTP_CODE)"
    ((FAIL++))
fi

echo ""

# ── 5. OCSP Stapling ──
echo "📎 OCSP Stapling"
OCSP=$(echo "$CERT_INFO" | grep -i "OCSP Response Status" || true)
if echo "$OCSP" | grep -qi "successful"; then
    echo -e "  ${GREEN}✓${NC} OCSP stapling enabled"
    ((PASS++))
else
    echo -e "  ${YELLOW}⚠${NC} OCSP stapling not detected (may need server config)"
    ((WARN++))
fi

echo ""

# ── 6. Certificate Chain ──
echo "🔗 Certificate Chain"
CHAIN_DEPTH=$(echo "$CERT_INFO" | grep -c "^ [0-9]" || true)
if [ "${CHAIN_DEPTH:-0}" -ge 2 ]; then
    echo -e "  ${GREEN}✓${NC} Full certificate chain sent (${CHAIN_DEPTH} certs)"
    ((PASS++))
else
    echo -e "  ${YELLOW}⚠${NC} Chain depth: ${CHAIN_DEPTH} (may be incomplete)"
    ((WARN++))
fi

echo ""

# ── Summary ──
echo "═══════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL + WARN))
echo -e "  ${GREEN}Pass: ${PASS}${NC}  ${RED}Fail: ${FAIL}${NC}  ${YELLOW}Warn: ${WARN}${NC}  Total: ${TOTAL}"

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
    echo -e "  ${GREEN}🏆 Rating: A+ (all checks passed)${NC}"
elif [ "$FAIL" -eq 0 ]; then
    echo -e "  ${GREEN}📊 Rating: A (minor warnings)${NC}"
elif [ "$FAIL" -le 2 ]; then
    echo -e "  ${YELLOW}📊 Rating: B (needs attention)${NC}"
else
    echo -e "  ${RED}📊 Rating: C or lower (critical issues)${NC}"
fi
echo ""
echo "🔬 Full SSL Labs test:"
echo "   https://www.ssllabs.com/ssltest/analyze.html?d=${DOMAIN}&latest"
echo ""
echo "🔬 Security Headers test:"
echo "   https://securityheaders.com/?q=https://${DOMAIN}"
