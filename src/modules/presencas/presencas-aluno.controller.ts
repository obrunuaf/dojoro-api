import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser as CurrentUserDecorator } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiaStatusGuard } from '../../common/guards/academia-status.guard';
import { CurrentUser, PresencasService } from './presencas.service';
import { HistoricoPresencaDto } from './dtos/historico-presenca.dto';

@ApiTags('Presencas')
@ApiAuth()
@UseGuards(JwtAuthGuard, RolesGuard) // AcademiaStatusGuard removido - PENDENTE pode ver histórico
@Controller('alunos')
export class AlunoPresencasController {
  constructor(private readonly presencasService: PresencasService) {}

  @Get(':id/historico-presencas')
  @Roles(
    UserRole.ALUNO,
    UserRole.INSTRUTOR,
    UserRole.PROFESSOR,
    UserRole.ADMIN,
    UserRole.TI,
  )
  @ApiOperation({ summary: 'Histórico de presenças do aluno' })
  @ApiOkResponse({ type: [HistoricoPresencaDto] })
  async historico(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserDecorator() user: CurrentUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<HistoricoPresencaDto[]> {
    return this.presencasService.historicoDoAluno(id, user, { from, to });
  }
}
