import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiaStatusGuard } from '../../common/guards/academia-status.guard';
import { DashboardService } from './dashboard.service';
import { AlunoDashboardDto } from './dtos/aluno-dashboard.dto';
import { StaffDashboardDto } from './dtos/staff-dashboard.dto';

@ApiTags('Dashboard')
@ApiAuth()
@UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('aluno')
  @Roles(
    UserRole.ALUNO,
    UserRole.INSTRUTOR,
    UserRole.PROFESSOR,
    UserRole.ADMIN,
    UserRole.TI,
  )
  @ApiOperation({ summary: 'Dashboard do aluno (filtrado pela academia do token)' })
  @ApiOkResponse({ type: AlunoDashboardDto })
  async getAlunoDashboard(
    @CurrentUser()
    user: {
      id: string;
      email: string;
      role: UserRole;
      roles: UserRole[];
      academiaId: string;
    },
  ): Promise<AlunoDashboardDto> {
    return this.dashboardService.getAlunoDashboard(user);
  }

  @Get('staff')
  @Roles(UserRole.INSTRUTOR, UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Dashboard do staff (academia atual do token)' })
  @ApiOkResponse({ type: StaffDashboardDto })
  async getStaffDashboard(
    @CurrentUser()
    user: {
      id: string;
      email: string;
      role: UserRole;
      roles: UserRole[];
      academiaId: string;
    },
  ): Promise<StaffDashboardDto> {
    return this.dashboardService.getStaffDashboard(user);
  }
}
