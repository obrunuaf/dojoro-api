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
          select faixa_atual_slug
          from usuarios
          where id = $1
          limit 1;
        `,
        [user.id],
      );

      let regraGraduacao: RegraGraduacaoRow | null = null;
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
      }

      const metaAulas = this.resolveMetaAulas(regraGraduacao);

      if (!matricula || matricula.status !== 'ATIVA') {
        return {
          proximaAulaId: null,
          proximaAulaHorario: null,
          proximaAulaTurma: null,
          aulasNoGrauAtual: 0,
          metaAulas,
          progressoPercentual: 0,
          statusMatricula,
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
          order by a.data_inicio asc
          limit 1;
        `,
        [user.academiaId],
      );

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
            select id
            from aulas
            where academia_id = $1
              and data_inicio >= $2
              and data_inicio < $3
              and deleted_at is null
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
}
