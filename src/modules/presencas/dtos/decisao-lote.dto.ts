import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { DECISAO_VALUES, DecisaoInput } from './decisao-presenca.dto';

export class DecisaoLoteDto {
  @ApiProperty({ type: [String], description: 'IDs das presencas' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

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
