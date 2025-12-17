import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import {
  AlunosService,
  CurrentUser as CurrentUserPayload,
} from './alunos.service';
import { AlunoDetalheDto } from './dtos/aluno-detalhe.dto';
import { AlunoDto } from './dtos/aluno.dto';
import { EvolucaoAlunoDto } from './dtos/evolucao-aluno.dto';

@ApiTags('Alunos')
@ApiAuth()
@UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard)
@Controller('alunos')
export class AlunosController {
  constructor(private readonly alunosService: AlunosService) {}

  @Get()
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Lista alunos' })
  @ApiOkResponse({ type: [AlunoDto] })
  async listar(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AlunoDto[]> {
    return this.alunosService.listar(user);
  }

  @Get(':id')
  @Roles(
    UserRole.ALUNO,
    UserRole.INSTRUTOR,
    UserRole.PROFESSOR,
    UserRole.ADMIN,
    UserRole.TI,
  )
  @ApiOperation({ summary: 'Detalhe do aluno' })
  @ApiOkResponse({ type: AlunoDetalheDto })
  async detalhar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AlunoDetalheDto> {
    return this.alunosService.detalhar(id, user);
  }

  @Get(':id/evolucao')
  @Roles(
    UserRole.ALUNO,
    UserRole.INSTRUTOR,
    UserRole.PROFESSOR,
    UserRole.ADMIN,
    UserRole.TI,
  )
  @ApiOperation({ summary: 'Evolucao e historico de graduacoes do aluno' })
  @ApiOkResponse({ type: EvolucaoAlunoDto })
  async evolucao(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<EvolucaoAlunoDto> {
    return this.alunosService.evolucao(id, user);
  }
}
