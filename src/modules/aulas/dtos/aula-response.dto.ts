import { ApiProperty } from '@nestjs/swagger';

export class AulaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  turmaId: string;

  @ApiProperty()
  turmaNome: string;

  @ApiProperty()
  dataInicio: string;

  @ApiProperty()
  dataFim: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  tipoTreino: string;

  @ApiProperty({ nullable: true })
  instrutorNome: string | null;

  @ApiProperty({ nullable: true })
  deletedAt: string | null;
}
