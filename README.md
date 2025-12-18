# Dojoro API

O sistema que organiza a vida da academia de Jiu-Jitsu. Do primeiro treino à faixa preta.

[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)

## Stack

- **Backend:** NestJS + TypeScript
- **Banco:** PostgreSQL (Supabase recomendado)
- **Auth:** JWT com roles multi-tenant
- **API:** REST, prefixo `/v1`, Swagger em `/v1/docs`

## Requisitos

- Node.js 18+
- PostgreSQL (local ou Supabase)

## Instalação

```bash
npm install
cp .env.example .env
```

Preencha o `.env`:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
JWT_SECRET=sua-chave-secreta
APP_TIMEZONE=America/Sao_Paulo
```

## Banco de Dados

Aplique os scripts SQL na ordem:

```bash
# Postgres local
psql "$DATABASE_URL" -f sql/001-init-schema.sql
psql "$DATABASE_URL" -f sql/004-turmas-aulas-softdelete.sql
psql "$DATABASE_URL" -f sql/003-presencas-auditoria-decisao.sql
psql "$DATABASE_URL" -f sql/005-tipos-treino-codigo.sql
psql "$DATABASE_URL" -f sql/003-seed-faixas-e-regras-base.sql
psql "$DATABASE_URL" -f sql/002-seed-demo-completa.sql
```

> **Supabase:** Abra SQL Editor, cole cada arquivo e execute na ordem.

## Rodar Local (Dev)

```bash
npm run start:dev
```

- **API:** http://localhost:3000/v1
- **Swagger:** http://localhost:3000/v1/docs

## Testes de Contrato

```bash
# 1. Subir Postgres CI
docker compose -f docker-compose.ci.yml up -d

# 2. Aplicar migrations
node scripts/apply-sql.js

# 3. Iniciar API (em outro terminal)
DATABASE_URL=postgresql://dojoro_ci:dojoro_ci_password@localhost:5433/dojoro_test \
JWT_SECRET=test-secret \
npm run start:dev

# 4. Rodar testes
./tests/Run-ContractTests.ps1

# 5. Cleanup
docker compose -f docker-compose.ci.yml down -v
```

## Estrutura de Pastas

```
dojoro-api/
├── src/
│   ├── modules/          # Domínios (auth, aulas, turmas, presencas...)
│   ├── common/           # Guards, decorators, filters
│   └── database/         # DatabaseService (pg raw SQL)
├── sql/                  # DDL e seeds
├── docs/                 # Documentação detalhada
│   ├── api/              # Especificação da API v1
│   ├── rules/            # Regras de negócio
│   └── roadmap/          # Gaps e próximos passos
└── tests/                # Testes de contrato
```

## Filosofia

- **Multi-tenant:** Tudo filtrado por `academiaId` do JWT
- **Roles:** ALUNO → INSTRUTOR → PROFESSOR → ADMIN → TI
- **Timezone:** `APP_TIMEZONE` define "hoje" para aulas/presenças
- **Soft-delete:** Turmas e aulas usam `deleted_at`

## Contas Seed (Demo)

| Role      | Email                      | Senha             |
| --------- | -------------------------- | ----------------- |
| ALUNO     | aluno.seed@example.com     | SenhaAluno123     |
| INSTRUTOR | instrutor.seed@example.com | SenhaInstrutor123 |
| PROFESSOR | professor.seed@example.com | SenhaProfessor123 |
| ADMIN     | admin.seed@example.com     | SenhaAdmin123     |
| TI        | ti.seed@example.com        | SenhaTi123        |

## Documentação

| Documento                                               | Descrição               |
| ------------------------------------------------------- | ----------------------- |
| [API v1 Spec](docs/api/00-api-v1-spec.md)               | Contrato oficial da API |
| [Roles e Acesso](docs/rules/01-roles-e-acesso.md)       | Permissões por role     |
| [Fluxos App](docs/rules/02-fluxos-app.md)               | Happy paths principais  |
| [Presenças e Aulas](docs/rules/03-presencas-e-aulas.md) | Regras de negócio       |
| [Gaps para o App](docs/roadmap/01-gaps-para-o-app.md)   | O que falta implementar |
| [Modelo de Dados](docs/db/00-modelo-logico-v1.md)       | Schema do banco         |
| [Contract Tests](tests/README.md)                       | Como rodar testes       |

## Teste Rápido

```bash
# Login
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"professor.seed@example.com","senha":"SenhaProfessor123"}' \
  | jq -r .accessToken)

# Home (staff)
curl http://localhost:3000/v1/home -H "Authorization: Bearer $ACCESS_TOKEN"

# Health
curl http://localhost:3000/v1/health
```

## Licença

Proprietário - Dojoro © 2025
