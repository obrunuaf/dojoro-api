import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CheckinResponseDto } from '../checkin/dtos/checkin-response.dto';
import { CurrentUser, PresencasService } from './presencas.service';
import { DecisaoLoteDto } from './dtos/decisao-lote.dto';
import { DecisaoPresencaDto } from './dtos/decisao-presenca.dto';
import { PresencaPendenteDto } from './dtos/presenca-pendente.dto';
import { PendenciasQueryDto } from './dtos/pendencias-query.dto';

@ApiTags('Presencas')
@ApiAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('presencas')
export class PresencasController {
  constructor(private readonly presencasService: PresencasService) {}

  @Get('pendencias')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Lista pendencias de presenca (hoje por default)' })
  @ApiOkResponse({
    schema: {
      example: {
        total: 1,
        itens: [
          {
            presencaId: 'uuid',
            alunoId: 'uuid',
            alunoNome: 'Aluno Seed',
            aulaId: 'uuid',
            turmaNome: 'Adulto Gi Noite',
            dataInicio: '2025-12-12T22:00:00.000Z',
            origem: 'QR_CODE',
            criadoEm: '2025-12-12T21:55:00.000Z',
          },
        ],
      },
    },
  })
  async listarPendencias(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: PendenciasQueryDto,
  ): Promise<{ total: number; itens: PresencaPendenteDto[] }> {
    return this.presencasService.listarPendencias(user, query);
  }

  @Patch(':id/decisao')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({
    summary: 'Decide pendencia de presenca (APROVAR -> PRESENTE, REJEITAR -> FALTA)',
  })
  @ApiOkResponse({ type: CheckinResponseDto })
  async decidir(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DecisaoPresencaDto,
    @CurrentUserDecorator() user: CurrentUser,
  ): Promise<CheckinResponseDto> {
    return this.presencasService.decidirPresenca(id, dto, user);
  }

  @Post('pendencias/lote')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({
    summary: 'Decide pendencias em lote (APROVAR -> PRESENTE, REJEITAR -> FALTA)',
  })
  @ApiOkResponse({
    schema: {
      example: {
        processados: 2,
        atualizados: ['015b0c97-1234-5678-90ab-1234567890ab'],
        ignorados: [{ id: '...', motivo: 'nao encontrada' }],
      },
    },
  })
  async decidirLote(
    @Body() dto: DecisaoLoteDto,
    @CurrentUserDecorator() user: CurrentUser,
  ): Promise<{
    processados: number;
    atualizados: string[];
    ignorados: { id: string; motivo: string }[];
  }> {
    return this.presencasService.decidirLote(dto, user);
  }
}
