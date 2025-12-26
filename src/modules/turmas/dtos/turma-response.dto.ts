import { ApiProperty } from '@nestjs/swagger';

export class TurmaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  tipoTreino: string;

  @ApiProperty({ nullable: true, description: 'Cor do tipo de treino (#RRGGBB)' })
  tipoTreinoCor: string | null;

  @ApiProperty({
    type: [Number],
    description: 'Dias da semana (0=Domingo ... 6=Sabado)',
  })
  diasSemana: number[];

  @ApiProperty({ description: 'Horário de início no formato HH:MM' })
  horaInicio: string;

  @ApiProperty({ description: 'Horário de término no formato HH:MM' })
  horaFim: string;

  @ApiProperty({ description: 'Duração em minutos (calculado)' })
  duracaoMinutos: number;

  @ApiProperty({ nullable: true })
  instrutorPadraoId: string | null;

  @ApiProperty({ nullable: true })
  instrutorPadraoNome: string | null;

  @ApiProperty({ nullable: true, description: 'Data de delecao (soft-delete)' })
  deletedAt: string | null;
}
