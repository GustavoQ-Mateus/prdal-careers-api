import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { COOKIE_ACESSO, lerCookie } from './cookies';
import { PayloadAcesso, SessoesService } from './sessoes.service';

export type JwtPayload = PayloadAcesso;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly sessoes: SessoesService,
  ) {
    super({
      jwtFromRequest: (req: Request) => lerCookie(req, COOKIE_ACESSO) ?? null,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sid || !(await this.sessoes.familiaAtiva(payload.sid, payload.sub))) {
      throw new UnauthorizedException('sessao encerrada');
    }
    return { userId: payload.sub, email: payload.email, sessaoId: payload.sid };
  }
}
