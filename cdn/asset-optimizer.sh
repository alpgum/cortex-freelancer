#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Asset Optimization Script for Cortex Freelancer
# ═══════════════════════════════════════════════════════════════
# Run before deployment to optimize static assets.
# Creates minified + compressed versions for CDN delivery.
#
# Usage: ./cdn/asset-optimizer.sh [--dry-run]
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN="${1:-}"
TOTAL_SAVED=0

echo "═══════════════════════════════════════════════════"
echo "  Cortex Freelancer Asset Optimizer"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Check dependencies ──
check_tool() {
  if command -v "$1" &> /dev/null; then
    echo "  ✓ $1 found"
    return 0
  else
    echo "  ✗ $1 not found (optional)"
    return 1
  fi
}

echo "Checking tools..."
HAS_TERSER=false
HAS_CSSO=false
HAS_HTMLMIN=false
HAS_BROTLI=false
HAS_GZIP=true  # Always available

check_tool "terser" && HAS_TERSER=true
check_tool "csso" && HAS_CSSO=true
check_tool "html-minifier-terser" && HAS_HTMLMIN=true
check_tool "brotli" && HAS_BROTLI=true
echo ""

# ── Helper: report size savings ──
report_savings() {
  local original="$1"
  local optimized="$2"
  local label="$3"
  
  local orig_size=$(wc -c < "$original")
  local opt_size=$(wc -c < "$optimized")
  local saved=$((orig_size - opt_size))
  local pct=0
  
  if [ "$orig_size" -gt 0 ]; then
    pct=$((saved * 100 / orig_size))
  fi
  
  TOTAL_SAVED=$((TOTAL_SAVED + saved))
  echo "  ${label}: ${orig_size}B → ${opt_size}B (-${pct}%)"
}

# ── 1. Analyze current asset sizes ──
echo "📊 Current Asset Analysis:"
echo "  JS files:  $(find "$PROJECT_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' -name '*.js' | wc -l | tr -d ' ')"
echo "  CSS files: $(find "$PROJECT_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' -name '*.css' | wc -l | tr -d ' ')"
echo "  HTML files: $(find "$PROJECT_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' -name '*.html' | wc -l | tr -d ' ')"
echo ""

JS_TOTAL=$(find "$PROJECT_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' -name '*.js' -exec cat {} + | wc -c)
CSS_TOTAL=$(find "$PROJECT_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' -name '*.css' -exec cat {} + | wc -c)
HTML_TOTAL=$(find "$PROJECT_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' -name '*.html' -exec cat {} + | wc -c)

echo "  JS total:   $(echo "$JS_TOTAL" | awk '{printf "%0.1f MB\n", $1/1048576}')"
echo "  CSS total:  $(echo "$CSS_TOTAL" | awk '{printf "%0.1f KB\n", $1/1024}')"
echo "  HTML total: $(echo "$HTML_TOTAL" | awk '{printf "%0.1f MB\n", $1/1048576}')"
echo ""

# ── 2. Identify largest files (optimization targets) ──
echo "🎯 Top 15 Largest JS Files (optimization targets):"
find "$PROJECT_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' -name '*.js' \
  -exec wc -c {} + | sort -rn | head -16 | tail -15 | \
  awk '{printf "  %6.1f KB  %s\n", $1/1024, $2}'
echo ""

# ── 3. Pre-compression (create .br and .gz versions) ──
echo "🗜️  Pre-compressing static assets..."

compress_file() {
  local file="$1"
  local size=$(wc -c < "$file")
  
  # Skip small files (< 1KB)
  if [ "$size" -lt 1024 ]; then
    return
  fi
  
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] Would compress: $file"
    return
  fi
  
  # Gzip
  gzip -9 -k -f "$file" 2>/dev/null && true
  
  # Brotli (if available)
  if [ "$HAS_BROTLI" = true ]; then
    brotli -q 11 -k -f "$file" 2>/dev/null && true
  fi
}

COMPRESSED_COUNT=0
for ext in js css html json svg xml; do
  while IFS= read -r file; do
    compress_file "$file"
    COMPRESSED_COUNT=$((COMPRESSED_COUNT + 1))
  done < <(find "$PROJECT_DIR" -not -path '*/node_modules/*' -not -path '*/.git/*' -name "*.$ext" -size +1k)
done

echo "  Compressed $COMPRESSED_COUNT files"
echo ""

# ── 4. Summary ──
echo "═══════════════════════════════════════════════════"
echo "  Optimization Summary"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Total raw assets: $(echo "$((JS_TOTAL + CSS_TOTAL + HTML_TOTAL))" | awk '{printf "%0.1f MB\n", $1/1048576}')"

if [ "$DRY_RUN" = "--dry-run" ]; then
  echo ""
  echo "  🔍 Dry run — no files were modified"
  echo "  Run without --dry-run to optimize"
fi

echo ""
echo "  Recommendations:"
echo "  ─────────────────"
echo "  1. Bundle app/js/* into chunks (433 individual files → ~5-10 bundles)"
echo "  2. Enable Brotli pre-compression for static serving"
echo "  3. Use content-hash filenames for cache-busting"
echo "  4. Lazy-load tool-specific JS (only load when tool page is visited)"
echo ""
echo "Done ✓"
