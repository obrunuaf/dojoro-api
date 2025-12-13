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
- Opcionais: `JWT_EXPIRES_IN=1h`, `PORT=3000`, `QR_TTL_MINUTES=5`
- Segurança (CORS/Helmet/Rate-limit):
  - `CORS_ENABLED=true|false` (default true)
  - `CORS_ORIGIN=*` (ou uma origem especifica)
  - `RATE_LIMIT_TTL=60` (segundos)
  - `RATE_LIMIT_LIMIT=100` (requests por TTL; rotas sensiveis tem limites menores via decorator)
- Timezone/SSL:
  - `APP_TIMEZONE=America/Sao_Paulo` (usado para calcular janela de "hoje" em UTC)
  - `PG_SSL=true` (default true para Supabase)
  - `PG_SSL_REJECT_UNAUTHORIZED=false` (DEV/POC evita erro de self-signed)
  - `SUPABASE_CA_CERT_PATH=` (usado apenas se futuramente habilitar verify-full em prod)

## Banco de dados (Supabase/Postgres)
Aplicar os scripts na ordem:
1) `sql/001-init-schema.sql`
2) `sql/003-presencas-auditoria-decisao.sql` (nova auditoria de decisoes)
3) `sql/003-seed-faixas-e-regras-base.sql`
4) `sql/002-seed-demo-completa.sql`

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

## Como autenticar no Swagger
- Abra `http://localhost:3000/v1/docs` e clique em **Authorize** (esquema `JWT`).
- Chame `POST /v1/auth/login`, copie **apenas** o valor de `accessToken` (sem prefixar `Bearer`).
- No modal Authorize, cole somente o token; o esquema bearer monta `Authorization: Bearer <token>`.
- O Swagger so envia o header para rotas anotadas com `@ApiBearerAuth('JWT')` (todas as privadas usam `@ApiAuth()` para isso).
- Rode `GET /v1/auth/me` (ou outras rotas) e valide o 200.
- O Swagger agora mantem o token entre refreshes (`persistAuthorization: true`).
- Exemplo rapido (token tambem funciona no Swagger):
  ```bash
  # login
  ACCESS_TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"aluno.seed@example.com","senha":"SenhaAluno123"}' \
    | jq -r .accessToken)

  # perfil autenticado
  curl http://localhost:3000/v1/auth/me -H "Authorization: Bearer $ACCESS_TOKEN"
  ```

## Multi-tenant
Todas as consultas devem ser filtradas pelo `academiaId` presente no JWT. Os dashboards ja aplicam esse filtro em matriculas, aulas, presencas e regras de graduacao.

## Multi-role (seed)
- Tokens agora carregam `role` (papel principal) **e** `roles` (todos os papeis do usuario na academia do token). Prioridade do papel principal: `TI` > `ADMIN` > `PROFESSOR` > `INSTRUTOR` > `ALUNO`.
- Nos seeds, instrutor/professor/admin/ti tambem tem papel **ALUNO** na mesma academia, entao endpoints `@Roles('ALUNO')` aceitam esses tokens.
- Swagger: basta autorizar normalmente; o token ja leva `roles`.

Exemplo com o professor seed acessando rota de aluno (`/v1/checkin/disponiveis`):
```bash
PROF_TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"professor.seed@example.com","senha":"SenhaProfessor123"}' | jq -r .accessToken)

curl http://localhost:3000/v1/checkin/disponiveis \
  -H "Authorization: Bearer $PROF_TOKEN"
```

## Home vs Dashboard
- **Home (`/v1/home`)**: tela inicial agregada. O query `mode` e opcional; se omitido, o backend escolhe automaticamente (`STAFF` se o token tiver papel staff — PROFESSOR/INSTRUTOR/ADMIN/TI — senao `ALUNO`). Aceita override `?mode=aluno|staff` respeitando os papeis em `roles`.
- **Dashboard (`/v1/dashboard/aluno`, `/v1/dashboard/staff`)**: KPIs/analytics dedicados, sem agregacao adicional.

## Validacao rapida (5 minutos)
1) Login (professor) e cole o `accessToken` em **Authorize** no Swagger.
2) `/v1/home` (modo default staff) e `/v1/home?mode=aluno` (usa roles com ALUNO).
3) `/v1/aulas/hoje` (staff).
4) Login aluno e `POST /v1/checkin` (gera presenca PENDENTE do seed).
5) `/v1/presencas/pendencias` (staff) → deve listar a pendencia do dia.
6) `PATCH /v1/presencas/:id/decisao` (APROVAR/REJEITAR) → pendencia some.
7) `/v1/home` (staff) reflete pendencias total e `/v1/dashboard/staff` atualiza contagens.

