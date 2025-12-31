# Sentinel Logger

Docker container log monitoring service with Telegram notifications.

## Features

- Real-time Docker container log streaming
- Telegram notifications with batching and rate limiting
- Log filtering by level (error, warn, debug)
- Auto-reconnect on container restart
- Smart alerts (no spam on reconnection attempts)
- Health check endpoints

## Quick Start

```bash
# Clone and setup
cp .env.example .env
nano .env  # configure your settings

# Deploy
./deploy.sh
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DOCKER_CONTAINER_NAME` | Yes | Name of the container to monitor |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | Chat/group ID to send messages |
| `TELEGRAM_TOPIC_ID` | No | Topic ID for forum groups |
| `LOG_LEVELS` | No | Comma-separated levels (default: `error,warn,debug`) |
| `BATCH_INTERVAL_MS` | No | Batch interval in ms (default: `5000`) |
| `MAX_BATCH_SIZE` | No | Max logs per batch (default: `10`) |

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Full health check |
| `GET /health/live` | Liveness probe |
| `GET /health/ready` | Readiness probe |
| `GET /health/stats` | Processing statistics |

## Commands

```bash
# Deploy/redeploy
./deploy.sh

# View logs
docker compose logs -f

# Stop
docker compose down

# Restart
docker compose restart
```

## Development

```bash
pnpm install
pnpm run start:dev
```

## License

MIT
