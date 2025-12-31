import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { ConfigService } from '../config/config.service';
import { LogEntry, LogBatch } from '../common/interfaces/log-entry.interface';
import { LogLevel, LOG_LEVEL_EMOJI } from '../common/enums/log-level.enum';
import { retry, sleep } from '../common/utils/retry.util';

interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Telegraf;
  private readonly chatId: string;
  private readonly topicId: number | undefined;
  private readonly rateLimitState: RateLimitState;
  private readonly maxTokens: number;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    this.bot = new Telegraf(this.configService.telegram.botToken);
    this.chatId = this.configService.telegram.chatId;
    this.topicId = this.configService.telegram.topicId;
    this.maxTokens = this.configService.processor.rateLimitPerSecond;
    this.rateLimitState = {
      tokens: this.maxTokens,
      lastRefill: Date.now(),
    };
  }

  async onModuleInit(): Promise<void> {
    await this.validateBotConnection();
  }

  onModuleDestroy(): void {
    // Keep connection alive until process exits for shutdown notifications
  }

  private async validateBotConnection(): Promise<void> {
    try {
      const botInfo = await retry(async () => {
        return await this.bot.telegram.getMe();
      });

      this.isConnected = true;
      this.logger.log(`Telegram bot connected: @${botInfo.username}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to connect to Telegram: ${message}`);
    }
  }

  async sendLogEntry(entry: LogEntry): Promise<boolean> {
    const message = this.formatLogEntry(entry);
    return this.sendMessage(message);
  }

  async sendLogBatch(batch: LogBatch): Promise<boolean> {
    if (batch.entries.length === 0) {
      return true;
    }

    const message = this.formatLogBatch(batch);
    return this.sendMessage(message);
  }

  async sendMessage(text: string): Promise<boolean> {
    if (!this.isConnected) {
      this.logger.warn('Telegram bot not connected, skipping message');
      return false;
    }

    await this.acquireRateLimitToken();

    try {
      await retry(
        async () => {
          await this.bot.telegram.sendMessage(this.chatId, text, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            message_thread_id: this.topicId,
          });
        },
        {
          maxAttempts: 3,
          delayMs: 1000,
          onRetry: (attempt, error) => {
            this.logger.warn(`Telegram send retry ${attempt}: ${error.message}`);
          },
        },
      );

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send Telegram message: ${message}`);
      return false;
    }
  }

  async sendAlert(title: string, body: string): Promise<boolean> {
    const message = `<b>${this.escapeHtml(title)}</b>\n\n${this.escapeHtml(body)}`;
    return this.sendMessage(message);
  }

  private formatLogEntry(entry: LogEntry): string {
    const emoji = LOG_LEVEL_EMOJI[entry.level];
    const level = entry.level.toUpperCase();
    const time = this.formatTimestamp(entry.timestamp);
    const container = entry.container;
    const message = this.truncateMessage(entry.message, 500);

    return (
      `${emoji} <b>${level}</b> | <code>${container}</code> | ${time}\n` +
      `<pre>${this.escapeHtml(message)}</pre>`
    );
  }

  private formatLogBatch(batch: LogBatch): string {
    const header = `<b>Log Batch</b> (${batch.entries.length} entries)\n`;
    const separator = '─'.repeat(30) + '\n';

    const entries = batch.entries
      .map((entry) => {
        const emoji = LOG_LEVEL_EMOJI[entry.level];
        const level = entry.level.toUpperCase().padEnd(5);
        const time = this.formatTimestamp(entry.timestamp);
        const message = this.truncateMessage(entry.message, 200);

        return `${emoji} <b>${level}</b> ${time}\n<pre>${this.escapeHtml(message)}</pre>`;
      })
      .join('\n');

    return header + separator + entries;
  }

  private formatTimestamp(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private truncateMessage(message: string, maxLength: number): string {
    const cleaned = message.trim();
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    return cleaned.substring(0, maxLength - 3) + '...';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private async acquireRateLimitToken(): Promise<void> {
    this.refillTokens();

    while (this.rateLimitState.tokens < 1) {
      const waitTime = 1000 / this.maxTokens;
      await sleep(waitTime);
      this.refillTokens();
    }

    this.rateLimitState.tokens -= 1;
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.rateLimitState.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.maxTokens;

    this.rateLimitState.tokens = Math.min(
      this.maxTokens,
      this.rateLimitState.tokens + tokensToAdd,
    );
    this.rateLimitState.lastRefill = now;
  }

  getConnectionStatus(): { isConnected: boolean } {
    return { isConnected: this.isConnected };
  }
}
