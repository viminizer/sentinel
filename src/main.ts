import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  logger.log('Starting Sentinel Logger Service...');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.port;

  app.enableShutdownHooks();

  setupGracefulShutdown(logger);

  await app.listen(port);

  logger.log(`Sentinel Logger Service is running on port ${port}`);
  logger.log(`Health check available at: http://localhost:${port}/health`);
  logger.log(`Stats available at: http://localhost:${port}/health/stats`);
}

function setupGracefulShutdown(logger: Logger): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP'];

  signals.forEach((signal) => {
    process.on(signal, () => {
      logger.log(`Received ${signal}, initiating graceful shutdown...`);
    });
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error(`Uncaught Exception: ${error.message}`, error.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    logger.error(`Unhandled Rejection: ${message}`);
  });
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('Bootstrap');
  logger.error(`Failed to start application: ${error.message}`, error.stack);
  process.exit(1);
});
