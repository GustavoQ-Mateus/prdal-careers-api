import { Global, Module } from '@nestjs/common';
import { Armazenamento, ArmazenamentoS3 } from './armazenamento';

@Global()
@Module({
  providers: [{ provide: Armazenamento, useFactory: () => new ArmazenamentoS3() }],
  exports: [Armazenamento],
})
export class ArquivosModule {}
