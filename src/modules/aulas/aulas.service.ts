import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UserRole } from '../../common/enums/user-role.enum';
import { DatabaseService } from '../../database/database.service';
import { AulaQrCodeDto } from './dtos/aula-qrcode.dto';
import { AulaDto } from './dtos/aula.dto';
import { AulaResponseDto } from './dtos/aula-response.dto';
import { CreateAulaDto } from './dtos/create-aula.dto';
import { ListAulasQueryDto } from './dtos/list-aulas-query.dto';
import { UpdateAulaDto } from './dtos/update-aula.dto';

export type CurrentUser = {
  id: string;
  academiaId: string;
  roles?: UserRole[];
  role?: UserRole;
};

type AulaRow = {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  turma_id: string;
  turma_nome: string;
  tipo_treino: string;
  instrutor_nome: string | null;
  deleted_at: string | null;
  academia_id: string;
};

@Injectable()
export class AulasService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listarHoje(currentUser: CurrentUser): Promise<AulaDto[]> {
    const tz = this.databaseService.getAppTimezone();
    const { startUtc, endUtc } =
      await this.databaseService.getTodayBoundsUtc(tz);

    const aulas = await this.databaseService.query<AulaRow>(
      `
        select
          a.id,
          a.data_inicio,
          a.data_fim,
          a.status,
          t.id as turma_id,
          t.nome as turma_nome,
          to_char(t.horario_padrao, 'HH24:MI') as turma_horario_padrao,
          tt.nome as tipo_treino,
          instrutor.nome_completo as instrutor_nome,
          a.deleted_at,
          a.academia_id
        from aulas a
        join turmas t on t.id = a.turma_id
        join tipos_treino tt on tt.id = t.tipo_treino_id
        left join usuarios instrutor on instrutor.id = t.instrutor_padrao_id
        where a.academia_id = $1
          and a.data_inicio >= $2
          and a.data_inicio < $3
          and a.status <> 'CANCELADA'
          and a.deleted_at is null
          and t.deleted_at is null
        order by a.data_inicio asc;
      `,
      [currentUser.academiaId, startUtc, endUtc],
    );

