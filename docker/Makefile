# ============================================================================
# Cortex Freelancer — Docker Make Targets
# ============================================================================
# Usage: make -f docker/Makefile <target>
# ============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

IMAGE_NAME ?= cortex-freelancer
REGISTRY ?= ghcr.io
OWNER ?= $(shell git config user.name 2>/dev/null || echo cortex)
TAG ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)

# ── Help ──
.PHONY: help
help:
	@echo "Cortex Freelancer — Docker Targets"
	@echo ""
	@echo "  make dev          Start local dev environment"
	@echo "  make up           Start production stack"
	@echo "  make up-full      Start with nginx + SSL + monitoring"
	@echo "  make down         Stop all containers"
	@echo "  make build        Build full image"
	@echo "  make build-slim   Build slim image (no Chromium)"
	@echo "  make push         Build + push to registry"
	@echo "  make scan         Build + security scan"
	@echo "  make logs         Tail container logs"
	@echo "  make health       Check health endpoint"
	@echo "  make shell        Shell into running container"
	@echo "  make clean        Remove images and volumes"
	@echo ""

# ── Development ──
.PHONY: dev
dev:
	cd .. && docker compose -f docker/docker-compose.dev.yml up --build

# ── Production ──
.PHONY: up
up:
	cd .. && docker compose -f docker/docker-compose.yml up -d --build

.PHONY: up-full
up-full:
	cd .. && docker compose -f docker/docker-compose.yml --profile production --profile monitoring up -d --build

.PHONY: down
down:
	cd .. && docker compose -f docker/docker-compose.yml --profile production --profile monitoring down
	cd .. && docker compose -f docker/docker-compose.dev.yml down

# ── Build ──
.PHONY: build
build:
	cd .. && ./docker/build.sh

.PHONY: build-slim
build-slim:
	cd .. && ./docker/build.sh --slim

.PHONY: push
push:
	cd .. && ./docker/build.sh --multi-platform --push

.PHONY: scan
scan:
	cd .. && ./docker/build.sh --scan

# ── Operations ──
.PHONY: logs
logs:
	docker logs -f cortex-app

.PHONY: health
health:
	@curl -sf http://localhost:3847/api/health | python3 -m json.tool 2>/dev/null || echo "❌ Health check failed"

.PHONY: shell
shell:
	docker exec -it cortex-app /bin/sh

.PHONY: clean
clean:
	docker compose -f docker/docker-compose.yml down -v --rmi local
	docker compose -f docker/docker-compose.dev.yml down -v --rmi local
	docker image prune -f
