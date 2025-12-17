import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthRepository, UserProfileRow } from './auth.repository';
import { AuthTokensDto } from './dtos/auth-tokens.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { InviteValidationDto } from './dtos/invite-validation.dto';
import { LoginDto } from './dtos/login.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { RegisterDto } from './dtos/register.dto';
import { SignupDto } from './dtos/signup.dto';
import { MeResponseDto } from './dtos/me-response.dto';
import { VerifyOtpDto, ResetPasswordWithOtpDto } from './dtos/otp.dto';

type UserWithRole = {
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

type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  academiaId: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authRepository: AuthRepository,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokensDto> {
    if (!dto.senha) {
      throw new BadRequestException('Senha e obrigatoria');
    }

    const usuarios =
      await this.authRepository.findUserWithRolesAndAcademiasByEmail(
        dto.email,
      );

    if (!usuarios.length) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const usuario = usuarios[0];
    const senhaValida = await bcrypt.compare(dto.senha, usuario.senha_hash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const principal = this.pickPrimaryRole(usuarios);
    const roles = this.getRolesForAcademia(usuarios, principal.academia_id);
    const primaryRole = this.getPrimaryRole(roles);

    const payload = {
      sub: usuario.usuario_id,
      email: usuario.email,
      role: primaryRole,
      roles,
      academiaId: principal.academia_id,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: 'mock-refresh-token',
      user: {
        id: payload.sub,
        nome: usuario.nome_completo,
        email: payload.email,
        role: payload.role,
        roles,
        academiaId: payload.academiaId,
      },
    };
  }

  async me(currentUser: CurrentUser): Promise<MeResponseDto> {
    const rows = await this.authRepository.findUserProfileByIdAndAcademia(
      currentUser.id,
      currentUser.academiaId,
    );

    if (!rows.length) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    const primaryRow = this.pickPrimaryRole<UserProfileRow>(rows);
    const roles = this.getRolesForAcademia(rows, currentUser.academiaId);
    const role = this.getPrimaryRole(roles);

    // TODO: bloquear usuarios com status diferente de ACTIVE quando login/refresh forem ajustados
    if (primaryRow.usuario_status !== 'ACTIVE') {
      // no-op por enquanto; endpoint ainda retorna os dados
    }

    return {
      id: primaryRow.usuario_id,
      nome: primaryRow.nome_completo,
      email: primaryRow.email,
      role,
      roles,
      academiaId: primaryRow.academia_id,
      academiaNome: primaryRow.academia_nome,
      faixaAtual: primaryRow.faixa_atual_slug,
      grauAtual: primaryRow.grau_atual,
      matriculaStatus: primaryRow.matricula_status,
      matriculaDataInicio: primaryRow.matricula_data_inicio,
      matriculaDataFim: primaryRow.matricula_data_fim,
      profileComplete: primaryRow.data_nascimento !== null,
    };
  }

  async validateInvite(codigo: string): Promise<InviteValidationDto> {
    const invite = await this.authRepository.findInviteByToken(codigo);
    if (!invite) {
      throw new NotFoundException('Convite invalido ou expirado');
    }

    const papelSugerido = this.normalizeRole(
      (invite.papel_sugerido as string) ?? UserRole.ALUNO,
    );

    return {
      codigo,
      valido: true,
      status: 'VALIDO',
      academiaId: invite.academia_id,
      academiaNome: invite.academia_nome,
      roleSugerido: papelSugerido,
      emailSugerido: invite.email,
    };
  }

  async register(dto: RegisterDto): Promise<AuthTokensDto> {
    if (!dto.codigoConvite) {
      throw new BadRequestException('Codigo de convite e obrigatorio');
    }

    if (!dto.aceitouTermos) {
      throw new BadRequestException('Aceite dos termos e obrigatorio');
    }

    const invite = await this.authRepository.findInviteByToken(
      dto.codigoConvite,
    );
    if (!invite) {
      throw new BadRequestException('Convite invalido ou expirado');
    }

    // Caso o convite tenha um email predefinido diferente do informado, bloquear por enquanto.
    if (
      invite.email &&
      invite.email.toLowerCase() !== dto.email.toLowerCase()
    ) {
      throw new BadRequestException('Email nao bate com o convite');
    }

    const existente = await this.authRepository.findUserByEmail(dto.email);
    if (existente) {
      throw new BadRequestException('Email ja cadastrado');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const papelSugerido = this.normalizeRole(
      (invite.papel_sugerido as string) ?? UserRole.ALUNO,
    );
    const novoUsuario =
      await this.authRepository.createUserWithRoleAndMatricula({
        email: dto.email,
        senhaHash,
        nomeCompleto: dto.nomeCompleto ?? dto.nome ?? dto.email,
        aceitouTermos: dto.aceitouTermos,
        academiaId: invite.academia_id,
        papel: papelSugerido,
      });

    await this.authRepository.markInviteAsUsed(
      invite.id,
      novoUsuario.usuario_id,
    );

    const payload = {
      sub: novoUsuario.usuario_id,
      email: dto.email,
      role: papelSugerido,
      roles: [papelSugerido],
      academiaId: invite.academia_id,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: 'mock-refresh-token',
      user: {
        id: payload.sub,
        nome: dto.nomeCompleto ?? dto.nome ?? dto.email,
        email: payload.email,
        role: payload.role,
        roles: payload.roles,
        academiaId: payload.academiaId,
      },
    };
  }

  /**
   * Self-service signup with academy code (creates PENDENTE matricula)
   */
  async signup(dto: SignupDto): Promise<AuthTokensDto> {
    if (!dto.codigoAcademia) {
      throw new BadRequestException('Codigo da academia e obrigatorio');
    }

    if (!dto.aceitouTermos) {
      throw new BadRequestException('Aceite dos termos e obrigatorio');
    }

    const academia = await this.authRepository.findAcademiaByCode(dto.codigoAcademia);
    if (!academia) {
      throw new NotFoundException('Academia nao encontrada');
    }

    const existente = await this.authRepository.findUserByEmail(dto.email);
    if (existente) {
      throw new BadRequestException('Email ja cadastrado');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const novoUsuario = await this.authRepository.createUserWithRoleAndMatricula({
      email: dto.email,
      senhaHash,
      nomeCompleto: dto.nomeCompleto,
      aceitouTermos: dto.aceitouTermos,
      academiaId: academia.id,
      papel: UserRole.ALUNO,
      matriculaStatus: 'PENDENTE', // Self-service = pending approval
    });

    const payload = {
      sub: novoUsuario.usuario_id,
      email: dto.email,
      role: UserRole.ALUNO,
      roles: [UserRole.ALUNO],
      academiaId: academia.id,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: 'mock-refresh-token',
      user: {
        id: payload.sub,
        nome: dto.nomeCompleto,
        email: payload.email,
        role: payload.role,
        roles: payload.roles,
        academiaId: payload.academiaId,
      },
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokensDto> {
    const payload = {
      sub: 'mock-user-id',
      email: 'user@example.com',
      role: UserRole.ALUNO,
      roles: [UserRole.ALUNO],
      academiaId: 'mock-academia-id',
    };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: dto.refreshToken || 'mock-refresh-token',
      user: {
        id: payload.sub,
        nome: 'Mock User',
        email: payload.email,
        role: payload.role,
        roles: payload.roles,
        academiaId: payload.academiaId,
      },
    };
    // TODO: validar refresh token real (spec 3.1.4)
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{
    message: string;
    devOtp?: string;
  }> {
    // Security: Never reveal if email exists
    const genericMessage = 'Se o email existir, um codigo foi enviado.';

    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      // Don't reveal that email doesn't exist
      return { message: genericMessage };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP with secret for storage (SHA256 for performance)
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const codigoHash = this.hashOtp(otp, secret);

    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.authRepository.createPasswordResetToken(
      user.id,
      codigoHash,
      expiresAt,
    );

    // TODO: Send email with OTP in production
    // For now, log it (remove in production)
    console.log(`[DEV] OTP for ${dto.email}: ${otp}`);

    // Return OTP only in non-production (for contract tests)
    const isDev = process.env.NODE_ENV !== 'production';
    return {
      message: genericMessage,
      ...(isDev && { devOtp: otp }),
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ valid: boolean }> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('Codigo invalido ou expirado');
    }

    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const codigoHash = this.hashOtp(dto.codigo, secret);

    const token = await this.authRepository.findValidPasswordResetToken(
      user.id,
      codigoHash,
    );

    if (!token) {
      throw new BadRequestException('Codigo invalido ou expirado');
    }

    return { valid: true };
  }

  async resetPassword(dto: ResetPasswordWithOtpDto): Promise<{ message: string }> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('Codigo invalido ou expirado');
    }

    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const codigoHash = this.hashOtp(dto.codigo, secret);

    const token = await this.authRepository.findValidPasswordResetToken(
      user.id,
      codigoHash,
    );

    if (!token) {
      throw new BadRequestException('Codigo invalido ou expirado');
    }

    // Update password
    const senhaHash = await bcrypt.hash(dto.novaSenha, 10);
    await this.authRepository.updateUserPassword(user.id, senhaHash);

    // Mark token as used
    await this.authRepository.markPasswordResetTokenUsed(token.id);

    return { message: 'Senha redefinida com sucesso.' };
  }

  private hashOtp(otp: string, secret: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(secret + otp).digest('hex');
  }

  private pickPrimaryRole<T extends { papel: UserRole | string }>(
    rows: T[],
  ): T {
    const priority: Record<UserRole, number> = {
      [UserRole.TI]: 1,
      [UserRole.ADMIN]: 2,
      [UserRole.PROFESSOR]: 3,
      [UserRole.INSTRUTOR]: 4,
      [UserRole.ALUNO]: 5,
    };

    let primary = rows[0];
    for (const current of rows) {
      const currentRole = this.normalizeRole(current.papel);
      const primaryRole = this.normalizeRole(primary.papel);
      const currentPriority = priority[currentRole] ?? Number.MAX_SAFE_INTEGER;
      const primaryPriority = priority[primaryRole] ?? Number.MAX_SAFE_INTEGER;
      if (currentPriority < primaryPriority) {
        primary = current;
      }
    }

    return {
      ...primary,
      papel: this.normalizeRole(primary.papel),
    } as T;
  }

  private getRolesForAcademia<
    T extends { papel: UserRole | string; academia_id: string },
  >(rows: T[], academiaId: string): UserRole[] {
    const roles = rows
      .filter((row) => row.academia_id === academiaId)
      .map((row) => this.normalizeRole(row.papel));

    const unique = Array.from(new Set(roles));
    if (unique.length > 0) {
      return unique;
    }

    if (rows.length > 0) {
      return [this.normalizeRole(rows[0].papel)];
    }

    return [UserRole.ALUNO];
  }

  private getPrimaryRole(roles: UserRole[]): UserRole {
    const priority: Record<UserRole, number> = {
      [UserRole.TI]: 1,
      [UserRole.ADMIN]: 2,
      [UserRole.PROFESSOR]: 3,
      [UserRole.INSTRUTOR]: 4,
      [UserRole.ALUNO]: 5,
    };

    let primary = roles[0] ?? UserRole.ALUNO;
    for (const role of roles) {
      const currentPriority = priority[role] ?? Number.MAX_SAFE_INTEGER;
      const primaryPriority = priority[primary] ?? Number.MAX_SAFE_INTEGER;
      if (currentPriority < primaryPriority) {
        primary = role;
      }
    }

    return primary;
  }

  private normalizeRole(role: string | UserRole | null | undefined): UserRole {
    return ((role as string) ?? UserRole.ALUNO).toUpperCase() as UserRole;
  }
}
