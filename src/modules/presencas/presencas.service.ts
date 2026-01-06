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
import { DecisaoLoteDto } from './dtos/decisao-lote.dto';
import { DecisaoInput, DecisaoPresencaDto } from './dtos/decisao-presenca.dto';
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
  decidido_em?: string | null;
  decidido_por?: string | null;
  observacao?: string | null;
  updated_at?: string | null;
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
  aprovacao_status?: 'PENDENTE' | 'APROVADA' | 'REJEITADA';
  aprovado_por?: string | null;
  aprovado_em?: string | null;
  rejeitado_por?: string | null;
  rejeitado_em?: string | null;
  observacao?: string | null;
  decidido_por?: string | null;
  decidido_em?: string | null;
  updated_at?: string | null;
};

type PresencaAuditColumns = {
  aprovacaoStatus: boolean;
  aprovadoPor: boolean;
  aprovadoEm: boolean;
  rejeitadoPor: boolean;
  rejeitadoEm: boolean;
  observacao: boolean;
  decididoPor: boolean;
  decididoEm: boolean;
  updatedAt: boolean;
};

@Injectable()
export class PresencasService {
  constructor(private readonly databaseService: DatabaseService) {}

  private presencaAuditColumnsPromise?: Promise<PresencaAuditColumns>;

