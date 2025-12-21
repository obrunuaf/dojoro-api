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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiaStatusGuard } from '../../common/guards/academia-status.guard';
import { Throttle } from '@nestjs/throttler';
import {
  AulasService,
  CurrentUser as CurrentUserPayload,
} from './aulas.service';
import { AulaQrCodeDto } from './dtos/aula-qrcode.dto';
import { AulaDto } from './dtos/aula.dto';
import { AulaResponseDto } from './dtos/aula-response.dto';
import { CreateAulaDto } from './dtos/create-aula.dto';
import { CreateAulasLoteDto } from './dtos/create-aulas-lote.dto';
import { CreateAulasLoteResponseDto } from './dtos/create-aulas-lote-response.dto';
import { EncerrarAulaResponseDto } from './dtos/encerrar-aula-response.dto';
import { CreatePresencaManualDto } from './dtos/create-presenca-manual.dto';
import { ListarPresencasAulaQueryDto } from './dtos/listar-presencas-aula.query.dto';
import { ListAulasQueryDto } from './dtos/list-aulas-query.dto';
import { PresencaAulaItemDto } from './dtos/presenca-aula-item.dto';
import { PresencasAulaResponseDto } from './dtos/presencas-aula-response.dto';
import { UpdateAulaDto } from './dtos/update-aula.dto';

@ApiTags('Aulas')
@ApiAuth()
@UseGuards(JwtAuthGuard, RolesGuard) // AcademiaStatusGuard removido - PENDENTE pode ver aulas
@Controller('aulas')
export class AulasController {
  constructor(private readonly aulasService: AulasService) {}

  @Get()
  @Roles(
    UserRole.ALUNO,
    UserRole.INSTRUTOR,
    UserRole.PROFESSOR,
    UserRole.ADMIN,
    UserRole.TI,
  )
  @ApiOperation({ summary: 'Lista aulas com filtros' })
  @ApiQuery({ name: 'turmaId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['AGENDADA', 'ENCERRADA', 'CANCELADA'],
  })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    description: 'Inclui aulas deletadas (somente staff)',
  })
  @ApiQuery({
    name: 'onlyDeleted',
    required: false,
    type: Boolean,
    description: 'Retorna apenas aulas deletadas (somente staff)',
  })
  @ApiOkResponse({ type: [AulaResponseDto] })
  async listar(
    @Query() query: ListAulasQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AulaResponseDto[]> {
    return this.aulasService.listar(query, user);
  }

  @Get('hoje')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Lista aulas do dia' })
  @ApiOkResponse({ type: [AulaDto] })
  async listarHoje(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AulaDto[]> {
    return this.aulasService.listarHoje(user);
  }

  @Get(':id')
  @Roles(
    UserRole.ALUNO,
    UserRole.INSTRUTOR,
    UserRole.PROFESSOR,
    UserRole.ADMIN,
    UserRole.TI,
  )
  @ApiOperation({ summary: 'Detalhe da aula' })
  @ApiOkResponse({ type: AulaResponseDto })
  async detalhar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<AulaResponseDto> {
    return this.aulasService.detalhar(
      id,
      user,
      includeDeleted?.toLowerCase() === 'true',
    );
  }

  @Get(':id/presencas')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Lista presencas da aula (STAFF)' })
  @ApiParam({ name: 'id', description: 'ID da aula' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDENTE', 'PRESENTE', 'FALTA'],
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Busca por nome do aluno (ILIKE %q%)',
  })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    description: 'Inclui aulas/turmas soft-deletadas (somente staff)',
  })
  @ApiOkResponse({ type: PresencasAulaResponseDto })
  async listarPresencasDaAula(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ListarPresencasAulaQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PresencasAulaResponseDto> {
    return this.aulasService.listarPresencasDaAula(id, query, user);
  }

  @Post(':id/presencas/manual')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Registra presença manual (STAFF)' })
  @ApiParam({ name: 'id', description: 'ID da aula' })
  @ApiCreatedResponse({ type: PresencaAulaItemDto })
  async criarPresencaManual(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreatePresencaManualDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PresencaAulaItemDto> {
    return this.aulasService.criarPresencaManual(id, dto, user);
  }

  @Post()
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Cria aula avulsa' })
  @ApiCreatedResponse({ type: AulaResponseDto })
  async criar(
    @Body() dto: CreateAulaDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AulaResponseDto> {
    return this.aulasService.criar(dto, user);
  }

  @Post('lote')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Gera aulas em lote' })
  @ApiOkResponse({ type: CreateAulasLoteResponseDto })
  async criarEmLote(
    @Body() dto: CreateAulasLoteDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CreateAulasLoteResponseDto> {
    return this.aulasService.criarEmLote(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Atualiza aula' })
  @ApiOkResponse({ type: AulaResponseDto })
  async atualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAulaDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AulaResponseDto> {
    return this.aulasService.atualizar(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Soft-delete de aula' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remover(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: true }> {
    await this.aulasService.remover(id, user);
    return { success: true };
  }

  @Post(':id/restore')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Restaura aula soft-deletada' })
  @ApiOkResponse({ type: AulaResponseDto })
  async restaurar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AulaResponseDto> {
    return this.aulasService.restaurar(id, user);
  }

  @Post(':id/encerrar')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Encerra aula (STAFF)' })
  @ApiParam({ name: 'id', description: 'ID da aula' })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    description: 'Inclui aulas/turmas soft-deletadas (somente staff)',
  })
  @ApiOkResponse({ type: EncerrarAulaResponseDto })
  async encerrar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<EncerrarAulaResponseDto> {
    return this.aulasService.encerrarAula(
      id,
      user,
      includeDeleted?.toLowerCase() === 'true',
    );
  }

  @Post(':id/cancel')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Cancela aula (status=CANCELADA)' })
  @ApiOkResponse({ type: AulaResponseDto })
  async cancelar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AulaResponseDto> {
    return this.aulasService.cancelar(id, user);
  }

  @Get(':id/qrcode')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Obtem token de QR Code da aula' })
  @ApiOkResponse({ type: AulaQrCodeDto })
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async obterQrCode(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AulaQrCodeDto> {
    return this.aulasService.gerarQrCode(id, user);
  }
}
