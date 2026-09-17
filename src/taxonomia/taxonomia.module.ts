import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { TaxonomiaController } from './taxonomia.controller';

@Module({
  imports: [ClientsModule],
  controllers: [TaxonomiaController],
})
export class TaxonomiaModule {}
