import { ApiProperty } from '@nestjs/swagger';

export class PresencaPendenteDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  alunoId: string;

  @ApiProperty()
  alunoNome: string;

  @ApiProperty()
  aulaId: string;

  @ApiProperty()
  turmaNome: string;

  @ApiProperty()
  dataInicio: string;

  @ApiProperty()
  origem: 'MANUAL' | 'QR_CODE' | 'SISTEMA';

  @ApiProperty()
  status: 'PENDENTE';

  @ApiProperty()
  criadoEm: string;

  @ApiProperty({ required: false, nullable: true })
  decididoEm?: string | null;

  @ApiProperty({ required: false, nullable: true })
  decididoPor?: string | null;

  @ApiProperty({ required: false, nullable: true })
  decisaoObservacao?: string | null;

  @ApiProperty({ required: false })
  updatedAt?: string;
}
