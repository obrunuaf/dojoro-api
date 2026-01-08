import { Injectable } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { DatabaseService } from '../../database/database.service';

type UserWithRolesAndAcademias = {
  usuario_id: string;
  email: string;
  nome_completo: string;
  status: string;
  faixa_atual_slug: string | null;
  grau_atual: number | null;
  senha_hash: string;
  papel: UserRole;
  academia_id: string;
  academia_nome: string;
};

export type UserProfileRow = {
  usuario_id: string;
  email: string;
  nome_completo: string;
  usuario_status: string;
  faixa_atual_slug: string | null;
  grau_atual: number | null;
  papel: UserRole;
  matricula_status: string | null;
  matricula_data_inicio: string | null;
  matricula_data_fim: string | null;
  academia_id: string;
  academia_nome: string;
  data_nascimento: string | null;
};

@Injectable()
export class AuthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findUserByEmail(email: string) {
    const query = `
      select
        id,
        email,
        senha_hash,
        nome_completo,
        status,
        faixa_atual_slug,
        grau_atual
      from usuarios
      where email = $1
      limit 1;
    `;

    return this.databaseService.queryOne<{
      id: string;
      email: string;
      senha_hash: string;
      nome_completo: string;
      status: string;
      faixa_atual_slug: string | null;
      grau_atual: number | null;
    }>(query, [email]);
  }

  async findUserWithRolesAndAcademiasByEmail(
    email: string,
  ): Promise<UserWithRolesAndAcademias[]> {
    const query = `
      select
        u.id as usuario_id,
        u.email,
        u.nome_completo,
        u.status,
        u.faixa_atual_slug,
        u.grau_atual,
        u.senha_hash,
        up.papel,
        up.academia_id,
        a.nome as academia_nome
      from usuarios u
      join usuarios_papeis up on up.usuario_id = u.id
      join academias a on a.id = up.academia_id
      where u.email = $1;
    `;

    return this.databaseService.query<UserWithRolesAndAcademias>(query, [
      email,
    ]);
  }

  async findUserWithRolesAndAcademiasByUserId(
    usuarioId: string,
  ): Promise<UserWithRolesAndAcademias[]> {
    const query = `
      select
        u.id as usuario_id,
        u.email,
        u.nome_completo,
        u.status,
        u.faixa_atual_slug,
        u.grau_atual,
        u.senha_hash,
        up.papel,
        up.academia_id,
        a.nome as academia_nome
      from usuarios u
      join usuarios_papeis up on up.usuario_id = u.id
      join academias a on a.id = up.academia_id
      where u.id = $1
        and u.status = 'ACTIVE';
    `;

    return this.databaseService.query<UserWithRolesAndAcademias>(query, [
      usuarioId,
    ]);
  }

  async findUserProfileByIdAndAcademia(
    usuarioId: string,
    academiaId: string,
  ): Promise<UserProfileRow[]> {
    const query = `
      select
        u.id as usuario_id,
        u.email,
        u.nome_completo,
        u.status as usuario_status,
        COALESCE(u.faixa_atual_slug, u.faixa_declarada) as faixa_atual_slug,
        u.grau_atual,
        u.data_nascimento,
        up.papel,
        m.status as matricula_status,
        m.data_inicio as matricula_data_inicio,
        m.data_fim as matricula_data_fim,
        a.id as academia_id,
        a.nome as academia_nome
      from usuarios u
      join usuarios_papeis up
        on up.usuario_id = u.id
      join academias a
        on a.id = up.academia_id
      left join matriculas m
        on m.usuario_id = u.id
       and m.academia_id = a.id
      where u.id = $1
        and a.id = $2;
    `;

    return this.databaseService.query<UserProfileRow>(query, [
      usuarioId,
      academiaId,
    ]);
  }

  async findUserManagementStats(usuarioId: string): Promise<Array<{
    academia_id: string;
    pendencias_count: number;
    notificacoes_count: number;
    aula_agora: boolean;
  }>> {
    const query = `
      SELECT 
        up.academia_id,
        -- Só conta pendências se o usuário for ADMIN, PROFESSOR ou TI nessa academia
        CASE 
          WHEN up.papel IN ('ADMIN', 'PROFESSOR', 'TI') 
          THEN (SELECT COUNT(*)::int FROM matriculas m WHERE m.academia_id = up.academia_id AND m.status = 'PENDENTE')
          ELSE 0 
        END as pendencias_count,
        (SELECT COUNT(*)::int FROM notificacoes n WHERE n.usuario_id = $1 AND n.lida = false AND (n.academia_id = up.academia_id OR n.academia_id IS NULL)) as notificacoes_count,
        EXISTS (
          SELECT 1 FROM aulas a 
          WHERE a.academia_id = up.academia_id 
          AND NOW() BETWEEN a.data_inicio AND a.data_fim
        ) as aula_agora
      FROM usuarios_papeis up
      WHERE up.usuario_id = $1;
    `;
    return this.databaseService.query(query, [usuarioId]);
  }

  async findInviteByToken(token: string) {
    const query = `
      select
        c.id,
        c.academia_id,
        c.email,
        c.papel_sugerido,
        c.expires_at,
        c.used_at,
        a.nome as academia_nome
      from convites c
      join academias a on a.id = c.academia_id
      where c.token_hash = $1
        and c.used_at is null
        and (c.expires_at is null or c.expires_at > now())
      limit 1;
    `;

    return this.databaseService.queryOne<{
      id: string;
      academia_id: string;
      email: string;
      papel_sugerido: UserRole;
      expires_at: Date | null;
      used_at: Date | null;
      academia_nome: string;
    }>(query, [token]);
  }

  /**
   * Find academia by public code (for self-service signup)
   */
  async findAcademiaByCode(codigo: string): Promise<{
    id: string;
    nome: string;
    codigo: string;
  } | null> {
    return this.databaseService.queryOne<{
      id: string;
      nome: string;
      codigo: string;
    }>(
      `SELECT id, nome, codigo_convite as codigo 
       FROM academias 
       WHERE UPPER(codigo_convite) = UPPER($1) 
       LIMIT 1`,
      [codigo],
    );
  }

  async markInviteAsUsed(inviteId: string, usuarioId: string, ip?: string): Promise<void> {
    const query = `
      update convites
      set used_at = now(), used_by_ip = $2
      where id = $1;
    `;

    await this.databaseService.query(query, [inviteId, ip || null]);
  }

  /**
   * Find invite by secure token (SHA256 hashed) + OTP + signature
   * Used for the new secure magic link flow
   */
  async findInviteBySecureToken(
    tokenHash: string,
    otp: string,
    signature: string,
  ): Promise<{
    id: string;
    academia_id: string;
    email: string;
    papel_sugerido: UserRole;
    expires_at: Date | null;
    used_at: Date | null;
    academia_nome: string;
    validation_attempts: number;
  } | null> {
    const query = `
      select
        c.id,
        c.academia_id,
        c.email,
        c.papel_sugerido,
        c.expires_at,
        c.used_at,
        c.validation_attempts,
        a.nome as academia_nome
      from convites c
      join academias a on a.id = c.academia_id
      where c.token_hash = $1
        and c.otp_code = $2
        and c.signature = $3
        and c.used_at is null
        and (c.expires_at is null or c.expires_at > now())
        and (c.validation_attempts is null or c.validation_attempts < 5)
      limit 1;
    `;

    return this.databaseService.queryOne<{
      id: string;
      academia_id: string;
      email: string;
      papel_sugerido: UserRole;
      expires_at: Date | null;
      used_at: Date | null;
      academia_nome: string;
      validation_attempts: number;
    }>(query, [tokenHash, otp, signature]);
  }

  /**
   * Increment validation attempts for an invite (for rate limiting)
   */
  async incrementInviteAttempts(tokenHash: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE convites SET validation_attempts = COALESCE(validation_attempts, 0) + 1 WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async createUserWithRoleAndMatricula(params: {
    email: string;
    senhaHash: string;
    nomeCompleto: string;
    faixaAtualSlug?: string | null;
    grauAtual?: number | null;
    aceitouTermos: boolean;
    academiaId: string;
    papel: UserRole;
    matriculaStatus?: 'ATIVA' | 'PENDENTE';
  }): Promise<{
    usuario_id: string;
    academia_id: string;
    numero_matricula: number;
  }> {
    // Para alunos, garantir que tenham faixa branca por padrão
    const faixa = params.faixaAtualSlug ?? (params.papel === 'ALUNO' ? 'branca' : null);
    const grau = params.grauAtual ?? (params.papel === 'ALUNO' ? 0 : null);

    const usuario = await this.databaseService.queryOne<{ id: string }>(
      `
        insert into usuarios (
          email,
          senha_hash,
          nome_completo,
          faixa_atual_slug,
          grau_atual,
          aceitou_termos
        ) values ($1, $2, $3, $4, $5, $6)
        returning id;
      `,
      [
        params.email,
        params.senhaHash,
        params.nomeCompleto,
        faixa,
        grau,
        params.aceitouTermos,
      ],
    );

    if (!usuario) {
      throw new Error('Falha ao criar usuario');
    }

    await this.databaseService.query(
      `
        insert into usuarios_papeis (usuario_id, academia_id, papel)
        values ($1, $2, $3);
      `,
      [usuario.id, params.academiaId, params.papel],
    );

    const nextMatricula =
      (await this.databaseService.queryOne<{ next: number }>(
        `
          select coalesce(max(numero_matricula) + 1, 1) as next
          from matriculas
          where academia_id = $1;
        `,
        [params.academiaId],
      ))?.next ?? 1;

    const status = params.matriculaStatus ?? 'ATIVA';
    const matricula = await this.databaseService.queryOne<{
      numero_matricula: number;
    }>(
      `
        insert into matriculas (usuario_id, academia_id, numero_matricula, status)
        values ($1, $2, $3, $4)
        returning numero_matricula;
      `,
      [usuario.id, params.academiaId, nextMatricula, status],
    );

    return {
      usuario_id: usuario.id,
      academia_id: params.academiaId,
      numero_matricula: matricula?.numero_matricula ?? nextMatricula,
    };
  }

  // =============== PASSWORD RESET OTP METHODS ===============

  /**
   * Invalidates any existing tokens for user and creates a new one
   */
  async createPasswordResetToken(
    usuarioId: string,
    codigoHash: string,
    expiresAt: Date,
  ): Promise<{ id: string }> {
    // Invalidate all previous tokens for this user
    await this.databaseService.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE usuario_id = $1 AND used_at IS NULL`,
      [usuarioId],
    );

    // Create new token
    return this.databaseService.queryOne<{ id: string }>(
      `
        INSERT INTO password_reset_tokens (usuario_id, codigo_hash, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id;
      `,
      [usuarioId, codigoHash, expiresAt],
    ) as Promise<{ id: string }>;
  }

  /**
   * Find valid (not expired, not used) token for user
   */
  async findValidPasswordResetToken(
    usuarioId: string,
    codigoHash: string,
  ): Promise<{ id: string; expires_at: Date } | null> {
    return this.databaseService.queryOne<{ id: string; expires_at: Date }>(
      `
        SELECT id, expires_at
        FROM password_reset_tokens
        WHERE usuario_id = $1
          AND codigo_hash = $2
          AND used_at IS NULL
          AND expires_at > now()
        LIMIT 1;
      `,
      [usuarioId, codigoHash],
    );
  }

  /**
   * Mark token as used
   */
  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
      [tokenId],
    );
  }

  /**
   * Update user password
   */
  async updateUserPassword(usuarioId: string, senhaHash: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE usuarios SET senha_hash = $1 WHERE id = $2`,
      [senhaHash, usuarioId],
    );
  }

  /**
   * Update user profile fields
   */
  async updateUserProfile(
    usuarioId: string,
    data: { telefone?: string; dataNascimento?: string },
  ): Promise<{
    id: string;
    telefone: string | null;
    data_nascimento: string | null;
  }> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.telefone !== undefined) {
      sets.push(`telefone = $${idx++}`);
      params.push(data.telefone);
    }
    if (data.dataNascimento !== undefined) {
      sets.push(`data_nascimento = $${idx++}`);
      params.push(data.dataNascimento);
    }

    if (sets.length === 0) {
      // Nothing to update, just return current
      return this.databaseService.queryOne<{
        id: string;
        telefone: string | null;
        data_nascimento: string | null;
      }>(
        `SELECT id, telefone, data_nascimento FROM usuarios WHERE id = $1`,
        [usuarioId],
      ) as Promise<{ id: string; telefone: string | null; data_nascimento: string | null }>;
    }

    params.push(usuarioId);
    return this.databaseService.queryOne<{
      id: string;
      telefone: string | null;
      data_nascimento: string | null;
    }>(
      `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, telefone, data_nascimento`,
      params,
    ) as Promise<{ id: string; telefone: string | null; data_nascimento: string | null }>;
  }

  // =============== REFRESH TOKEN METHODS ===============

  /**
   * Create a new refresh token for a user session
   */
  async createRefreshToken(params: {
    usuarioId: string;
    tokenHash: string;
    deviceInfo: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    return this.databaseService.queryOne<{ id: string }>(
      `
        INSERT INTO refresh_tokens (usuario_id, token_hash, device_info, ip_address, user_agent, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `,
      [
        params.usuarioId,
        params.tokenHash,
        params.deviceInfo,
        params.ipAddress,
        params.userAgent,
        params.expiresAt,
      ],
    ) as Promise<{ id: string }>;
  }

  /**
   * Find valid refresh token by hash
   */
  async findValidRefreshToken(tokenHash: string): Promise<{
    id: string;
    usuario_id: string;
    expires_at: Date;
  } | null> {
    return this.databaseService.queryOne<{
      id: string;
      usuario_id: string;
      expires_at: Date;
    }>(
      `
        SELECT id, usuario_id, expires_at
        FROM refresh_tokens
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        LIMIT 1;
      `,
      [tokenHash],
    );
  }

  /**
   * Revoke a refresh token (logout)
   */
  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`,
      [tokenId],
    );
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   */
  async revokeAllRefreshTokens(usuarioId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE usuario_id = $1 AND revoked_at IS NULL`,
      [usuarioId],
    );
  }

  /**
   * Update last used timestamp
   */
  async updateRefreshTokenLastUsed(tokenId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE refresh_tokens SET ultimo_uso = now() WHERE id = $1`,
      [tokenId],
    );
  }

  /**
   * List active sessions for a user
   */
  async listUserSessions(usuarioId: string): Promise<Array<{
    id: string;
    device_info: string | null;
    ip_address: string | null;
    criado_em: string;
    ultimo_uso: string | null;
  }>> {
    return this.databaseService.query(
      `
        SELECT id, device_info, ip_address, criado_em, ultimo_uso
        FROM refresh_tokens
        WHERE usuario_id = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        ORDER BY criado_em DESC;
      `,
      [usuarioId],
    );
  }
}
