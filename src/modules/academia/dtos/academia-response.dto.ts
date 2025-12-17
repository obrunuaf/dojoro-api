import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcademiaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nome: string;

  @ApiPropertyOptional()
  codigo: string | null;

  @ApiPropertyOptional()
  codigoConvite: string | null;

  @ApiProperty()
  ativo: boolean;

  @ApiPropertyOptional()
  endereco: string | null;

  @ApiPropertyOptional()
  telefone: string | null;

  @ApiPropertyOptional()
  email: string | null;

  @ApiPropertyOptional()
  logoUrl: string | null;

  @ApiProperty()
  criadoEm: string;
}
