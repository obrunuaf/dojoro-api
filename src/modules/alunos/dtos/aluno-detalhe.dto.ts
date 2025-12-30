import { ApiProperty } from '@nestjs/swagger';

export class AlunoDetalheDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  academiaId: string;

  @ApiProperty()
  academiaNome: string;

  @ApiProperty({ nullable: true, type: Number })
  matriculaNumero: number | null;

  @ApiProperty({ nullable: true })
  matriculaStatus: string | null;

  @ApiProperty({ nullable: true })
  matriculaDataInicio: string | null;

  @ApiProperty({ nullable: true })
  matriculaDataFim: string | null;

  @ApiProperty({ nullable: true })
  faixaAtual: string | null;

  @ApiProperty({ nullable: true })
  grauAtual: number | null;

  @ApiProperty({ nullable: true })
  faixaDeclarada: string | null;

  @ApiProperty({ nullable: true })
  telefone: string | null;

  @ApiProperty({ nullable: true })
  dataNascimento: string | null;

  @ApiProperty({ nullable: true })
  sexo: string | null;

  @ApiProperty()
  presencasTotais: number;

  @ApiProperty({ nullable: true })
  fotoUrl: string | null;

  @ApiProperty({ nullable: true })
  fotoCapaUrl: string | null;
}
