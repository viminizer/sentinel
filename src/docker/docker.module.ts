import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DockerService } from './docker.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [DockerService],
  exports: [DockerService],
})
export class DockerModule {}
