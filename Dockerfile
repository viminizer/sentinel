# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src

# Build the application
RUN pnpm run build

# Prune dev dependencies
RUN pnpm prune --prod

# Production stage
FROM node:20-alpine AS production

# Security: Run as non-root user
RUN addgroup -g 1001 -S sentinel && \
    adduser -S sentinel -u 1001 -G sentinel

WORKDIR /app

# Copy built application
COPY --from=builder --chown=sentinel:sentinel /app/dist ./dist
COPY --from=builder --chown=sentinel:sentinel /app/node_modules ./node_modules
COPY --from=builder --chown=sentinel:sentinel /app/package.json ./

# Set environment
ENV NODE_ENV=production

# Switch to non-root user
USER sentinel

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
