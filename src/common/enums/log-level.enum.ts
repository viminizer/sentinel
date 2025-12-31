export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  DEBUG = 'debug',
  INFO = 'info',
}

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
};

export const LOG_LEVEL_EMOJI: Record<LogLevel, string> = {
  [LogLevel.ERROR]: '🔴',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.DEBUG]: '🔵',
};
