import { Injectable } from '@nestjs/common';
import { OrigemEvento, Prisma } from '@prisma/client';

type Cliente = Prisma.TransactionClient;

export type NovoEvento = {
  usuarioId: string;
  vagaId: string;
  candidaturaId?: string | null;
  curriculoId?: string | null;
  tipo: string;
  origem: OrigemEvento;
  descricao: string;
  dados?: Prisma.InputJsonValue;
  ocorridoEm?: Date;
};

@Injectable()
export class EventosService {
  registrar(tx: Cliente, evento: NovoEvento) {
    return tx.eventoOportunidade.create({
      data: {
        usuarioId: evento.usuarioId,
        vagaId: evento.vagaId,
        candidaturaId: evento.candidaturaId ?? null,
        curriculoId: evento.curriculoId ?? null,
        tipo: evento.tipo,
        origem: evento.origem,
        descricao: evento.descricao,
        dados: evento.dados ?? {},
        ocorridoEm: evento.ocorridoEm ?? new Date(),
      },
    });
  }
}
