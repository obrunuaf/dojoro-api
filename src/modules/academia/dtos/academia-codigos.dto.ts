import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcademiaCodigosDto {
  @ApiProperty({ description: 'Código público para signup self-service' })
  codigoSignup: string;

  @ApiPropertyOptional({ description: 'Código de convite (legacy)' })
  codigoConvite: string | null;

  @ApiProperty({ description: 'Data de criação do código atual' })
  criadoEm: string;
}

export class RotacionarCodigoResponseDto {
  @ApiProperty()
  codigoAnterior: string;

  @ApiProperty()
  codigoNovo: string;

  @ApiProperty()
  message: string;
}
