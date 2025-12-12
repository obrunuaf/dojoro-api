import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ListAulasQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  turmaId?: string;

  @ApiPropertyOptional({ description: 'Data/hora inicial (ISO)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Data/hora final (ISO)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: ['AGENDADA', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA'],
  })
  @IsOptional()
  @IsIn(['AGENDADA', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Inclui aulas deletadas (somente staff)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
  })
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    description: 'Retorna apenas aulas deletadas (somente staff)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
  })
  onlyDeleted?: boolean;
}
