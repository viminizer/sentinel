import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DockerModule } from '../docker/docker.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ProcessorModule } from '../processor/processor.module';

@Module({
  imports: [TerminusModule, DockerModule, TelegramModule, ProcessorModule],
  controllers: [HealthController],
})
export class HealthModule {}
