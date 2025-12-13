import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class PendenciasQueryDto {
  @ApiPropertyOptional({
    description: 'Dia de referencia (YYYY-MM-DD). Se ausente, usa hoje no APP_TIMEZONE.',
    example: '2025-12-12',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date deve estar no formato YYYY-MM-DD',
  })
  date?: string;

  @ApiPropertyOptional({
    description:
      'Inicio do range em ISO. So e considerado se "to" tambem for enviado.',
    example: '2025-12-12T03:00:00.000Z',
  })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Fim do range em ISO. So e considerado se "from" tambem for enviado.',
    example: '2025-12-13T03:00:00.000Z',
  })
  @IsOptional()
  to?: string;
}
