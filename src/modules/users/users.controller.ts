import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UsersService, ProfileResponseDto } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Atualiza perfil do usuario autenticado' })
  @ApiOkResponse({
    schema: {
      properties: {
        id: { type: 'string' },
        telefone: { type: 'string', nullable: true },
        dataNascimento: { type: 'string', nullable: true },
        profileComplete: { type: 'boolean' },
      },
    },
  })
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser()
    user: {
      id: string;
      email: string;
      academiaId: string;
    },
  ): Promise<ProfileResponseDto> {
    return this.usersService.updateProfile(dto, user);
  }
}
