import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ 
    example: '1990-05-15',
    description: 'Data de nascimento no formato ISO (YYYY-MM-DD)'
  })
  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @ApiPropertyOptional({ 
    example: '+5511999999999',
    description: 'Telefone com código do país'
  })
  @IsOptional()
  @IsString()
  telefone?: string;
}
