import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AcademiaStatusGuard } from '../../common/guards/academia-status.guard';
import { HomeResponseDto } from './dtos/home-response.dto';
import { HomeQueryDto } from './dtos/home-query.dto';
import { HomeService } from './home.service';

@ApiTags('Home')
@ApiAuth()
@UseGuards(JwtAuthGuard, AcademiaStatusGuard, RolesGuard)
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @ApiOperation({
    summary: 'Home agregada (modo aluno ou staff)',
    description:
      'Retorna um payload unico com dados de home. Modo padrao: STAFF se houver papel staff, senao ALUNO. Override via ?mode=aluno|staff respeitando os papeis do token.',
  })
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['aluno', 'staff'],
    description:
      'Opcional. Default: STAFF se o token tiver papel staff; senao ALUNO. Override exige o papel correspondente.',
  })
  @ApiOkResponse({ type: HomeResponseDto })
  async getHome(
    @CurrentUser()
    user: {
      id: string;
      email: string;
      role: UserRole;
      roles: UserRole[];
      academiaId: string;
    },
    @Query() query: HomeQueryDto,
  ): Promise<HomeResponseDto> {
    return this.homeService.getHome(user, query.mode);
  }
}
