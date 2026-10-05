import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CadastroDto, LoginDto, TrocaSenhaDto } from './dto';
import { CredenciaisSessao, SessoesService } from './sessoes.service';

export const RESPOSTA_CADASTRO = {
  mensagem: 'cadastro recebido; entre com seu e-mail e senha',
} as const;

const HASH_FICTICIO = bcrypt.hashSync('senha-que-nunca-confere', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessoes: SessoesService,
  ) {}

  async register(dto: CadastroDto) {
    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const email = dto.email.trim().toLowerCase();
    const existente = await this.buscarPorEmail(email);
    if (!existente) {
      await this.prisma.usuario
        .create({ data: { email, senhaHash } })
        .catch((erro: { code?: string }) => {
          if (erro?.code !== 'P2002') throw erro;
        });
    }
    return RESPOSTA_CADASTRO;
  }

  async login(dto: LoginDto): Promise<{ usuario: { id: string; email: string }; credenciais: CredenciaisSessao }> {
    const usuario = await this.buscarPorEmail(dto.email);
    const confere = await bcrypt.compare(dto.senha, usuario?.senhaHash ?? HASH_FICTICIO);
    if (!usuario || !confere) {
      throw new UnauthorizedException('credenciais invalidas');
    }
    const dados = { id: usuario.id, email: usuario.email };
    return { usuario: dados, credenciais: await this.sessoes.abrir(dados) };
  }

  async trocarSenha(usuarioId: string, dto: TrocaSenhaDto, csrf?: string): Promise<CredenciaisSessao> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario || !(await bcrypt.compare(dto.senhaAtual, usuario.senhaHash))) {
      throw new UnauthorizedException('senha atual incorreta');
    }
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { senhaHash: await bcrypt.hash(dto.novaSenha, 10) },
    });
    await this.sessoes.revogarTodas(usuarioId);
    return this.sessoes.abrir({ id: usuario.id, email: usuario.email }, csrf);
  }

  private buscarPorEmail(email: string) {
    return this.prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
  }
}
