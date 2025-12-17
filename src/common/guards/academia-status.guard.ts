import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * Guard that checks if the user's academia is active.
 * Use AFTER JwtAuthGuard to ensure user is authenticated.
 * 
 * When academia.ativo = false, blocks access with 403.
 */
@Injectable()
export class AcademiaStatusGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.academiaId) {
      // No academiaId in token, allow (will fail on other guards/logic)
      return true;
    }

    const academia = await this.databaseService.queryOne<{ ativo: boolean }>(
      'SELECT ativo FROM academias WHERE id = $1',
      [user.academiaId],
    );

    if (!academia) {
      throw new ForbiddenException('Academia não encontrada.');
    }

    if (!academia.ativo) {
      throw new ForbiddenException(
        'Academia desativada. Entre em contato com o suporte para reativar sua conta.',
      );
    }

    return true;
  }
}
