import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { DatabaseService } from '../../database/database.service';
import { AulasService } from '../aulas/aulas.service';
import { AuthService } from '../auth/auth.service';
import { CheckinService } from '../checkin/checkin.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { PresencasService } from '../presencas/presencas.service';
import { HomeResponseDto } from './dtos/home-response.dto';

type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  academiaId: string;
};

@Injectable()
export class HomeService {
  constructor(
    private readonly authService: AuthService,
    private readonly dashboardService: DashboardService,
    private readonly aulasService: AulasService,
    private readonly checkinService: CheckinService,
    private readonly presencasService: PresencasService,
    private readonly databaseService: DatabaseService,
  ) {}

  async getHome(
    currentUser: CurrentUser,
    modeParam?: string,
  ): Promise<HomeResponseDto> {
    const rolesNormalized = this.normalizeRoles(currentUser);
    const isStaff = this.hasStaffRole(rolesNormalized);
    const isAluno = rolesNormalized.includes(UserRole.ALUNO);

    const resolvedMode = this.resolveMode({ isStaff, isAluno, modeParam });

    const me = await this.authService.me(currentUser);

    const base: HomeResponseDto = {
      mode: resolvedMode,
      me,
    };

    if (resolvedMode === 'ALUNO') {
      const alunoDashboard = await this.dashboardService.getAlunoDashboard({
        id: currentUser.id,
        academiaId: currentUser.academiaId,
      });

      // Checkins - pode falhar se matrícula não está ativa (PENDENTE)
      let checkins: any[] = [];
      try {
        checkins = await this.checkinService.listarDisponiveis({
          ...currentUser,
          roles: rolesNormalized,
        });
      } catch {
        // PENDENTE não tem acesso a check-ins, retorna vazio
        checkins = [];
      }

      const ultimasPresencas = await this.buscarUltimasPresencas(
        currentUser,
      );

      const historicoGraduacoes = await this.buscarHistoricoGraduacoes(
        currentUser,
      );

      base.aluno = {
        dashboard: alunoDashboard,
        checkinDisponiveis: checkins,
        ultimasPresencas,
        historicoGraduacoes,
      };
    } else {
      const staffDashboard = await this.dashboardService.getStaffDashboard({
        id: currentUser.id,
        academiaId: currentUser.academiaId,
      });

      const aulasHoje = await this.aulasService.listarHoje({
        id: currentUser.id,
        roles: rolesNormalized,
        academiaId: currentUser.academiaId,
      });

      const pendencias = await this.presencasService.listarPendencias(
        {
          ...currentUser,
          roles: rolesNormalized,
        },
        {},
      );

      base.staff = {
        dashboard: staffDashboard,
        aulasHoje,
        pendencias: {
          total: pendencias.total,
          itens: pendencias.itens.slice(0, 10).map((item) => ({
            presencaId: item.id,
            aulaId: item.aulaId,
            alunoId: item.alunoId,
            alunoNome: item.alunoNome,
            turmaNome: item.turmaNome,
            dataInicio: item.dataInicio,
            status: item.status,
            origem: item.origem,
          })),
        },
      };
    }

    return base;
  }

  private normalizeRoles(user: CurrentUser): UserRole[] {
    if (Array.isArray(user.roles) && user.roles.length) {
      return user.roles.map((role) =>
        (role as string).toUpperCase(),
      ) as UserRole[];
    }
    return user.role ? [(user.role as string).toUpperCase() as UserRole] : [];
  }

  private hasStaffRole(roles: UserRole[]): boolean {
    return roles.some((role) =>
      [UserRole.PROFESSOR, UserRole.INSTRUTOR, UserRole.ADMIN, UserRole.TI].includes(
        role,
      ),
    );
  }

  private resolveMode(params: {
    isStaff: boolean;
    isAluno: boolean;
    modeParam?: string;
  }): 'ALUNO' | 'STAFF' {
    const requested = params.modeParam?.toLowerCase();
    if (requested === 'aluno') {
      if (!params.isAluno) {
        throw new ForbiddenException('Usuario nao possui papel de aluno');
      }
      return 'ALUNO';
    }
    if (requested === 'staff') {
      if (!params.isStaff) {
        throw new ForbiddenException('Usuario nao possui papel de staff');
      }
      return 'STAFF';
    }
    if (requested) {
      throw new BadRequestException('mode invalido (use aluno ou staff)');
    }

    if (params.isStaff) {
      return 'STAFF';
    }
    return 'ALUNO';
  }

  private async buscarUltimasPresencas(currentUser: CurrentUser) {
    const presencas = await this.databaseService.query<{
      aula_id: string;
      turma_nome: string;
      data_inicio: string;
      status: string;
      origem: string;
    }>(
      `
        select
          p.aula_id,
          t.nome as turma_nome,
          a.data_inicio,
          p.status,
          p.origem
        from presencas p
        join aulas a on a.id = p.aula_id
        join turmas t on t.id = a.turma_id
        where p.aluno_id = $1
          and p.academia_id = $2
          and a.academia_id = $2
          and a.deleted_at is null
          and t.deleted_at is null
        order by a.data_inicio desc
        limit 10;
      `,
      [currentUser.id, currentUser.academiaId],
    );

    return presencas.map((row) => ({
      aulaId: row.aula_id,
      turmaNome: row.turma_nome,
      dataInicio: new Date(row.data_inicio).toISOString(),
      status: row.status,
      origem: row.origem,
    }));
  }

  private async buscarHistoricoGraduacoes(currentUser: CurrentUser) {
    const graduacoes = await this.databaseService.query<{
      data_graduacao: string;
      faixa_slug: string;
      grau: number | null;
      professor_nome: string | null;
    }>(
      `
        select
          g.data_graduacao,
          g.faixa_slug,
          g.grau,
          prof.nome_completo as professor_nome
        from graduacoes g
        left join usuarios prof on prof.id = g.professor_id
        where g.usuario_id = $1
          and g.academia_id = $2
        order by g.data_graduacao desc, g.criado_em desc
        limit 10;
      `,
      [currentUser.id, currentUser.academiaId],
    );

    return graduacoes.map((row) => ({
      dataGraduacao: new Date(row.data_graduacao).toISOString(),
      faixaSlug: row.faixa_slug,
      grau: row.grau,
      professorNome: row.professor_nome,
    }));
  }
}
