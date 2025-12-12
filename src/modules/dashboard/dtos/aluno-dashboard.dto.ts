import { ApiProperty } from '@nestjs/swagger';

export class AlunoDashboardDto {
  @ApiProperty({ nullable: true, format: 'uuid' })
  proximaAulaId: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  proximaAulaHorario: string | null;

  @ApiProperty({ nullable: true })
  proximaAulaTurma: string | null;

  @ApiProperty()
  aulasNoGrauAtual: number;

  @ApiProperty()
  metaAulas: number;

  @ApiProperty({ description: 'Percentual 0-100' })
  progressoPercentual: number;

  @ApiProperty()
  statusMatricula: string;
}
