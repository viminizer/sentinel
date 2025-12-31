import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
};

export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const logger = new Logger('RetryUtil');

  let lastError: Error | undefined;
  let currentDelay = config.delayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === config.maxAttempts) {
        break;
      }

      logger.warn(`Attempt ${attempt}/${config.maxAttempts} failed: ${lastError.message}`);
      config.onRetry?.(attempt, lastError);

      await sleep(currentDelay);
      currentDelay = Math.min(currentDelay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
