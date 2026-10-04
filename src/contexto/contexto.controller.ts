import {
  Body,
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
import {
  ArquivoRecebido,
  LimiteUploadInterceptor,
  lerArquivosTexto,
  lerHistorico,
  opcoesMulter,
} from './upload-texto';

@UseGuards(JwtAuthGuard)
@Controller('contexto')
export class ContextoController {
  constructor(private readonly contexto: ContextoService) {}

  @Post('reindexar')
  reindexar(@CurrentUser() user: AuthUser) {
    return this.contexto.reindexar(user.userId);
  }

  @Post('upload')
  @UseInterceptors(LimiteUploadInterceptor, FilesInterceptor('arquivos', undefined, opcoesMulter()))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() arquivos: ArquivoRecebido[],
    @Body() corpo: { historico?: unknown },
  ) {
    return this.contexto.upload(
      user.userId,
      lerArquivosTexto(arquivos ?? []),
      lerHistorico(corpo?.historico),
    );
  }

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.contexto.status(user.userId);
  }
}
