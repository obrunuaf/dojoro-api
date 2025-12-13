import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HistoricoPresencaDto {
  @ApiProperty()
  presencaId: string;

  @ApiProperty()
  aulaId: string;

  @ApiProperty()
  dataInicio: string;

  @ApiProperty()
  turmaNome: string;

  @ApiProperty({ required: false, nullable: true })
  tipoTreino?: string | null;

  @ApiProperty({ enum: ['PRESENTE', 'FALTA', 'PENDENTE', 'JUSTIFICADA', 'AJUSTADO'] })
  status: 'PRESENTE' | 'FALTA' | 'PENDENTE' | 'JUSTIFICADA' | 'AJUSTADO';

  @ApiProperty({ enum: ['MANUAL', 'QR_CODE', 'SISTEMA'] })
  origem: 'MANUAL' | 'QR_CODE' | 'SISTEMA';

  @ApiPropertyOptional({
    enum: ['PENDENTE', 'APROVADA', 'REJEITADA'],
    description: 'Campo legado; decisoes finais refletem em status (PRESENTE/FALTA).',
  })
  aprovacaoStatus?: 'PENDENTE' | 'APROVADA' | 'REJEITADA';

  @ApiPropertyOptional()
  updatedAt?: string;

  @ApiPropertyOptional({ nullable: true })
  decididoEm?: string | null;

  @ApiPropertyOptional({ nullable: true })
  decididoPor?: string | null;

  @ApiPropertyOptional({ nullable: true })
  decisaoObservacao?: string | null;
}
