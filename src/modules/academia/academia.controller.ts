import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiaStatusGuard } from '../../common/guards/academia-status.guard';
import { AcademiaService } from './academia.service';
import { AcademiaResponseDto } from './dtos/academia-response.dto';
import { UpdateAcademiaDto } from './dtos/update-academia.dto';

@ApiTags('Academia')
@ApiAuth()
@UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard)
@Controller('academia')
export class AcademiaController {
  constructor(private readonly academiaService: AcademiaService) {}

  @Get('me')
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Retorna dados da academia do usuario autenticado' })
  @ApiOkResponse({ type: AcademiaResponseDto })
  async getAcademia(
    @CurrentUser() user: { id: string; academiaId: string },
  ): Promise<AcademiaResponseDto> {
    return this.academiaService.getAcademia(user);
  }

  @Patch('me')
  @Roles(UserRole.ADMIN, UserRole.TI)
  @ApiOperation({ summary: 'Atualiza dados da academia' })
  @ApiOkResponse({ type: AcademiaResponseDto })
  async updateAcademia(
    @Body() dto: UpdateAcademiaDto,
    @CurrentUser() user: { id: string; academiaId: string },
  ): Promise<AcademiaResponseDto> {
    return this.academiaService.updateAcademia(dto, user);
  }
}
