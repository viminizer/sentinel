import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module';
import { DockerModule } from './docker/docker.module';
import { TelegramModule } from './telegram/telegram.module';
import { ProcessorModule } from './processor/processor.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    ConfigModule,
    DockerModule,
    TelegramModule,
    ProcessorModule,
    HealthModule,
  ],
})
export class AppModule {}
