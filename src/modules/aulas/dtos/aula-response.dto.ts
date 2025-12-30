import { ApiProperty } from '@nestjs/swagger';

export class AulaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  turmaId: string;

  @ApiProperty()
  turmaNome: string;

  @ApiProperty({ nullable: true })
  turmaHorarioPadrao: string | null;

  @ApiProperty({ type: [Number], nullable: true })
  turmaDiasSemana: number[] | null;

  @ApiProperty()
  dataInicio: string;

  @ApiProperty()
  dataFim: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  tipoTreino: string;

  @ApiProperty({ nullable: true })
  tipoTreinoCor: string | null;

  @ApiProperty({ nullable: true })
  instrutorId: string | null;

  @ApiProperty({ nullable: true })
  instrutorPadraoId: string | null;

  @ApiProperty({ nullable: true })
  instrutorNome: string | null;

  @ApiProperty({ nullable: true })
  qrToken: string | null;

  @ApiProperty({ nullable: true })
  qrExpiresAt: string | null;

  @ApiProperty({ nullable: true })
  deletedAt: string | null;

  @ApiProperty({ description: 'Número de alunos presentes', required: false })
  presentes?: number;

  @ApiProperty({ description: 'Status do check-in do usuário atual', required: false, nullable: true })
  meuCheckin?: string | null;
}
