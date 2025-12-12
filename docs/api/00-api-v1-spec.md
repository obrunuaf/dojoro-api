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
- **Swagger/Authorize**: em `/v1/docs`, clique em **Authorize** (esquema `JWT`) e cole apenas o `accessToken` (sem `Bearer`); o Swagger prefixa o header e so envia para rotas anotadas com `@ApiBearerAuth('JWT')`.
- **Multi-tenant**: todas as consultas devem ser filtradas pelo `academiaId` presente no JWT (dashboards, presencas, regras, etc.).
- **Claims do JWT** (emitido no login):
  - `sub`: id do usuario (`usuarios.id`)
  - `email`
  - `role`: papel principal resolvido para a academia do token
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
      "academiaId": "46af..."
    }
  }
  ```
- **Notas**:
  - O `accessToken` traz os claims `sub`, `email`, `role`, `academiaId`.
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
- papel principal na academia atual
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

### 3.2 Dashboards

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

#### 3.4.1 GET `/turmas`
- **Roles:** `ALUNO`, `INSTRUTOR`, `PROFESSOR`, `ADMIN`, `TI`.
- **Multi-tenant:** filtra `turmas` pelo `academiaId` do token.
- **Retorna:** `id`, `nome`, `tipoTreino`, `diasSemana` (0=Domingo ... 6=Sabado), `horarioPadrao` (HH:MM), `instrutorPadraoId`, `instrutorPadraoNome`.
- **Exemplo (seed):**
  ```json
  [
    {
      "id": "turma-uuid",
      "nome": "Adulto Gi Noite",
      "tipoTreino": "Gi Adulto",
      "diasSemana": [1, 3],
      "horarioPadrao": "19:00",
      "instrutorPadraoId": "instrutor-uuid",
      "instrutorPadraoNome": "Instrutor Seed"
    }
  ]
  ```

#### 3.4.2 GET `/aulas/hoje`
- **Roles:** `INSTRUTOR`, `PROFESSOR`, `ADMIN`, `TI`.
- **Multi-tenant:** filtra `aulas` pelo `academiaId` e `date(data_inicio) = current_date`, ignorando `CANCELADA`.
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

### 3.5 Check-in & Presencas

- `GET /checkin/disponiveis` - aulas disponiveis para check-in (planejado).
- `POST /checkin` - efetiva check-in (validando QR/horario, planejado).
- `GET /presencas` e endpoints de ajuste/validacao (planejado).

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

> Nota: se `JWT_SECRET` for alterado, todos os tokens emitidos antes da troca deixam de ser validos.
