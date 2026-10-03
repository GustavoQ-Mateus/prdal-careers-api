import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CadastroDto, LoginDto } from './dto';

export const RESPOSTA_CADASTRO = {
  mensagem: 'cadastro recebido; entre com seu e-mail e senha',
} as const;

const HASH_FICTICIO = bcrypt.hashSync('senha-que-nunca-confere', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: CadastroDto) {
    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const existente = await this.buscarPorEmail(dto.email);
    if (!existente) {
      await this.prisma.usuario
        .create({ data: { email: dto.email, senhaHash } })
        .catch((erro: { code?: string }) => {
          if (erro?.code !== 'P2002') throw erro;
        });
    }
    return RESPOSTA_CADASTRO;
  }

  async login(dto: LoginDto) {
    const usuario = await this.buscarPorEmail(dto.email);
    const confere = await bcrypt.compare(dto.senha, usuario?.senhaHash ?? HASH_FICTICIO);
    if (!usuario || !confere) {
      throw new UnauthorizedException('credenciais invalidas');
    }
    return this.token(usuario.id, usuario.email);
  }

  private buscarPorEmail(email: string) {
    return this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      orderBy: { criadoEm: 'asc' },
    });
  }

  private token(sub: string, email: string) {
    return { accessToken: this.jwt.sign({ sub, email }) };
  }
}