Exemplos:
```bash
# ALUNO (modo default aluno - sem query)
ACCESS_TOKEN="<token-aluno>"
curl http://localhost:3000/v1/home \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# STAFF (modo default staff)
ACCESS_TOKEN="<token-professor>"
curl http://localhost:3000/v1/home \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# STAFF forçando modo staff explicitamente
curl "http://localhost:3000/v1/home?mode=staff" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# STAFF vendo modo aluno (precisa ter ALUNO em roles)
curl "http://localhost:3000/v1/home?mode=aluno" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# ALUNO tentando mode=staff -> 403 (nao tem papel staff)
curl "http://localhost:3000/v1/home?mode=staff" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Notas:
- Personas seed de staff (ex.: professor) trazem `roles` como `["PROFESSOR","ALUNO"]`, entao podem usar `mode=aluno` ou `mode=staff`.
- Aluno puro nao possui papel staff, entao `mode=staff` retorna 403.

## Turmas (CRUD com soft-delete)
- Leitura (ALUNO e staff): `GET /v1/turmas` (default ignora deletadas), `GET /v1/turmas/:id`.
- Escrita (STAFF: INSTRUTOR/PROFESSOR/ADMIN/TI): `POST /v1/turmas`, `PATCH /v1/turmas/:id`, `DELETE /v1/turmas/:id` (soft-delete com `deleted_at/deleted_by`).
- Query `includeDeleted=true` mostra todas; `onlyDeleted=true` lista apenas deletadas (somente staff).
- Restore: `POST /v1/turmas/:id/restore` (staff) reativa a turma. Se ja existe turma ativa com o mesmo nome, retorna 409.

Exemplos (professor):
```bash
ACCESS_TOKEN="<token-professor>"

# criar turma
curl -X POST http://localhost:3000/v1/turmas \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome":"No-Gi Manha","tipoTreinoId":"<tipo-id>","diasSemana":[2,4],"horarioPadrao":"08:00","instrutorPadraoId":null}'

# listar (sem deletadas)
curl http://localhost:3000/v1/turmas \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# editar
curl -X PATCH http://localhost:3000/v1/turmas/<turmaId> \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"horarioPadrao":"09:00"}'

# deletar (soft)
curl -X DELETE http://localhost:3000/v1/turmas/<turmaId> \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# listar com deletadas (staff)
curl "http://localhost:3000/v1/turmas?includeDeleted=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# listar apenas deletadas
curl "http://localhost:3000/v1/turmas?onlyDeleted=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# restaurar turma
curl -X POST http://localhost:3000/v1/turmas/<turmaId>/restore \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Health checks
- `GET /v1/health` (liveness)
- `GET /v1/health/ready` (readiness; inclui checagem de Postgres via `DatabaseService`)

Testes rapidos:
```bash
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/health/ready
```

## Rate limit e segurança (MVP)
- Helmet habilitado por default.
- CORS configuravel via `CORS_ENABLED`/`CORS_ORIGIN`.
- Rate limit global (TTL/limit configuraveis via env) e reforco em rotas sensiveis:
  - `POST /v1/auth/login` (Throttle 5 req/60s por IP)
  - `POST /v1/checkin` (Throttle 10 req/60s)
  - `GET /v1/checkin/disponiveis` (Throttle 20 req/60s)
  - `GET /v1/aulas/:id/qrcode` (Throttle 10 req/60s)
```bash
# Exemplo login ate estourar limite
for i in {1..6}; do
  curl -i -X POST http://localhost:3000/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"aluno.seed@example.com","senha":"SenhaAluno123"}';
done
```

## Fluxo de check-in, pendencias e decisao
- `GET /v1/checkin/disponiveis` (ALUNO): aulas do dia; ignora aulas/turmas deletadas e canceladas.
- `POST /v1/checkin` (ALUNO): cria presenca `status=PRESENTE` (QR) ou `status=PENDENTE` (MANUAL); pendencias depois viram `PRESENTE` ou `FALTA`.
- `GET /v1/presencas/pendencias` (STAFF): filtros opcionais (`date` **ou** `from`/`to`). Sem query, usa “hoje” no `APP_TIMEZONE`; sempre lista apenas `status='PENDENTE'`.
- `PATCH /v1/presencas/:id/decisao` (STAFF): `decisao=APROVAR|REJEITAR|PRESENTE|FALTA`, muda `status` para `PRESENTE` ou `FALTA`, grava `decidido_em/decidido_por/decisao_observacao` (se colunas existirem) e falha com 409 se ja decidido.
- `POST /v1/presencas/pendencias/lote` (STAFF): decide em lote e retorna `{ processados, atualizados, ignorados }`.
- Seed: ja cria 1 presenca `PENDENTE` na aula “hoje” para `aluno.seed@example.com`, facilitando testes de aprovacao.

