import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { DatabaseService } from '../../database/database.service';
import { CheckinResponseDto } from '../checkin/dtos/checkin-response.dto';
import { DecisaoPendenciaLoteDto } from './dtos/decisao-pendencia-lote.dto';
import { DecisaoPendenciaDto } from './dtos/decisao-pendencia.dto';
import { HistoricoPresencaDto } from './dtos/historico-presenca.dto';
import { PresencaPendenteDto } from './dtos/presenca-pendente.dto';

export type CurrentUser = {
  id: string;
  role: UserRole;
  roles: UserRole[];
  academiaId: string;
};

type PendenciaRow = {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  aula_id: string;
  status: string;
  turma_nome: string;
  data_inicio: string;
  origem: 'MANUAL' | 'QR_CODE' | 'SISTEMA';
  criado_em: string;
};

type PresencaRow = {
  id: string;
  academia_id: string;
  aula_id: string;
  aluno_id: string;
  status: string;
  origem: 'MANUAL' | 'QR_CODE' | 'SISTEMA';
  criado_em: string;
  registrado_por: string | null;
  aprovacao_status: 'PENDENTE' | 'APROVADA' | 'REJEITADA';
};

@Injectable()
export class PresencasService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listarPendencias(
    currentUser: CurrentUser,
    filtros?: { date?: string; from?: string; to?: string },
  ): Promise<{ total: number; itens: PresencaPendenteDto[] }> {
    const range = await this.resolveDateRange(filtros);

    const pendencias = await this.databaseService.query<PendenciaRow>(
      `
        select
          p.id,
          p.aluno_id,
          u.nome_completo as aluno_nome,
          p.aula_id,
          p.status,
          t.nome as turma_nome,
          a.data_inicio,
          p.origem,
          p.criado_em
        from presencas p
        join aulas a on a.id = p.aula_id
        join turmas t on t.id = a.turma_id
        join usuarios u on u.id = p.aluno_id
        where p.academia_id = $1
          and a.academia_id = $1
          and p.status = 'PENDENTE'
          and a.data_inicio >= $2
          and a.data_inicio < $3
        order by a.data_inicio asc, p.criado_em asc
        limit 100;
      `,
      [currentUser.academiaId, range.startUtc, range.endUtc],
    );

    return {
      total: pendencias.length,
      itens: pendencias.map((row) => ({
        id: row.id,
        alunoId: row.aluno_id,
        alunoNome: row.aluno_nome,
        aulaId: row.aula_id,
        turmaNome: row.turma_nome,
        dataInicio: new Date(row.data_inicio).toISOString(),
        origem: row.origem,
        status: row.status as PresencaPendenteDto['status'],
        criadoEm: new Date(row.criado_em).toISOString(),
      })),
    };
  }

  async decidir(
    id: string,
    dto: DecisaoPendenciaDto,
    currentUser: CurrentUser,
  ): Promise<CheckinResponseDto> {
    const presenca = await this.buscarPresenca(id);

    if (!presenca) {
      throw new NotFoundException('Presenca nao encontrada');
    }

    if (presenca.academia_id !== currentUser.academiaId) {
      throw new ForbiddenException('Presenca nao pertence a academia do usuario');
    }

    if (presenca.aprovacao_status !== 'PENDENTE') {
      throw new ConflictException('Presenca ja foi decidida');
    }

    const decisao = dto.decisao === 'APROVAR' ? 'APROVADA' : 'REJEITADA';

    const atualizada = await this.databaseService.queryOne<PresencaRow>(
      `
        update presencas
           set aprovacao_status = $1,
               aprovado_por = case when $1 = 'APROVADA' then $2 else null end,
               aprovado_em = case when $1 = 'APROVADA' then now() else null end,
               rejeitado_por = case when $1 = 'REJEITADA' then $2 else null end,
               rejeitado_em = case when $1 = 'REJEITADA' then now() else null end,
               aprovacao_observacao = $3
         where id = $4
           and academia_id = $5
         returning id, aula_id, aluno_id, status, origem, criado_em, registrado_por, aprovacao_status;
      `,
      [
        decisao,
        currentUser.id,
        dto.observacao ?? null,
        id,
        currentUser.academiaId,
      ],
    );

    if (!atualizada) {
      throw new NotFoundException('Presenca nao encontrada');
    }

    return this.mapPresencaResponse(atualizada, currentUser.id);
  }

  async decidirLote(
    dto: DecisaoPendenciaLoteDto,
    currentUser: CurrentUser,
  ): Promise<{
    totalProcessados: number;
    aprovados: number;
    rejeitados: number;
    ignorados: number;
  }> {
    const decisao = dto.decisao === 'APROVAR' ? 'APROVADA' : 'REJEITADA';

    const result = await this.databaseService.queryOne<{
      aprovados: number;
      rejeitados: number;
      ignorados: number;
    }>(
      `
        with selecionadas as (
          select id
          from presencas
          where id = any($1::uuid[])
            and academia_id = $2
            and aprovacao_status = 'PENDENTE'
        ),
        atualizadas as (
          update presencas p
             set aprovacao_status = $3,
                 aprovado_por = case when $3 = 'APROVADA' then $4 else null end,
                 aprovado_em = case when $3 = 'APROVADA' then now() else null end,
                 rejeitado_por = case when $3 = 'REJEITADA' then $4 else null end,
                 rejeitado_em = case when $3 = 'REJEITADA' then now() else null end,
                 aprovacao_observacao = $5
           where p.id in (select id from selecionadas)
           returning aprovacao_status
        )
        select
          sum(case when aprovacao_status = 'APROVADA' then 1 else 0 end)::int as aprovados,
          sum(case when aprovacao_status = 'REJEITADA' then 1 else 0 end)::int as rejeitados,
          0::int as ignorados
        from atualizadas;
      `,
      [dto.ids, currentUser.academiaId, decisao, currentUser.id, dto.observacao ?? null],
    );

    const totalProcessados =
      (result?.aprovados ?? 0) + (result?.rejeitados ?? 0);
    return {
      totalProcessados,
      aprovados: result?.aprovados ?? 0,
      rejeitados: result?.rejeitados ?? 0,
      ignorados: dto.ids.length - totalProcessados,
    };
  }

  async historicoDoAluno(
    alunoId: string,
    currentUser: CurrentUser,
    filters?: { from?: string; to?: string; limit?: number },
  ): Promise<HistoricoPresencaDto[]> {
    await this.ensureAlunoScope(alunoId, currentUser);

    const whereClauses = [
      'p.aluno_id = $1',
      'p.academia_id = $2',
      'a.academia_id = $2',
      "p.aprovacao_status = 'APROVADA'",
    ];
    const params: (string | number)[] = [alunoId, currentUser.academiaId];
    let paramIndex = params.length;

    const fromDate = this.parseDateFilter(filters?.from, 'from');
    if (fromDate) {
      paramIndex += 1;
      whereClauses.push(`a.data_inicio::date >= $${paramIndex}`);
      params.push(fromDate);
    }

    const toDate = this.parseDateFilter(filters?.to, 'to');
    if (toDate) {
      paramIndex += 1;
      whereClauses.push(`a.data_inicio::date <= $${paramIndex}`);
      params.push(toDate);
    }

    const limit = Math.min(filters?.limit ?? 50, 100);
    params.push(limit);
    paramIndex += 1;

    const historico = await this.databaseService.query<{
      id: string;
      aula_id: string;
      data_inicio: string;
      turma_nome: string;
      tipo_treino: string | null;
      status: string;
      origem: 'MANUAL' | 'QR_CODE' | 'SISTEMA';
      criado_em: string;
    }>(
      `
        select
          p.id,
          p.aula_id,
          a.data_inicio,
          t.nome as turma_nome,
          tt.nome as tipo_treino,
          p.status,
          p.origem,
          p.criado_em
        from presencas p
        join aulas a on a.id = p.aula_id
        join turmas t on t.id = a.turma_id
        left join tipos_treino tt on tt.id = t.tipo_treino_id
        where ${whereClauses.join(' and ')}
        order by a.data_inicio desc
        limit $${paramIndex};
      `,
      params,
    );

    return historico.map((row) => ({
      presencaId: row.id,
      aulaId: row.aula_id,
      dataInicio: new Date(row.data_inicio).toISOString(),
      turmaNome: row.turma_nome,
      tipoTreino: row.tipo_treino ?? null,
      status: row.status as HistoricoPresencaDto['status'],
      origem: row.origem,
      aprovacaoStatus: 'APROVADA',
    }));
  }

  private async resolveDateRange(filters?: {
    date?: string;
    from?: string;
    to?: string;
  }): Promise<{ startUtc: Date; endUtc: Date }> {
    const tz = this.databaseService.getAppTimezone();

    const hasFrom = !!filters?.from;
    const hasTo = !!filters?.to;

    if (hasFrom !== hasTo) {
      throw new BadRequestException('from e to devem ser enviados juntos');
    }

    if (hasFrom && filters?.from && filters?.to) {
      const from = new Date(filters.from);
      const to = new Date(filters.to);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new BadRequestException('from/to invalidos');
      }
      if (from.getTime() >= to.getTime()) {
        throw new BadRequestException('from deve ser menor que to');
      }
      return { startUtc: from, endUtc: to };
    }

    if (filters?.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
        throw new BadRequestException('date deve estar no formato YYYY-MM-DD');
      }
      return this.databaseService.getDayBoundsUtc(filters.date, tz);
    }

    return this.databaseService.getTodayBoundsUtc(tz);
  }

  private async ensureAlunoScope(
    alunoId: string,
    currentUser: CurrentUser,
  ): Promise<void> {
    if (currentUser.role === UserRole.ALUNO && currentUser.id !== alunoId) {
      throw new ForbiddenException('Aluno so pode acessar o proprio historico');
    }

    const vinculo = await this.databaseService.queryOne<{ academia_id: string }>(
      `
        select academia_id
        from usuarios_papeis
        where usuario_id = $1
          and academia_id = $2
        union
        select academia_id
        from matriculas
        where usuario_id = $1
          and academia_id = $2
        limit 1;
      `,
      [alunoId, currentUser.academiaId],
    );

    if (vinculo) {
      return;
    }

    const existeAluno = await this.databaseService.queryOne<{ id: string }>(
      `select id from usuarios where id = $1 limit 1;`,
      [alunoId],
    );

    if (!existeAluno) {
      throw new NotFoundException('Aluno nao encontrado');
    }

    throw new ForbiddenException('Aluno pertence a outra academia');
  }

  private parseDateFilter(
    value?: string,
    field: 'from' | 'to' = 'from',
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Parametro ${field} invalido`);
    }

    return value;
  }

  private async buscarPresenca(id: string): Promise<PresencaRow | null> {
    return this.databaseService.queryOne<PresencaRow>(
      `
        select
          id,
          academia_id,
          aula_id,
          aluno_id,
          status,
          origem,
          criado_em,
          registrado_por,
          aprovacao_status
        from presencas
        where id = $1
        limit 1;
      `,
      [id],
    );
  }

  private mapPresencaResponse(
    presenca: PresencaRow,
    registradoPor?: string,
  ): CheckinResponseDto {
    return {
      id: presenca.id,
      aulaId: presenca.aula_id,
      alunoId: presenca.aluno_id,
      status: presenca.status as CheckinResponseDto['status'],
      origem: presenca.origem,
      criadoEm: new Date(presenca.criado_em).toISOString(),
      registradoPor: registradoPor ?? presenca.registrado_por ?? undefined,
      aprovacaoStatus: presenca.aprovacao_status,
    };
  }
}
