import { Injectable } from '@nestjs/common';
import { AuthRepository } from '../auth/auth.repository';
import { UpdateProfileDto } from './dtos/update-profile.dto';

type CurrentUser = {
  id: string;
  email: string;
  academiaId: string;
};

export type ProfileResponseDto = {
  id: string;
  telefone: string | null;
  dataNascimento: string | null;
  profileComplete: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly authRepository: AuthRepository) {}

  async updateProfile(
    dto: UpdateProfileDto,
    currentUser: CurrentUser,
  ): Promise<ProfileResponseDto> {
    const updated = await this.authRepository.updateUserProfile(
      currentUser.id,
      {
        telefone: dto.telefone,
        dataNascimento: dto.dataNascimento,
      },
    );

    return {
      id: updated.id,
      telefone: updated.telefone,
      dataNascimento: updated.data_nascimento,
      profileComplete: this.isProfileComplete(updated),
    };
  }

  private isProfileComplete(user: {
    telefone: string | null;
    data_nascimento: string | null;
  }): boolean {
    // Profile is complete if birthdate is set
    return user.data_nascimento !== null;
  }
}
