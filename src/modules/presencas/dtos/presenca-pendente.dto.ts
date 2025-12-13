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
}
