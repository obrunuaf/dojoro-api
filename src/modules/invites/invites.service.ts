import { Injectable, BadRequestException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateInviteDto } from './dtos/create-invite.dto';
import { InviteDto } from './dtos/invite.dto';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';

@Injectable()
export class InvitesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
  ) {}

  async criar(
    dto: CreateInviteDto,
    user: { id: string; academiaId: string },
  ): Promise<InviteDto> {
    // 1. Gerar token único
    const token = crypto.randomBytes(16).toString('hex');
    
    // 2. Definir expiração (padrão 7 dias)
    const expiresAt = dto.expiraEm 
      ? new Date(dto.expiraEm) 
      : new Date(Date.now() + 7 * 86400000);

    // 3. Buscar nome da academia para o email
    const academia = await this.databaseService.queryOne<{ nome: string }>(
      'SELECT nome FROM academias WHERE id = $1',
      [user.academiaId],
    );

    if (!academia) {
      throw new BadRequestException('Academia não encontrada');
    }

    // 4. Salvar no banco
    await this.databaseService.query(
      `
        INSERT INTO convites (academia_id, email, token_hash, papel_sugerido, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        user.academiaId,
        dto.email,
        token, // Usando o token direto como hash para simplificar com o AuthRepository existente
        dto.roleSugerido || UserRole.ALUNO,
        expiresAt,
      ],
    );

    // 5. Enviar email se houver endereço
    if (dto.email) {
      const inviteUrl = `https://dojoro.com.br/register?token=${token}`;
      this.emailService
        .sendInviteEmail(dto.email, academia.nome, inviteUrl)
        .catch((err) => console.error('Error sending invite email:', err));
    }

    return {
      codigo: token,
      roleSugerido: dto.roleSugerido || UserRole.ALUNO,
      validoAte: expiresAt.toISOString(),
      academiaId: user.academiaId,
    };
  }
}
