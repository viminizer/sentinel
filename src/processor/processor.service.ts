import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '../config/config.service';
import { TelegramService } from '../telegram/telegram.service';
import { LogEntry, LogBatch } from '../common/interfaces/log-entry.interface';
import { LogLevel } from '../common/enums/log-level.enum';
import { generateBatchId } from '../common/utils/id-generator.util';
import { DOCKER_EVENTS } from '../docker/docker.constants';

@Injectable()
export class ProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessorService.name);
  private readonly allowedLevels: Set<LogLevel>;
  private readonly batchIntervalMs: number;
  private readonly maxBatchSize: number;
  private logBuffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private processedCount = 0;
  private filteredCount = 0;
  private sentCount = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) {
    this.allowedLevels = new Set(this.configService.processor.levels);
    this.batchIntervalMs = this.configService.processor.batchIntervalMs;
    this.maxBatchSize = this.configService.processor.maxBatchSize;
  }

  onModuleInit(): void {
    this.startFlushTimer();
    this.logger.log(
      `Processor initialized - Levels: ${[...this.allowedLevels].join(', ')}, ` +
        `Batch: ${this.maxBatchSize} entries / ${this.batchIntervalMs}ms`,
    );
  }

  onModuleDestroy(): void {
    this.stopFlushTimer();
    this.flushBuffer(true);
  }

  @OnEvent(DOCKER_EVENTS.LOG_RECEIVED)
  handleLogReceived(entry: LogEntry): void {
    this.processedCount++;

    if (!this.shouldProcess(entry)) {
      this.filteredCount++;
      return;
    }

    this.addToBuffer(entry);
  }

  @OnEvent(DOCKER_EVENTS.STREAM_STARTED)
  handleStreamStarted(payload: { containerName: string }): void {
    this.logger.log(`Stream started for container: ${payload.containerName}`);
    this.telegramService.sendAlert(
      'Stream Started',
      `Now monitoring logs from: ${payload.containerName}`,
    );
  }

  @OnEvent(DOCKER_EVENTS.STREAM_ERROR)
  handleStreamError(payload: { error: string }): void {
    this.logger.error(`Stream error: ${payload.error}`);
  }

  @OnEvent(DOCKER_EVENTS.STREAM_FAILED)
  handleStreamFailed(): void {
    this.logger.error('Stream permanently failed');
    this.telegramService.sendAlert(
      'Stream Failed',
      'Log streaming has permanently failed. Manual intervention required.',
    );
  }

  @OnEvent(DOCKER_EVENTS.CONTAINER_NOT_FOUND)
  handleContainerNotFound(payload: { containerName: string; error: string }): void {
    this.logger.warn(`Container not found: ${payload.containerName}`);
    this.telegramService.sendAlert(
      'Container Not Found',
      `Container "${payload.containerName}" is not available.\n\nReason: ${payload.error}\n\nRetrying in background...`,
    );
  }

  @OnEvent(DOCKER_EVENTS.CONTAINER_RECONNECTED)
  handleContainerReconnected(payload: { containerName: string }): void {
    this.logger.log(`Container reconnected: ${payload.containerName}`);
    this.telegramService.sendAlert(
      'Container Reconnected',
      `Container "${payload.containerName}" is back online. Resuming log monitoring.`,
    );
  }

  private shouldProcess(entry: LogEntry): boolean {
    return this.allowedLevels.has(entry.level);
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);

    if (this.logBuffer.length >= this.maxBatchSize) {
      this.flushBuffer();
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.batchIntervalMs);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async flushBuffer(force = false): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    const batch: LogBatch = {
      entries,
      batchId: generateBatchId(),
      createdAt: new Date(),
    };

    this.logger.debug(`Flushing batch ${batch.batchId} with ${entries.length} entries`);

    const success = await this.sendBatch(batch);

    if (success) {
      this.sentCount += entries.length;
    } else if (!force) {
      this.logBuffer = [...entries, ...this.logBuffer];
      this.logger.warn(`Failed to send batch, re-queued ${entries.length} entries`);
    }
  }

  private async sendBatch(batch: LogBatch): Promise<boolean> {
    if (batch.entries.length === 1) {
      return this.telegramService.sendLogEntry(batch.entries[0]);
    }

    return this.telegramService.sendLogBatch(batch);
  }

  getStats(): {
    processed: number;
    filtered: number;
    sent: number;
    buffered: number;
  } {
    return {
      processed: this.processedCount,
      filtered: this.filteredCount,
      sent: this.sentCount,
      buffered: this.logBuffer.length,
    };
  }

  resetStats(): void {
    this.processedCount = 0;
    this.filteredCount = 0;
    this.sentCount = 0;
  }
}
