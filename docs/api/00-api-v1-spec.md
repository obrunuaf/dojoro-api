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
- **Swagger/Authorize**: em `/v1/docs`, clique em **Authorize** e informe `Bearer <accessToken>` (com o prefixo) para testar rotas protegidas.
- **Multi-tenant**: todas as consultas devem ser filtradas pelo `academiaId` presente no JWT (dashboards, presencas, regras, etc.).
- **Claims do JWT** (emitido no login):
  - `sub`: id do usuario (`usuarios.id`)
  - `email`
  - `role`: papel principal resolvido para a academia do token
  - `academiaId`: academia atual do usuario
- **Roles suportados**: `ALUNO`, `INSTRUTOR`, `PROFESSOR`, `ADMIN`, `TI`.
  - Prioridade do papel principal quando o usuario tem multiplos papeis na mesma academia: `TI` > `ADMIN` > `PROFESSOR` > `INSTRUTOR` > `ALUNO`.
- **Banco**: PostgreSQL (Supabase). Scripts de schema/seeds em `sql/` (ex.: `001-init-schema.sql`, `002-seed-demo-completa.sql`, `003-seed-faixas-e-regras-base.sql`).

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
3. No Swagger, clicar em **Authorize** (cadeado verde).
4. Preencher com `Bearer <accessToken>` (prefixo incluso).
5. Confirmar, fechar o modal e executar `GET /v1/auth/me`.

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
  - `metaAulas`: `regras_graduacao.meta_aulas_no_grau` para a `faixa_atual_slug` do usuario; fallback `30` se nao houver regra/valor.
  - `progressoPercentual`: `floor(aulasNoGrauAtual * 100 / metaAulas)`, limitado a `100`.
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

### 3.3 Check-in & Presencas

- `GET /checkin/disponiveis` - aulas disponiveis para check-in (planejado).
- `POST /checkin` - efetiva check-in (validando QR/horario, planejado).
- `GET /presencas` e endpoints de ajuste/validacao (planejado).

### 3.4 Alunos & Graduacoes

- `GET /alunos/:id/evolucao` - evolucao de faixas/graus (planejado).
- `GET /graduacoes` / `POST /graduacoes` - registro de graduacoes (planejado).

### 3.5 Configuracoes

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
