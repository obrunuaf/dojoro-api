import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiaStatusGuard } from '../../common/guards/academia-status.guard';
import { CreateTurmaDto } from './dtos/create-turma.dto';
import { ListTurmasQueryDto } from './dtos/list-turmas-query.dto';
import { TurmaResponseDto } from './dtos/turma-response.dto';
import { UpdateTurmaDto } from './dtos/update-turma.dto';
import {
  TurmasService,
  CurrentUser as CurrentUserPayload,
} from './turmas.service';

@ApiTags('Turmas')
@ApiAuth()
@UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard)
@Controller('turmas')
export class TurmasController {
  constructor(private readonly turmasService: TurmasService) {}

  @Get()
  @Roles(
    UserRole.ALUNO,
    UserRole.INSTRUTOR,
    UserRole.PROFESSOR,
    UserRole.ADMIN,
    UserRole.TI,
  )
  @ApiOperation({ summary: 'Lista turmas cadastradas' })
  @ApiOkResponse({ type: [TurmaResponseDto] })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    description: 'Inclui turmas deletadas (somente staff). Ignorado se onlyDeleted=true.',
    type: Boolean,
  })
  @ApiQuery({
    name: 'onlyDeleted',
    required: false,
    description: 'Retorna apenas turmas deletadas (somente staff).',
    type: Boolean,
  })
  async listar(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListTurmasQueryDto,
  ): Promise<TurmaResponseDto[]> {
    return this.turmasService.listar(user, query);
  }

  @Get(':id')
  @Roles(
    UserRole.ALUNO,
    UserRole.INSTRUTOR,
    UserRole.PROFESSOR,
    UserRole.ADMIN,
    UserRole.TI,
  )
  @ApiOperation({ summary: 'Detalhe da turma' })
  @ApiOkResponse({ type: TurmaResponseDto })
  async detalhar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<TurmaResponseDto> {
    return this.turmasService.detalhar(id, user);
  }

  @Post()
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Cria nova turma' })
  @ApiCreatedResponse({ type: TurmaResponseDto })
  async criar(
    @Body() dto: CreateTurmaDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<TurmaResponseDto> {
    return this.turmasService.criar(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Atualiza turma' })
  @ApiOkResponse({ type: TurmaResponseDto })
  async atualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTurmaDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<TurmaResponseDto> {
    return this.turmasService.atualizar(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Soft-delete de turma' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remover(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: true }> {
    await this.turmasService.remover(id, user);
    return { success: true };
  }

  @Post(':id/restore')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({
    summary: 'Restaura turma soft-deletada',
    description:
      'Desfaz o soft-delete, reativando a turma. Conflita se ja existir turma ativa com o mesmo nome.',
  })
  @ApiOkResponse({ type: TurmaResponseDto })
  async restaurar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<TurmaResponseDto> {
    return this.turmasService.restaurar(id, user);
  }
}
