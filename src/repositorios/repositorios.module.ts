import { Global, Module } from '@nestjs/common';
import { ConversasRepositorio } from './conversas.repositorio';
import { DocumentosRagRepositorio } from './documentos-rag.repositorio';
import { NotasRepositorio } from './notas.repositorio';
import { VetoresRepositorio } from './vetores.repositorio';

const REPOSITORIOS = [ConversasRepositorio, DocumentosRagRepositorio, NotasRepositorio, VetoresRepositorio];

@Global()
@Module({
  providers: REPOSITORIOS,
  exports: REPOSITORIOS,
})
export class RepositoriosModule {}
