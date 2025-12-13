# BJJAcademy API v1 - Especificacao (atualizada)

Documento de referencia rapida da API v1 do ecossistema **BJJAcademy / BJJAcademy Codex**, cobrindo convencoes, modulos principais e endpoints ja implementados.

---

## 1. Visao geral

- **O que e**: backend que centraliza autenticacao, check-ins, dashboards e gestao academica da BJJAcademy.
- **Stack**: NestJS + TypeScript, PostgreSQL (Supabase), acesso via `pg`/SQL cru (`DatabaseService`), JWT com roles, Swagger em `/v1/docs`.
- **Dominios principais**: Auth & Onboarding, Dashboards, Check-in & Presencas, Alunos & Graduacoes, Configuracoes.

---

## 2. Convencoes gerais

- **Base URL / versao**: todas as rotas sao servidas em `/v1` (ex.: `http://localhost:3000/v1`).
- **Formato**: JSON; headers padrao `Content-Type: application/json; charset=utf-8`.
- **Autenticacao**: Bearer JWT no header `Authorization: Bearer <token>`.
- **Swagger/Authorize**: em `/v1/docs`, clique em **Authorize** (esquema `JWT`) e cole apenas o `accessToken` (sem `Bearer`); o Swagger prefixa o header e so envia para rotas anotadas com `@ApiBearerAuth('JWT')` (via `@ApiAuth()`). A opcao `persistAuthorization: true` mantem o token apos refresh da pagina.
- **Multi-tenant**: todas as consultas devem ser filtradas pelo `academiaId` presente no JWT (dashboards, presencas, regras, etc.).
- **Home vs Dashboard**: `GET /v1/home` e a tela agregada (modo padrao STAFF se houver papel staff; senao ALUNO; aceita `?mode=aluno|staff` respeitando `roles`). Dashboards dedicados permanecem em `/v1/dashboard/aluno` e `/v1/dashboard/staff`.
- **Timezone ("hoje")**: o backend calcula a janela [startUtc, endUtc) usando `APP_TIMEZONE` (padrao `America/Sao_Paulo`) via SQL `date_trunc`. Endpoints que usam isso: `GET /v1/aulas/hoje` e contadores de `GET /v1/dashboard/staff`. Futuro: ler timezone por academia.
- **Health**: `GET /v1/health` (liveness) e `GET /v1/health/ready` (readiness com Postgres).
- **Seguranca (MVP)**: Helmet habilitado; CORS configuravel via env; rate limit global (TTL/limit via env) com reforco em rotas sensiveis (`/auth/login`, `/checkin`, `/checkin/disponiveis`, `/aulas/:id/qrcode`).
- **Claims do JWT** (emitido no login):
  - `sub`: id do usuario (`usuarios.id`)
  - `email`
  - `role`: papel principal resolvido para a academia do token
  - `roles`: lista de papeis do usuario na academia do token
  - `academiaId`: academia atual do usuario
- **Roles suportados**: `ALUNO`, `INSTRUTOR`, `PROFESSOR`, `ADMIN`, `TI`.
  - Prioridade do papel principal quando o usuario tem multiplos papeis na mesma academia: `TI` > `ADMIN` > `PROFESSOR` > `INSTRUTOR` > `ALUNO`.
- **Banco**: PostgreSQL (Supabase). Scripts de schema/seeds em `sql/` (ex.: `001-init-schema.sql`, `002-seed-demo-completa.sql`, `003-seed-faixas-e-regras-base.sql`).
- **Authorize no Swagger (passo a passo)**:
  1) Acesse `http://localhost:3000/v1/docs` e clique em **Authorize** (esquema `JWT`).
  2) Chame `POST /v1/auth/login` e copie somente o `accessToken` retornado.
  3) No modal, cole apenas o token (nao prefixe `Bearer`); o esquema bearer monta `Authorization: Bearer <token>`.
  4) O header so sera enviado para rotas com `@ApiBearerAuth('JWT')` (todas as privadas usam `@ApiAuth()`).
  5) Execute `GET /v1/auth/me` para validar.

