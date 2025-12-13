import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckinResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  aulaId: string;

  @ApiProperty()
  alunoId: string;

  @ApiProperty({ enum: ['PENDENTE', 'PRESENTE', 'FALTA', 'JUSTIFICADA', 'AJUSTADO'] })
  status: 'PENDENTE' | 'PRESENTE' | 'FALTA' | 'JUSTIFICADA' | 'AJUSTADO';

  @ApiPropertyOptional({
    enum: ['PENDENTE', 'APROVADA', 'REJEITADA'],
    description: 'Campo legado; decisoes finais refletem em status (PRESENTE/FALTA).',
  })
  aprovacaoStatus?: 'PENDENTE' | 'APROVADA' | 'REJEITADA';

  @ApiProperty({ enum: ['MANUAL', 'QR_CODE', 'SISTEMA'] })
  origem: 'MANUAL' | 'QR_CODE' | 'SISTEMA';

  @ApiProperty()
  criadoEm: string;

  @ApiProperty({ required: false })
  registradoPor?: string;

  @ApiPropertyOptional()
  updatedAt?: string;

  @ApiPropertyOptional({ nullable: true })
  decididoEm?: string | null;

  @ApiPropertyOptional({ nullable: true })
  decididoPor?: string | null;

  @ApiPropertyOptional({ nullable: true })
  decisaoObservacao?: string | null;
}
