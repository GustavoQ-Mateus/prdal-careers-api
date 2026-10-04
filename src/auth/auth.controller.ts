import { Body, ConflictException, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LIMITES, LimitarRequisicoes } from '../limites/limite-requisicoes';
import { AuthService } from './auth.service';
import { COOKIE_CSRF, COOKIE_REFRESH, gravarCsrf, gravarSessao, lerCookie, limparSessao } from './cookies';
import { CurrentUser, type AuthUser } from './current-user.decorator';
import { CadastroDto, LoginDto, TrocaSenhaDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { novoSegredo, SessoesService } from './sessoes.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessoes: SessoesService,
  ) {}

  @Post('register')
  @LimitarRequisicoes(LIMITES.cadastro)
  register(@Body() dto: CadastroDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @LimitarRequisicoes(LIMITES.login)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { usuario, credenciais } = await this.authService.login(dto);
    gravarSessao(res, credenciais);
    return { usuario, csrfToken: credenciais.csrf };
  }

  @Post('refresh')
  @HttpCode(200)
  @LimitarRequisicoes(LIMITES.refresh)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const credenciais = await this.sessoes.renovar(lerCookie(req, COOKIE_REFRESH), lerCookie(req, COOKIE_CSRF));
      gravarSessao(res, credenciais);
      return { csrfToken: credenciais.csrf };
    } catch (erro) {
      if (erro instanceof ConflictException) throw erro;
      limparSessao(res);
      throw erro;
    }
  }

  @Get('sessao')
  @UseGuards(JwtAuthGuard)
  sessao(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let csrf = lerCookie(req, COOKIE_CSRF);
    if (!csrf) {
      csrf = novoSegredo();
      gravarCsrf(res, csrf);
    }
    return { usuario: { id: user.userId, email: user.email }, csrfToken: csrf };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    if (user.sessaoId) await this.sessoes.revogarFamilia(user.sessaoId);
    limparSessao(res);
  }

  @Post('senha')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @LimitarRequisicoes(LIMITES.login)
  async trocarSenha(
    @CurrentUser() user: AuthUser,
    @Body() dto: TrocaSenhaDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    gravarSessao(res, await this.authService.trocarSenha(user.userId, dto, lerCookie(req, COOKIE_CSRF)));
  }
}