### Multi-role (seed)

- Tokens carregam `role` (principal) e `roles` (todos os papeis do usuario na academia do token). Prioridade do papel principal: `TI` > `ADMIN` > `PROFESSOR` > `INSTRUTOR` > `ALUNO`.
- Nos seeds, instrutor/professor/admin/ti tambem tem papel **ALUNO**, entao rotas `@Roles('ALUNO')` funcionam para esses tokens.
- Swagger ja usa o mesmo token (nao muda o fluxo de authorize).

Exemplo real (professor seed consumindo rota de aluno):
```bash
PROF_TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"professor.seed@example.com","senha":"SenhaProfessor123"}' | jq -r .accessToken)

curl http://localhost:3000/v1/checkin/disponiveis \
  -H "Authorization: Bearer $PROF_TOKEN"
```

---

## 3. Recursos e endpoints

### 3.1 Auth & Onboarding

#### 3.1.1 POST `/auth/login`

- **Descricao**: login com email/senha. Consulta usuarios reais no banco, valida senha (`bcrypt`) e emite JWT.
- **Metodo/URL**: `POST /v1/auth/login`
- **Auth**: publica
- **Payload**:
  ```json
  {
    "email": "aluno.seed@example.com",
    "senha": "SenhaAluno123"
  }
  ```
- **Resposta**:
  ```json
  {
    "accessToken": "<jwt>",
    "refreshToken": "mock-refresh-token",
    "user": {
      "id": "58c9...",
      "nome": "Aluno Seed",
      "email": "aluno.seed@example.com",
      "role": "ALUNO",
      "roles": ["ALUNO"],
      "academiaId": "46af..."
    }
  }
  ```
- **Notas**:
  - O `accessToken` traz os claims `sub`, `email`, `role`, `roles`, `academiaId`.
  - `role` e o papel principal (prioridade `TI` > `ADMIN` > `PROFESSOR` > `INSTRUTOR` > `ALUNO`); `roles` lista todos os papeis do usuario na academia do token.
  - O `refreshToken` ainda e mock; rota `/auth/refresh` existe mas sera evoluida.
- **Exemplo curl**:
  ```bash
  curl -X POST http://localhost:3000/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"aluno.seed@example.com","senha":"SenhaAluno123"}'
  ```

#### 3.1.2 GET `/auth/me`

**Descricao:**  
Retorna o perfil do usuario autenticado, incluindo:

- dados basicos (id, nome, email)
- papeis na academia atual (`role` principal + `roles` completos)
- vinculo com a academia
- status da matricula e faixa atual

**Metodo:** `GET`  
**URL:** `/v1/auth/me`  
**Auth:** `Authorization: Bearer <accessToken>` (obrigatorio)  
**Roles:** qualquer usuario autenticado (`ALUNO`, `INSTRUTOR`, `PROFESSOR`, `ADMIN`, `TI`)

**Fluxo tipico via Swagger (`/v1/docs`):**

1. Chamar `POST /v1/auth/login` com `email` e `senha`.
2. Copiar o campo `accessToken` da resposta.
3. No Swagger, clicar em **Authorize** (cadeado verde) no esquema `JWT`.
4. Preencher com **somente** o `accessToken` (sem prefixo); o Swagger ja envia `Authorization: Bearer ...`.
5. Confirmar, fechar o modal e executar `GET /v1/auth/me`.

O header so e enviado para rotas anotadas com `@ApiBearerAuth('JWT')`; controllers privados usam `@ApiAuth()` para manter o swagger alinhado com os guards.

O Swagger enviara automaticamente `Authorization: Bearer <accessToken>`.

**Exemplo de resposta 200 (ALUNO):**

