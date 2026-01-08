import { ApiProperty } from '@nestjs/swagger';

export class AptidaoDto {
  @ApiProperty()
  alunoId: string;

  @ApiProperty({ required: false })
  alunoNome?: string;

  @ApiProperty({ required: false })
  fotoUrl?: string;

  @ApiProperty({ required: false })
  matriculaStatus?: string;  // ATIVA, PENDENTE, SUSPENSA, CANCELADA

  @ApiProperty()
  faixaAtual: string;

  @ApiProperty()
  grauAtual: number;

  @ApiProperty()
  proximoPasso: string; // 'GRAU' ou 'FAIXA'

  @ApiProperty()
  faixaDestino: string;

  @ApiProperty()
  grauDestino: number;

  @ApiProperty()
  status: 'APTO' | 'PROXIMO' | 'BLOQUEADO';

  @ApiProperty()
  progressoPercentual: number;

  @ApiProperty({ type: [String] })
  motivos: string[];

  @ApiProperty()
  metricas: {
    aulasNoGrau: number;
    metaAulasNoGrau: number;
    aulasNaFaixa: number;
    metaAulasNaFaixa: number;
    mesesNaFaixa: number;
    metaMesesNaFaixa: number;
    frequenciaSemanal: number;
    metaFrequenciaSemanal: number;
  };
}
