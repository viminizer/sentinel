import { LogLevel } from '../enums/log-level.enum';

export interface LogEntry {
  readonly id: string;
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly message: string;
  readonly container: string;
  readonly raw: string;
}

export interface RawDockerLog {
  readonly log: string;
  readonly stream: 'stdout' | 'stderr';
  readonly time: string;
}

export interface LogBatch {
  readonly entries: LogEntry[];
  readonly batchId: string;
  readonly createdAt: Date;
}
