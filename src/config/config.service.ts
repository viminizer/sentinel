import { Injectable, Logger } from '@nestjs/common';
import { AppConfig, appConfigSchema } from './config.schema';
import { LogLevel } from '../common/enums/log-level.enum';
import { DEFAULT_VALUES } from '../common/constants';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
    this.logger.log('Configuration loaded successfully');
    this.logConfig();
  }

  private loadConfig(): AppConfig {
    const rawConfig = this.buildRawConfig();
    const result = appConfigSchema.safeParse(rawConfig);

    if (!result.success) {
      const errors = result.error.errors
        .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Configuration validation failed:\n${errors}`);
    }

    return result.data;
  }

  private buildRawConfig(): Record<string, unknown> {
    return {
      nodeEnv: process.env.NODE_ENV || 'production',
      port: this.parseNumber(process.env.PORT, DEFAULT_VALUES.PORT),
      docker: {
        containerName: process.env.DOCKER_CONTAINER_NAME,
        socketPath: process.env.DOCKER_SOCKET_PATH || DEFAULT_VALUES.DOCKER_SOCKET_PATH,
      },
      telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
        topicId: this.parseOptionalNumber(process.env.TELEGRAM_TOPIC_ID),
      },
      processor: {
        levels: this.parseLogLevels(process.env.LOG_LEVELS),
        batchIntervalMs: this.parseNumber(
          process.env.BATCH_INTERVAL_MS,
          DEFAULT_VALUES.BATCH_INTERVAL_MS,
        ),
        maxBatchSize: this.parseNumber(process.env.MAX_BATCH_SIZE, DEFAULT_VALUES.MAX_BATCH_SIZE),
        rateLimitPerSecond: this.parseNumber(
          process.env.RATE_LIMIT_PER_SECOND,
          DEFAULT_VALUES.RATE_LIMIT_PER_SECOND,
        ),
      },
    };
  }

  private parseNumber(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private parseOptionalNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  }

  private parseLogLevels(value: string | undefined): LogLevel[] {
    if (!value) {
      return [LogLevel.ERROR, LogLevel.WARN, LogLevel.DEBUG];
    }

    return value
      .split(',')
      .map((level) => level.trim().toLowerCase())
      .filter((level): level is LogLevel =>
        Object.values(LogLevel).includes(level as LogLevel),
      );
  }

  private logConfig(): void {
    this.logger.log(`Environment: ${this.config.nodeEnv}`);
    this.logger.log(`Port: ${this.config.port}`);
    this.logger.log(`Docker container: ${this.config.docker.containerName}`);
    this.logger.log(`Log levels: ${this.config.processor.levels.join(', ')}`);
    this.logger.log(`Batch interval: ${this.config.processor.batchIntervalMs}ms`);
    this.logger.log(`Max batch size: ${this.config.processor.maxBatchSize}`);
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  get docker(): AppConfig['docker'] {
    return this.config.docker;
  }

  get telegram(): AppConfig['telegram'] {
    return this.config.telegram;
  }

  get processor(): AppConfig['processor'] {
    return this.config.processor;
  }

  get port(): number {
    return this.config.port;
  }

  get nodeEnv(): string {
    return this.config.nodeEnv;
  }

  get isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }
}
