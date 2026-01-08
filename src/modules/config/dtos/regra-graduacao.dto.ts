import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegraGraduacaoDto {
  @ApiProperty({ description: 'Slug da faixa (ex: branca, azul)' })
  faixaSlug: string;

  @ApiProperty({ description: 'Nome legível da faixa' })
  faixaNome: string;

  @ApiProperty({ description: 'Categoria da faixa (ADULTO, INFANTIL, HONORIFICA)' })
  categoria: string;

  @ApiProperty({ description: 'Número máximo de graus para esta faixa' })
  grausMaximos: number;

  @ApiProperty({ description: 'Se true, exibe todos os graus preenchidos (faixas honoríficas)' })
  exibirGrausPreenchidos: boolean;

  @ApiProperty({ description: 'Número mínimo de aulas para graduação' })
  aulasMinimas: number;

  @ApiProperty({ description: 'Tempo mínimo em meses na faixa' })
  tempoMinimoMeses: number;

  @ApiProperty({ description: 'Meta de aulas por grau' })
  metaAulasNoGrau: number;

  @ApiPropertyOptional({ description: 'Frequência mínima semanal' })
  frequenciaMinimaSemal?: number;

  @ApiPropertyOptional()
  observacoes?: string;
}
