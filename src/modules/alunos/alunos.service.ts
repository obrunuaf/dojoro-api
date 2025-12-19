import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { DatabaseService } from '../../database/database.service';
import { AlunoDetalheDto } from './dtos/aluno-detalhe.dto';
import { AlunoDto } from './dtos/aluno.dto';
import { EvolucaoAlunoDto } from './dtos/evolucao-aluno.dto';
import { CompletarPerfilDto } from './dtos/completar-perfil.dto';

export type CurrentUser = {
  id: string;
  role: UserRole;
  roles: UserRole[];
  academiaId: string;
};

type AlunoBaseRow = {
  id: string;
  nome_completo: string;
  email: string;
  faixa_atual_slug: string | null;
  grau_atual: number | null;
  academia_id: string;
  academia_nome: string;
  matricula_status: string | null;
  matricula_numero: number | null;
  matricula_data_inicio: string | null;
  matricula_data_fim: string | null;
};

type GraduacaoRow = {
  faixa_slug: string;
  grau: number | null;
  data_graduacao: string;
  professor_nome: string | null;
};

type RegraGraduacaoRow = {
  meta_aulas_no_grau: number | null;
  aulas_minimas: number | null;
};

const DEFAULT_META_AULAS = 60;

@Injectable()
export class AlunosService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Get profile completion status for current user
  async getPerfilStatus(userId: string): Promise<{
    perfilCompleto: boolean;
    statusMatricula: string;
    dataNascimento: string | null;
    telefone: string | null;
    faixaDeclarada: string | null;
  }> {
    const result = await this.databaseService.queryOne<{
      perfil_completo: boolean;
      status_matricula: string;
      data_nascimento: string | null;
      telefone: string | null;
      faixa_declarada: string | null;
    }>(
      `SELECT 
        COALESCE(perfil_completo, false) as perfil_completo,
        COALESCE(status_matricula::text, 'INCOMPLETO') as status_matricula,
        data_nascimento::text,
        telefone,
        faixa_declarada
      FROM usuarios WHERE id = $1`,
      [userId],
    );

    return {
      perfilCompleto: result?.perfil_completo ?? false,
      statusMatricula: result?.status_matricula ?? 'INCOMPLETO',
      dataNascimento: result?.data_nascimento ?? null,
      telefone: result?.telefone ?? null,
      faixaDeclarada: result?.faixa_declarada ?? null,
    };
  }

  // Complete user profile
  async completarPerfil(
    userId: string,
    dto: CompletarPerfilDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.databaseService.query(
      `UPDATE usuarios SET
        data_nascimento = $2,
        sexo = $3,
        telefone = $4,
        faixa_declarada = $5,
        perfil_completo = true,
        status_matricula = 'PENDENTE',
        atualizado_em = NOW()
      WHERE id = $1`,
      [
        userId,
        dto.dataNascimento,
        dto.sexo,
        dto.telefone,
        dto.faixaDeclarada,
      ],
    );

    return {
      success: true,
      message: 'Perfil completado com sucesso. Aguardando aprovação da academia.',
    };
  }

  async listar(currentUser: CurrentUser): Promise<AlunoDto[]> {
    const alunos = await this.databaseService.query<AlunoBaseRow>(
      `
        with matricula_prioritaria as (
          select distinct on (m.usuario_id)
            m.usuario_id,
            m.numero_matricula,
            m.status as matricula_status,
            m.data_inicio as matricula_data_inicio,
            m.data_fim as matricula_data_fim,
            case when m.status = 'ATIVA' then 0 else 1 end as prioridade
          from matriculas m
          where m.academia_id = $1
          order by m.usuario_id, prioridade, m.data_inicio desc, m.criado_em desc
        ),
        vinculos as (
          select usuario_id, academia_id, criado_em
          from usuarios_papeis
          union all
          select usuario_id, academia_id, criado_em
          from matriculas
        ),
        alunos_base as (
          select distinct on (u.id)
            u.id,
            u.nome_completo,
            u.email,
            u.faixa_atual_slug,
            u.grau_atual,
            v.academia_id,
            '' as academia_nome,
            mp.matricula_status,
            mp.numero_matricula as matricula_numero,
            mp.matricula_data_inicio,
            mp.matricula_data_fim
          from usuarios u
          join vinculos v
            on v.usuario_id = u.id
           and v.academia_id = $1
          left join matricula_prioritaria mp
            on mp.usuario_id = u.id
          order by u.id, v.criado_em desc
        )
        select *
        from alunos_base
        order by nome_completo asc;
      `,
      [currentUser.academiaId],
    );

    return alunos.map((row) => ({
      id: row.id,
      nome: row.nome_completo,
      email: row.email,
      faixaAtual: row.faixa_atual_slug,
      grauAtual: row.grau_atual,
      matriculaStatus: row.matricula_status,
      matriculaNumero: row.matricula_numero,
    }));
  }

  async detalhar(
    alunoId: string,
    currentUser: CurrentUser,
  ): Promise<AlunoDetalheDto> {
    this.ensureAlunoScope(currentUser, alunoId);

    const aluno = await this.findAlunoBase(alunoId, currentUser.academiaId);
    if (!aluno) {
      await this.throwForbiddenOrNotFound(alunoId, currentUser.academiaId);
      return null as never;
    }

    const alunoBase = aluno;

    const presencas = await this.databaseService.queryOne<{ total: number }>(
      `
        select count(*)::int as total
        from presencas p
        where p.aluno_id = $1
          and p.academia_id = $2
          and p.status = 'PRESENTE';
      `,
      [alunoId, currentUser.academiaId],
    );

    return {
      id: alunoBase.id,
      nome: alunoBase.nome_completo,
      email: alunoBase.email,
      academiaId: alunoBase.academia_id,
      academiaNome: alunoBase.academia_nome,
      matriculaNumero: alunoBase.matricula_numero,
      matriculaStatus: alunoBase.matricula_status,
      matriculaDataInicio: alunoBase.matricula_data_inicio,
      matriculaDataFim: alunoBase.matricula_data_fim,
      faixaAtual: alunoBase.faixa_atual_slug,
      grauAtual: alunoBase.grau_atual,
      presencasTotais: presencas?.total ?? 0,
    };
  }

  async evolucao(
    alunoId: string,
    currentUser: CurrentUser,
  ): Promise<EvolucaoAlunoDto> {
    this.ensureAlunoScope(currentUser, alunoId);

    const aluno = await this.findAlunoBase(alunoId, currentUser.academiaId);
    if (!aluno) {
      await this.throwForbiddenOrNotFound(alunoId, currentUser.academiaId);
      return null as never;
    }

    const alunoBase = aluno;

    const historico = await this.databaseService.query<GraduacaoRow>(
      `
        select
          g.faixa_slug,
          g.grau,
          g.data_graduacao,
          prof.nome_completo as professor_nome
        from graduacoes g
        left join usuarios prof on prof.id = g.professor_id
        where g.usuario_id = $1
          and g.academia_id = $2
        order by g.data_graduacao asc, g.criado_em asc;
      `,
      [alunoId, currentUser.academiaId],
    );

    const dataReferencia =
      historico[historico.length - 1]?.data_graduacao ??
      alunoBase.matricula_data_inicio ??
      '1970-01-01';

    const aulasNaFaixaAtual =
      (
        await this.databaseService.queryOne<{ total: number }>(
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
          [alunoId, currentUser.academiaId, dataReferencia],
        )
      )?.total ?? 0;

    let metaAulas = DEFAULT_META_AULAS;
    if (alunoBase.faixa_atual_slug) {
      const regra = await this.databaseService.queryOne<RegraGraduacaoRow>(
        `
          select meta_aulas_no_grau, aulas_minimas
          from regras_graduacao
          where academia_id = $1
            and faixa_slug = $2
          limit 1;
        `,
        [currentUser.academiaId, alunoBase.faixa_atual_slug],
      );
      metaAulas = this.resolveMetaAulas(regra);
    }

    const porcentagemProgresso =
      metaAulas > 0
        ? Math.min(100, Math.floor((aulasNaFaixaAtual * 100) / metaAulas))
        : 0;

    return {
      historico: historico.map((item) => ({
        faixaSlug: item.faixa_slug,
        grau: item.grau,
        dataGraduacao: new Date(item.data_graduacao).toISOString(),
        professorNome: item.professor_nome ?? null,
      })),
      faixaAtual: alunoBase.faixa_atual_slug,
      grauAtual: alunoBase.grau_atual,
      aulasNaFaixaAtual,
      metaAulas,
      porcentagemProgresso,
    };
  }

  private ensureAlunoScope(currentUser: CurrentUser, alunoId: string) {
    if (currentUser.role === UserRole.ALUNO && currentUser.id !== alunoId) {
      throw new ForbiddenException('Aluno so pode acessar o proprio id');
    }
  }

  private async findAlunoBase(
    alunoId: string,
    academiaId: string,
  ): Promise<AlunoBaseRow | null> {
    return this.databaseService.queryOne<AlunoBaseRow>(
      `
        with matricula_prioritaria as (
          select distinct on (m.usuario_id)
            m.usuario_id,
            m.numero_matricula,
            m.status as matricula_status,
            m.data_inicio as matricula_data_inicio,
            m.data_fim as matricula_data_fim,
            case when m.status = 'ATIVA' then 0 else 1 end as prioridade
          from matriculas m
          where m.academia_id = $2
          order by m.usuario_id, prioridade, m.data_inicio desc, m.criado_em desc
        ),
        vinculos as (
          select usuario_id, academia_id, criado_em
          from usuarios_papeis
          union all
          select usuario_id, academia_id, criado_em
          from matriculas
        )
        select distinct on (u.id)
          u.id,
          u.nome_completo,
          u.email,
          u.faixa_atual_slug,
          u.grau_atual,
          a.id as academia_id,
          a.nome as academia_nome,
          mp.matricula_status,
          mp.numero_matricula as matricula_numero,
          mp.matricula_data_inicio,
          mp.matricula_data_fim
        from usuarios u
        join vinculos v
          on v.usuario_id = u.id
         and v.academia_id = $2
        join academias a
          on a.id = v.academia_id
        left join matricula_prioritaria mp
          on mp.usuario_id = u.id
        where u.id = $1
        order by u.id, v.criado_em desc;
      `,
      [alunoId, academiaId],
    );
  }

  private async throwForbiddenOrNotFound(
    alunoId: string,
    academiaId: string,
  ): Promise<never> {
    const existe = await this.databaseService.queryOne<{ id: string }>(
      `select id from usuarios where id = $1 limit 1;`,
      [alunoId],
    );

    if (!existe) {
      throw new NotFoundException('Aluno nao encontrado');
    }

    const papel = await this.databaseService.queryOne<{ academia_id: string }>(
      `select academia_id from usuarios_papeis where usuario_id = $1 limit 1;`,
      [alunoId],
    );

    const matricula = await this.databaseService.queryOne<{
      academia_id: string;
    }>(
      `select academia_id from matriculas where usuario_id = $1 limit 1;`,
      [alunoId],
    );

    if (
      (papel && papel.academia_id !== academiaId) ||
      (matricula && matricula.academia_id !== academiaId)
    ) {
      throw new ForbiddenException('Aluno pertence a outra academia');
    }

    throw new NotFoundException('Aluno nao encontrado na academia');
  }

  private resolveMetaAulas(regraGraduacao: RegraGraduacaoRow | null): number {
    const metaPreferencial =
      regraGraduacao?.meta_aulas_no_grau &&
      regraGraduacao.meta_aulas_no_grau > 0
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
