import { Module } from '@nestjs/common';
import { ProcessorService } from './processor.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  providers: [ProcessorService],
  exports: [ProcessorService],
})
export class ProcessorModule {}
