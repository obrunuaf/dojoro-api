import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/user-role.enum';

export class MeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ type: [String], enum: UserRole })
  roles: UserRole[];

  @ApiProperty()
  academiaId: string;

  @ApiProperty()
  academiaNome: string;

  @ApiProperty({ nullable: true })
  faixaAtual: string | null;

  @ApiProperty({ nullable: true })
  grauAtual: number | null;

  @ApiProperty({ nullable: true })
  matriculaStatus: string | null;

  @ApiProperty({ nullable: true })
  matriculaDataInicio: string | null;

  @ApiProperty({ nullable: true })
  matriculaDataFim: string | null;

  @ApiProperty({ description: 'True if data_nascimento is set' })
  profileComplete: boolean;
}
