import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { TelegramService } from './telegram/telegram.service';

let telegramService: TelegramService | null = null;
let isShuttingDown = false;

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  logger.log('Starting Sentinel Logger Service...');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  telegramService = app.get(TelegramService);
  const port = configService.port;

  setupErrorHandlers(logger);
  setupShutdownHandlers(logger, app);

  await app.listen(port);

  logger.log(`Sentinel Logger Service is running on port ${port}`);

  await sendStartupNotification(configService);
}

async function sendStartupNotification(configService: ConfigService): Promise<void> {
  if (!telegramService) return;

  const containerName = configService.docker.containerName;
  const levels = configService.processor.levels.join(', ');

  await telegramService.sendAlert(
    'Sentinel Started',
    `Service is online and monitoring.\n\nContainer: ${containerName}\nLog levels: ${levels}`,
  );
}

async function sendShutdownNotification(signal: string): Promise<void> {
  if (!telegramService || isShuttingDown) return;
  isShuttingDown = true;

  try {
    await telegramService.sendAlert(
      'Sentinel Stopped',
      `Service received ${signal} and is shutting down.`,
    );
  } catch {
    // Ignore errors during shutdown
  }
}

async function sendErrorNotification(error: string): Promise<void> {
  if (!telegramService) return;

  try {
    await telegramService.sendAlert('Sentinel Error', `Service error:\n\n${error}`);
  } catch {
    // Ignore - can't send if Telegram is the problem
  }
}

function setupErrorHandlers(logger: Logger): void {
  process.on('uncaughtException', async (error: Error) => {
    logger.error(`Uncaught Exception: ${error.message}`, error.stack);
    await sendErrorNotification(`Uncaught Exception: ${error.message}\n\n${error.stack || ''}`);
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : '';
    logger.error(`Unhandled Rejection: ${message}`);
    await sendErrorNotification(`Unhandled Rejection: ${message}\n\n${stack || ''}`);
  });
}

function setupShutdownHandlers(logger: Logger, app: { close: () => Promise<void> }): void {
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;

    logger.log(`Received ${signal}, initiating graceful shutdown...`);
    await sendShutdownNotification(signal);

    try {
      await app.close();
    } catch {
      // Ignore close errors
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
}

bootstrap().catch(async (error: Error) => {
  const logger = new Logger('Bootstrap');
  logger.error(`Failed to start application: ${error.message}`, error.stack);
  await sendErrorNotification(`Failed to start: ${error.message}\n\n${error.stack || ''}`);
  process.exit(1);
});
