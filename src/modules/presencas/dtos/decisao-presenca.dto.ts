import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const DECISAO_VALUES = ['APROVAR', 'REJEITAR', 'PRESENTE', 'FALTA'] as const;
export type DecisaoInput = (typeof DECISAO_VALUES)[number];

export class DecisaoPresencaDto {
  @ApiProperty({
    enum: DECISAO_VALUES,
    description:
      'APROVAR/PRESENTE -> status=PRESENTE; REJEITAR/FALTA -> status=FALTA',
  })
  @IsIn(DECISAO_VALUES as unknown as string[])
  decisao: DecisaoInput;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacao?: string;
}
