import { Global, Module } from '@nestjs/common';
import { BancoVagasRepositorio } from './banco-vagas.repositorio';
import { ConversasRepositorio } from './conversas.repositorio';
import { DocumentosRagRepositorio } from './documentos-rag.repositorio';
import { NotasRepositorio } from './notas.repositorio';

const REPOSITORIOS = [ConversasRepositorio, DocumentosRagRepositorio, NotasRepositorio, BancoVagasRepositorio];

@Global()
@Module({
  providers: REPOSITORIOS,
  exports: REPOSITORIOS,
})
export class RepositoriosModule {}
