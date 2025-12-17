import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AulasModule } from './modules/aulas/aulas.module';
import { AuthModule } from './modules/auth/auth.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { ConfigModule as AppConfigModule } from './modules/config/config.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GraduacoesModule } from './modules/graduacoes/graduacoes.module';
import { InvitesModule } from './modules/invites/invites.module';
import { PresencasModule } from './modules/presencas/presencas.module';
import { AlunosModule } from './modules/alunos/alunos.module';
import { TurmasModule } from './modules/turmas/turmas.module';
import { HomeModule } from './modules/home/home.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { MatriculasModule } from './modules/matriculas/matriculas.module';
import { AcademiaModule } from './modules/academia/academia.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    NestConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: Number(process.env.RATE_LIMIT_TTL ?? 60),
        limit: Number(process.env.RATE_LIMIT_LIMIT ?? 100),
      },
    ]),
    AuthModule,
    DashboardModule,
    CheckinModule,
    PresencasModule,
    AlunosModule,
    GraduacoesModule,
    TurmasModule,
    AulasModule,
    AppConfigModule,
    InvitesModule,
    HomeModule,
    HealthModule,
    UsersModule,
    MatriculasModule,
    AcademiaModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
