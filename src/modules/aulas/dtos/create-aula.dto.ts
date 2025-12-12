import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateAulaDto {
  @ApiProperty({ description: 'UUID da turma' })
  @IsUUID()
  turmaId: string;

  @ApiProperty({ description: 'Data/hora de inicio (ISO)' })
  @IsDateString()
  dataInicio: string;

  @ApiProperty({ description: 'Data/hora de fim (ISO)' })
  @IsDateString()
  dataFim: string;

  @ApiPropertyOptional({
    enum: ['AGENDADA', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA'],
    default: 'AGENDADA',
  })
  @IsOptional()
  @IsIn(['AGENDADA', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA'])
  status?: string;
}
