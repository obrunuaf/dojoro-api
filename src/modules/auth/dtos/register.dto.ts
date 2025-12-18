import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: 'Nome completo do usuario' })
  @ValidateIf((dto) => !dto.nome)
  @IsString()
  nomeCompleto: string;

  @ApiPropertyOptional({
    description: 'Alias legado para nome completo',
  })
  @ValidateIf((dto) => !dto.nomeCompleto)
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  senha: string;

  @ApiProperty({
    description: 'Codigo de convite no formato DOJ-XXXXXX',
  })
  @IsString()
  codigoConvite: string;

  @ApiProperty({
    description: 'Confirma que o usuario aceitou os termos',
  })
  @IsBoolean()
  aceitouTermos: boolean;
}
