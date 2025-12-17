import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiaStatusGuard } from '../../common/guards/academia-status.guard';
import { MatriculasService } from './matriculas.service';
import { MatriculaPendenteDto } from './dtos/matricula-pendente.dto';
import {
  DecisaoMatriculaDto,
  DecisaoMatriculaResponseDto,
} from './dtos/decisao-matricula.dto';

@ApiTags('Matriculas')
@ApiAuth()
@UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard)
@Controller('staff/matriculas')
export class MatriculasController {
  constructor(private readonly matriculasService: MatriculasService) {}

  @Get('pendentes')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Lista matriculas pendentes de aprovacao' })
  @ApiOkResponse({ type: [MatriculaPendenteDto] })
  async listarPendentes(
    @CurrentUser() user: { id: string; academiaId: string },
  ): Promise<MatriculaPendenteDto[]> {
    return this.matriculasService.listarPendentes(user);
  }

  @Patch(':id')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Aprova ou rejeita matricula pendente' })
  @ApiOkResponse({ type: DecisaoMatriculaResponseDto })
  async decidir(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: DecisaoMatriculaDto,
    @CurrentUser() user: { id: string; academiaId: string },
  ): Promise<DecisaoMatriculaResponseDto> {
    return this.matriculasService.decidir(id, dto, user);
  }
}
