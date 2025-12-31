import { LogLevel } from '../enums/log-level.enum';
import { LOG_PATTERNS } from '../constants';
import { LogEntry, RawDockerLog } from '../interfaces/log-entry.interface';
import { generateLogId } from './id-generator.util';

export function parseLogLevel(message: string, stream: 'stdout' | 'stderr'): LogLevel {
  if (stream === 'stderr' || LOG_PATTERNS.ERROR.test(message)) {
    return LogLevel.ERROR;
  }

  if (LOG_PATTERNS.WARN.test(message)) {
    return LogLevel.WARN;
  }

  if (LOG_PATTERNS.DEBUG.test(message)) {
    return LogLevel.DEBUG;
  }

  return LogLevel.INFO;
}

export function parseDockerLog(raw: string, containerName: string): LogEntry | null {
  try {
    const parsed: RawDockerLog = JSON.parse(raw);
    const message = parsed.log?.trim();

    if (!message) {
      return null;
    }

    const level = parseLogLevel(message, parsed.stream);

    return {
      id: generateLogId(),
      timestamp: new Date(parsed.time),
      level,
      message,
      container: containerName,
      raw,
    };
  } catch {
    const message = raw.trim();
    if (!message) {
      return null;
    }

    return {
      id: generateLogId(),
      timestamp: new Date(),
      level: parseLogLevel(message, 'stdout'),
      message,
      container: containerName,
      raw,
    };
  }
}

export function parseRawLogStream(data: Buffer, containerName: string): LogEntry | null {
  const content = data.toString('utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    const entry = parseDockerLog(line, containerName);
    if (entry) {
      return entry;
    }
  }

  return null;
}