```json
{
  "id": "58c97363-6137-46ff-b5b4-ec2cd77a075f",
  "nome": "Aluno Seed",
  "email": "aluno.seed@example.com",
  "role": "ALUNO",
  "roles": ["ALUNO"],
  "academiaId": "46af5505-f3cd-4df2-b856-ce1a33471481",
  "academiaNome": "Academia Seed BJJ",
  "faixaAtual": "azul",
  "grauAtual": 1,
  "matriculaStatus": "ATIVA",
  "matriculaDataInicio": "2025-06-01T03:00:00.000Z",
  "matriculaDataFim": null
}
```

**Observacao:** `role` e o papel principal do usuario na academia do token (prioridade `TI` > `ADMIN` > `PROFESSOR` > `INSTRUTOR` > `ALUNO`).  
**Codigos de resposta:** `200 OK`, `401 Unauthorized`, `404 Not Found`.

**Exemplo curl (/auth/me):**
```bash
ACCESS_TOKEN="<cole-o-accessToken-do-login>"
curl http://localhost:3000/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### 3.1.3 Demais rotas de Auth (estado atual)

- `GET /auth/convite/:codigo` - valida codigo de convite.
- `POST /auth/register` - conclui cadastro a partir de convite.
- `POST /auth/refresh` - renova tokens (mock; sera evoluida).
- `POST /auth/forgot-password` - inicia fluxo de recuperacao (stub).
- `POST /auth/reset-password` - redefine senha com token (stub).

### 3.2 Dashboards & Home

#### 3.2.0 GET `/home`

- **Descricao**: home agregada. Modo padrao: `STAFF` se o token tiver algum papel staff (`PROFESSOR`/`INSTRUTOR`/`ADMIN`/`TI`), senao `ALUNO`. Override opcional via `?mode=aluno|staff` respeitando `roles` do token.
- **Query `mode`**: opcional; se omitido, o backend escolhe automaticamente (`STAFF` se houver papel staff no token, senao `ALUNO`).
- **Auth/Roles**: qualquer usuario autenticado com o papel solicitado (`mode=staff` requer papel staff; `mode=aluno` requer ALUNO em `roles`).
- **Retorna**:
  - `mode`: `ALUNO` ou `STAFF`
  - `me`: igual ao `/auth/me` (inclui `role` e `roles`)
  - `aluno`: dashboard do aluno + `checkinDisponiveis`, `ultimasPresencas` (10) e `historicoGraduacoes` (10) — presente apenas quando `mode=ALUNO`
  - `staff`: dashboard staff + `aulasHoje` e pendencias (`total` + itens) — presente apenas quando `mode=STAFF`
- **Exemplos (curl)**:
  ```bash
  # aluno (modo default aluno)
  ACCESS_TOKEN="<token-aluno>"
  curl http://localhost:3000/v1/home \
    -H "Authorization: Bearer $ACCESS_TOKEN"

  # staff (modo default staff)
  ACCESS_TOKEN="<token-professor>"
  curl http://localhost:3000/v1/home \
    -H "Authorization: Bearer $ACCESS_TOKEN"

  # staff forçando modo staff explicitamente
  curl "http://localhost:3000/v1/home?mode=staff" \
    -H "Authorization: Bearer $ACCESS_TOKEN"

  # staff enxergando modo aluno (precisa ALUNO em roles)
  curl "http://localhost:3000/v1/home?mode=aluno" \
    -H "Authorization: Bearer $ACCESS_TOKEN"

  # aluno sem papel staff tentando modo=staff (esperado 403)
  curl "http://localhost:3000/v1/home?mode=staff" \
    -H "Authorization: Bearer $ACCESS_TOKEN"
  ```

Notas:
- Persona professor no seed possui `roles=["PROFESSOR","ALUNO"]`, entao pode usar `mode=aluno` ou `mode=staff`.
- Aluno puro nao tem papel staff, portanto `mode=staff` retorna 403.

#### 3.2.1 GET `/dashboard/aluno` (real)

- **Roles:** `ALUNO` e papeis acima (INSTRUTOR/PROFESSOR/ADMIN/TI).
- **Multi-tenant:** filtra `matriculas`, `aulas`, `presencas` e `regras_graduacao` pelo `academiaId` do JWT.
- **Calculo:**
  - `statusMatricula`: matricula mais recente do aluno na academia (prioriza `ATIVA`). Se inexistente ou inativa, retorna o status encontrado e numeros zerados.
  - `proximaAula*`: proxima aula futura da academia (`aulas` + `turmas`, `data_inicio > now()`, ignorando `CANCELADA`).
  - `aulasNoGrauAtual`: conta `presencas` com status `PRESENTE` desde a ultima `graduacoes.data_graduacao` (ou `data_inicio` da matricula) na mesma academia.
  - `metaAulas`: `regras_graduacao.meta_aulas_no_grau` se > 0; se vazio/0 usa `aulas_minimas` se > 0; se ainda sem valor, fallback `DEFAULT_META_AULAS = 60`.
  - `progressoPercentual`: se `metaAulas <= 0` retorna `0`; senao `floor(aulasNoGrauAtual * 100 / metaAulas)` limitado a `100`.
  - Seeds/guarda-corpos: `sql/003-seed-faixas-e-regras-base.sql` e `sql/002-seed-demo-completa.sql` trazem valores > 0 (inclui faixa preta) e o schema tem CHECK para bloquear zeros; use `NULL` para desativar uma meta.
- **Exemplo de resposta (seeds, sem aulas futuras apos 2025-11):**
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

#### 3.2.2 GET `/dashboard/staff` (real)

- **Roles:** `INSTRUTOR`, `PROFESSOR`, `ADMIN`, `TI` (aluno bloqueado).
- **Multi-tenant:** todos os contadores filtram pelo `academiaId` do JWT.
- **Timezone:** contas de hoje usam janela [startUtc, endUtc) calculada com `APP_TIMEZONE`.
- **Retorna:** `alunosAtivos` (matriculas `ATIVA`), `aulasHoje` (aulas da academia na data atual), `presencasHoje` e `faltasHoje` (status em `presencas` para aulas do dia).
- **Exemplo de resposta (seeds, data fora do calendario de aulas):**
  ```json
  {
    "alunosAtivos": 5,
    "aulasHoje": 0,
    "presencasHoje": 0,
    "faltasHoje": 0
  }
  ```

### 3.3 Alunos (perfil e evolucao) — real

#### 3.3.1 GET `/alunos` (staff)
- **Roles:** `INSTRUTOR`, `PROFESSOR`, `ADMIN`, `TI` (aluno nao pode).
- **Multi-tenant:** filtra por `academiaId` do JWT usando papeis/matriculas.
- **Retorna:** `id`, `nome`, `email`, `faixaAtual` (slug), `grauAtual`, `matriculaStatus`, `matriculaNumero`.
- **Exemplo (seeds):**
  ```json
  [
    {
      "id": "aluno-uuid",
      "nome": "Aluno Seed",
      "email": "aluno.seed@example.com",
      "faixaAtual": "azul",
      "grauAtual": 1,
      "matriculaStatus": "ATIVA",
      "matriculaNumero": 2
    }
  ]
  ```

#### 3.3.2 GET `/alunos/:id`
- **Roles/escopo:** `ALUNO` so pode consultar o proprio `id` (`sub` do token). `INSTRUTOR/PROFESSOR/ADMIN/TI` podem consultar qualquer aluno da **mesma** academia; se outra academia, `403`. `UUID` invalido -> `400`; inexistente -> `404`.
- **Retorna:** dados do aluno + vinculo atual: `id`, `nome`, `email`, `academiaId`, `academiaNome`, `matriculaNumero`, `matriculaStatus`, `matriculaDataInicio`, `matriculaDataFim`, `faixaAtual`, `grauAtual`, `presencasTotais` (somente status `PRESENTE` na academia do token).
- **Exemplo (Aluno Seed):**
  ```json
  {
    "id": "58c97363-6137-46ff-b5b4-ec2cd77a075f",
    "nome": "Aluno Seed",
    "email": "aluno.seed@example.com",
    "academiaId": "46af5505-f3cd-4df2-b856-ce1a33471481",
    "academiaNome": "Academia Seed BJJ",
    "matriculaNumero": 2,
    "matriculaStatus": "ATIVA",
    "matriculaDataInicio": "2025-06-01",
    "matriculaDataFim": null,
    "faixaAtual": "azul",
    "grauAtual": 1,
    "presencasTotais": 20
  }
  ```

#### 3.3.3 GET `/alunos/:id/evolucao`
- **Roles/escopo:** mesmo acesso da rota de detalhe (`ALUNO` so o proprio id; staff da mesma academia).
- **Calculo:**  
  - `historico`: graduacoes na academia (`graduacoes` + `usuarios` do professor).  
  - `aulasNaFaixaAtual`: presencas `PRESENTE` desde a ultima graduacao (ou `data_inicio` da matricula se ainda nao graduado).  
  - `metaAulas`: `regras_graduacao.meta_aulas_no_grau` se > 0; senao `aulas_minimas`; senao `DEFAULT_META_AULAS = 60`.  
  - `porcentagemProgresso`: `floor(aulasNaFaixaAtual * 100 / metaAulas)`, limitado a `100`; se `metaAulas <= 0` retorna `0`.  
- **Exemplo (Aluno Seed):**
  ```json
  {
    "historico": [
      {
        "faixaSlug": "branca",
        "grau": 0,
        "dataGraduacao": "2024-01-10T00:00:00.000Z",
        "professorNome": "Professor Seed"
      },
      {
        "faixaSlug": "azul",
        "grau": 1,
        "dataGraduacao": "2025-07-18T00:00:00.000Z",
        "professorNome": "Professor Seed"
      }
    ],
    "faixaAtual": "azul",
    "grauAtual": 1,
    "aulasNaFaixaAtual": 20,
    "metaAulas": 60,
    "porcentagemProgresso": 33
  }
  ```

### 3.4 Turmas e Aulas (listagens) — real

#### 3.4.1 Turmas (CRUD com soft-delete)
- **Roles leitura:** `ALUNO` e staff (mesma academia). **Escrita:** `INSTRUTOR`, `PROFESSOR`, `ADMIN`, `TI`.
- **Soft-delete:** `deleted_at/deleted_by`; listagens ignoram deletadas por default. `includeDeleted=true` so para staff.
- **Endpoints:**
  - `GET /turmas` (queries `includeDeleted` ou `onlyDeleted` opcionais)
  - `GET /turmas/:id`
  - `POST /turmas`
  - `PATCH /turmas/:id`
  - `DELETE /turmas/:id` (marca `deleted_at/deleted_by`)
  - `POST /turmas/:id/restore` (reativa; 409 se ja houver turma ativa com mesmo nome)
- **Campos (response):** `id`, `nome`, `tipoTreino`, `diasSemana` (0=Dom ... 6=Sab), `horarioPadrao` (HH:MM), `instrutorPadraoId`, `instrutorPadraoNome`, `deletedAt`.
- **Curls (staff):**
  ```bash
  ACCESS_TOKEN="<token-professor>"
  # criar
  curl -X POST http://localhost:3000/v1/turmas \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"nome":"No-Gi Manha","tipoTreinoId":"<tipo-id>","diasSemana":[2,4],"horarioPadrao":"08:00"}'
  # listar
  curl http://localhost:3000/v1/turmas -H "Authorization: Bearer $ACCESS_TOKEN"
  # editar
  curl -X PATCH http://localhost:3000/v1/turmas/<turmaId> \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"horarioPadrao":"09:00"}'
  # deletar (soft)
  curl -X DELETE http://localhost:3000/v1/turmas/<turmaId> \
    -H "Authorization: Bearer $ACCESS_TOKEN"
  # listar deletadas (staff)
  curl "http://localhost:3000/v1/turmas?includeDeleted=true" \
    -H "Authorization: Bearer $ACCESS_TOKEN"
  # listar apenas deletadas
  curl "http://localhost:3000/v1/turmas?onlyDeleted=true" \
    -H "Authorization: Bearer $ACCESS_TOKEN"
  # restaurar turma (reativa)
  curl -X POST http://localhost:3000/v1/turmas/<turmaId>/restore \
    -H "Authorization: Bearer $ACCESS_TOKEN"
  ```

#### 3.4.2 GET `/aulas/hoje`
- **Roles:** `INSTRUTOR`, `PROFESSOR`, `ADMIN`, `TI`.
- **Multi-tenant + timezone:** filtra `aulas` pelo `academiaId` e pela janela [startUtc, endUtc) calculada com `APP_TIMEZONE` (padrao `America/Sao_Paulo`), ignorando `CANCELADA`.
- **Retorna:** `id`, `dataInicio`, `dataFim`, `status`, `turmaId`, `turmaNome`, `turmaHorarioPadrao`, `tipoTreino`, `instrutorNome`.
- **Observacao:** se nao ha aulas no dia (ex.: seeds acabam em 2025-11), retorna `[]`.
- **Exemplo de estrutura (aula da seed):**
  ```json
  [
    {
      "id": "aula-uuid",
      "dataInicio": "2025-09-01T19:00:00.000Z",
      "dataFim": "2025-09-01T20:30:00.000Z",
      "status": "ENCERRADA",
      "turmaId": "turma-uuid",
      "turmaNome": "Adulto Gi Noite",
      "turmaHorarioPadrao": "19:00",
      "tipoTreino": "Gi Adulto",
      "instrutorNome": "Instrutor Seed"
    }
  ]
  ```

### 3.5 Check-in & Presencas (real)

**Regras gerais**
- Janela de hoje usa `APP_TIMEZONE` para montar [startUtc, endUtc); aplicada em `/checkin/disponiveis` e `/presencas/pendencias`.
- Escopo: `ALUNO` so enxerga o proprio historico/check-in; `STAFF` (INSTRUTOR/PROFESSOR/ADMIN/TI) so ve dados da `academiaId` do token.
- Duplicidade: `presencas` tem unique `(aula_id, aluno_id)`; se ja existir retorna `422`.
- QR Codes: `GET /aulas/:id/qrcode` (roles staff) gera `qrToken` seguro (`crypto.randomBytes`), persiste em `aulas.qr_token/qr_expires_at` e expira conforme `QR_TTL_MINUTES` (default `5` minutos).
- Aprovacao: check-in do aluno sempre cria `aprovacao_status=PENDENTE` (`status=PRESENTE` quando QR, `status=PENDENTE` quando MANUAL). STAFF decide via `PATCH /v1/presencas/:id/decisao` ou `POST /v1/presencas/pendencias/lote`.
- Pendencias: filtros opcionais `date` (YYYY-MM-DD) ou `from`/`to` (ISO, sempre juntos). Sem query, usa “hoje” no `APP_TIMEZONE`. `from` sem `to` (ou vice-versa) -> `400`.
- Erros: `401` sem token, `403` fora do escopo/academia, `422` para duplicidade/aula cancelada/QR invalido/expirado, `400` para query de data invalida.

#### 3.5.1 GET `/checkin/disponiveis` (ALUNO)
- Lista aulas de hoje (`aulas.status <> 'CANCELADA'`) da academia do token e indica se o aluno ja possui presenca (`jaFezCheckin`).
- Retorna: `aulaId`, `turmaNome`, `dataInicio`, `dataFim`, `tipoTreino`, `statusAula`, `jaFezCheckin`.
- Requer matricula `ATIVA` na academia; senao `403`.

#### 3.5.2 POST `/checkin` (ALUNO)
- Payload: `{ "aulaId": "uuid", "tipo": "MANUAL" | "QR", "qrToken": "opcional" }`.
- Validacoes: aula existe e pertence a academia do token; aluno tem matricula `ATIVA`; `tipo=QR` exige `qrToken` igual a `aulas.qr_token` e `qr_expires_at > now()`; bloqueia duplicidade (`422`).
- Criacao: `MANUAL` -> `status=PENDENTE`, `origem=MANUAL`; `QR` -> `status=PRESENTE`, `origem=QR_CODE`; `registrado_por` = usuario do token; `aprovacao_status=PENDENTE`.
- Resposta: `{ id, aulaId, alunoId, status, origem, criadoEm, registradoPor, aprovacaoStatus }`.

#### 3.5.3 GET `/presencas/pendencias` (STAFF)
- Filtros opcionais: `date=YYYY-MM-DD` **ou** `from`/`to` (ISO, sempre juntos). Sem query, usa “hoje” (`APP_TIMEZONE`) com janela `[startUtc, endUtc)`.
- Lista presencas com `aprovacao_status='PENDENTE'` para a academia do token (filtra por `aulas.data_inicio` no intervalo escolhido).
- Retorna: `id`, `alunoId`, `alunoNome`, `aulaId`, `turmaNome`, `dataInicio`, `origem`, `status` (sempre `PENDENTE`), `criadoEm`, `aprovacaoStatus`.

#### 3.5.4 PATCH `/presencas/:id/decisao` (STAFF)
- Payload: `{ "decisao": "APROVAR" | "REJEITAR", "observacao?": "string" }`.
- Efeitos: `APROVAR` -> `aprovacao_status=APROVADA`, grava `aprovado_por`/`aprovado_em`; limpa campos de rejeicao. `REJEITAR` -> `aprovacao_status=REJEITADA`, grava `rejeitado_por`/`rejeitado_em`.
- Valida `id` (UUID), escopo de academia, status pendente e registra quem decidiu.

#### 3.5.5 POST `/presencas/pendencias/lote` (STAFF)
- Payload: `{ "ids": ["uuid","uuid"], "decisao": "APROVAR" | "REJEITAR", "observacao?": "string" }`.
- Resposta: `{ "totalProcessados": 2, "aprovados": 2, "rejeitados": 0, "ignorados": 0 }`.

#### 3.5.6 GET `/alunos/:id/historico-presencas`
- Roles: `ALUNO` (somente o proprio id) ou `STAFF` da mesma academia.
- Query opcional: `from=YYYY-MM-DD`, `to=YYYY-MM-DD` (limite padrao 50 itens).
- Retorna: `presencaId`, `aulaId`, `dataInicio`, `turmaNome`, `tipoTreino`, `status`, `origem`.

#### 3.5.7 GET `/aulas/:id/qrcode` (STAFF)
- Gera/atualiza `qr_token` e `qr_expires_at` da aula (academia validada). TTL em minutos via env `QR_TTL_MINUTES` (fallback 5).
- Resposta: `{ "aulaId": "...", "qrToken": "...", "expiresAt": "..." }` mais contexto (`turma`, `horario`).

**Curls rapidos**
```bash
# login (aluno e staff)
ALUNO_TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aluno.seed@example.com","senha":"SenhaAluno123"}' | jq -r .accessToken)
STAFF_TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"instrutor.seed@example.com","senha":"SenhaInstrutor123"}' | jq -r .accessToken)

