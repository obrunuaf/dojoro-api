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
import { CreateInviteDto } from './dtos/create-invite.dto';
import { InviteDto } from './dtos/invite.dto';
import { InvitesService } from './invites.service';

@ApiTags('Invites')
@ApiAuth()
@UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard)
@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Gera convite para onboarding' })
  @ApiCreatedResponse({ type: InviteDto })
  async criar(@Body() dto: CreateInviteDto): Promise<InviteDto> {
    return this.invitesService.criar(dto);
  }
}
