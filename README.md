<div align="center">

# Sentinel

**Docker Container Log Monitoring with Telegram Alerts**

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Features](#features) | [Quick Start](#quick-start) | [Configuration](#configuration) | [API](#api-reference) | [Deployment](#deployment) | [Development](#development)

</div>

---

## Overview

Sentinel is a log monitoring service that streams Docker container logs in real-time and delivers intelligent notifications to Telegram. Built with NestJS and designed for production environments, it provides reliable alerting with smart batching, rate limiting, and automatic recovery mechanisms.

### Why Sentinel?

- **Zero Configuration Complexity** - Simple environment variables, no complex setup
- **Intelligent Alerting** - Smart batching prevents notification fatigue
- **Production Hardened** - Auto-reconnection, graceful shutdown, comprehensive health checks
- **Resource Efficient** - Token bucket rate limiting, minimal memory footprint
- **Observable** - Built-in health endpoints for Kubernetes/Docker orchestration

---

## Features

### Core Capabilities

| Feature                 | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| **Real-time Streaming** | Direct connection to Docker daemon via Unix socket        |
| **Log Level Filtering** | Filter by ERROR, WARN, DEBUG, INFO with pattern detection |
| **Smart Batching**      | Configurable batch intervals and sizes reduce API calls   |
| **Rate Limiting**       | Token bucket algorithm ensures Telegram API compliance    |
| **Auto-Reconnection**   | Exponential backoff with configurable retry attempts      |
| **Graceful Lifecycle**  | Startup/shutdown notifications, signal handling           |

### Advanced Features

- **Telegram Forum Support** - Route logs to specific topics/threads
- **Rich Formatting** - HTML messages with emojis and code blocks
- **Message Truncation** - Automatic handling of oversized log entries
- **Processing Statistics** - Track processed, filtered, sent, and buffered counts
- **Multi-stream Demux** - Proper stdout/stderr separation from Docker

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SENTINEL                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    Events    ┌──────────────┐    HTTP    ┌──────┐ │
│  │    Docker    │─────────────▶│  Processor   │───────────▶│  TG  │ │
│  │   Service    │              │   Service    │            │ API  │ │
│  └──────┬───────┘              └──────────────┘            └──────┘ │
│         │                             │                             │
│         │ /var/run/docker.sock        │ Batching & Filtering        │
│         ▼                             ▼                             │
│  ┌──────────────┐              ┌──────────────┐                     │
│  │   Docker     │              │    Health    │◀─── /health/*       │
│  │   Daemon     │              │  Controller  │                     │
│  └──────────────┘              └──────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **DockerService** connects to the Docker daemon and streams container logs
2. Log entries are parsed and emitted as events via NestJS EventEmitter
3. **ProcessorService** receives events, filters by log level, and batches entries
4. Batched logs are sent to **TelegramService** with rate limiting
5. **HealthController** exposes endpoints for monitoring and orchestration

---

## Quick Start

### Prerequisites

- Docker Engine 20.10+
- Telegram Bot Token ([Create one](https://core.telegram.org/bots#creating-a-new-bot))
- Target container to monitor

### Installation

```bash
# Clone the repository
git clone https://github.com/viminizer/sentinel.git
cd sentinel

# Configure environment
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DOCKER_CONTAINER_NAME=your-app-container
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWxyz
TELEGRAM_CHAT_ID=-1001234567890
```

### Deploy

```bash
# Production deployment
./deploy.sh

# Or manually with Docker Compose
docker compose up -d
```

### Verify

```bash
# Check service health
curl http://localhost:7777/health

# View logs
docker compose logs -f sentinel
```

---

## Configuration

### Environment Variables

| Variable                | Required | Default                | Description                                         |
| ----------------------- | :------: | ---------------------- | --------------------------------------------------- |
| `DOCKER_CONTAINER_NAME` | **Yes**  | -                      | Name of the container to monitor                    |
| `TELEGRAM_BOT_TOKEN`    | **Yes**  | -                      | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID`      | **Yes**  | -                      | Target chat/group ID                                |
| `TELEGRAM_TOPIC_ID`     |    No    | -                      | Topic ID for forum-type groups                      |
| `LOG_LEVELS`            |    No    | `error,warn,debug`     | Comma-separated levels to capture                   |
| `BATCH_INTERVAL_MS`     |    No    | `5000`                 | Batch timeout in milliseconds                       |
| `MAX_BATCH_SIZE`        |    No    | `10`                   | Maximum logs per batch                              |
| `RATE_LIMIT_PER_SECOND` |    No    | `25`                   | Telegram API rate limit                             |
| `PORT`                  |    No    | `7777`                 | HTTP server port                                    |
| `NODE_ENV`              |    No    | `production`           | Environment mode                                    |
| `DOCKER_SOCKET_PATH`    |    No    | `/var/run/docker.sock` | Docker socket path                                  |

### Log Levels

Sentinel uses pattern-based detection to classify log levels:

| Level   | Detection Patterns                                                                    |
| ------- | ------------------------------------------------------------------------------------- |
| `error` | `error`, `exception`, `fatal`, `critical`, `fail`, `failed`, `failure`, stderr output |
| `warn`  | `warn`, `warning`, `caution`, `alert`                                                 |
| `debug` | `debug`, `trace`, `verbose`                                                           |
| `info`  | Default fallback for unmatched patterns                                               |

### Example Configurations

**Minimal (Errors Only)**

```env
DOCKER_CONTAINER_NAME=api-server
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_CHAT_ID=-100123456789
LOG_LEVELS=error
```

**High-Volume Application**

```env
DOCKER_CONTAINER_NAME=web-app
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_CHAT_ID=-100123456789
LOG_LEVELS=error,warn
BATCH_INTERVAL_MS=10000
MAX_BATCH_SIZE=20
RATE_LIMIT_PER_SECOND=15
```

**Forum Group with Topic**

```env
DOCKER_CONTAINER_NAME=microservice
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_CHAT_ID=-100123456789
TELEGRAM_TOPIC_ID=42
LOG_LEVELS=error,warn,debug
```

---

## API Reference

### Health Endpoints

All endpoints are served under the `/health` prefix.

#### `GET /health`

Full health check with all component statuses.

**Response:**

```json
{
  "status": "ok",
  "info": {
    "docker": {
      "status": "up",
      "streamActive": true,
      "containerState": "running",
      "containerHealth": "healthy"
    },
    "telegram": {
      "status": "up",
      "connected": true
    },
    "processor": {
      "status": "up",
      "processed": 1542,
      "filtered": 312,
      "sent": 1230,
      "buffered": 3
    }
  }
}
```

#### `GET /health/live`

Kubernetes liveness probe. Returns 200 if the process is running.

**Response:**

```json
{
  "status": "ok"
}
```

#### `GET /health/ready`

Kubernetes readiness probe. Returns 200 only when fully operational.

**Response:**

```json
{
  "status": "ready",
  "checks": {
    "streamActive": true,
    "telegramConnected": true
  }
}
```

#### `GET /health/stats`

Detailed processing statistics.

**Response:**

```json
{
  "processor": {
    "processed": 1542,
    "filtered": 312,
    "sent": 1230,
    "buffered": 3
  },
  "docker": {
    "streamActive": true,
    "reconnectAttempts": 0
  },
  "telegram": {
    "connected": true,
    "messagesSent": 1230
  }
}
```

---

## Deployment

### Docker Compose (Recommended)

```yaml
# docker-compose.yaml
services:
  sentinel:
    build: .
    container_name: sentinel
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - '7777:7777'
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:7777/health/live']
      interval: 30s
      timeout: 10s
      retries: 3
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sentinel
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sentinel
  template:
    metadata:
      labels:
        app: sentinel
    spec:
      containers:
        - name: sentinel
          image: your-registry/sentinel:latest
          ports:
            - containerPort: 7777
          envFrom:
            - secretRef:
                name: sentinel-secrets
          volumeMounts:
            - name: docker-socket
              mountPath: /var/run/docker.sock
              readOnly: true
          livenessProbe:
            httpGet:
              path: /health/live
              port: 7777
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 7777
            initialDelaySeconds: 5
            periodSeconds: 10
      volumes:
        - name: docker-socket
          hostPath:
            path: /var/run/docker.sock
```

### Automated Deployment

The included `deploy.sh` script handles:

- Docker daemon validation
- Environment file verification
- Required variable checks
- Container lifecycle management
- Health verification

```bash
./deploy.sh
```

---

## Development

### Local Setup

```bash
# Install dependencies
pnpm install

# Start in development mode (with hot reload)
pnpm run start:dev

# Or use Docker Compose for development
docker compose -f docker-compose.dev.yaml up
```

### Available Scripts

| Script                 | Description                      |
| ---------------------- | -------------------------------- |
| `pnpm run build`       | Compile TypeScript to JavaScript |
| `pnpm run start`       | Start production server          |
| `pnpm run start:dev`   | Start with hot reload            |
| `pnpm run start:debug` | Start with debugger attached     |
| `pnpm run lint`        | Run ESLint with auto-fix         |
| `pnpm run format`      | Format code with Prettier        |
| `pnpm run test`        | Run unit tests                   |
| `pnpm run test:cov`    | Run tests with coverage          |

### Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root module
├── config/                 # Configuration management
│   ├── config.service.ts   # Config loading & validation
│   └── config.schema.ts    # Zod validation schemas
├── docker/                 # Docker integration
│   ├── docker.service.ts   # Docker daemon interaction
│   └── docker.constants.ts # Event definitions
├── telegram/               # Telegram integration
│   └── telegram.service.ts # Telegram API wrapper
├── processor/              # Log processing
│   └── processor.service.ts # Filtering & batching
├── health/                 # Health checks
│   └── health.controller.ts # HTTP endpoints
└── common/                 # Shared utilities
    ├── enums/              # Log level enums
    ├── interfaces/         # Type definitions
    └── utils/              # Helper functions
```

### Development Container

The `docker-compose.dev.yaml` includes a test container that generates sample logs:

```bash
docker compose -f docker-compose.dev.yaml up
```

This starts:

- Sentinel in development mode with hot reload
- A test container emitting INFO, DEBUG, WARN, and ERROR logs

---

## Monitoring

### Prometheus Metrics (Coming Soon)

Integration with Prometheus metrics is planned for future releases.

### Log Output

Sentinel outputs structured logs suitable for log aggregation:

```
[Nest] 1  - 01/01/2026, 12:00:00 PM     LOG [DockerService] Connected to container: my-app
[Nest] 1  - 01/01/2026, 12:00:00 PM     LOG [ProcessorService] Processing log batch (5 entries)
[Nest] 1  - 01/01/2026, 12:00:01 PM     LOG [TelegramService] Sent batch to chat -100123456789
```

### Telegram Notifications

Sentinel sends notifications on:

- **Startup** - Service initialization complete
- **Shutdown** - Graceful termination
- **Container Events** - Target container start/stop/restart
- **Log Batches** - Filtered logs matching configured levels
- **Errors** - Uncaught exceptions and critical failures

---

## Troubleshooting

### Common Issues

#### Container Not Found

```
Error: Container 'my-app' not found
```

**Solution:** Verify the container name matches exactly (case-sensitive) and the container is running.

```bash
docker ps --format '{{.Names}}'
```

#### Permission Denied on Docker Socket

```
Error: connect EACCES /var/run/docker.sock
```

**Solution:** Ensure the container has access to the Docker socket:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

For rootless Docker, adjust the socket path accordingly.

#### Telegram Bot Not Sending Messages

**Checklist:**

1. Bot token format: `123456789:ABCdef...`
2. Bot added to the target chat/group
3. For groups, bot must have message permissions
4. Chat ID format: Negative for groups (`-100...`)

Test with curl:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "<CHAT_ID>", "text": "Test"}'
```

#### High Memory Usage

**Solution:** Reduce batch size and interval:

```env
BATCH_INTERVAL_MS=3000
MAX_BATCH_SIZE=5
```

### Debug Mode

Enable verbose logging:

```env
NODE_ENV=development
```

---

## Security Considerations

- **Docker Socket Access** - Sentinel requires read-only access to the Docker socket. In production, consider using Docker socket proxies for additional isolation.
- **Telegram Tokens** - Store bot tokens securely using environment variables or secrets management.
- **Network Exposure** - The health endpoint should be restricted to internal networks or protected by authentication in production.
- **Non-Root User** - The production Docker image runs as a non-root user (UID 1001).

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Guidelines

- Follow the existing code style (ESLint + Prettier)
- Add tests for new functionality
- Update documentation as needed
- Keep commits atomic and well-described

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**[Back to Top](#sentinel)**

Built with [NestJS](https://nestjs.com/) | Powered by [Node.js](https://nodejs.org/)

</div>
