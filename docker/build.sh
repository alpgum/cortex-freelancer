#!/usr/bin/env bash
# ============================================================================
# Cortex Freelancer — Universal Docker Build Script
# ============================================================================
# Usage:
#   ./docker/build.sh                    # Build full image (with Chromium)
#   ./docker/build.sh --slim             # Build slim image (no Chromium)
#   ./docker/build.sh --multi-platform   # Build for amd64 + arm64
#   ./docker/build.sh --push             # Build + push to registry
#   ./docker/build.sh --scan             # Build + security scan
# ============================================================================

set -euo pipefail

# ── Config ──
IMAGE_NAME="${IMAGE_NAME:-cortex-freelancer}"
REGISTRY="${REGISTRY:-ghcr.io}"
OWNER="${OWNER:-$(git config user.name 2>/dev/null || echo 'cortex')}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
FULL_IMAGE="${REGISTRY}/${OWNER}/${IMAGE_NAME}"

# ── Parse args ──
SLIM=false
MULTI_PLATFORM=false
PUSH=false
SCAN=false

for arg in "$@"; do
  case $arg in
    --slim)          SLIM=true ;;
    --multi-platform) MULTI_PLATFORM=true ;;
    --push)          PUSH=true ;;
    --scan)          SCAN=true ;;
    --help|-h)
      echo "Usage: $0 [--slim] [--multi-platform] [--push] [--scan]"
      exit 0
      ;;
  esac
done

# ── Determine target ──
TARGET="final"
TAG_SUFFIX=""
if $SLIM; then
  TARGET="slim-final"
  TAG_SUFFIX="-slim"
fi

echo "╔══════════════════════════════════════════╗"
echo "║  Cortex Freelancer — Docker Build        ║"
echo "╠══════════════════════════════════════════╣"
echo "║  Image:    ${FULL_IMAGE}"
echo "║  Tag:      ${TAG}${TAG_SUFFIX}"
echo "║  Target:   ${TARGET}"
echo "║  Platform: $(if $MULTI_PLATFORM; then echo 'amd64,arm64'; else echo 'native'; fi)"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Build ──
cd "$(dirname "$0")/.."

BUILD_ARGS=(
  --file docker/Dockerfile.universal
  --target "${TARGET}"
  --tag "${FULL_IMAGE}:${TAG}${TAG_SUFFIX}"
  --tag "${FULL_IMAGE}:latest${TAG_SUFFIX}"
  --build-arg BUILDKIT_INLINE_CACHE=1
)

if $MULTI_PLATFORM; then
  # Ensure buildx builder exists
  docker buildx inspect cortex-builder >/dev/null 2>&1 || \
    docker buildx create --name cortex-builder --use

  BUILD_CMD="docker buildx build"
  BUILD_ARGS+=(--platform linux/amd64,linux/arm64)

  if $PUSH; then
    BUILD_ARGS+=(--push)
  else
    BUILD_ARGS+=(--load)
    echo "⚠ Multi-platform without --push uses --load (single platform only)"
    BUILD_ARGS=($(echo "${BUILD_ARGS[@]}" | sed 's/--platform linux\/amd64,linux\/arm64/--platform linux\/amd64/'))
  fi
else
  BUILD_CMD="docker build"
  if $PUSH; then
    BUILD_ARGS+=(--push)
  fi
fi

echo "🔨 Building..."
$BUILD_CMD "${BUILD_ARGS[@]}" .

echo ""
echo "✅ Build complete: ${FULL_IMAGE}:${TAG}${TAG_SUFFIX}"

# ── Security scan ──
if $SCAN; then
  echo ""
  echo "🔍 Running security scan..."
  if command -v trivy &>/dev/null; then
    trivy image --severity HIGH,CRITICAL "${FULL_IMAGE}:${TAG}${TAG_SUFFIX}"
  elif command -v docker scout &>/dev/null 2>&1; then
    docker scout quickview "${FULL_IMAGE}:${TAG}${TAG_SUFFIX}"
  else
    echo "⚠ No scanner found. Install trivy or Docker Scout."
    echo "  brew install trivy"
  fi
fi

# ── Image size report ──
echo ""
echo "📦 Image size:"
docker images "${FULL_IMAGE}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null || true
