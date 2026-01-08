import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
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
import { CompletarPerfilDto } from './dtos/completar-perfil.dto';
import { UpdatePapeisDto } from './dtos/update-papeis.dto';

@ApiTags('Alunos')
@ApiAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alunos')
export class AlunosController {
  constructor(private readonly alunosService: AlunosService) {}

  @Get('perfil-status')
  @Roles(UserRole.ALUNO, UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Verifica status de completude do perfil' })
  async getPerfilStatus(
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.alunosService.getPerfilStatus(user.id);
  }

  @Patch('completar-perfil')
  @Roles(UserRole.ALUNO, UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Completa o perfil do usuário' })
  async completarPerfil(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CompletarPerfilDto,
  ) {
    return this.alunosService.completarPerfil(user.id, dto);
  }

  @Get()
  @UseGuards(AcademiaStatusGuard)
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Lista alunos' })
  @ApiQuery({ name: 'busca', required: false, type: String })
  @ApiQuery({ name: 'limite', required: false, type: Number })
  @ApiOkResponse({ type: [AlunoDto] })
  async listar(
    @CurrentUser() user: CurrentUserPayload,
    @Query('busca') busca?: string,
    @Query('limite') limite?: number,
  ): Promise<AlunoDto[]> {
    return this.alunosService.listar(user, { busca, limite });
  }

  @Get(':id')
  // AcademiaStatusGuard removido - PENDENTE pode ver perfil
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
  // AcademiaStatusGuard removido - PENDENTE pode ver evolução
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

  @Get(':id/papeis')
  @UseGuards(AcademiaStatusGuard)
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Busca os papéis do aluno na academia' })
  async buscarPapeis(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<string[]> {
    return this.alunosService.buscarPapeis(id, user);
  }

  @Patch(':id/papeis')
  @UseGuards(AcademiaStatusGuard)
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Atualiza os papéis do aluno na academia' })
  async atualizarPapeis(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePapeisDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: boolean; papeis: string[] }> {
    return this.alunosService.atualizarPapeis(id, dto.papeis, user);
  }
}