# gerar QR (staff)
AULA_ID="<id retornado de /checkin/disponiveis ou /aulas/hoje>"
QR=$(curl -s http://localhost:3000/v1/aulas/$AULA_ID/qrcode \
  -H "Authorization: Bearer $STAFF_TOKEN")
QR_TOKEN=$(echo "$QR" | jq -r .qrToken)

# check-in via QR (aluno)
curl -X POST http://localhost:3000/v1/checkin \
  -H "Authorization: Bearer $ALUNO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"aulaId\":\"$AULA_ID\",\"tipo\":\"QR\",\"qrToken\":\"$QR_TOKEN\"}"

# check-in manual (aluno)
curl -X POST http://localhost:3000/v1/checkin \
  -H "Authorization: Bearer $ALUNO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"aulaId\":\"$AULA_ID\",\"tipo\":\"MANUAL\"}"

# pendencias (staff, default hoje no APP_TIMEZONE)
curl http://localhost:3000/v1/presencas/pendencias \
  -H "Authorization: Bearer $STAFF_TOKEN"

# pendencias com filtros opcionais
curl "http://localhost:3000/v1/presencas/pendencias?date=2025-12-12" \
  -H "Authorization: Bearer $STAFF_TOKEN"
curl "http://localhost:3000/v1/presencas/pendencias?from=2025-12-12T03:00:00.000Z&to=2025-12-13T03:00:00.000Z" \
  -H "Authorization: Bearer $STAFF_TOKEN"

