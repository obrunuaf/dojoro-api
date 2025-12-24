import { ApiProperty } from '@nestjs/swagger';

export class AulaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  dataInicio: string;

  @ApiProperty()
  dataFim: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  turmaId: string;

  @ApiProperty()
  turmaNome: string;

  @ApiProperty()
  turmaHorarioPadrao: string;

  @ApiProperty()
  tipoTreino: string;

  @ApiProperty({ nullable: true, description: 'ID do instrutor da turma' })
  instrutorId: string | null;

  @ApiProperty({ nullable: true })
  instrutorNome: string | null;

  @ApiProperty({ description: 'Número de alunos com presença confirmada' })
  presentes: number;
}

