import { Global, Module } from '@nestjs/common';
import { Fila, FilaSqs } from './fila';
import { JobsService } from './jobs.service';

@Global()
@Module({
  providers: [{ provide: Fila, useFactory: () => new FilaSqs() }, JobsService],
  exports: [Fila, JobsService],
})
export class JobsModule {}
