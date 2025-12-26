import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AulasService } from '../aulas/aulas.service';
import { CreateTurmaDto } from './dtos/create-turma.dto';
import { ListTurmasQueryDto } from './dtos/list-turmas-query.dto';
import { TurmaResponseDto } from './dtos/turma-response.dto';
import { TurmaAlertaDto } from './dtos/turma-alerta.dto';
import { UpdateTurmaDto } from './dtos/update-turma.dto';

export type CurrentUser = {
  id: string;
  role: string;
  roles?: string[];
  academiaId: string;
};

type TurmaRow = {
  id: string;
  nome: string;
  dias_semana: number[];
  hora_inicio: string;
  hora_fim: string;
  tipo_treino: string;
  tipo_treino_cor: string | null;
  instrutor_id: string | null;
  instrutor_nome: string | null;
  deleted_at: string | null;
};

type TipoTreinoRow = {
  id: string;
  codigo: string;
  nome: string;
  cor_identificacao: string | null;
};

@Injectable()
export class TurmasService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => AulasService))
    private readonly aulasService: AulasService,
  ) {}

  async listar(
    currentUser: CurrentUser,
    query?: ListTurmasQueryDto,
  ): Promise<TurmaResponseDto[]> {
    const includeDeleted = !!query?.includeDeleted;
    const onlyDeleted = !!query?.onlyDeleted;
    const isStaff = this.userIsStaff(currentUser);
    if ((includeDeleted || onlyDeleted) && !isStaff) {
      throw new ForbiddenException('Apenas staff pode listar deletadas');
    }

    const turmas = await this.databaseService.query<TurmaRow>(
      `
        select
          t.id,
          t.nome,
          t.dias_semana,
          to_char(t.hora_inicio, 'HH24:MI') as hora_inicio,
          to_char(t.hora_fim, 'HH24:MI') as hora_fim,
          tt.nome as tipo_treino,
          COALESCE(tt.cor_identificacao,
            CASE
              WHEN lower(tt.nome) LIKE '%kids%' OR lower(tt.nome) LIKE '%infantil%' THEN '#22C55E'
              WHEN lower(tt.nome) LIKE '%no-gi%' OR lower(tt.nome) LIKE '%nogi%' THEN '#F97316'
              WHEN lower(tt.nome) LIKE '%gi%' THEN '#3B82F6'
              ELSE '#6B7280'
            END
          ) as tipo_treino_cor,
          instrutor.id as instrutor_id,
          instrutor.nome_completo as instrutor_nome,
          t.deleted_at
        from turmas t
        join tipos_treino tt
          on tt.id = t.tipo_treino_id
        left join usuarios instrutor
          on instrutor.id = t.instrutor_padrao_id
        where t.academia_id = $1
          ${onlyDeleted ? 'and t.deleted_at is not null' : includeDeleted ? '' : 'and t.deleted_at is null'}
        order by t.nome asc;
      `,
      [currentUser.academiaId],
    );

    return turmas.map((turma) => this.mapRow(turma));
  }

  async detalhar(id: string, currentUser: CurrentUser): Promise<TurmaResponseDto> {
    const turma = await this.buscarTurma(id, currentUser.academiaId, {
      includeDeleted: true,
    });
    if (!turma) {
      throw new NotFoundException('Turma nao encontrada');
    }

    if (turma.deleted_at) {
      throw new NotFoundException('Turma nao encontrada');
    }

    return this.mapRow(turma);
  }

  async criar(
    dto: CreateTurmaDto,
    currentUser: CurrentUser,
  ): Promise<TurmaResponseDto> {
    this.ensureStaff(currentUser);
    const tipoTreino = await this.resolveTipoTreinoOrThrow(
      dto.tipoTreinoId,
      currentUser.academiaId,
    );
    await this.validarInstrutor(dto.instrutorPadraoId, currentUser.academiaId);

    // Calcular duração em minutos
    const [horaInicioH, horaInicioM] = dto.horaInicio.split(':').map(Number);
    const [horaFimH, horaFimM] = dto.horaFim.split(':').map(Number);
    const duracaoMinutos = (horaFimH * 60 + horaFimM) - (horaInicioH * 60 + horaInicioM);

    if (duracaoMinutos <= 0) {
      throw new BadRequestException('horaFim deve ser maior que horaInicio');
    }

    const turma = await this.databaseService.queryOne<TurmaRow & { academia_id: string }>(
      `
        insert into turmas (
          nome,
          tipo_treino_id,
          dias_semana,
          hora_inicio,
          hora_fim,
          instrutor_padrao_id,
          academia_id
        ) values ($1, $2, $3, $4, $5, $6, $7)
        returning
          id,
          nome,
          dias_semana,
          to_char(hora_inicio, 'HH24:MI') as hora_inicio,
          to_char(hora_fim, 'HH24:MI') as hora_fim,
          tipo_treino_id,
          instrutor_padrao_id,
          academia_id,
          null::varchar as tipo_treino_cor,
          null::timestamptz as deleted_at;
      `,
      [
        dto.nome,
        tipoTreino.id,
        dto.diasSemana,
        dto.horaInicio,
        dto.horaFim,
        dto.instrutorPadraoId ?? null,
        currentUser.academiaId,
      ],
    );

    if (!turma) {
      throw new BadRequestException('Falha ao criar turma');
    }

    const instrutorNome = await this.buscarInstrutorNome(
      dto.instrutorPadraoId,
      currentUser.academiaId,
    );

    // Auto-gerar aulas para as próximas 12 semanas
    try {
      const today = new Date();
      const in12Weeks = new Date();
      in12Weeks.setDate(in12Weeks.getDate() + 84); // 12 weeks = 84 days

      await this.aulasService.criarEmLote(
        {
          turmaId: turma.id,
          fromDate: today.toISOString().split('T')[0],
          toDate: in12Weeks.toISOString().split('T')[0],
          diasSemana: dto.diasSemana,
          horaInicio: dto.horaInicio,
          duracaoMinutos: duracaoMinutos,
        },
        currentUser as any,
      );
    } catch (err) {
      // Log mas não falha a criação da turma
      console.error('Erro ao auto-gerar aulas:', err);
    }

    return {
      id: turma.id,
      nome: turma.nome,
      tipoTreino: tipoTreino.nome,
      tipoTreinoCor: tipoTreino.cor_identificacao || (
        tipoTreino.nome.toLowerCase().includes('kids') || tipoTreino.nome.toLowerCase().includes('infantil') ? '#22C55E' :
        tipoTreino.nome.toLowerCase().includes('no-gi') || tipoTreino.nome.toLowerCase().includes('nogi') ? '#F97316' :
        tipoTreino.nome.toLowerCase().includes('gi') ? '#3B82F6' : '#6B7280'
      ),
      diasSemana: dto.diasSemana.map(Number),
      horaInicio: dto.horaInicio,
      horaFim: dto.horaFim,
      duracaoMinutos: duracaoMinutos,
      instrutorPadraoId: dto.instrutorPadraoId ?? null,
      instrutorPadraoNome: instrutorNome,
      deletedAt: null,
    };
  }

  async atualizar(
    id: string,
    dto: UpdateTurmaDto,
    currentUser: CurrentUser,
  ): Promise<TurmaResponseDto> {
    this.ensureStaff(currentUser);
    const turma = await this.buscarTurma(id, currentUser.academiaId, {
      includeDeleted: false,
    });

    if (!turma) {
      throw new NotFoundException('Turma nao encontrada');
    }

    const resolvedTipoTreino =
      dto.tipoTreinoId !== undefined
        ? await this.resolveTipoTreinoOrThrow(dto.tipoTreinoId, currentUser.academiaId)
        : null;
    await this.validarInstrutor(dto.instrutorPadraoId, currentUser.academiaId);

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const pushUpdate = (field: string, value: any) => {
      updates.push(`${field} = $${idx}`);
      params.push(value);
      idx += 1;
    };

    if (dto.nome !== undefined) pushUpdate('nome', dto.nome);
    if (dto.tipoTreinoId !== undefined)
      pushUpdate('tipo_treino_id', resolvedTipoTreino!.id);
    if (dto.diasSemana !== undefined) pushUpdate('dias_semana', dto.diasSemana);
    if (dto.horaInicio !== undefined)
      pushUpdate('hora_inicio', dto.horaInicio);
    if (dto.horaFim !== undefined)
      pushUpdate('hora_fim', dto.horaFim);
    if (dto.instrutorPadraoId !== undefined)
      pushUpdate('instrutor_padrao_id', dto.instrutorPadraoId ?? null);

    if (updates.length === 0) {
      return this.mapRow(turma);
    }

    params.push(id, currentUser.academiaId);

    const updated = await this.databaseService.queryOne<TurmaRow & { academia_id: string }>(
      `
        update turmas
           set ${updates.join(', ')}
         where id = $${idx}
           and academia_id = $${idx + 1}
         returning
           id,
           nome,
           dias_semana,
           to_char(hora_inicio, 'HH24:MI') as hora_inicio,
           to_char(hora_fim, 'HH24:MI') as hora_fim,
           instrutor_padrao_id as instrutor_id,
           (select nome from tipos_treino where id = turmas.tipo_treino_id) as tipo_treino,
           (select 
              COALESCE(cor_identificacao, 
                CASE 
                  WHEN lower(nome) LIKE '%kids%' OR lower(nome) LIKE '%infantil%' THEN '#22C55E'
                  WHEN lower(nome) LIKE '%no-gi%' OR lower(nome) LIKE '%nogi%' THEN '#F97316'
                  WHEN lower(nome) LIKE '%gi%' THEN '#3B82F6'
                  ELSE '#6B7280'
                END
              )
            from tipos_treino where id = turmas.tipo_treino_id) as tipo_treino_cor,
           (select nome_completo from usuarios where id = instrutor_padrao_id) as instrutor_nome,
           deleted_at,
           academia_id;
      `,
      params,
    );

    if (!updated) {
      throw new NotFoundException('Turma nao encontrada');
    }

    // Se solicitado, atualizar aulas futuras com os novos horários
    if (dto.atualizarAulasFuturas && (dto.horaInicio || dto.horaFim || dto.instrutorPadraoId !== undefined)) {
      const novaHoraInicio = dto.horaInicio || turma.hora_inicio;
      const novaHoraFim = dto.horaFim || turma.hora_fim;

      // Calcular duração em minutos
      const [hI, mI] = novaHoraInicio.split(':').map(Number);
      const [hF, mF] = novaHoraFim.split(':').map(Number);
      const duracaoMinutos = (hF * 60 + mF) - (hI * 60 + mI);

      // Atualizar aulas futuras agendadas
      const tz = this.databaseService.getAppTimezone();
      const aulasAtualizadas = await this.databaseService.query<{ id: string }>(
        `
          UPDATE aulas
          SET 
            data_inicio = date_trunc('day', data_inicio AT TIME ZONE $5) + $3::time,
            data_fim = date_trunc('day', data_inicio AT TIME ZONE $5) + $4::time
            ${dto.instrutorPadraoId !== undefined ? `, instrutor_id = $6` : ''}
          WHERE turma_id = $1
            AND academia_id = $2
            AND deleted_at IS NULL
            AND status = 'AGENDADA'
            AND data_inicio > NOW()
          RETURNING id;
        `,
        dto.instrutorPadraoId !== undefined 
          ? [id, currentUser.academiaId, novaHoraInicio, novaHoraFim, tz, dto.instrutorPadraoId]
          : [id, currentUser.academiaId, novaHoraInicio, novaHoraFim, tz],
      );

      console.log(`Turma ${id}: ${aulasAtualizadas.length} aulas futuras atualizadas`);
    }

    return this.mapRow({
      ...updated,
      tipo_treino: updated.tipo_treino,
      instrutor_nome: updated.instrutor_nome,
    });
  }

  async remover(id: string, currentUser: CurrentUser): Promise<void> {
    this.ensureStaff(currentUser);
    const turma = await this.buscarTurma(id, currentUser.academiaId, {
      includeDeleted: true,
    });
    if (!turma) {
      throw new NotFoundException('Turma nao encontrada');
    }

    // Cancelar automaticamente todas as aulas futuras desta turma
    const canceladas = await this.databaseService.query<{ id: string }>(
      `
        update aulas
           set status = 'CANCELADA'
         where turma_id = $1
           and academia_id = $2
           and deleted_at is null
           and data_inicio >= now()
           and status = 'AGENDADA'
        returning id;
      `,
      [id, currentUser.academiaId],
    );

    if (canceladas.length > 0) {
      console.log(`Turma ${id} arquivada: ${canceladas.length} aulas futuras canceladas`);
    }

    await this.databaseService.query(
      `
        update turmas
           set deleted_at = now(),
               deleted_by = $1
         where id = $2
           and academia_id = $3;
      `,
      [currentUser.id, id, currentUser.academiaId],
    );
  }

  async restaurar(id: string, currentUser: CurrentUser): Promise<TurmaResponseDto> {
    this.ensureStaff(currentUser);
    const turma = await this.buscarTurma(id, currentUser.academiaId, {
      includeDeleted: true,
    });

    if (!turma) {
      throw new NotFoundException('Turma nao encontrada');
    }

    if (!turma.deleted_at) {
      throw new ConflictException('Turma nao esta deletada');
    }

    const conflito = await this.databaseService.queryOne<{ id: string }>(
      `
        select id
        from turmas
        where academia_id = $1
          and deleted_at is null
          and lower(nome) = lower($2)
          and id <> $3
        limit 1;
      `,
      [currentUser.academiaId, turma.nome, id],
    );

    if (conflito) {
      throw new ConflictException(
        'Turma ja existe ativa com o mesmo nome. Renomeie antes de restaurar.',
      );
    }

    const updated = await this.databaseService.queryOne<{ id: string }>(
      `
        update turmas
           set deleted_at = null,
               deleted_by = null
         where id = $1
           and academia_id = $2
         returning id;
      `,
      [id, currentUser.academiaId],
    );

    if (!updated) {
      throw new NotFoundException('Turma nao encontrada');
    }

    const restored = await this.buscarTurma(id, currentUser.academiaId, {
      includeDeleted: false,
    });

    if (!restored) {
      throw new NotFoundException('Turma nao encontrada apos restaurar');
    }

    return this.mapRow(restored);
  }

  private mapRow(row: TurmaRow & { academia_id?: string }): TurmaResponseDto {
    // Calcular duração em minutos
    const [horaInicioH, horaInicioM] = (row.hora_inicio || '00:00').split(':').map(Number);
    const [horaFimH, horaFimM] = (row.hora_fim || '00:00').split(':').map(Number);
    const duracaoMinutos = (horaFimH * 60 + horaFimM) - (horaInicioH * 60 + horaInicioM);

    return {
      id: row.id,
      nome: row.nome,
      tipoTreino: row.tipo_treino,
      tipoTreinoCor: row.tipo_treino_cor ?? null,
      diasSemana: Array.isArray(row.dias_semana)
        ? row.dias_semana.map(Number)
        : [],
      horaInicio: row.hora_inicio,
      horaFim: row.hora_fim,
      duracaoMinutos: duracaoMinutos > 0 ? duracaoMinutos : 60,
      instrutorPadraoId: row.instrutor_id ?? null,
      instrutorPadraoNome: row.instrutor_nome ?? null,
      deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    };
  }

  private async buscarTurma(
    id: string,
    academiaId: string,
    opts?: { includeDeleted?: boolean },
  ): Promise<
    (TurmaRow & { academia_id: string; tipo_treino_id?: string }) | null
  > {
    return this.databaseService.queryOne(
      `
        select
          t.id,
          t.nome,
          t.dias_semana,
          to_char(t.hora_inicio, 'HH24:MI') as hora_inicio,
          to_char(t.hora_fim, 'HH24:MI') as hora_fim,
          tt.nome as tipo_treino,
          COALESCE(tt.cor_identificacao, 
            CASE 
              WHEN lower(tt.nome) LIKE '%kids%' OR lower(tt.nome) LIKE '%infantil%' THEN '#22C55E'
              WHEN lower(tt.nome) LIKE '%no-gi%' OR lower(tt.nome) LIKE '%nogi%' THEN '#F97316'
              WHEN lower(tt.nome) LIKE '%gi%' THEN '#3B82F6'
              ELSE '#6B7280'
            END
          ) as tipo_treino_cor,
          t.tipo_treino_id,
          t.instrutor_padrao_id as instrutor_id,
          instrutor.nome_completo as instrutor_nome,
          t.deleted_at,
          t.academia_id
        from turmas t
        join tipos_treino tt on tt.id = t.tipo_treino_id
        left join usuarios instrutor on instrutor.id = t.instrutor_padrao_id
        where t.id = $1
          and t.academia_id = $2
          ${opts?.includeDeleted ? '' : 'and t.deleted_at is null'}
        limit 1;
      `,
      [id, academiaId],
    );
  }

  private async resolveTipoTreinoOrThrow(
    codigo: string,
    academiaId: string,
  ): Promise<TipoTreinoRow> {
    const codigoNormalizado = codigo.toLowerCase();
    const tipo = await this.databaseService.queryOne<TipoTreinoRow>(
      `
        select id, lower(codigo) as codigo, nome, cor_identificacao
          from tipos_treino
         where lower(codigo) = $1
           and academia_id = $2
         limit 1;
      `,
      [codigoNormalizado, academiaId],
    );

    if (tipo) return tipo;

    const codigos = await this.listarCodigosTipoTreino(academiaId);
    if (!codigos.length) {
      throw new BadRequestException(
        'tipoTreinoId invalido. Nenhum tipo de treino configurado para a academia.',
      );
    }

    throw new BadRequestException(
      `tipoTreinoId invalido. Use um dos codigos: ${codigos.join(', ')}`,
    );
  }

  private async listarCodigosTipoTreino(academiaId: string): Promise<string[]> {
    const rows = await this.databaseService.query<{ codigo: string }>(
      `
        select lower(codigo) as codigo
          from tipos_treino
         where academia_id = $1
         order by lower(codigo) asc;
      `,
      [academiaId],
    );

    return rows.map((row) => row.codigo);
  }

  private async validarInstrutor(
    instrutorId: string | null | undefined,
    academiaId: string,
  ) {
    if (!instrutorId) return;

    const instrutor = await this.databaseService.queryOne<{ usuario_id: string }>(
      `
        select usuario_id
        from usuarios_papeis
        where usuario_id = $1
          and academia_id = $2
          and papel in ('INSTRUTOR', 'PROFESSOR', 'ADMIN', 'TI')
        limit 1;
      `,
      [instrutorId, academiaId],
    );

    if (!instrutor) {
      throw new NotFoundException(
        'Instrutor nao encontrado na academia ou sem papel de staff',
      );
    }
  }

  private async buscarInstrutorNome(
    instrutorId: string | null | undefined,
    academiaId: string,
  ): Promise<string | null> {
    if (!instrutorId) return null;
    const instrutor = await this.databaseService.queryOne<{ nome_completo: string }>(
      `
        select u.nome_completo
        from usuarios u
        join usuarios_papeis up
          on up.usuario_id = u.id
         and up.academia_id = $2
        where u.id = $1
        limit 1;
      `,
      [instrutorId, academiaId],
    );
    return instrutor?.nome_completo ?? null;
  }

  private ensureStaff(user: CurrentUser) {
    if (!this.userIsStaff(user)) {
      throw new ForbiddenException('Apenas staff pode executar esta acao');
    }
  }

  private userIsStaff(user: CurrentUser): boolean {
    const roles = (user.roles ?? [user.role]).map((r) => r.toUpperCase());
    // INSTRUTOR não pode criar/editar turmas - apenas PROFESSOR+
    const allowed = ['PROFESSOR', 'ADMIN', 'TI'];
    return roles.some((r) => allowed.includes(r));
  }

  /**
   * Lista turmas com última aula nos próximos 7 dias (turmas prestes a "expirar")
   */
  async listarAlertas(currentUser: CurrentUser): Promise<TurmaAlertaDto[]> {
    this.ensureStaff(currentUser);

    const rows = await this.databaseService.query<{
      id: string;
      nome: string;
      tipo_treino: string;
      tipo_treino_cor: string | null;
      ultima_aula: string;
      dias_restantes: number;
      total_aulas_futuras: number;
    }>(
      `
      SELECT 
        t.id,
        t.nome,
        tt.nome as tipo_treino,
        tt.cor_identificacao as tipo_treino_cor,
        MAX(a.data_inicio)::text as ultima_aula,
        EXTRACT(DAY FROM MAX(a.data_inicio) - NOW())::integer as dias_restantes,
        COUNT(a.id)::integer as total_aulas_futuras
      FROM turmas t
      JOIN tipos_treino tt ON tt.id = t.tipo_treino_id
      LEFT JOIN aulas a ON a.turma_id = t.id 
        AND a.deleted_at IS NULL 
        AND a.status = 'AGENDADA'
        AND a.data_inicio > NOW()
      WHERE t.academia_id = $1
        AND t.deleted_at IS NULL
      GROUP BY t.id, t.nome, tt.nome, tt.cor_identificacao
      HAVING MAX(a.data_inicio) IS NOT NULL 
        AND EXTRACT(DAY FROM MAX(a.data_inicio) - NOW()) <= 7
      ORDER BY dias_restantes ASC;
      `,
      [currentUser.academiaId],
    );

    return rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      tipoTreino: row.tipo_treino,
      tipoTreinoCor: row.tipo_treino_cor,
      ultimaAula: row.ultima_aula,
      diasRestantes: row.dias_restantes,
      totalAulasFuturas: row.total_aulas_futuras,
    }));
  }

  /**
   * Gera próximas 12 semanas de aulas para uma turma (renovação trimestral)
   */
  async renovar(
    id: string,
    currentUser: CurrentUser,
  ): Promise<{ aulasGeradas: number }> {
    this.ensureStaff(currentUser);

    const turma = await this.buscarTurma(id, currentUser.academiaId);
    if (!turma) {
      throw new NotFoundException('Turma nao encontrada');
    }

    // Buscar última aula agendada da turma
    const ultimaAula = await this.databaseService.queryOne<{ data_inicio: string }>(
      `
      SELECT data_inicio 
      FROM aulas 
      WHERE turma_id = $1 
        AND academia_id = $2 
        AND deleted_at IS NULL 
        AND status = 'AGENDADA'
      ORDER BY data_inicio DESC 
      LIMIT 1;
      `,
      [id, currentUser.academiaId],
    );

    // Calcular data de início (dia seguinte à última aula ou hoje)
    const fromDate = ultimaAula
      ? new Date(new Date(ultimaAula.data_inicio).getTime() + 86400000) // +1 dia
      : new Date();
    
    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + 84); // 12 semanas = 84 dias

    // Calcular duração a partir de hora_inicio e hora_fim da turma
    const [horaInicioH, horaInicioM] = (turma.hora_inicio || '00:00').split(':').map(Number);
    const [horaFimH, horaFimM] = (turma.hora_fim || '00:00').split(':').map(Number);
    const duracaoMinutos = (horaFimH * 60 + horaFimM) - (horaInicioH * 60 + horaInicioM);

    // Gerar aulas usando criarEmLote
    const result = await this.aulasService.criarEmLote(
      {
        turmaId: id,
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0],
        diasSemana: turma.dias_semana,
        horaInicio: turma.hora_inicio,
        duracaoMinutos: duracaoMinutos > 0 ? duracaoMinutos : 60,
      },
      currentUser as any,
    );

    return { aulasGeradas: result.criadas };
  }
}
