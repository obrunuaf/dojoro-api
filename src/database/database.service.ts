// src/database/database.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const isLocal =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1');

    const defaultPgSsl =
      isLocal || connectionString.includes('@localhost')
        ? 'false'
        : connectionString.includes('.supabase.')
          ? 'true'
          : 'false';

    const pgSsl =
      (process.env.PG_SSL ?? defaultPgSsl).toLowerCase() === 'true';
    const rejectUnauthorized =
      (process.env.PG_SSL_REJECT_UNAUTHORIZED ?? 'false').toLowerCase() ===
      'true';

    this.pool = new Pool({
      connectionString,
      ssl: pgSsl
        ? {
            rejectUnauthorized,
          }
        : false,
    });

    // Migração automática para a nova coluna de capa
    this.runMigrations();
  }

  private async runMigrations() {
    try {
      await this.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_capa_url character varying;');
      console.log('✅ Migração: Coluna foto_capa_url verificada/adicionada.');
    } catch (err) {
      console.error('❌ Erro na migração automática:', err);
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows as T[];
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const result = await this.pool.query(text, params);
    return (result.rows[0] as T) ?? null;
  }

  getAppTimezone(): string {
    return process.env.APP_TIMEZONE || 'America/Sao_Paulo';
  }

  async getTodayBoundsUtc(tz: string): Promise<{
    startUtc: Date;
    endUtc: Date;
  }> {
    const row = await this.queryOne<{
      start_utc: string;
      end_utc: string;
    }>(
      `
        select
          (date_trunc('day', now() at time zone $1) at time zone $1) as start_utc,
          ((date_trunc('day', now() at time zone $1) + interval '1 day') at time zone $1) as end_utc;
      `,
      [tz],
    );

    if (!row?.start_utc || !row?.end_utc) {
      throw new Error('Failed to compute today bounds');
    }

    return {
      startUtc: new Date(row.start_utc),
      endUtc: new Date(row.end_utc),
    };
  }

  async getDayBoundsUtc(date: string, tz: string): Promise<{
    startUtc: Date;
    endUtc: Date;
  }> {
    const row = await this.queryOne<{
      start_utc: string;
      end_utc: string;
    }>(
      `
        select
          (($1::date)::timestamp at time zone $2) as start_utc,
          ((($1::date)::timestamp + interval '1 day') at time zone $2) as end_utc;
      `,
      [date, tz],
    );

    if (!row?.start_utc || !row?.end_utc) {
      throw new Error('Failed to compute bounds for date');
    }

    return {
      startUtc: new Date(row.start_utc),
      endUtc: new Date(row.end_utc),
    };
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
