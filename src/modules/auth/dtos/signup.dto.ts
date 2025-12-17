import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ description: 'Nome completo do usuario' })
  @IsString()
  nomeCompleto: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  senha: string;

  @ApiProperty({
    description: 'Codigo da academia (informado pelo professor)',
    example: 'ACADBJJ',
  })
  @IsString()
  codigoAcademia: string;

  @ApiProperty({ description: 'Confirma que o usuario aceitou os termos' })
  @IsBoolean()
  aceitouTermos: boolean;
}
