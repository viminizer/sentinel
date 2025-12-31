#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

if ! command -v docker &> /dev/null; then
    error "Docker is not installed"
fi

if ! docker info &> /dev/null; then
    error "Docker is not running"
fi

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        warn ".env file not found"
        echo ""
        echo "Create .env file with your configuration:"
        echo "  cp .env.example .env"
        echo "  nano .env"
        echo ""
        error "Missing .env file"
    else
        error ".env and .env.example not found"
    fi
fi

source .env

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ] || [ -z "$DOCKER_CONTAINER_NAME" ]; then
    error "Missing required environment variables: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DOCKER_CONTAINER_NAME"
fi

log "Stopping existing containers..."
docker compose down --remove-orphans 2>/dev/null || true

log "Building image..."
docker compose build --no-cache

log "Starting service..."
docker compose up -d

log "Waiting for service to start..."
sleep 5

if docker compose ps | grep -q "Up"; then
    log "Service started successfully"
    echo ""
    docker compose ps
    echo ""

    if curl -s http://localhost:3000/health/live &>/dev/null; then
        log "Health check passed"
        echo ""
        curl -s http://localhost:3000/health/stats | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health/stats
    else
        warn "Health endpoint not responding yet"
    fi
else
    error "Service failed to start. Check logs: docker compose logs"
fi

echo ""
log "Deployment complete"
echo ""
echo "Commands:"
echo "  docker compose logs -f    # View logs"
echo "  docker compose down       # Stop service"
echo "  docker compose restart    # Restart service"
