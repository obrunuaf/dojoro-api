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

  // Stats de engajamento
  @ApiProperty({ description: 'Total de treinos no mês atual' })
  treinosMes: number;

  @ApiProperty({ description: 'Frequência percentual no mês (0-100)' })
  frequenciaMes: number;

  @ApiProperty({ description: 'Semanas consecutivas com treino' })
  semanasConsecutivas: number;

  // Progresso da faixa (total desde início na faixa atual)
  @ApiProperty({ description: 'Total de aulas desde que entrou na faixa atual' })
  aulasNaFaixaAtual: number;

  @ApiProperty({ description: 'Meta de aulas para próxima faixa' })
  metaAulasFaixa: number;
}
