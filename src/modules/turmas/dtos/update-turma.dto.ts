import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

const DAYS_RANGE = [0, 1, 2, 3, 4, 5, 6];

export class UpdateTurmaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({
    description: 'Codigo do tipo de treino (ex.: gi, nogi, kids)',
    example: 'nogi',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tipoTreinoId?: string;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Dias da semana (0=Domingo ... 6=Sabado)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(DAYS_RANGE, { each: true })
  diasSemana?: number[];

  @ApiPropertyOptional({ description: 'Horário de início HH:MM', example: '18:00' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'horaInicio deve estar no formato HH:MM',
  })
  horaInicio?: string;

  @ApiPropertyOptional({ description: 'Horário de término HH:MM', example: '19:00' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'horaFim deve estar no formato HH:MM',
  })
  horaFim?: string;

  @ApiPropertyOptional({ description: 'UUID do instrutor padrao' })
  @IsOptional()
  @IsUUID()
  instrutorPadraoId?: string | null;

  @ApiPropertyOptional({ 
    description: 'Se true, aplica alterações de horário às aulas agendadas futuras',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  atualizarAulasFuturas?: boolean;
}