# aprovar/rejeitar (staff)
PRESENCA_ID="<id>"
curl -X PATCH http://localhost:3000/v1/presencas/$PRESENCA_ID/decisao \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decisao":"APROVAR","observacao":"Validado"}'

# decisao em lote
curl -X POST http://localhost:3000/v1/presencas/pendencias/lote \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids":["'"$PRESENCA_ID"'"],"decisao":"REJEITAR","observacao":"Teste"}'
```

### 3.6 Configuracoes

- `GET /config/regras-graduacao` / `PUT /config/regras-graduacao/:faixaSlug` - regras de graduacao (planejado).
- `GET /config/tipos-treino` - tipos/modalidades de treino (planejado).
- `POST /invites` - geracao de convites (planejado).

---

## 4. Padroes de resposta e erros

- **Status codes**: `200`, `201`, `400`, `401`, `403`, `404`, `422`, `500`.
- **Formato de erro sugerido**:
  ```json
  {
    "statusCode": 422,
    "error": "Unprocessable Entity",
    "message": "Aluno ja possui check-in nesta aula",
    "details": {
      "aulaId": "uuid-...",
      "alunoId": "uuid-..."
    }
  }
  ```

---

## 5. Notas rapidas de implementacao

- Validar role e pertencimento a academia para rotas protegidas.
- `TI` deve ter no minimo as permissoes de `ADMIN`, com abrangencia multi-academia conforme evolucao.
- Dashboards devem retornar numeros agregados pelo backend, evitando calculos pesados no frontend.
- Check-in deve validar QR/TTL e impedir duplicidades.

---

## 6. Seeds e contas de exemplo

Todas as contas abaixo pertencem a **Academia Seed BJJ** (scripts em `sql/002-seed-demo-completa.sql`):
- `aluno.seed@example.com` / `SenhaAluno123` — ALUNO
- `instrutor.seed@example.com` / `SenhaInstrutor123` — INSTRUTOR (tambem ALUNO)
- `professor.seed@example.com` / `SenhaProfessor123` — PROFESSOR (tambem ALUNO)
- `admin.seed@example.com` / `SenhaAdmin123` — ADMIN (tambem ALUNO)
- `ti.seed@example.com` / `SenhaTi123` — TI (tambem ALUNO)
- O seed garante uma aula "hoje" (timezone `America/Sao_Paulo`) e uma presenca `PENDENTE` para `aluno.seed@example.com`, facilitando testar `/presencas/pendencias` imediatamente.

> Nota: se `JWT_SECRET` for alterado, todos os tokens emitidos antes da troca deixam de ser validos.

## 7. SSL (Supabase) e variaveis de ambiente

- DEV/POC: use `PG_SSL=true` e `PG_SSL_REJECT_UNAUTHORIZED=false` para evitar `self-signed certificate in certificate chain` ao conectar no Supabase. Em conexoes locais (`localhost`) o SSL e desabilitado automaticamente.
- PRODUCAO (TODO): usar verify-full com o CA do Supabase (`PG_SSL=true`, `PG_SSL_REJECT_UNAUTHORIZED=true`, `SUPABASE_CA_CERT_PATH` apontando para o certificado baixado). A carga do CA e configuracao de `ssl.ca` sera implementada no passo 3B.