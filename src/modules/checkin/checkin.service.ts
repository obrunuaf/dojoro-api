import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { DatabaseService } from '../../database/database.service';
import { CheckinDisponivelDto } from './dtos/checkin-disponivel.dto';
import { CheckinResponseDto } from './dtos/checkin-response.dto';
import { CreateCheckinDto } from './dtos/create-checkin.dto';

export type CurrentUser = {
  id: string;
  role: UserRole;
  roles: UserRole[];
  academiaId: string;
};

type CheckinDisponivelRow = {
  aula_id: string;
  data_inicio: string;
  data_fim: string;
  status_aula: string;
  turma_nome: string;
  tipo_treino: string | null;
  tipo_treino_cor: string | null;
  ja_fez_checkin: boolean;
};

type AulaRow = {
  id: string;
  academia_id: string;
  status: string;
  qr_token: string | null;
  qr_expires_at: string | null;
  deleted_at: string | null;
};

type PresencaAuditColumns = {
  updatedAt: boolean;
  decididoEm: boolean;
  decididoPor: boolean;
  decisaoObservacao: boolean;
  aprovacaoObservacao: boolean;
};

@Injectable()
export class CheckinService {
  constructor(private readonly databaseService: DatabaseService) {}

  private presencaAuditColumnsPromise?: Promise<PresencaAuditColumns>;

  async listarDisponiveis(
    currentUser: CurrentUser,
  ): Promise<CheckinDisponivelDto[]> {
    await this.ensureAlunoComMatriculaAtiva(
      currentUser.id,
      currentUser.academiaId,
    );

    const tz = this.databaseService.getAppTimezone();
    const { startUtc, endUtc } =
      await this.databaseService.getTodayBoundsUtc(tz);

    const aulas = await this.databaseService.query<CheckinDisponivelRow>(
      `
        select
          a.id as aula_id,
          a.data_inicio,
          a.data_fim,
          a.status as status_aula,
          t.nome as turma_nome,
          tt.nome as tipo_treino,
          COALESCE(tt.cor_identificacao, 
            CASE 
              WHEN lower(tt.nome) LIKE '%kids%' OR lower(tt.nome) LIKE '%infantil%' THEN '#22C55E'
              WHEN lower(tt.nome) LIKE '%no-gi%' OR lower(tt.nome) LIKE '%nogi%' THEN '#F97316'
              WHEN lower(tt.nome) LIKE '%gi%' THEN '#3B82F6'
              ELSE '#6B7280'
            END
          ) as tipo_treino_cor,
          (p.id is not null) as ja_fez_checkin
        from aulas a
        join turmas t on t.id = a.turma_id
        left join tipos_treino tt on tt.id = t.tipo_treino_id
        left join presencas p
          on p.aula_id = a.id
         and p.aluno_id = $4
         and p.academia_id = a.academia_id
        where a.academia_id = $1
          and a.data_inicio >= $2
          and a.data_inicio < $3
          and a.status <> 'CANCELADA'
          and a.deleted_at is null
          and t.deleted_at is null
        order by a.data_inicio asc;
      `,
      [currentUser.academiaId, startUtc, endUtc, currentUser.id],
    );

    return aulas.map((row) => ({
      aulaId: row.aula_id,
      turmaNome: row.turma_nome,
      dataInicio: new Date(row.data_inicio).toISOString(),
      dataFim: new Date(row.data_fim).toISOString(),
      tipoTreino: row.tipo_treino ?? null,
      tipoTreinoCor: row.tipo_treino_cor ?? null,
      statusAula: row.status_aula,
      jaFezCheckin: !!row.ja_fez_checkin,
    }));
  }

