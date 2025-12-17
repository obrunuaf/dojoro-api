import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiaStatusGuard } from '../../common/guards/academia-status.guard';
import { CreateGraduacaoDto } from './dtos/create-graduacao.dto';
import { GraduacaoDto } from './dtos/graduacao.dto';
import { GraduacoesService } from './graduacoes.service';

@ApiTags('Graduacoes')
@ApiAuth()
@UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard)
@Controller('graduacoes')
export class GraduacoesController {
  constructor(private readonly graduacoesService: GraduacoesService) {}

  @Post()
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Registra uma graduação' })
  @ApiCreatedResponse({ type: GraduacaoDto })
  async criar(@Body() dto: CreateGraduacaoDto): Promise<GraduacaoDto> {
    return this.graduacoesService.criar(dto);
  }
}
