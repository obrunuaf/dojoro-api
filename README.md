# BJJAcademy API v1

Backend NestJS para autenticar, gerir check-ins/dashboards e operar academias BJJAcademy/Codex. Prefixo global `/v1`, Swagger em `/v1/docs`.

## Requisitos
- Node.js 18+ e npm
- Banco PostgreSQL (Supabase recomendado)

## Instalacao e ambiente
```bash
npm install
cp .env.example .env
```
Preencha:
- `DATABASE_URL=postgresql://...` (string do Supabase/Postgres; use `?sslmode=require` no Supabase)
- `JWT_SECRET=chave-super-forte` (obrigatorio, nao commitar)
- Opcionais: `JWT_EXPIRES_IN=1h`, `PORT=3000`

## Banco de dados (Supabase/Postgres)
Aplicar os scripts na ordem:
1) `sql/001-init-schema.sql`
2) `sql/003-seed-faixas-e-regras-base.sql`
3) `sql/002-seed-demo-completa.sql`

No Supabase: abra SQL Editor, cole cada arquivo e execute na ordem acima. Em Postgres local: `psql "$DATABASE_URL" -f sql/001-init-schema.sql` (repita para os demais).

## Dashboard e regras de graduacao
- `GET /v1/dashboard/aluno` depende de `regras_graduacao` para a `faixa_atual_slug` do usuario na academia do token.
- `metaAulas`: usa `meta_aulas_no_grau` se > 0; se vazio/0, usa `aulas_minimas` se > 0; se ainda sem valor, cai para `DEFAULT_META_AULAS = 60`.
- `progressoPercentual`: se `metaAulas <= 0` retorna `0`; senao `floor(aulasNoGrauAtual * 100 / metaAulas)` limitado a `100`.
- Seeds `sql/003-seed-faixas-e-regras-base.sql` e `sql/002-seed-demo-completa.sql` agora trazem metas > 0 (inclusive faixa preta). A tabela tem CHECK para impedir zeros; para "desativar" uma regra use `NULL` nos campos e deixe o fallback assumir.

## Rodar a API
```bash
npm run start:dev
```
Swagger: `http://localhost:3000/v1/docs`

## Autenticacao no Swagger
1) Faca login em `POST /v1/auth/login` com uma credencial seed.
2) Copie o `accessToken`.
3) Clique em **Authorize** (esquema `JWT`) e cole **exatamente** `Bearer <accessToken>`.
4) Execute `GET /v1/auth/me` e demais rotas protegidas. Sem o prefixo `Bearer` o Swagger retorna `401 Unauthorized`.

## Multi-tenant
Todas as consultas devem ser filtradas pelo `academiaId` presente no JWT. Os dashboards ja aplicam esse filtro em matriculas, aulas, presencas e regras de graduacao.

## Teste rapido (curl)
```bash
# Login
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aluno.seed@example.com","senha":"SenhaAluno123"}'

# Perfil autenticado
ACCESS_TOKEN="<copie-do-login>"
curl http://localhost:3000/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Dashboard do aluno (real, filtra academiaId do token)
curl http://localhost:3000/v1/dashboard/aluno \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Dashboard do staff (real, requer INSTRUTOR/PROFESSOR/ADMIN/TI)
curl http://localhost:3000/v1/dashboard/staff \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
Exemplo de resposta com os seeds (sem aulas futuras depois de 2025-11):
```json
{
  "proximaAulaId": null,
  "proximaAulaHorario": null,
  "proximaAulaTurma": null,
  "aulasNoGrauAtual": 20,
  "metaAulas": 60,
  "progressoPercentual": 33,
  "statusMatricula": "ATIVA"
}
```
Dashboard staff (mesmo cenario, data fora do calendario das seeds):
```json
{
  "alunosAtivos": 5,
  "aulasHoje": 0,
  "presencasHoje": 0,
  "faltasHoje": 0
}
```

## Seed personas (Academia Seed BJJ)
- ALUNO: `aluno.seed@example.com` / `SenhaAluno123`
- INSTRUTOR: `instrutor.seed@example.com` / `SenhaInstrutor123`
- PROFESSOR: `professor.seed@example.com` / `SenhaProfessor123`
- ADMIN: `admin.seed@example.com` / `SenhaAdmin123`
- TI: `ti.seed@example.com` / `SenhaTi123`

## Estado atual da API
- **Real (Postgres):** `POST /v1/auth/login`, `GET /v1/auth/me`, `GET /v1/auth/convite/:codigo`, `POST /v1/auth/register`, `GET /v1/dashboard/aluno`, `GET /v1/dashboard/staff`.
- **Stub/mock (retorno provisorio):** `GET /v1/alunos`, `GET /v1/alunos/:id`, `GET /v1/alunos/:id/evolucao`, `GET /v1/turmas`, `GET /v1/aulas/hoje`, `GET /v1/aulas/:id/qrcode`, `GET /v1/checkin/disponiveis`, `POST /v1/checkin`, `GET /v1/presencas/pendencias`, `PATCH /v1/presencas/:id/status`, `GET /v1/alunos/:id/historico-presencas`, `GET /v1/config/*`, `POST /v1/invites`, `POST /v1/graduacoes`, `POST /v1/auth/refresh`, `POST /v1/auth/forgot-password`, `POST /v1/auth/reset-password`.
- Prefixo global `/v1`; Swagger em `/v1/docs`.
