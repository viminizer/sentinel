import { z } from 'zod';
import { LogLevel } from '../common/enums/log-level.enum';
import { DEFAULT_VALUES } from '../common/constants';

const logLevelSchema = z.nativeEnum(LogLevel);

const dockerConfigSchema = z.object({
  containerName: z.string().min(1, 'Container name is required'),
  socketPath: z.string().default(DEFAULT_VALUES.DOCKER_SOCKET_PATH),
  maxReconnectAttempts: z.number().int().positive().default(DEFAULT_VALUES.MAX_RECONNECT_ATTEMPTS),
  reconnectDelayMs: z.number().int().positive().default(DEFAULT_VALUES.RECONNECT_DELAY_MS),
});

const telegramConfigSchema = z.object({
  botToken: z
    .string()
    .min(1, 'Telegram bot token is required')
    .regex(/^\d+:[A-Za-z0-9_-]+$/, 'Invalid Telegram bot token format'),
  chatId: z.string().min(1, 'Telegram chat ID is required'),
  topicId: z.number().int().positive().optional(),
});

const processorConfigSchema = z.object({
  levels: z.array(logLevelSchema).min(1, 'At least one log level must be specified'),
  batchIntervalMs: z.number().int().positive().default(DEFAULT_VALUES.BATCH_INTERVAL_MS),
  maxBatchSize: z.number().int().positive().default(DEFAULT_VALUES.MAX_BATCH_SIZE),
  rateLimitPerSecond: z.number().int().positive().default(DEFAULT_VALUES.RATE_LIMIT_PER_SECOND),
});

const appConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('production'),
  port: z.number().int().positive().default(DEFAULT_VALUES.PORT),
  docker: dockerConfigSchema,
  telegram: telegramConfigSchema,
  processor: processorConfigSchema,
});

export type DockerConfig = z.infer<typeof dockerConfigSchema>;
export type TelegramConfig = z.infer<typeof telegramConfigSchema>;
export type ProcessorConfig = z.infer<typeof processorConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

export { appConfigSchema, dockerConfigSchema, telegramConfigSchema, processorConfigSchema };
