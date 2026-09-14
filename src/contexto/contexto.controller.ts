import {
  Controller,
  Get,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContextoService } from './contexto.service';

@UseGuards(JwtAuthGuard)
@Controller('contexto')
export class ContextoController {
  constructor(private readonly contexto: ContextoService) {}

  @Post('reindexar')
  reindexar(@CurrentUser() user: AuthUser) {
    return this.contexto.reindexar(user.userId);
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('arquivos'))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() arquivos: { originalname: string; buffer: Buffer }[],
  ) {
    return this.contexto.upload(user.userId, arquivos ?? []);
  }

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.contexto.status(user.userId);
  }
}
