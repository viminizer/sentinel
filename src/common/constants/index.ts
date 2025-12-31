export const INJECTION_TOKENS = {
  DOCKER_CLIENT: 'DOCKER_CLIENT',
  TELEGRAF_INSTANCE: 'TELEGRAF_INSTANCE',
  CONFIG: 'APP_CONFIG',
} as const;

export const DEFAULT_VALUES = {
  BATCH_INTERVAL_MS: 5000,
  MAX_BATCH_SIZE: 10,
  RATE_LIMIT_PER_SECOND: 25,
  DOCKER_SOCKET_PATH: '/var/run/docker.sock',
  PORT: 7777,
} as const;

export const LOG_PATTERNS = {
  ERROR: /\b(error|exception|fatal|critical|fail(ed|ure)?)\b/i,
  WARN: /\b(warn(ing)?|caution|alert)\b/i,
  DEBUG: /\b(debug|trace|verbose)\b/i,
  INFO: /\b(info|notice|log)\b/i,
} as const;
