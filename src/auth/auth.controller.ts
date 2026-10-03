import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CredenciaisDto } from './dto';
import { LIMITES, LimitarRequisicoes } from '../limites/limite-requisicoes';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @LimitarRequisicoes(LIMITES.cadastro)
  register(@Body() dto: CredenciaisDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @LimitarRequisicoes(LIMITES.login)
  login(@Body() dto: CredenciaisDto) {
    return this.authService.login(dto);
  }
}
