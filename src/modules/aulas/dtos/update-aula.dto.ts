import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class UpdateAulaDto {
  @ApiPropertyOptional({ description: 'Data/hora de inicio (ISO)' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Data/hora de fim (ISO)' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({
    enum: ['AGENDADA', 'ENCERRADA', 'CANCELADA'],
  })
  @IsOptional()
  @IsIn(['AGENDADA', 'ENCERRADA', 'CANCELADA'])
  status?: string;

  @ApiPropertyOptional({ description: 'ID do instrutor designado para esta aula' })
  @IsOptional()
  @IsUUID()
  instrutorId?: string;
}

