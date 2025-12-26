import { ApiProperty } from '@nestjs/swagger';

export class TurmaAlertaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  tipoTreino: string;

  @ApiProperty({ nullable: true })
  tipoTreinoCor: string | null;

  @ApiProperty()
  ultimaAula: string;

  @ApiProperty()
  diasRestantes: number;

  @ApiProperty()
  totalAulasFuturas: number;
}
