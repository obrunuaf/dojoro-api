import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class UpdatePapeisDto {
  @ApiProperty({
    description: 'Lista de papéis do usuário',
    example: ['ALUNO', 'INSTRUTOR'],
    enum: ['ALUNO', 'INSTRUTOR', 'PROFESSOR', 'ADMIN', 'TI'],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Pelo menos um papel é obrigatório' })
  @IsString({ each: true })
  papeis: string[];
}
