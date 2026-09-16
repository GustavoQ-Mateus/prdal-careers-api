import { Module } from '@nestjs/common';
import { HojeModule } from '../hoje/hoje.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [HojeModule],
  controllers: [PipelineController],
  providers: [PipelineService],
})
export class PipelineModule {}
