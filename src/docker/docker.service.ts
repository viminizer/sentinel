import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as Docker from 'dockerode';
import { Readable } from 'stream';
import { ConfigService } from '../config/config.service';
import { LogEntry } from '../common/interfaces/log-entry.interface';
import { parseDockerLog } from '../common/utils/log-parser.util';
import { retry, sleep } from '../common/utils/retry.util';
import { DOCKER_EVENTS } from './docker.constants';

@Injectable()
export class DockerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DockerService.name);
  private readonly docker: Docker;
  private logStream: Readable | null = null;
  private isStreaming = false;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelayMs = 5000;
  private wasDisconnected = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.docker = new Docker({
      socketPath: this.configService.docker.socketPath,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.validateDockerConnection();
    await this.startLogStream();
  }

  async onModuleDestroy(): Promise<void> {
    this.shouldReconnect = false;
    await this.stopLogStream();
  }

  private async validateDockerConnection(): Promise<void> {
    try {
      await retry(async () => {
        await this.docker.ping();
        this.logger.log('Docker daemon connection established');
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to connect to Docker daemon: ${message}`);
    }
  }

  private async getContainer(): Promise<Docker.Container> {
    const containerName = this.configService.docker.containerName;

    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: { name: [containerName] },
      });

      const containerInfo = containers.find((c) =>
        c.Names.some((name) => name === `/${containerName}` || name === containerName),
      );

      if (!containerInfo) {
        throw new Error(`Container '${containerName}' not found`);
      }

      if (containerInfo.State !== 'running') {
        throw new Error(`Container '${containerName}' is not running (state: ${containerInfo.State})`);
      }

      return this.docker.getContainer(containerInfo.Id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get container: ${message}`);
    }
  }

  async startLogStream(): Promise<void> {
    if (this.isStreaming) {
      this.logger.warn('Log stream already active');
      return;
    }

    const containerName = this.configService.docker.containerName;

    try {
      const container = await this.getContainer();

      this.logger.log(`Starting log stream for container: ${containerName}`);

      this.logStream = (await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        timestamps: true,
        since: Math.floor(Date.now() / 1000),
        tail: 0,
      })) as Readable;

      this.isStreaming = true;
      this.reconnectAttempts = 0;

      // Emit reconnected event if we were previously disconnected
      if (this.wasDisconnected) {
        this.eventEmitter.emit(DOCKER_EVENTS.CONTAINER_RECONNECTED, { containerName });
        this.wasDisconnected = false;
      } else {
        this.eventEmitter.emit(DOCKER_EVENTS.STREAM_STARTED, { containerName });
      }

      this.setupStreamHandlers(containerName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to start log stream: ${message}`);

      // Only emit CONTAINER_NOT_FOUND once when first disconnecting
      if (!this.wasDisconnected) {
        this.wasDisconnected = true;
        this.eventEmitter.emit(DOCKER_EVENTS.CONTAINER_NOT_FOUND, {
          containerName,
          error: message
        });
      }

      await this.handleReconnect();
    }
  }

  private setupStreamHandlers(containerName: string): void {
    if (!this.logStream) return;

    let buffer = '';

    this.logStream.on('data', (chunk: Buffer) => {
      try {
        const data = this.demuxDockerStream(chunk);
        buffer += data;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const logEntry = parseDockerLog(line, containerName);
          if (logEntry) {
            this.emitLogEntry(logEntry);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Error processing log chunk: ${message}`);
      }
    });

    this.logStream.on('error', (error: Error) => {
      this.logger.error(`Log stream error: ${error.message}`);
      this.eventEmitter.emit(DOCKER_EVENTS.STREAM_ERROR, { error: error.message });
      this.handleStreamEnd();
    });

    this.logStream.on('end', () => {
      this.logger.warn('Log stream ended');
      this.handleStreamEnd();
    });

    this.logStream.on('close', () => {
      this.logger.warn('Log stream closed');
      this.handleStreamEnd();
    });
  }

  private demuxDockerStream(chunk: Buffer): string {
    const results: string[] = [];
    let offset = 0;

    while (offset < chunk.length) {
      if (offset + 8 > chunk.length) {
        results.push(chunk.slice(offset).toString('utf-8'));
        break;
      }

      const header = chunk.slice(offset, offset + 8);
      const streamType = header[0];
      const size = header.readUInt32BE(4);

      if (streamType > 2 || size === 0 || offset + 8 + size > chunk.length) {
        results.push(chunk.slice(offset).toString('utf-8'));
        break;
      }

      const content = chunk.slice(offset + 8, offset + 8 + size).toString('utf-8');
      results.push(content);
      offset += 8 + size;
    }

    return results.join('');
  }

  private emitLogEntry(entry: LogEntry): void {
    this.eventEmitter.emit(DOCKER_EVENTS.LOG_RECEIVED, entry);
  }

  private handleStreamEnd(): void {
    this.isStreaming = false;
    this.logStream = null;
    this.eventEmitter.emit(DOCKER_EVENTS.STREAM_ENDED);

    if (this.shouldReconnect) {
      this.handleReconnect();
    }
  }

  private async handleReconnect(): Promise<void> {
    if (!this.shouldReconnect) return;

    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached. Giving up.');
      this.eventEmitter.emit(DOCKER_EVENTS.STREAM_FAILED);
      return;
    }

    const delay = this.reconnectDelayMs * Math.min(this.reconnectAttempts, 5);
    this.logger.warn(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`,
    );

    await sleep(delay);

    if (this.shouldReconnect) {
      await this.startLogStream();
    }
  }

  async stopLogStream(): Promise<void> {
    this.shouldReconnect = false;
    this.isStreaming = false;

    if (this.logStream) {
      this.logStream.destroy();
      this.logStream = null;
      this.logger.log('Log stream stopped');
    }
  }

  async getContainerStatus(): Promise<{
    isRunning: boolean;
    state: string;
    health?: string;
  }> {
    try {
      const container = await this.getContainer();
      const info = await container.inspect();

      return {
        isRunning: info.State.Running,
        state: info.State.Status,
        health: info.State.Health?.Status,
      };
    } catch {
      return {
        isRunning: false,
        state: 'unknown',
      };
    }
  }

  isStreamActive(): boolean {
    return this.isStreaming;
  }
}
