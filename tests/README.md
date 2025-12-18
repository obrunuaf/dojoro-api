# Contract Tests

Automated API contract tests for Dojoro API.

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PowerShell (Windows) or pwsh (Linux/macOS)

## Running Locally with Docker

```bash
# 1. Start Postgres
docker compose -f docker-compose.ci.yml up -d

# 2. Wait for Postgres to be ready
docker compose -f docker-compose.ci.yml exec postgres pg_isready -U dojoro_ci

# 3. Apply SQL migrations
node scripts/apply-sql.js

# 4. Start API (in another terminal)
DATABASE_URL=postgresql://dojoro_ci:dojoro_ci_password@localhost:5433/dojoro_test \
JWT_SECRET=test-secret \
APP_TIMEZONE=America/Sao_Paulo \
npm run start:dev

# 5. Run tests
pwsh ./tests/Run-ContractTests.ps1
# or on Windows:
.\tests\Run-ContractTests.ps1

# 6. Cleanup
docker compose -f docker-compose.ci.yml down -v
```

## Quick Commands (PowerShell)

```powershell
# Full local test run
docker compose -f docker-compose.ci.yml up -d
Start-Sleep -Seconds 5
node scripts/apply-sql.js
# Start API in another terminal, then:
.\tests\Run-ContractTests.ps1
docker compose -f docker-compose.ci.yml down -v
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PGHOST` | localhost | Postgres host |
| `PGPORT` | 5433 | Postgres port (5433 to avoid conflicts) |
| `PGUSER` | dojoro_ci | Database user |
| `PGPASSWORD` | dojoro_ci_password | Database password |
| `PGDATABASE` | dojoro_test | Database name |
| `JWT_SECRET` | (required) | JWT signing secret |
| `APP_TIMEZONE` | America/Sao_Paulo | Timezone for date calculations |

## Test Coverage

24 scenarios covering:
- Authentication (PROFESSOR/ALUNO)
- Aulas (CRUD, QR, encerrar)
- Check-in flow (QR, pendências, decisão)
- Presenças (list, filter, manual)
- Turmas (delete with future aulas → 409)
- Negative tests (403, 400, 404, 409)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Postgres not starting | Check port 5433 is free |
| SQL errors | Some duplicates are OK, check for real errors |
| 401 Unauthorized | Check JWT_SECRET is set |
| Empty /aulas/hoje | Check APP_TIMEZONE and seed data |
