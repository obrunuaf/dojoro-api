import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GraduacaoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  alunoId: string;

  @ApiProperty()
  alunoNome: string;

  @ApiProperty()
  faixaAnterior: string;

  @ApiProperty()
  grauAnterior: number;

  @ApiProperty()
  faixaNova: string;

  @ApiProperty()
  grauNovo: number;

  @ApiProperty()
  dataGraduacao: string;

  @ApiProperty()
  professorId: string;

  @ApiProperty()
  professorNome: string;

  @ApiPropertyOptional()
  observacoes?: string;

  @ApiPropertyOptional()
  aulaVinculadaId?: string;

  @ApiProperty({ description: 'Status: PENDENTE, CONFIRMADA, CANCELADA' })
  status: string;
}
