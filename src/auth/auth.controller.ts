import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CredenciaisDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: CredenciaisDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: CredenciaisDto) {
    return this.authService.login(dto);
  }
}