  async criarCheckin(
    dto: CreateCheckinDto,
    currentUser: CurrentUser,
  ): Promise<CheckinResponseDto> {
    await this.ensureAlunoComMatriculaAtiva(
      currentUser.id,
      currentUser.academiaId,
    );

    if (dto.tipo === 'QR' && !dto.qrToken) {
      throw new BadRequestException(
        'qrToken e obrigatorio para check-in via QR',
      );
    }

    const aula = await this.databaseService.queryOne<AulaRow>(
      `
        select id, academia_id, status, qr_token, qr_expires_at, deleted_at
        from aulas
        where id = $1
          and academia_id = $2
        limit 1;
      `,
      [dto.aulaId, currentUser.academiaId],
    );

    if (!aula) {
      throw new NotFoundException('Aula nao encontrada');
    }

    if (aula.academia_id !== currentUser.academiaId) {
      throw new ForbiddenException('Aula nao pertence a academia do usuario');
    }

    if (aula.deleted_at) {
      throw new UnprocessableEntityException('Aula nao disponivel para check-in');
    }

    if (aula.status === 'CANCELADA') {
      throw new UnprocessableEntityException('Aula cancelada para check-in');
    }

    const jaExiste = await this.databaseService.queryOne<{
      id: string;
      aprovacao_status?: string;
      status?: string;
    }>(
      `
        select id
        from presencas
        where aula_id = $1
          and aluno_id = $2
          and academia_id = $3
        limit 1;
      `,
      [dto.aulaId, currentUser.id, currentUser.academiaId],
    );

    if (jaExiste) {
      throw new UnprocessableEntityException(
        'Aluno ja possui presenca registrada para esta aula',
      );
    }

    if (dto.tipo === 'QR') {
      if (!aula.qr_token || aula.qr_token !== dto.qrToken) {
        throw new UnprocessableEntityException('QR code invalido para a aula');
      }

      if (!aula.qr_expires_at || new Date(aula.qr_expires_at) <= new Date()) {
        throw new UnprocessableEntityException('QR code expirado');
      }
    }

    const status = dto.tipo === 'QR' ? 'PRESENTE' : 'PENDENTE';
    const origem = dto.tipo === 'QR' ? 'QR_CODE' : 'MANUAL';

    try {
      const auditColumns = await this.getPresencaAuditColumns();
      const auditSelectParts: string[] = [];
      if (auditColumns.updatedAt) auditSelectParts.push('updated_at');
      if (auditColumns.decididoEm) auditSelectParts.push('decidido_em');
      if (auditColumns.decididoPor) auditSelectParts.push('decidido_por');
      if (auditColumns.decisaoObservacao)
        auditSelectParts.push('decisao_observacao');
      if (auditColumns.aprovacaoObservacao)
        auditSelectParts.push('aprovacao_observacao');
      const auditSelect =
        auditSelectParts.length > 0 ? `, ${auditSelectParts.join(', ')}` : '';

      const presenca = await this.databaseService.queryOne<{
        id: string;
        aula_id: string;
        aluno_id: string;
        status: string;
        origem: 'MANUAL' | 'QR_CODE' | 'SISTEMA';
        criado_em: string;
        aprovacao_status: 'PENDENTE' | 'APROVADA' | 'REJEITADA';
        updated_at?: string | null;
        decidido_em?: string | null;
        decidido_por?: string | null;
        decisao_observacao?: string | null;
        aprovacao_observacao?: string | null;
      }>(
        `
          insert into presencas (
            academia_id,
            aula_id,
            aluno_id,
            status,
            origem,
            registrado_por,
            aprovacao_status
          )
          values ($1, $2, $3, $4, $5, $6, 'PENDENTE')
          returning id, aula_id, aluno_id, status, origem, criado_em, aprovacao_status${auditSelect};
        `,
        [
          currentUser.academiaId,
          dto.aulaId,
          currentUser.id,
          status,
          origem,
          currentUser.id,
        ],
      );

      if (!presenca) {
        throw new InternalServerErrorException('Falha ao criar presenca');
      }

      return {
        id: presenca.id,
        aulaId: presenca.aula_id,
        alunoId: presenca.aluno_id,
        status: presenca.status as CheckinResponseDto['status'],
        origem: presenca.origem,
        criadoEm: new Date(presenca.criado_em).toISOString(),
        registradoPor: currentUser.id,
        aprovacaoStatus: presenca.aprovacao_status,
        updatedAt: presenca.updated_at
          ? new Date(presenca.updated_at).toISOString()
          : undefined,
        decididoEm: presenca.decidido_em
          ? new Date(presenca.decidido_em).toISOString()
          : undefined,
        decididoPor: presenca.decidido_por ?? undefined,
        decisaoObservacao:
          presenca.decisao_observacao ?? presenca.aprovacao_observacao ?? undefined,
      };
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new UnprocessableEntityException(
          'Aluno ja possui presenca registrada para esta aula',
        );
      }
      throw error;
    }
  }

  private async ensureAlunoComMatriculaAtiva(
    alunoId: string,
    academiaId: string,
  ): Promise<void> {
    const matriculaAtiva = await this.databaseService.queryOne<{ id: string }>(
      `
        select id
        from matriculas
        where usuario_id = $1
          and academia_id = $2
          and status = 'ATIVA'
        limit 1;
      `,
      [alunoId, academiaId],
    );

    if (matriculaAtiva) {
      return;
    }

    const existeAluno = await this.databaseService.queryOne<{ id: string }>(
      `select id from usuarios where id = $1 limit 1;`,
      [alunoId],
    );

    if (!existeAluno) {
      throw new NotFoundException('Aluno nao encontrado');
    }

    throw new ForbiddenException('Aluno nao possui matricula ativa na academia');
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
              'updated_at',
              'decidido_em',
              'decidido_por',
              'decisao_observacao',
              'aprovacao_observacao',
            ],
          ],
        )
        .then((rows) => {
          const set = new Set(rows.map((row) => row.column_name));
          return {
            updatedAt: set.has('updated_at'),
            decididoEm: set.has('decidido_em'),
            decididoPor: set.has('decidido_por'),
            decisaoObservacao: set.has('decisao_observacao'),
            aprovacaoObservacao: set.has('aprovacao_observacao'),
          };
        })
        .catch(() => ({
          updatedAt: false,
          decididoEm: false,
          decididoPor: false,
          decisaoObservacao: false,
          aprovacaoObservacao: false,
        }));
    }

    return this.presencaAuditColumnsPromise;
  }
}