Campos importantes:
- `criado_em`: quando o check-in foi registrado.
- `decidido_em` / `decidido_por`: quando e por quem a pendencia foi aprovada/rejeitada.
- `decisao_observacao`: observacao livre da decisao (se a coluna existir; fallback para `aprovacao_observacao`).
- `updated_at`: timestamp atualizado automaticamente em qualquer update via trigger.

Exemplos rapidos (staff):
```bash
PROF_TOKEN="<token-professor>"

# pendencias de hoje
curl http://localhost:3000/v1/presencas/pendencias \
  -H "Authorization: Bearer $PROF_TOKEN"
# resposta (ex):
# { "total": 1, "itens": [{ "id": "...", "status": "PENDENTE", "alunoNome": "...", "dataInicio": "..."}] }

# pendencias com filtro de data (YYYY-MM-DD)
curl "http://localhost:3000/v1/presencas/pendencias?date=2025-12-12" \
  -H "Authorization: Bearer $PROF_TOKEN"

# pendencias com range explicito (from/to sempre juntos, ISO)
curl "http://localhost:3000/v1/presencas/pendencias?from=2025-12-12T03:00:00.000Z&to=2025-12-13T03:00:00.000Z" \
  -H "Authorization: Bearer $PROF_TOKEN"

# aprovar uma pendencia
PRESENCA_ID="<id-da-pendencia>"
curl -X PATCH http://localhost:3000/v1/presencas/$PRESENCA_ID/decisao \
  -H "Authorization: Bearer $PROF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decisao":"PRESENTE","observacao":"Presenca validada"}'
# resposta (ex):
# { "id": "...", "status": "PRESENTE", "alunoId": "...", "aulaId": "...", "origem": "MANUAL", "decididoEm": "...", "decididoPor": "...", "updatedAt": "..." }

# decidir em lote
curl -X POST http://localhost:3000/v1/presencas/pendencias/lote \
  -H "Authorization: Bearer $PROF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids":["'"$PRESENCA_ID"'"],"decisao":"FALTA","observacao":"Teste"}'
# resposta (ex):
# { "processados": 1, "atualizados": ["'"$PRESENCA_ID"'"], "ignorados": [] }
```

## Timezone e "hoje"
- O backend calcula a janela de "hoje" com base em `APP_TIMEZONE` (padrao `America/Sao_Paulo`) usando SQL (`date_trunc`), gerando [startUtc, endUtc) para filtrar `aulas.data_inicio` (timestamptz).
- Endpoints que usam "hoje": `GET /v1/aulas/hoje` e contadores do `GET /v1/dashboard/staff`.
- Futuro multi-tenant: substituir por `academias.timezone` (TODO).

## SSL com Supabase (DEV vs PROD)
- DEV/POC: defina `PG_SSL=true` e `PG_SSL_REJECT_UNAUTHORIZED=false` para evitar o erro `self-signed certificate in certificate chain` no Supabase. Para conexoes locais (`localhost`) o SSL e desabilitado por padrao.
- Producao (TODO): usar verify-full com o CA do Supabase (`PG_SSL=true`, `PG_SSL_REJECT_UNAUTHORIZED=true` e `SUPABASE_CA_CERT_PATH` apontando para o certificado baixado no dashboard). A leitura do CA e configuracao de `ssl.ca` sera implementada no passo 3B.

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

# Detalhe do aluno (ALUNO so pode o proprio id; staff consulta alunos da mesma academia)
ALUNO_ID="<id-do-aluno-ou-do-proprio-usuario>"
curl http://localhost:3000/v1/alunos/$ALUNO_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Evolucao do aluno (graduacoes + progresso de presencas)
curl http://localhost:3000/v1/alunos/$ALUNO_ID/evolucao \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Turmas da academia (todos os roles)
curl http://localhost:3000/v1/turmas \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Aulas do dia (staff INSTRUTOR/PROFESSOR/ADMIN/TI)
curl http://localhost:3000/v1/aulas/hoje \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Dashboard staff (usa janela de hoje no timezone configurado)
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

## Check-in & Presencas (MVP real)
- Endpoints protegidos com `@ApiAuth()` no Swagger (`/v1/docs`); clique em **Authorize** e cole somente o `accessToken` do login.
- Usa `APP_TIMEZONE` para a janela de "hoje" ([startUtc, endUtc)) e `QR_TTL_MINUTES` (default `5`) para o vencimento do QR.
- ALUNO so enxerga a propria presenca; STAFF acessa apenas a academia do token.
- Check-in do aluno cria `status=PRESENTE` quando QR e `status=PENDENTE` quando MANUAL; STAFF decide pendencias (`status='PENDENTE'`) para `PRESENTE` ou `FALTA` via `PATCH /v1/presencas/:id/decisao` ou `POST /v1/presencas/pendencias/lote`.

