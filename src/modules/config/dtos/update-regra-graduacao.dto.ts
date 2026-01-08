import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateRegraGraduacaoDto {
  @ApiProperty({ description: 'Número mínimo de aulas para graduação' })
  @IsNumber()
  @Min(0)
  aulasMinimas: number;

  @ApiProperty({ description: 'Tempo mínimo em meses na faixa' })
  @IsNumber()
  @Min(0)
  tempoMinimoMeses: number;

  @ApiProperty({ description: 'Meta de aulas por grau' })
  @IsNumber()
  @Min(0)
  metaAulasNoGrau: number;

  @ApiPropertyOptional({ description: 'Frequência mínima semanal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  frequenciaMinimaSemal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
