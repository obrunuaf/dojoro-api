import { ApiProperty } from '@nestjs/swagger';

export class CheckinDisponivelDto {
  @ApiProperty()
  aulaId: string;

  @ApiProperty()
  turmaNome: string;

  @ApiProperty()
  dataInicio: string;

  @ApiProperty()
  dataFim: string;

  @ApiProperty({ required: false, nullable: true })
  tipoTreino: string | null;

  @ApiProperty({ required: false, nullable: true })
  tipoTreinoCor: string | null;

  @ApiProperty()
  statusAula: string;

  @ApiProperty({ required: false, nullable: true })
  instrutorId: string | null;

  @ApiProperty({ required: false, nullable: true })
  instrutorNome: string | null;

  @ApiProperty({ description: 'Indica se ja existe presenca para o aluno na aula' })
  jaFezCheckin: boolean;
}
