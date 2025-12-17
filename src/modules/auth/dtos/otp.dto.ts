import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: 'Código OTP de 6 dígitos' })
  @IsString()
  @Length(6, 6)
  codigo: string;
}

export class VerifyOtpResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;
}

export class ResetPasswordWithOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: 'Código OTP de 6 dígitos' })
  @IsString()
  @Length(6, 6)
  codigo: string;

  @ApiProperty({ example: 'NovaSenha123', minLength: 6 })
  @IsString()
  @MinLength(6)
  novaSenha: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({ example: 'Se o email existir, um código foi enviado.' })
  message: string;

  @ApiPropertyOptional({ 
    description: 'OTP retornado apenas em ambiente dev/test',
    example: '123456'
  })
  devOtp?: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({ example: 'Senha redefinida com sucesso.' })
  message: string;
}
