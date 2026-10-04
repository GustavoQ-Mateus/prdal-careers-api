import { Global, Module } from '@nestjs/common';
import { PipelineAtsService } from './pipeline-ats.service';

@Global()
@Module({
  providers: [PipelineAtsService],
  exports: [PipelineAtsService],
})
export class PipelineAtsModule {}
