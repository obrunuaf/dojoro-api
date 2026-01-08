import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiaStatusGuard } from '../../common/guards/academia-status.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { CreateGraduacaoDto } from './dtos/create-graduacao.dto';
import { GraduacaoDto } from './dtos/graduacao.dto';
import { AptidaoDto } from './dtos/aptidao.dto';
import { GraduacoesService } from './graduacoes.service';

@ApiTags('Graduacoes')
@ApiAuth()
@UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard)
@Controller('graduacoes')
export class GraduacoesController {
  constructor(private readonly graduacoesService: GraduacoesService) {}

  @Get('aptos')
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Lista alunos aptos para graduação hoje' })
  @ApiOkResponse({ type: [AptidaoDto] })
  async findAptos(@CurrentUser() user: any): Promise<AptidaoDto[]> {
    return this.graduacoesService.findAptos(user.academiaId);
  }

  @Get('alunos/:alunoId/aptidao')
  @ApiOperation({ summary: 'Verifica se um aluno específico está apto' })
  @ApiOkResponse({ type: AptidaoDto })
  async verificarAptidao(
    @CurrentUser() user: any,
    @Param('alunoId') alunoId: string,
  ): Promise<AptidaoDto> {
    return this.graduacoesService.verificarAptidao(alunoId, user.academiaId);
  }

  @Get()
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI, UserRole.INSTRUTOR)
  @ApiOperation({ summary: 'Lista graduações da academia' })
  @ApiOkResponse({ type: [GraduacaoDto] })
  async findAll(
    @CurrentUser() user: any,
    @Query('alunoId') alunoId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ): Promise<GraduacaoDto[]> {
    return this.graduacoesService.findAll(user.academiaId, { alunoId, from, to, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma graduação por ID' })
  @ApiOkResponse({ type: GraduacaoDto })
  async findById(@Param('id') id: string): Promise<GraduacaoDto> {
    return this.graduacoesService.findById(id);
  }

  @Post()
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Registra uma graduação' })
  @ApiCreatedResponse({ type: GraduacaoDto })
  async criar(
    @CurrentUser() user: any,
    @Body() dto: CreateGraduacaoDto,
  ): Promise<GraduacaoDto> {
    return this.graduacoesService.criar(dto, user.academiaId);
  }

  @Post(':id/confirmar')
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Confirma uma graduação pendente' })
  @ApiOkResponse({ type: GraduacaoDto })
  async confirmar(@Param('id') id: string): Promise<GraduacaoDto> {
    return this.graduacoesService.confirmar(id);
  }

  @Post(':id/cancelar')
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Cancela uma graduação' })
  async cancelar(@Param('id') id: string): Promise<void> {
    return this.graduacoesService.cancelar(id);
  }
}
