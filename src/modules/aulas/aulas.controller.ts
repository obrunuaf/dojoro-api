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
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Throttle } from '@nestjs/throttler';
import {
  AulasService,
  CurrentUser as CurrentUserPayload,
} from './aulas.service';
import { AulaQrCodeDto } from './dtos/aula-qrcode.dto';
import { AulaDto } from './dtos/aula.dto';
import { AulaResponseDto } from './dtos/aula-response.dto';
import { CreateAulaDto } from './dtos/create-aula.dto';
import { ListAulasQueryDto } from './dtos/list-aulas-query.dto';
import { UpdateAulaDto } from './dtos/update-aula.dto';

@ApiTags('Aulas')
@ApiAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
    enum: ['AGENDADA', 'ENCERRADA', 'CANCELADA', 'EM_ANDAMENTO'],
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
