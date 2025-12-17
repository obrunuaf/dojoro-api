import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AcademiaResponseDto } from './dtos/academia-response.dto';
import { UpdateAcademiaDto } from './dtos/update-academia.dto';

type CurrentUser = {
  id: string;
  academiaId: string;
};

@Injectable()
export class AcademiaService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAcademia(user: CurrentUser): Promise<AcademiaResponseDto> {
    const academia = await this.databaseService.queryOne<{
      id: string;
      nome: string;
      codigo: string | null;
      codigo_convite: string | null;
      ativo: boolean;
      endereco: string | null;
      telefone: string | null;
      email: string | null;
      logo_url: string | null;
      criado_em: string;
    }>(
      `
        SELECT 
          id, nome, codigo, codigo_convite, ativo,
          endereco, telefone, email, logo_url, criado_em
        FROM academias
        WHERE id = $1
      `,
      [user.academiaId],
    );

    if (!academia) {
      throw new NotFoundException('Academia nao encontrada');
    }

    return {
      id: academia.id,
      nome: academia.nome,
      codigo: academia.codigo,
      codigoConvite: academia.codigo_convite,
      ativo: academia.ativo,
      endereco: academia.endereco,
      telefone: academia.telefone,
      email: academia.email,
      logoUrl: academia.logo_url,
      criadoEm: academia.criado_em,
    };
  }

  async updateAcademia(
    dto: UpdateAcademiaDto,
    user: CurrentUser,
  ): Promise<AcademiaResponseDto> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.nome !== undefined) {
      sets.push(`nome = $${idx++}`);
      params.push(dto.nome);
    }
    if (dto.ativo !== undefined) {
      sets.push(`ativo = $${idx++}`);
      params.push(dto.ativo);
    }
    if (dto.endereco !== undefined) {
      sets.push(`endereco = $${idx++}`);
      params.push(dto.endereco);
    }
    if (dto.telefone !== undefined) {
      sets.push(`telefone = $${idx++}`);
      params.push(dto.telefone);
    }
    if (dto.email !== undefined) {
      sets.push(`email = $${idx++}`);
      params.push(dto.email);
    }
    if (dto.logoUrl !== undefined) {
      sets.push(`logo_url = $${idx++}`);
      params.push(dto.logoUrl);
    }

    if (sets.length === 0) {
      // Nothing to update, just return current
      return this.getAcademia(user);
    }

    params.push(user.academiaId);

    await this.databaseService.query(
      `UPDATE academias SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    );

    return this.getAcademia(user);
  }
}