    return aulas.map((aula) => ({
      id: aula.id,
      dataInicio: new Date(aula.data_inicio).toISOString(),
      dataFim: new Date(aula.data_fim).toISOString(),
      status: aula.status,
      turmaId: aula.turma_id,
      turmaNome: aula.turma_nome,
      turmaHorarioPadrao: (aula as any).turma_horario_padrao,
      tipoTreino: aula.tipo_treino,
      instrutorNome: aula.instrutor_nome ?? null,
    }));
  }

  async gerarQrCode(
    id: string,
    currentUser: CurrentUser,
  ): Promise<AulaQrCodeDto> {
    const aula = await this.buscarAula(id, currentUser.academiaId, {
      includeDeleted: false,
    });

    if (!aula) {
      throw new NotFoundException('Aula nao encontrada');
    }

    const ttlMinutes = this.resolveQrTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const qrToken = randomBytes(32).toString('hex');

    await this.databaseService.query(
      `
        update aulas
           set qr_token = $1,
               qr_expires_at = $2
         where id = $3
           and academia_id = $4;
      `,
      [qrToken, expiresAt, id, currentUser.academiaId],
    );

    return {
      aulaId: id,
      qrToken,
      expiresAt: expiresAt.toISOString(),
      turma: aula.turma_nome,
      horario: new Date(aula.data_inicio).toISOString(),
    };
  }

  async listar(
    query: ListAulasQueryDto,
    currentUser: CurrentUser,
  ): Promise<AulaResponseDto[]> {
    const { where, params } = this.buildListQuery(query, currentUser);

    const aulas = await this.databaseService.query<AulaRow>(
      `
        select
          a.id,
          a.data_inicio,
          a.data_fim,
          a.status,
          a.turma_id,
          t.nome as turma_nome,
          tt.nome as tipo_treino,
          instrutor.nome_completo as instrutor_nome,
          a.deleted_at,
          a.academia_id
        from aulas a
        join turmas t on t.id = a.turma_id
        join tipos_treino tt on tt.id = t.tipo_treino_id
        left join usuarios instrutor on instrutor.id = t.instrutor_padrao_id
        where ${where.join(' and ')}
        order by a.data_inicio asc;
      `,
      params,
    );

    return aulas.map((row) => this.mapRow(row));
  }

  async detalhar(
    id: string,
    currentUser: CurrentUser,
    includeDeleted?: boolean,
  ): Promise<AulaResponseDto> {
    const aula = await this.buscarAula(id, currentUser.academiaId, {
      includeDeleted,
    });
    if (!aula) {
      throw new NotFoundException('Aula nao encontrada');
    }

    if (!includeDeleted && aula.deleted_at) {
      throw new NotFoundException('Aula nao encontrada');
    }

    return this.mapRow(aula);
  }

  async criar(
    dto: CreateAulaDto,
    currentUser: CurrentUser,
  ): Promise<AulaResponseDto> {
    this.ensureStaff(currentUser);
    await this.validarTurma(dto.turmaId, currentUser.academiaId);
    this.ensureDateOrder(dto.dataInicio, dto.dataFim);
    await this.ensureAulaUnica(dto.turmaId, dto.dataInicio, currentUser.academiaId);

    const created = await this.databaseService.queryOne<AulaRow>(
      `
        insert into aulas (
          academia_id,
          turma_id,
          data_inicio,
          data_fim,
          status
        ) values ($1, $2, $3, $4, $5)
        returning
          id,
          data_inicio,
          data_fim,
          status,
          turma_id,
          (select nome from turmas where id = $2) as turma_nome,
          (select nome from tipos_treino where id = (select tipo_treino_id from turmas where id = $2)) as tipo_treino,
          (select u.nome_completo from usuarios u join turmas t on t.instrutor_padrao_id = u.id where t.id = $2) as instrutor_nome,
          deleted_at,
          academia_id;
      `,
      [
        currentUser.academiaId,
        dto.turmaId,
        dto.dataInicio,
        dto.dataFim,
        dto.status ?? 'AGENDADA',
      ],
    );

    if (!created) {
      throw new BadRequestException('Falha ao criar aula');
    }

    return this.mapRow(created);
  }

  async atualizar(
    id: string,
    dto: UpdateAulaDto,
    currentUser: CurrentUser,
  ): Promise<AulaResponseDto> {
    this.ensureStaff(currentUser);
    const aula = await this.buscarAula(id, currentUser.academiaId, {
      includeDeleted: false,
    });

    if (!aula) {
      throw new NotFoundException('Aula nao encontrada');
    }

    if (dto.dataInicio || dto.dataFim) {
      this.ensureDateOrder(
        dto.dataInicio ?? aula.data_inicio,
        dto.dataFim ?? aula.data_fim,
      );
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const push = (field: string, value: any) => {
      updates.push(`${field} = $${idx}`);
      params.push(value);
      idx += 1;
    };

    if (dto.dataInicio !== undefined) push('data_inicio', dto.dataInicio);
    if (dto.dataFim !== undefined) push('data_fim', dto.dataFim);
    if (dto.status !== undefined) push('status', dto.status);

    if (updates.length === 0) {
      return this.mapRow(aula);
    }

    params.push(id, currentUser.academiaId);

    const updated = await this.databaseService.queryOne<AulaRow>(
      `
        update aulas
           set ${updates.join(', ')}
         where id = $${idx}
           and academia_id = $${idx + 1}
         returning
           id,
           data_inicio,
           data_fim,
           status,
           turma_id,
           (select nome from turmas where id = turma_id) as turma_nome,
           (select nome from tipos_treino where id = (select tipo_treino_id from turmas where id = turma_id)) as tipo_treino,
           (select u.nome_completo from usuarios u join turmas t on t.instrutor_padrao_id = u.id where t.id = turma_id) as instrutor_nome,
           deleted_at,
           academia_id;
      `,
      params,
    );

    if (!updated) {
      throw new NotFoundException('Aula nao encontrada');
    }

    return this.mapRow(updated);
  }

  async remover(id: string, currentUser: CurrentUser): Promise<void> {
    this.ensureStaff(currentUser);
    const aula = await this.buscarAula(id, currentUser.academiaId, {
      includeDeleted: true,
    });
    if (!aula) {
      throw new NotFoundException('Aula nao encontrada');
    }

    await this.databaseService.query(
      `
        update aulas
           set deleted_at = now()
         where id = $1
           and academia_id = $2;
      `,
      [id, currentUser.academiaId],
    );
  }

  async restaurar(id: string, currentUser: CurrentUser): Promise<AulaResponseDto> {
    this.ensureStaff(currentUser);
    const aula = await this.buscarAula(id, currentUser.academiaId, {
      includeDeleted: true,
    });

    if (!aula) {
      throw new NotFoundException('Aula nao encontrada');
    }

    if (!aula.deleted_at) {
      throw new ConflictException('Aula nao esta deletada');
    }

    await this.ensureAulaUnica(aula.turma_id, aula.data_inicio, currentUser.academiaId);

    await this.databaseService.query(
      `
        update aulas
           set deleted_at = null
         where id = $1
           and academia_id = $2;
      `,
      [id, currentUser.academiaId],
    );

    const restored = await this.buscarAula(id, currentUser.academiaId, {
      includeDeleted: false,
    });

    if (!restored) {
      throw new NotFoundException('Aula nao encontrada apos restaurar');
    }

    return this.mapRow(restored);
  }

  async cancelar(id: string, currentUser: CurrentUser): Promise<AulaResponseDto> {
    this.ensureStaff(currentUser);
    const aula = await this.buscarAula(id, currentUser.academiaId, {
      includeDeleted: false,
    });

    if (!aula) {
      throw new NotFoundException('Aula nao encontrada');
    }

    const updated = await this.databaseService.queryOne<AulaRow>(
      `
        update aulas
           set status = 'CANCELADA',
               qr_token = null,
               qr_expires_at = null
         where id = $1
           and academia_id = $2
         returning
           id,
           data_inicio,
           data_fim,
           status,
           turma_id,
           (select nome from turmas where id = turma_id) as turma_nome,
           (select nome from tipos_treino where id = (select tipo_treino_id from turmas where id = turma_id)) as tipo_treino,
           (select u.nome_completo from usuarios u join turmas t on t.instrutor_padrao_id = u.id where t.id = turma_id) as instrutor_nome,
           deleted_at,
           academia_id;
      `,
      [id, currentUser.academiaId],
    );

    if (!updated) {
      throw new NotFoundException('Aula nao encontrada');
    }

    return this.mapRow(updated);
  }

  private ensureStaff(user: CurrentUser) {
    const roles = (user.roles ?? (user.role ? [user.role] : [])).map((r) =>
      (r as string).toUpperCase(),
    );
    const allowed = [
      UserRole.INSTRUTOR,
      UserRole.PROFESSOR,
      UserRole.ADMIN,
      UserRole.TI,
    ];
    if (!roles.some((r) => allowed.includes(r as UserRole))) {
      throw new ForbiddenException('Apenas staff pode executar esta acao');
    }
  }

  private ensureDateOrder(dataInicio: string, dataFim: string) {
    if (new Date(dataFim) <= new Date(dataInicio)) {
      throw new BadRequestException('dataFim deve ser maior que dataInicio');
    }
  }

  private async validarTurma(turmaId: string, academiaId: string) {
    const turma = await this.databaseService.queryOne<{ id: string; deleted_at: string | null }>(
      `
        select id, deleted_at
        from turmas
        where id = $1
          and academia_id = $2
        limit 1;
      `,
      [turmaId, academiaId],
    );

    if (!turma) {
      throw new NotFoundException('Turma nao encontrada');
    }

    if (turma.deleted_at) {
      throw new ConflictException('Turma deletada nao pode receber aulas');
    }
  }

  private async ensureAulaUnica(
    turmaId: string,
    dataInicio: string,
    academiaId: string,
  ) {
    const exists = await this.databaseService.queryOne<{ id: string }>(
      `
        select id
        from aulas
        where turma_id = $1
          and academia_id = $2
          and data_inicio = $3
          and deleted_at is null
        limit 1;
      `,
      [turmaId, academiaId, dataInicio],
    );

    if (exists) {
      throw new ConflictException(
        'Ja existe aula ativa para a turma neste horario',
      );
    }
  }

  private buildListQuery(
    query: ListAulasQueryDto,
    currentUser: CurrentUser,
  ): { where: string[]; params: any[] } {
    const where = ['a.academia_id = $1'];
    const params: any[] = [currentUser.academiaId];
    let idx = 2;

    const onlyDeleted = !!query.onlyDeleted;
    const includeDeleted = !!query.includeDeleted;

    if (onlyDeleted) {
      where.push('a.deleted_at is not null');
    } else if (!includeDeleted) {
      where.push('a.deleted_at is null');
    }

    if (query.turmaId) {
      where.push(`a.turma_id = $${idx}`);
      params.push(query.turmaId);
      idx += 1;
    }

    if (query.status) {
      where.push(`a.status = $${idx}`);
      params.push(query.status);
      idx += 1;
    }

    if (query.from) {
      where.push(`a.data_inicio >= $${idx}`);
      params.push(query.from);
      idx += 1;
    }

    if (query.to) {
      where.push(`a.data_inicio <= $${idx}`);
      params.push(query.to);
      idx += 1;
    }

    if (!query.from && !query.to) {
      const now = Date.now();
      const defaultFrom = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const defaultTo = new Date(now + 7 * 24 * 60 * 60 * 1000);
      where.push(
        `a.data_inicio between $${idx} and $${idx + 1}`,
      );
      params.push(defaultFrom.toISOString(), defaultTo.toISOString());
    }

    return { where, params };
  }

  private async buscarAula(
    id: string,
    academiaId: string,
    opts?: { includeDeleted?: boolean },
  ): Promise<AulaRow | null> {
    return this.databaseService.queryOne<AulaRow>(
      `
        select
          a.id,
          a.data_inicio,
          a.data_fim,
          a.status,
          a.turma_id,
          t.nome as turma_nome,
          tt.nome as tipo_treino,
          instrutor.nome_completo as instrutor_nome,
          a.deleted_at,
          a.academia_id
        from aulas a
        join turmas t on t.id = a.turma_id
        join tipos_treino tt on tt.id = t.tipo_treino_id
        left join usuarios instrutor on instrutor.id = t.instrutor_padrao_id
        where a.id = $1
          and a.academia_id = $2
          ${opts?.includeDeleted ? '' : 'and a.deleted_at is null'}
        limit 1;
      `,
      [id, academiaId],
    );
  }

  private resolveQrTtlMinutes(): number {
    const raw = Number(process.env.QR_TTL_MINUTES ?? 5);
    if (Number.isFinite(raw) && raw > 0) {
      return raw;
    }
    return 5;
  }

  private mapRow(row: AulaRow): AulaResponseDto {
    return {
      id: row.id,
      turmaId: row.turma_id,
      turmaNome: row.turma_nome,
      dataInicio: new Date(row.data_inicio).toISOString(),
      dataFim: new Date(row.data_fim).toISOString(),
      status: row.status,
      tipoTreino: row.tipo_treino,
      instrutorNome: row.instrutor_nome ?? null,
      deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    };
  }
}
