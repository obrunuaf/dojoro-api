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
import { DecisaoPendenciaLoteDto } from './dtos/decisao-pendencia-lote.dto';
import { DecisaoPendenciaDto } from './dtos/decisao-pendencia.dto';
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
  @ApiOperation({ summary: 'Decide pendencia de presenca (aprovar/rejeitar)' })
  @ApiOkResponse({ type: CheckinResponseDto })
  async decidir(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DecisaoPendenciaDto,
    @CurrentUserDecorator() user: CurrentUser,
  ): Promise<CheckinResponseDto> {
    return this.presencasService.decidir(id, dto, user);
  }

  @Post('pendencias/lote')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Decide pendencias em lote' })
  @ApiOkResponse({
    schema: {
      example: {
        totalProcessados: 2,
        aprovados: 2,
        rejeitados: 0,
        ignorados: 0,
      },
    },
  })
  async decidirLote(
    @Body() dto: DecisaoPendenciaLoteDto,
    @CurrentUserDecorator() user: CurrentUser,
  ): Promise<{
    totalProcessados: number;
    aprovados: number;
    rejeitados: number;
    ignorados: number;
  }> {
    return this.presencasService.decidirLote(dto, user);
  }
}
