import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { DockerService } from '../docker/docker.service';
import { TelegramService } from '../telegram/telegram.service';
import { ProcessorService } from '../processor/processor.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dockerService: DockerService,
    private readonly telegramService: TelegramService,
    private readonly processorService: ProcessorService,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDocker(),
      () => this.checkTelegram(),
      () => this.checkProcessor(),
    ]);
  }

  @Get('live')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness(): Promise<{ status: string; checks: Record<string, boolean> }> {
    const dockerStreamActive = this.dockerService.isStreamActive();
    const telegramStatus = this.telegramService.getConnectionStatus();

    const isReady = dockerStreamActive && telegramStatus.isConnected;

    return {
      status: isReady ? 'ready' : 'not_ready',
      checks: {
        dockerStream: dockerStreamActive,
        telegram: telegramStatus.isConnected,
      },
    };
  }

  @Get('stats')
  getStats(): {
    processor: ReturnType<ProcessorService['getStats']>;
    docker: { streamActive: boolean };
    telegram: { connected: boolean };
  } {
    return {
      processor: this.processorService.getStats(),
      docker: { streamActive: this.dockerService.isStreamActive() },
      telegram: { connected: this.telegramService.getConnectionStatus().isConnected },
    };
  }

  private async checkDocker(): Promise<HealthIndicatorResult> {
    const isActive = this.dockerService.isStreamActive();
    const status = await this.dockerService.getContainerStatus();

    return {
      docker: {
        status: isActive ? 'up' : 'down',
        streamActive: isActive,
        containerState: status.state,
        containerHealth: status.health,
      },
    };
  }

  private checkTelegram(): HealthIndicatorResult {
    const status = this.telegramService.getConnectionStatus();

    return {
      telegram: {
        status: status.isConnected ? 'up' : 'down',
        connected: status.isConnected,
      },
    };
  }

  private checkProcessor(): HealthIndicatorResult {
    const stats = this.processorService.getStats();

    return {
      processor: {
        status: 'up',
        ...stats,
      },
    };
  }
}
