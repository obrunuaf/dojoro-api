import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

const DAYS_RANGE = [0, 1, 2, 3, 4, 5, 6];

export class CreateTurmaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({
    description: 'Codigo do tipo de treino (ex.: gi, nogi, kids)',
    example: 'gi',
  })
  @IsString()
  @IsNotEmpty()
  tipoTreinoId: string;

  @ApiProperty({
    type: [Number],
    description: 'Dias da semana (0=Domingo ... 6=Sabado)',
    example: [1, 3],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(DAYS_RANGE, { each: true })
  diasSemana: number[];

  @ApiProperty({ description: 'Horário de início HH:MM', example: '18:00' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'horaInicio deve estar no formato HH:MM',
  })
  horaInicio: string;

  @ApiProperty({ description: 'Horário de término HH:MM', example: '19:00' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'horaFim deve estar no formato HH:MM',
  })
  horaFim: string;

  @ApiPropertyOptional({ description: 'UUID do instrutor padrao' })
  @IsOptional()
  @IsUUID()
  instrutorPadraoId?: string | null;
}
