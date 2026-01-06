import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AlunoDashboardDto } from './dtos/aluno-dashboard.dto';
import { StaffDashboardDto } from './dtos/staff-dashboard.dto';

const DEFAULT_META_AULAS = 60;

type CurrentUser = {
  id: string;
  academiaId: string;
};

type MatriculaRow = {
  id: string;
  status: string;
  data_inicio: string;
  criado_em?: string;
};

type ProximaAulaRow = {
  id: string;
  data_inicio: string;
  turma_nome: string;
};

type RegraGraduacaoRow = {
  meta_aulas_no_grau: number | null;
  aulas_minimas: number | null;
};

@Injectable()
export class DashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAlunoDashboard(user: CurrentUser): Promise<AlunoDashboardDto> {
    try {
      const matricula = await this.databaseService.queryOne<MatriculaRow>(
        `
          with candidatas as (
            select
              m.id,
              m.status,
              m.data_inicio,
              m.criado_em,
              case when m.status = 'ATIVA' then 1 else 2 end as prioridade
            from matriculas m
            where m.usuario_id = $1
              and m.academia_id = $2
          )
          select
            id,
            status,
            data_inicio
          from candidatas
          order by prioridade, data_inicio desc, criado_em desc
          limit 1;
        `,
        [user.id, user.academiaId],
      );

      const statusMatricula = matricula?.status ?? 'INEXISTENTE';
      const faixaAtual = await this.databaseService.queryOne<{
        faixa_atual_slug: string | null;
      }>(
        `
          select COALESCE(faixa_atual_slug, faixa_declarada) as faixa_atual_slug
          from usuarios
          where id = $1
          limit 1;
        `,
        [user.id],
      );

      let regraGraduacao: RegraGraduacaoRow | null = null;
      let regraProximaFaixa: { meta_aulas_faixa: number | null } | null = null;
      
      if (faixaAtual?.faixa_atual_slug) {
        regraGraduacao = await this.databaseService.queryOne<RegraGraduacaoRow>(
          `
            select
              meta_aulas_no_grau,
              aulas_minimas
            from regras_graduacao
            where academia_id = $1
              and faixa_slug = $2
            limit 1;
          `,
          [user.academiaId, faixaAtual.faixa_atual_slug],
        );
        
        // Busca meta para próxima faixa (aulas_minimas da faixa atual)
        regraProximaFaixa = await this.databaseService.queryOne<{ meta_aulas_faixa: number | null }>(
          `
            select aulas_minimas as meta_aulas_faixa
            from regras_graduacao
            where academia_id = $1
              and faixa_slug = $2
            limit 1;
          `,
          [user.academiaId, faixaAtual.faixa_atual_slug],
        );
      }

      const metaAulas = this.resolveMetaAulas(regraGraduacao);
      const metaAulasFaixa = regraProximaFaixa?.meta_aulas_faixa ?? 60;

      if (!matricula || matricula.status !== 'ATIVA') {
        return {
          proximaAulaId: null,
          proximaAulaHorario: null,
          proximaAulaTurma: null,
          aulasNoGrauAtual: 0,
          metaAulas,
          progressoPercentual: 0,
          statusMatricula,
          treinosMes: 0,
          frequenciaMes: 0,
          semanasConsecutivas: 0,
          aulasNaFaixaAtual: 0,
          metaAulasFaixa,
        };
      }

      const proximaAula = await this.databaseService.queryOne<ProximaAulaRow>(
        `
          select
            a.id,
            a.data_inicio,
            t.nome as turma_nome
          from aulas a
          join turmas t on t.id = a.turma_id
          where a.academia_id = $1
            and a.data_inicio > now()
            and a.status <> 'CANCELADA'
            and a.deleted_at is null
            and t.deleted_at is null
          order by a.data_inicio asc
          limit 1;
        `,
        [user.academiaId],
      );

      // Última graduação de GRAU (para progresso do grau)
      const ultimaGraduacao = await this.databaseService.queryOne<{
        data_graduacao: string | null;
      }>(
        `
          select max(g.data_graduacao) as data_graduacao
          from graduacoes g
          where g.usuario_id = $1
            and g.academia_id = $2;
        `,
        [user.id, user.academiaId],
      );

      // Última graduação de FAIXA (para progresso da faixa)
      const ultimaGraduacaoFaixa = await this.databaseService.queryOne<{
        data_graduacao: string | null;
      }>(
        `
          select max(g.data_graduacao) as data_graduacao
          from graduacoes g
          join faixas f on f.slug = g.faixa_slug
          where g.usuario_id = $1
            and g.academia_id = $2
            and g.faixa_slug = $3;
        `,
        [user.id, user.academiaId, faixaAtual?.faixa_atual_slug],
      );

      const dataReferencia =
        ultimaGraduacao?.data_graduacao ??
        matricula.data_inicio ??
        '1970-01-01';

      const presencas = await this.databaseService.queryOne<{ total: number }>(
        `
          select count(*)::int as total
          from presencas p
          join aulas a on a.id = p.aula_id
          where p.aluno_id = $1
            and p.academia_id = $2
            and a.academia_id = $2
            and p.status = 'PRESENTE'
            and a.data_inicio::date >= $3::date;
        `,
        [user.id, user.academiaId, dataReferencia],
      );

      const aulasNoGrauAtual = presencas?.total ?? 0;
      const progressoPercentual =
        metaAulas > 0
          ? Math.min(
              100,
              Math.floor((aulasNoGrauAtual * 100) / metaAulas),
            )
          : 0;

      // Presenças na faixa atual (desde que recebeu a faixa)
      const dataReferenciaFaixa =
        ultimaGraduacaoFaixa?.data_graduacao ??
        matricula.data_inicio ??
        '1970-01-01';
        
      const presencasFaixa = await this.databaseService.queryOne<{ total: number }>(
        `
          select count(*)::int as total
          from presencas p
          join aulas a on a.id = p.aula_id
          where p.aluno_id = $1
            and p.academia_id = $2
            and a.academia_id = $2
            and p.status = 'PRESENTE'
            and a.data_inicio::date >= $3::date;
        `,
        [user.id, user.academiaId, dataReferenciaFaixa],
      );

      const aulasNaFaixaAtual = presencasFaixa?.total ?? 0;

      // Stats de engajamento
      const statsEngajamento = await this.calcularStatsEngajamento(user);

      return {
        proximaAulaId: proximaAula?.id ?? null,
        proximaAulaHorario: proximaAula?.data_inicio
          ? new Date(proximaAula.data_inicio).toISOString()
          : null,
        proximaAulaTurma: proximaAula?.turma_nome ?? null,
        aulasNoGrauAtual,
        metaAulas,
        progressoPercentual,
        statusMatricula,
        ...statsEngajamento,
        aulasNaFaixaAtual,
        metaAulasFaixa,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Erro ao consultar dashboard do aluno',
      );
    }
  }

  async getStaffDashboard(user: CurrentUser): Promise<StaffDashboardDto> {
    try {
      const tz = this.databaseService.getAppTimezone();
      const { startUtc, endUtc } =
        await this.databaseService.getTodayBoundsUtc(tz);

      const resumo = await this.databaseService.queryOne<{
        alunos_ativos: number;
        aulas_hoje: number;
        presencas_hoje: number;
        faltas_hoje: number;
        pendencias_hoje: number;
      }>(
        `
          with aulas_hoje as (
            select a.id
            from aulas a
            join turmas t on t.id = a.turma_id
            where a.academia_id = $1
              and a.data_inicio >= $2
              and a.data_inicio < $3
              and a.deleted_at is null
              and t.deleted_at is null
              and a.status <> 'CANCELADA'
          ),
          presencas_hoje as (
            select p.status
            from presencas p
            where p.academia_id = $1
              and p.aula_id in (select id from aulas_hoje)
          )
          select
            (select count(*) from matriculas m where m.academia_id = $1 and m.status = 'ATIVA')::int as alunos_ativos,
            (select count(*) from aulas_hoje)::int as aulas_hoje,
            (select count(*) from presencas_hoje where status = 'PRESENTE')::int as presencas_hoje,
            (select count(*) from presencas_hoje where status = 'FALTA')::int as faltas_hoje,
            (select count(*) from presencas_hoje where status = 'PENDENTE')::int as pendencias_hoje;
        `,
        [user.academiaId, startUtc, endUtc],
      );

      return {
        alunosAtivos: resumo?.alunos_ativos ?? 0,
        aulasHoje: resumo?.aulas_hoje ?? 0,
        presencasHoje: resumo?.presencas_hoje ?? 0,
        faltasHoje: resumo?.faltas_hoje ?? 0,
        pendenciasHoje: resumo?.pendencias_hoje ?? 0,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Erro ao consultar dashboard do staff',
      );
    }
  }

  private resolveMetaAulas(regraGraduacao: RegraGraduacaoRow | null): number {
    const metaPreferencial =
      regraGraduacao?.meta_aulas_no_grau && regraGraduacao.meta_aulas_no_grau > 0
        ? regraGraduacao.meta_aulas_no_grau
        : null;

    if (metaPreferencial) {
      return metaPreferencial;
    }

    const aulasMinimas =
      regraGraduacao?.aulas_minimas && regraGraduacao.aulas_minimas > 0
        ? regraGraduacao.aulas_minimas
        : null;

    if (aulasMinimas) {
      return aulasMinimas;
    }

    return DEFAULT_META_AULAS;
  }

  private async calcularStatsEngajamento(user: CurrentUser): Promise<{
    treinosMes: number;
    frequenciaMes: number;
    semanasConsecutivas: number;
  }> {
    // Treinos no mês atual
    const treinosMesResult = await this.databaseService.queryOne<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM presencas p
        JOIN aulas a ON a.id = p.aula_id
        WHERE p.aluno_id = $1
          AND p.academia_id = $2
          AND p.status = 'PRESENTE'
          AND DATE_TRUNC('month', a.data_inicio) = DATE_TRUNC('month', NOW())
          AND a.deleted_at IS NULL;
      `,
      [user.id, user.academiaId],
    );
    const treinosMes = treinosMesResult?.total ?? 0;

    // Aulas disponíveis no mês (para calcular frequência)
    const aulasMesResult = await this.databaseService.queryOne<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM aulas a
        JOIN turmas t ON t.id = a.turma_id
        WHERE a.academia_id = $1
          AND DATE_TRUNC('month', a.data_inicio) = DATE_TRUNC('month', NOW())
          AND a.data_inicio <= NOW()
          AND a.status <> 'CANCELADA'
          AND a.deleted_at IS NULL
          AND t.deleted_at IS NULL;
      `,
      [user.academiaId],
    );
    const aulasMes = aulasMesResult?.total ?? 0;
    const frequenciaMes = aulasMes > 0 
      ? Math.min(100, Math.floor((treinosMes * 100) / aulasMes))
      : 0;

    // Semanas consecutivas com treino
    const semanasResult = await this.databaseService.queryOne<{ semanas: number }>(
      `
        WITH semanas_com_treino AS (
          SELECT DISTINCT DATE_TRUNC('week', a.data_inicio)::date AS semana
          FROM presencas p
          JOIN aulas a ON a.id = p.aula_id
          WHERE p.aluno_id = $1
            AND p.academia_id = $2
            AND p.status = 'PRESENTE'
            AND a.deleted_at IS NULL
          ORDER BY semana DESC
        ),
        semanas_ordenadas AS (
          SELECT semana,
                 ROW_NUMBER() OVER (ORDER BY semana DESC) AS rn,
                 semana - (ROW_NUMBER() OVER (ORDER BY semana DESC) * INTERVAL '1 week') AS grupo
          FROM semanas_com_treino
        )
        SELECT COUNT(*)::int AS semanas
        FROM semanas_ordenadas
        WHERE grupo = (SELECT grupo FROM semanas_ordenadas WHERE rn = 1);
      `,
      [user.id, user.academiaId],
    );
    const semanasConsecutivas = semanasResult?.semanas ?? 0;

    return {
      treinosMes,
      frequenciaMes,
      semanasConsecutivas,
    };
  }
}
