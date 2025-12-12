import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

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
    enum: ['AGENDADA', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA'],
  })
  @IsOptional()
  @IsIn(['AGENDADA', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA'])
  status?: string;
}