  /**
   * Retorna estatísticas de presença do usuário logado
   */
  async getStats(currentUser: CurrentUser): Promise<{
    treinosMes: number;
    treinosAno: number;
    sequencia: number;
    presencasTotais: number;
    ultimoTreino: string | null;
    mediaSemanal: number;
  }> {
    const tz = this.databaseService.getAppTimezone();
    
    // Query para calcular todas as métricas de uma vez
    const stats = await this.databaseService.queryOne<{
      treinos_mes: string;
      treinos_ano: string;
      presencas_totais: string;
      ultimo_treino: string | null;
      media_semanal: string;
    }>(`
      WITH presencas_aluno AS (
        SELECT DISTINCT a.data_inicio::date as data_aula
        FROM presencas p
        JOIN aulas a ON a.id = p.aula_id
        WHERE p.aluno_id = $1
          AND p.academia_id = $2
          AND p.status = 'PRESENTE'
      ),
      mes_atual AS (
        SELECT COUNT(*) as total
        FROM presencas_aluno
        WHERE data_aula >= date_trunc('month', CURRENT_DATE AT TIME ZONE $3)
          AND data_aula < date_trunc('month', CURRENT_DATE AT TIME ZONE $3) + interval '1 month'
      ),
      ano_atual AS (
        SELECT COUNT(*) as total
        FROM presencas_aluno
        WHERE data_aula >= date_trunc('year', CURRENT_DATE AT TIME ZONE $3)
          AND data_aula < date_trunc('year', CURRENT_DATE AT TIME ZONE $3) + interval '1 year'
      ),
      total_geral AS (
        SELECT COUNT(*) as total
        FROM presencas_aluno
      ),
      ultimo AS (
        SELECT MAX(data_aula) as data
        FROM presencas_aluno
      ),
      semanas AS (
        SELECT 
          GREATEST(1, EXTRACT(WEEK FROM CURRENT_DATE) - EXTRACT(WEEK FROM MIN(data_aula)) + 1) as num_semanas,
          COUNT(*) as total_presencas
        FROM presencas_aluno
        WHERE data_aula >= CURRENT_DATE - interval '12 weeks'
      )
      SELECT 
        COALESCE((SELECT total FROM mes_atual), 0) as treinos_mes,
        COALESCE((SELECT total FROM ano_atual), 0) as treinos_ano,
        COALESCE((SELECT total FROM total_geral), 0) as presencas_totais,
        (SELECT data FROM ultimo) as ultimo_treino,
        COALESCE(
          ROUND((SELECT total_presencas FROM semanas)::numeric / NULLIF((SELECT num_semanas FROM semanas), 0), 1),
          0
        ) as media_semanal
    `, [currentUser.id, currentUser.academiaId, tz]);

    // Calcular sequência de dias consecutivos
    const sequenciaRows = await this.databaseService.query<{ data_aula: string }>(`
      SELECT DISTINCT a.data_inicio::date as data_aula
      FROM presencas p
      JOIN aulas a ON a.id = p.aula_id
      WHERE p.aluno_id = $1
        AND p.academia_id = $2
        AND p.status = 'PRESENTE'
      ORDER BY data_aula DESC
      LIMIT 90
    `, [currentUser.id, currentUser.academiaId]);

    let sequencia = 0;
    if (sequenciaRows.length > 0) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      // Primeira data deve ser hoje ou ontem para contar sequência
      const primeiraData = new Date(sequenciaRows[0].data_aula);
      primeiraData.setHours(0, 0, 0, 0);
      
      const diffDias = Math.floor((hoje.getTime() - primeiraData.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias <= 1) {
        // Conta sequência
        sequencia = 1;
        for (let i = 1; i < sequenciaRows.length; i++) {
          const dataAnterior = new Date(sequenciaRows[i - 1].data_aula);
          const dataAtual = new Date(sequenciaRows[i].data_aula);
          const diff = Math.floor((dataAnterior.getTime() - dataAtual.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diff === 1) {
            sequencia++;
          } else {
            break;
          }
        }
      }
    }

    return {
      treinosMes: parseInt(stats?.treinos_mes ?? '0'),
      treinosAno: parseInt(stats?.treinos_ano ?? '0'),
      sequencia,
      presencasTotais: parseInt(stats?.presencas_totais ?? '0'),
      ultimoTreino: stats?.ultimo_treino ?? null,
      mediaSemanal: parseFloat(stats?.media_semanal ?? '0'),
    };
  }

  async listarPendencias(
    currentUser: CurrentUser,
    filtros?: { date?: string; from?: string; to?: string },
  ): Promise<{ total: number; itens: PresencaPendenteDto[] }> {
    const range = await this.resolveDateRange(filtros);
    const auditColumns = await this.getPresencaAuditColumns();

    const auditSelectParts: string[] = [];
    if (auditColumns.decididoEm) auditSelectParts.push('p.decidido_em');
    if (auditColumns.decididoPor) auditSelectParts.push('p.decidido_por');
    if (auditColumns.observacao)
      auditSelectParts.push('p.observacao');
    if (auditColumns.updatedAt) auditSelectParts.push('p.updated_at');
    const auditSelect =
      auditSelectParts.length > 0 ? `, ${auditSelectParts.join(', ')}` : '';

    // INSTRUTOR only sees pendencias from their own classes
    const isInstructorOnly = 
      currentUser.roles.includes(UserRole.INSTRUTOR) && 
      !currentUser.roles.includes(UserRole.PROFESSOR) &&
      !currentUser.roles.includes(UserRole.ADMIN) &&
      !currentUser.roles.includes(UserRole.TI);

    const instrutorFilter = isInstructorOnly 
      ? `and t.instrutor_padrao_id = $4` 
      : '';
    const params = isInstructorOnly
      ? [currentUser.academiaId, range.startUtc, range.endUtc, currentUser.id]
      : [currentUser.academiaId, range.startUtc, range.endUtc];

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
          ${auditSelect}
        from presencas p
        join aulas a on a.id = p.aula_id
        join turmas t on t.id = a.turma_id
        join usuarios u on u.id = p.aluno_id
        where p.academia_id = $1
          and a.academia_id = $1
          and p.status = 'PENDENTE'
          and a.data_inicio >= $2
          and a.data_inicio < $3
          ${instrutorFilter}
        order by a.data_inicio asc, p.criado_em asc
        limit 100;
      `,
      params,
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
        decididoEm: row.decidido_em ? new Date(row.decidido_em).toISOString() : null,
        decididoPor: row.decidido_por ?? null,
        decisaoObservacao:
          row.observacao ?? null,
        updatedAt: row.updated_at
          ? new Date(row.updated_at).toISOString()
          : undefined,
      })),
    };
  }

  async decidirPresenca(
    id: string,
    dto: DecisaoPresencaDto,
    currentUser: CurrentUser,
  ): Promise<CheckinResponseDto> {
    const auditColumns = await this.getPresencaAuditColumns();
    const presenca = await this.buscarPresenca(id, auditColumns);

    if (!presenca) {
      throw new NotFoundException('Presenca nao encontrada');
    }

    if (presenca.academia_id !== currentUser.academiaId) {
      throw new ForbiddenException('Presenca nao pertence a academia do usuario');
    }

    const decision = this.resolveDecision(dto.decisao);

    // Se já estiver com o status final desejado, não faz nada ou retorna conflito se quiser ser estrito
    if (presenca.status === decision.finalStatus) {
      throw new ConflictException(
        `Presenca ja esta com o status ${decision.finalStatus}`,
      );
    }

    const update = this.buildDecisionUpdate(
      dto.decisao,
      currentUser.id,
      auditColumns,
      dto.observacao,
    );

    const atualizada = await this.databaseService.queryOne<PresencaRow>(
      `
        update presencas p
           set ${update.setClause}
         where id = $${update.params.length + 1}
           and academia_id = $${update.params.length + 2}
         returning ${this.buildPresencaSelect(auditColumns, 'p')};
      `,
      [...update.params, id, currentUser.academiaId],
    );

    if (!atualizada) {
      throw new ConflictException('Presenca ja foi decidida');
    }

    return this.mapPresencaResponse(atualizada, currentUser.id);
  }

  async decidirLote(
    dto: DecisaoLoteDto,
    currentUser: CurrentUser,
  ): Promise<{
    processados: number;
    atualizados: string[];
    ignorados: { id: string; motivo: string }[];
  }> {
    const ids = Array.from(new Set(dto.ids));
    if (ids.length === 0) {
      return { processados: 0, atualizados: [], ignorados: [] };
    }

    const auditColumns = await this.getPresencaAuditColumns();
    const presencas = await this.databaseService.query<PresencaRow>(
      `
        select ${this.buildPresencaSelect(auditColumns)}
        from presencas p
        where p.id = any($1::uuid[]);
      `,
      [ids],
    );

    const presencaPorId = new Map(presencas.map((row) => [row.id, row]));
    const pendentes: string[] = [];
    const ignorados: { id: string; motivo: string }[] = [];

    for (const id of ids) {
      const presenca = presencaPorId.get(id);
      if (!presenca) {
        ignorados.push({ id, motivo: 'NAO_ENCONTRADA' });
        continue;
      }
      if (presenca.academia_id !== currentUser.academiaId) {
        ignorados.push({ id, motivo: 'FORA_DA_ACADEMIA' });
        continue;
      }
      const decision = this.resolveDecision(dto.decisao);
      if (presenca.status === decision.finalStatus) {
        ignorados.push({ id, motivo: `JA_${decision.finalStatus}` });
        continue;
      }
      pendentes.push(id);
    }

    const update = this.buildDecisionUpdate(
      dto.decisao,
      currentUser.id,
      auditColumns,
      dto.observacao,
    );

    const atualizadas =
      pendentes.length > 0
        ? await this.databaseService.query<PresencaRow>(
            `
              update presencas p
                 set ${update.setClause}
               where id = any($${update.params.length + 1}::uuid[])
                 and academia_id = $${update.params.length + 2}
               returning ${this.buildPresencaSelect(auditColumns, 'p')};
            `,
            [...update.params, pendentes, currentUser.academiaId],
          )
        : [];

    const atualizadosIds = new Set(atualizadas.map((row) => row.id));

    for (const id of pendentes) {
      if (!atualizadosIds.has(id)) {
        ignorados.push({ id, motivo: 'JA_DECIDIDA' });
      }
    }

    return {
      processados: atualizadosIds.size,
      atualizados: Array.from(atualizadosIds),
      ignorados,
    };
  }

  async historicoDoAluno(
    alunoId: string,
    currentUser: CurrentUser,
    filters?: { from?: string; to?: string; limit?: number },
  ): Promise<HistoricoPresencaDto[]> {
    await this.ensureAlunoScope(alunoId, currentUser);
    const auditColumns = await this.getPresencaAuditColumns();
    const auditSelectParts: string[] = [];
    if (auditColumns.decididoEm) auditSelectParts.push('p.decidido_em');
    if (auditColumns.decididoPor) auditSelectParts.push('p.decidido_por');
    if (auditColumns.observacao)
      auditSelectParts.push('p.observacao');
    if (auditColumns.updatedAt) auditSelectParts.push('p.updated_at');
    const auditSelect =
      auditSelectParts.length > 0 ? `, ${auditSelectParts.join(', ')}` : '';

    const whereClauses = [
      'p.aluno_id = $1',
      'p.academia_id = $2',
      'a.academia_id = $2',
      "p.status <> 'PENDENTE'",
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
      decidido_em?: string | null;
      decidido_por?: string | null;
      observacao?: string | null;
      updated_at?: string | null;
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
          ${auditSelect}
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
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      decididoEm: row.decidido_em
        ? new Date(row.decidido_em).toISOString()
        : undefined,
      decididoPor: row.decidido_por ?? undefined,
      decisaoObservacao:
        row.observacao ?? undefined,
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

  private async buscarPresenca(
    id: string,
    auditColumns?: PresencaAuditColumns,
  ): Promise<PresencaRow | null> {
    const columns = auditColumns ?? (await this.getPresencaAuditColumns());
    return this.databaseService.queryOne<PresencaRow>(
      `
        select ${this.buildPresencaSelect(columns)}
        from presencas p
        where p.id = $1
        limit 1;
      `,
      [id],
    );
  }

  private mapPresencaResponse(
    presenca: PresencaRow,
    registradoPor?: string,
  ): CheckinResponseDto {
    const aprovacaoStatus = presenca.aprovacao_status;

    return {
      id: presenca.id,
      aulaId: presenca.aula_id,
      alunoId: presenca.aluno_id,
      status: presenca.status as CheckinResponseDto['status'],
      origem: presenca.origem,
      criadoEm: new Date(presenca.criado_em).toISOString(),
      registradoPor: registradoPor ?? presenca.registrado_por ?? undefined,
      aprovacaoStatus: aprovacaoStatus ?? undefined,
      updatedAt: presenca.updated_at
        ? new Date(presenca.updated_at).toISOString()
        : undefined,
      decididoEm: presenca.decidido_em
        ? new Date(presenca.decidido_em).toISOString()
        : undefined,
      decididoPor: presenca.decidido_por ?? undefined,
      decisaoObservacao:
        presenca.observacao ?? undefined,
    };
  }

  private async getPresencaAuditColumns(): Promise<PresencaAuditColumns> {
    if (!this.presencaAuditColumnsPromise) {
    this.presencaAuditColumnsPromise = this.databaseService
      .query<{ column_name: string }>(
        `
          select column_name
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'presencas'
            and column_name = any($1)
        `,
        [
          [
            'aprovacao_status',
            'aprovado_por',
            'aprovado_em',
            'rejeitado_por',
            'rejeitado_em',
            'aprovacao_observacao',
            'decidido_por',
            'decidido_em',
            'rejeitado_em',
            'observacao',
            'decidido_por',
            'decidido_em',
            'updated_at',
          ],
        ],
      )
      .then((rows) => {
        const set = new Set(rows.map((row) => row.column_name));
        return {
          aprovacaoStatus: set.has('aprovacao_status'),
          aprovadoPor: set.has('aprovado_por'),
          aprovadoEm: set.has('aprovado_em'),
          rejeitadoPor: set.has('rejeitado_por'),
          rejeitadoEm: set.has('rejeitado_em'),
          observacao: set.has('observacao'),
          decididoPor: set.has('decidido_por'),
          decididoEm: set.has('decidido_em'),
          updatedAt: set.has('updated_at'),
        };
      })
      .catch(() => ({
        aprovacaoStatus: false,
        aprovadoPor: false,
        aprovadoEm: false,
        rejeitadoPor: false,
        rejeitadoEm: false,
        observacao: false,
        decididoPor: false,
        decididoEm: false,
        updatedAt: false,
      }));
    }

    return this.presencaAuditColumnsPromise;
  }

  private buildPresencaSelect(
    auditColumns: PresencaAuditColumns,
    alias = 'p',
  ): string {
    const columns = [
      `${alias}.id`,
      `${alias}.academia_id`,
      `${alias}.aula_id`,
      `${alias}.aluno_id`,
      `${alias}.status`,
      `${alias}.origem`,
      `${alias}.criado_em`,
      `${alias}.registrado_por`,
    ];

    if (auditColumns.aprovacaoStatus) {
      columns.push(`${alias}.aprovacao_status`);
    }
    if (auditColumns.aprovadoPor) {
      columns.push(`${alias}.aprovado_por`);
    }
    if (auditColumns.aprovadoEm) {
      columns.push(`${alias}.aprovado_em`);
    }
    if (auditColumns.rejeitadoPor) {
      columns.push(`${alias}.rejeitado_por`);
    }
    if (auditColumns.rejeitadoEm) {
      columns.push(`${alias}.rejeitado_em`);
    }
    if (auditColumns.decididoPor) {
      columns.push(`${alias}.decidido_por`);
    }
    if (auditColumns.decididoEm) {
      columns.push(`${alias}.decidido_em`);
    }
    if (auditColumns.observacao) {
      columns.push(`${alias}.observacao`);
    }
    if (auditColumns.updatedAt) {
      columns.push(`${alias}.updated_at`);
    }

    return columns.join(', ');
  }

  private buildDecisionUpdate(
    decisao: DecisaoInput,
    userId: string,
    auditColumns: PresencaAuditColumns,
    observacao?: string,
  ): { setClause: string; params: any[] } {
    const params: any[] = [];
    const setClauses: string[] = [];

    const decision = this.resolveDecision(decisao);
    const finalStatus = decision.finalStatus;
    params.push(finalStatus);
    setClauses.push(`status = $${params.length}`);

    if (auditColumns.aprovacaoStatus) {
      params.push(decision.aprovacaoStatus);
      setClauses.push(`aprovacao_status = $${params.length}`);
    }

    const needsUserParam =
      auditColumns.decididoPor ||
      auditColumns.aprovadoPor ||
      auditColumns.rejeitadoPor;
    let userParamIndex: number | null = null;

    if (needsUserParam) {
      params.push(userId);
      userParamIndex = params.length;
    }

    if (auditColumns.decididoPor && userParamIndex) {
      setClauses.push(`decidido_por = $${userParamIndex}`);
    }
    if (auditColumns.decididoEm) {
      setClauses.push(`decidido_em = now()`);
    }

    if (auditColumns.aprovadoPor) {
      setClauses.push(
        decision.finalStatus === 'PRESENTE'
          ? `aprovado_por = $${userParamIndex}`
          : `aprovado_por = null`,
      );
    }
    if (auditColumns.aprovadoEm) {
      setClauses.push(
        decision.finalStatus === 'PRESENTE'
          ? `aprovado_em = now()`
          : `aprovado_em = null`,
      );
    }
    if (auditColumns.rejeitadoPor) {
      setClauses.push(
        decision.finalStatus === 'FALTA'
          ? `rejeitado_por = $${userParamIndex}`
          : `rejeitado_por = null`,
      );
    }
    if (auditColumns.rejeitadoEm) {
      setClauses.push(
        decision.finalStatus === 'FALTA'
          ? `rejeitado_em = now()`
          : `rejeitado_em = null`,
      );
    }

    if (auditColumns.observacao) {
      params.push(observacao ?? null);
      const obsIndex = params.length;
      setClauses.push(`observacao = $${obsIndex}`);
    }

    return {
      setClause: setClauses.join(', '),
      params,
    };
  }


  private resolveDecision(decisao: DecisaoInput): {
    finalStatus: 'PRESENTE' | 'FALTA';
    aprovacaoStatus: 'APROVADA' | 'REJEITADA';
  } {
    if (decisao === 'APROVAR' || decisao === 'PRESENTE') {
      return { finalStatus: 'PRESENTE', aprovacaoStatus: 'APROVADA' };
    }
    return { finalStatus: 'FALTA', aprovacaoStatus: 'REJEITADA' };
  }
}