Fluxo rapido (curl):
```bash
# logins
ALUNO_TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aluno.seed@example.com","senha":"SenhaAluno123"}' | jq -r .accessToken)
STAFF_TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"instrutor.seed@example.com","senha":"SenhaInstrutor123"}' | jq -r .accessToken)

# aulas disponiveis hoje para check-in do aluno
curl http://localhost:3000/v1/checkin/disponiveis \
  -H "Authorization: Bearer $ALUNO_TOKEN"

# gerar QR de uma aula (staff) e extrair token
AULA_ID="<copie uma aula de /checkin/disponiveis ou /aulas/hoje>"
QR=$(curl -s http://localhost:3000/v1/aulas/$AULA_ID/qrcode \
  -H "Authorization: Bearer $STAFF_TOKEN")
QR_TOKEN=$(echo "$QR" | jq -r .qrToken)

# check-in via QR (ALUNO) -> status PRESENTE
curl -X POST http://localhost:3000/v1/checkin \
  -H "Authorization: Bearer $ALUNO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"aulaId\":\"$AULA_ID\",\"tipo\":\"QR\",\"qrToken\":\"$QR_TOKEN\"}"

# check-in manual (ALUNO) -> status PENDENTE
curl -X POST http://localhost:3000/v1/checkin \
  -H "Authorization: Bearer $ALUNO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"aulaId\":\"$AULA_ID\",\"tipo\":\"MANUAL\"}"

# pendencias do dia (STAFF)
curl http://localhost:3000/v1/presencas/pendencias \
  -H "Authorization: Bearer $STAFF_TOKEN"

# aprovar/ajustar presenca (STAFF)
PRESENCA_ID="<id retornado em pendencias>"
curl -X PATCH http://localhost:3000/v1/presencas/$PRESENCA_ID/decisao \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decisao":"PRESENTE","observacao":"Validado"}'

# decidir em lote
curl -X POST http://localhost:3000/v1/presencas/pendencias/lote \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids":["'"$PRESENCA_ID"'"],"decisao":"FALTA","observacao":"Teste"}'

# historico do aluno (ALUNO so o proprio; STAFF mesma academia)
ALUNO_ID="<id do aluno>"
curl "http://localhost:3000/v1/alunos/$ALUNO_ID/historico-presencas?from=2025-01-01" \
  -H "Authorization: Bearer $ALUNO_TOKEN"
```

## Seed personas (Academia Seed BJJ)
- ALUNO: `aluno.seed@example.com` / `SenhaAluno123`
- INSTRUTOR: `instrutor.seed@example.com` / `SenhaInstrutor123`
- PROFESSOR: `professor.seed@example.com` / `SenhaProfessor123` (roles: `PROFESSOR` + `ALUNO`)
- ADMIN: `admin.seed@example.com` / `SenhaAdmin123`
- TI: `ti.seed@example.com` / `SenhaTi123`
- Tokens trazem `roles` (lista completa) e `role` (principal). Trocar `JWT_SECRET` invalida tokens antigos.
- Se alterar `JWT_SECRET`, todos os tokens antigos (emitidos antes da troca) deixam de funcionar.

## Estado atual da API
- **Real (Postgres):** `POST /v1/auth/login`, `GET /v1/auth/me`, `GET /v1/auth/convite/:codigo`, `POST /v1/auth/register`, `GET /v1/home`, `GET /v1/dashboard/aluno`, `GET /v1/dashboard/staff`, `GET /v1/alunos`, `GET /v1/alunos/:id`, `GET /v1/alunos/:id/evolucao`, `GET /v1/alunos/:id/historico-presencas`, `GET /v1/turmas`, `GET /v1/turmas/:id`, `POST /v1/turmas`, `PATCH /v1/turmas/:id`, `DELETE /v1/turmas/:id`, `POST /v1/turmas/:id/restore`, `GET /v1/aulas/hoje`, `GET /v1/aulas/:id/qrcode`, `GET /v1/checkin/disponiveis`, `POST /v1/checkin`, `GET /v1/presencas/pendencias`, `PATCH /v1/presencas/:id/decisao`, `POST /v1/presencas/pendencias/lote`.
- **Stub/mock (retorno provisorio):** `GET /v1/config/*`, `POST /v1/invites`, `POST /v1/graduacoes`, `POST /v1/auth/refresh`, `POST /v1/auth/forgot-password`, `POST /v1/auth/reset-password`.
- Prefixo global `/v1`; Swagger em `/v1/docs`.
