import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateGraduacaoDto {
  @ApiProperty({ description: 'ID do aluno' })
  @IsUUID()
  alunoId: string;

  @ApiProperty({ description: 'Slug da faixa anterior' })
  @IsString()
  faixaAnterior: string;

  @ApiProperty({ description: 'Grau anterior (0-4)' })
  @IsNumber()
  @Min(0)
  grauAnterior: number;

  @ApiProperty({ description: 'Slug da nova faixa' })
  @IsString()
  faixaNova: string;

  @ApiProperty({ description: 'Novo grau (0-4)' })
  @IsNumber()
  @Min(0)
  grauNovo: number;

  @ApiProperty({ description: 'Data da graduação' })
  @IsDateString()
  dataGraduacao: string;

  @ApiProperty({ description: 'ID do professor que aplicou' })
  @IsUUID()
  professorId: string;

  @ApiPropertyOptional({ description: 'Observações opcionais' })
  @IsOptional()
  @IsString()
  observacoes?: string;

  @ApiPropertyOptional({ description: 'ID da aula vinculada (se graduação ocorreu durante aula)' })
  @IsOptional()
  @IsUUID()
  aulaVinculadaId?: string;

  @ApiPropertyOptional({ description: 'Indica se é graduação manual (sem regras automáticas)' })
  @IsOptional()
  @IsBoolean()
  manual?: boolean;

  @ApiPropertyOptional({ description: 'Justificativa para graduação manual (obrigatória quando manual=true)' })
  @IsOptional()
  @IsString()
  justificativa?: string;
}
