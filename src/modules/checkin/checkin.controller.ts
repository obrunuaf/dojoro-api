import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser as CurrentUserDecorator } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiaStatusGuard } from '../../common/guards/academia-status.guard';
import { Throttle } from '@nestjs/throttler';
import { CheckinService, CurrentUser } from './checkin.service';
import { CheckinDisponivelDto } from './dtos/checkin-disponivel.dto';
import { CheckinResponseDto } from './dtos/checkin-response.dto';
import { CreateCheckinDto } from './dtos/create-checkin.dto';

@ApiTags('Checkin')
@ApiAuth()
@UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard)
@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Get('disponiveis')
  @Roles(UserRole.ALUNO)
  @ApiOperation({ summary: 'Lista aulas do dia para check-in' })
  @ApiOkResponse({ type: [CheckinDisponivelDto] })
  @Throttle({ default: { limit: 20, ttl: 60 } })
  async listarDisponiveis(
    @CurrentUserDecorator() user: CurrentUser,
  ): Promise<CheckinDisponivelDto[]> {
    return this.checkinService.listarDisponiveis(user);
  }

  @Post()
  @Roles(UserRole.ALUNO)
  @ApiOperation({ summary: 'Realiza check-in (manual ou QR)' })
  @ApiCreatedResponse({ type: CheckinResponseDto })
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async criarCheckin(
    @Body() dto: CreateCheckinDto,
    @CurrentUserDecorator() user: CurrentUser,
  ): Promise<CheckinResponseDto> {
    return this.checkinService.criarCheckin(dto, user);
  }
}
