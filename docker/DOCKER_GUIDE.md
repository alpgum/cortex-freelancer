# 🐳 Cortex Freelancer — Docker Containerization Guide

## Overview

Universal Docker container that runs Cortex Freelancer on **any** Docker-compatible platform:
Railway, Render, DigitalOcean, AWS ECS/Fargate, GCP Cloud Run, Azure Container Apps, Fly.io, Kubernetes, or bare metal.

## Architecture

```
docker/
├── Dockerfile.universal    # Multi-stage, multi-target Dockerfile
├── docker-compose.yml      # Production compose (app + nginx + certbot)
├── docker-compose.dev.yml  # Local development compose
├── build.sh               # Build + scan + push script
├── .env.example           # Environment variable template
├── nginx/
│   ├── nginx.conf         # Reverse proxy with WSS, rate limiting, SSL
│   └── conf.d/            # Additional nginx configs
├── k8s/
│   ├── namespace.yaml
│   ├── deployment.yaml    # Deployment + liveness/readiness probes
│   ├── service.yaml       # Service + Ingress + HPA
│   └── secrets.yaml.template
└── DOCKER_GUIDE.md        # This file
```

## Quick Start

### 1. Local Development

```bash
# Start with hot-reload
docker compose -f docker/docker-compose.dev.yml up

# Visit http://localhost:3847
```

### 2. Production (Single Server)

```bash
# Setup env
cp docker/.env.example .env.production.local
# Edit .env.production.local with real values

# Build and run
docker compose -f docker/docker-compose.yml up -d

# With nginx + SSL
docker compose -f docker/docker-compose.yml --profile production up -d
```

### 3. Build Only

```bash
# Full image (with Chromium for PDF generation)
./docker/build.sh

# Slim image (no Chromium, ~60% smaller)
./docker/build.sh --slim

# Multi-platform (amd64 + arm64)
./docker/build.sh --multi-platform --push

# With security scan
./docker/build.sh --scan
```

## Build Targets

| Target | Chromium | Size (approx) | Use Case |
|--------|----------|---------------|----------|
| `final` | ✅ Yes | ~450MB | Full features, PDF invoice generation |
| `slim-final` | ❌ No | ~180MB | API-only, no PDF generation |

```bash
# Explicit target selection
docker build -f docker/Dockerfile.universal --target final -t cortex:full .
docker build -f docker/Dockerfile.universal --target slim-final -t cortex:slim .
```

## Platform-Specific Deployment

### Railway

```bash
# Railway auto-detects Dockerfile. Point to universal:
# In railway.json or dashboard:
#   Build Command: docker build -f docker/Dockerfile.universal --target slim-final .
#   Or just use the existing Dockerfile.railway (kept for backwards compat)
```

### Render

```yaml
# render.yaml — update dockerfilePath:
services:
  - type: web
    dockerfilePath: ./docker/Dockerfile.universal
    # Render injects PORT=10000
```

### DigitalOcean App Platform

```yaml
# .do/app.yaml
services:
  - name: cortex-freelancer
    dockerfile_path: docker/Dockerfile.universal
    http_port: 3847
    health_check:
      http_path: /api/health
```

### DigitalOcean Droplet

```bash
# SSH into droplet
ssh root@your-droplet

# Clone and deploy
git clone <repo> /opt/cortex-freelancer
cd /opt/cortex-freelancer
cp docker/.env.example .env.production.local
# Edit .env.production.local

docker compose -f docker/docker-compose.yml --profile production up -d
```

### AWS ECS / Fargate

```bash
# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker tag cortex-freelancer:latest <account>.dkr.ecr.<region>.amazonaws.com/cortex-freelancer:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/cortex-freelancer:latest

# Task definition: use container port 3847, health check /api/health
```

### Google Cloud Run

```bash
# Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/<project>/cortex-freelancer

# Deploy
gcloud run deploy cortex-freelancer \
  --image gcr.io/<project>/cortex-freelancer \
  --port 3847 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production,PLATFORM=cloud-run
```

### Fly.io

```toml
# fly.toml
[build]
  dockerfile = "docker/Dockerfile.universal"

[[services]]
  internal_port = 3847
  protocol = "tcp"

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.http_checks]]
    path = "/api/health"
    interval = 15000
    timeout = 5000
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f docker/k8s/namespace.yaml
kubectl apply -f docker/k8s/secrets.yaml      # From template, filled in
kubectl apply -f docker/k8s/deployment.yaml
kubectl apply -f docker/k8s/service.yaml

# Check status
kubectl -n cortex-freelancer get pods
kubectl -n cortex-freelancer logs -f deployment/cortex-freelancer
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3847` | HTTP port |
| `NODE_ENV` | No | `production` | Environment |
| `PLATFORM` | No | `docker` | Platform identifier |
| `WS_TIMEOUT_PROFILE` | No | `production` | WebSocket timeout config |
| `STRIPE_SECRET_KEY` | Yes | — | Stripe API key |
| `ANTHROPIC_API_KEY` | Yes | — | Claude AI key |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Yes | — | Firebase Admin |
| `RESEND_API_KEY` | Yes | — | Email sending |
| See `.env.example` for full list | | | |

## Security

- **Non-root user**: Container runs as `cortex:cortex` (UID 1000)
- **Tini init**: Proper PID 1 signal handling (no zombie processes)
- **Read-only FS**: Mount volumes only for `/app/logs` and `/app/tmp`
- **No secrets in image**: All config via env vars at runtime
- **Health checks**: Built into Dockerfile + compose + k8s manifests
- **Security scanning**: `./docker/build.sh --scan` runs Trivy or Docker Scout

## Performance

### Resource Guidelines

| Environment | CPU | Memory | Notes |
|------------|-----|--------|-------|
| Dev | 0.25 | 256MB | Slim image, no Chromium |
| Staging | 0.5 | 512MB | Slim image |
| Production | 1.0 | 1GB | Full image with Chromium |
| High traffic | 1.5 | 1.5GB | Full image, consider replicas |

### Optimization Tips

1. **Use slim target** if you don't need PDF generation
2. **Layer caching**: Dependencies installed before code copy
3. **Multi-platform**: Build once for amd64 + arm64
4. **Health checks**: Fast `/api/health` endpoint, 20s intervals
5. **Graceful shutdown**: 30s termination grace period

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs cortex-app

# Common: missing env vars
docker exec cortex-app curl -s http://localhost:3847/api/health | jq .env.missing_required
```

### WebSocket disconnections
```bash
# Ensure proxy supports WS upgrade
# Check WS_TIMEOUT_PROFILE matches platform
# Railway/Render: native WS support
# Nginx: needs proxy_set_header Upgrade/Connection
```

### High memory usage
```bash
# Check if Chromium is eating memory (only needed for PDF gen)
# Switch to slim target if PDF gen not needed
docker stats cortex-app
```

### Multi-platform build fails
```bash
# Ensure buildx is available
docker buildx create --name cortex-builder --use
docker buildx inspect --bootstrap
```
