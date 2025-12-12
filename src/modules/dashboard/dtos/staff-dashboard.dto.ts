import { ApiProperty } from '@nestjs/swagger';

export class StaffDashboardDto {
  @ApiProperty()
  alunosAtivos: number;

  @ApiProperty()
  aulasHoje: number;

  @ApiProperty()
  presencasHoje: number;

  @ApiProperty()
  faltasHoje: number;
}
