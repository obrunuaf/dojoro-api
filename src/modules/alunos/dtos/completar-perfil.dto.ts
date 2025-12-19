import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CompletarPerfilDto {
  @ApiProperty({ description: 'Data de nascimento', example: '1997-05-15' })
  @IsDateString()
  @IsNotEmpty()
  dataNascimento: string;

  @ApiProperty({ description: 'Sexo', example: 'M', enum: ['M', 'F'] })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[MF]$/, { message: 'Sexo deve ser M ou F' })
  sexo: string;

  @ApiProperty({ description: 'Telefone com DDD', example: '11999998888' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10,11}$/, { message: 'Telefone deve ter 10 ou 11 dígitos' })
  telefone: string;

  @ApiProperty({ 
    description: 'Faixa declarada pelo aluno (pendente confirmação)', 
    example: 'branca',
    enum: ['branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta', 'coral', 'vermelha']
  })
  @IsString()
  @IsNotEmpty()
  faixaDeclarada: string;

  @ApiPropertyOptional({ description: 'URL da foto de perfil' })
  @IsOptional()
  @IsString()
  fotoUrl?: string;
}
