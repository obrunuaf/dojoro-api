import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HomeResponseDto {
  @ApiProperty({ enum: ['ALUNO', 'STAFF'] })
  mode: 'ALUNO' | 'STAFF';

  @ApiProperty({
    example: {
      id: 'user-id',
      nome: 'Aluno Seed',
      email: 'aluno.seed@example.com',
      role: 'ALUNO',
      roles: ['ALUNO'],
      academiaId: 'academia-id',
      academiaNome: 'Academia Seed Dojoro',
      faixaAtual: 'azul',
      grauAtual: 1,
      matriculaStatus: 'ATIVA',
      matriculaDataInicio: '2025-06-01',
      matriculaDataFim: null,
    },
  })
  me: any;

  @ApiPropertyOptional({
    description: 'Bloco para modo ALUNO',
  })
  aluno?: any;

  @ApiPropertyOptional({
    description: 'Bloco para modo STAFF',
  })
  staff?: any;
}
