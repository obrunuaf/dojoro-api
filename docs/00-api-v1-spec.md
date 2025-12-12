# BJJAcademy API v1 - Especificacao (estado atual)

Estado real da API NestJS v1 com Postgres (Supabase). Todas as rotas usam o prefixo `/v1` e o Swagger fica em `/v1/docs` com esquema **JWT** habilitado.  
Multi-tenant: sempre filtre consultas pelo `academiaId` presente no JWT.

## 1) Autenticacao no Swagger (passo a passo)
1. Suba a API (`npm run start:dev`) e abra `http://localhost:3000/v1/docs`.
2. Chame `POST /v1/auth/login` com `email` e `senha`.
3. Copie o `accessToken` retornado.
4. Clique em **Authorize** (cadeado verde) e cole **exatamente** `Bearer <accessToken>`.
5. Execute rotas protegidas (ex.: `GET /v1/auth/me`, `GET /v1/dashboard/aluno`, etc.).
6. Sem o prefixo `Bearer` o Swagger retorna `401 Unauthorized` (comportamento validado).

### Body do login (confirmado)
```json
{
  "email": "aluno.seed@example.com",
  "senha": "SenhaAluno123"
}
```
Campos aceitos: apenas `email` e `senha`.

### Claims do JWT
`sub` (usuario), `email`, `role` (papel efetivo), `academiaId` (contexto).

## 2) Roles e role efetiva
- Roles suportados: `ALUNO`, `INSTRUTOR`, `PROFESSOR`, `ADMIN`, `TI`.
- Um usuario pode ter mais de um papel na mesma academia (ex.: ADMIN tambem e ALUNO).
- O JWT sempre traz **uma role efetiva** (usada nos guards) seguindo a regra atual do login: `TI > ADMIN > PROFESSOR > INSTRUTOR > ALUNO`.

## 3) Fluxo validado (curl)
```bash
# Login (real, Postgres)
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aluno.seed@example.com","senha":"SenhaAluno123"}'

# /auth/me (real, requer Bearer)
ACCESS_TOKEN="<cole-o-accessToken>"
curl http://localhost:3000/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# /dashboard/aluno (real, filtra academiaId do token)
curl http://localhost:3000/v1/dashboard/aluno \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# /dashboard/staff (real, requer INSTRUTOR/PROFESSOR/ADMIN/TI)
curl http://localhost:3000/v1/dashboard/staff \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# /alunos/:id (stub - retorno provisorio)
curl http://localhost:3000/v1/alunos/123 \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# /alunos/:id/evolucao (stub - retorno provisorio)
curl http://localhost:3000/v1/alunos/123/evolucao \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# /turmas (stub - retorno provisorio)
curl http://localhost:3000/v1/turmas \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Exemplos de resposta (resumo)
- `POST /auth/login` (real):
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
- `GET /auth/me` (real):
  ```json
  {
    "id": "58c9...",
    "nome": "Aluno Seed",
    "email": "aluno.seed@example.com",
    "role": "ALUNO",
    "academiaId": "46af...",
    "academiaNome": "Academia Seed BJJ",
    "faixaAtual": "azul",
    "grauAtual": 1,
    "matriculaStatus": "ATIVA",
    "matriculaDataInicio": "2025-06-01T03:00:00.000Z",
    "matriculaDataFim": null
  }
  ```
- `GET /dashboard/aluno` (real, multi-tenant):
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
- `GET /dashboard/staff` (real):
  ```json
  {
    "alunosAtivos": 5,
    "aulasHoje": 0,
    "presencasHoje": 0,
    "faltasHoje": 0
  }
  ```
- `GET /alunos/:id` (stub):
  ```json
  {
    "id": "123",
    "nome": "Joao Silva",
    "email": "joao@example.com",
    "telefone": "+55 11 99999-9999",
    "matriculaNumero": "MAT-001",
    "academia": "BJJ Academy Central",
    "statusMatricula": "ATIVA",
    "faixaAtual": "Azul",
    "grauAtual": 2,
    "presencasTotais": 120
  }
  ```
- `GET /alunos/:id/evolucao` (stub):
  ```json
  {
    "historico": [
      {
        "faixaAnterior": "Branca",
        "grauAnterior": 2,
        "faixaNova": "Azul",
        "grauNovo": 0,
        "data": "2024-05-10",
        "professor": "Professor X"
      }
    ],
    "aulasNaFaixaAtual": 12,
    "metaAulas": 40,
    "porcentagemProgresso": 30
  }
  ```
- `GET /turmas` (stub):
  ```json
  [
    {
      "id": "turma-1",
      "nome": "Fundamentos Gi",
      "faixaAlvo": "Branca/Azul",
      "professor": "Professor X",
      "horarios": "Seg/Qua/Sex - 19h"
    }
  ]
  ```

## 4) Dashboards e regras de graduacao
- `GET /v1/dashboard/aluno` depende de `regras_graduacao` filtrado por `academiaId` + `faixa_atual_slug` do usuario.
- `metaAulas`: usa `meta_aulas_no_grau` se > 0; se vazio/0, usa `aulas_minimas` se > 0; se ainda sem valor, fallback `DEFAULT_META_AULAS = 60`.
- `progressoPercentual`: se `metaAulas <= 0` retorna `0`; senao `floor(aulasNoGrauAtual * 100 / metaAulas)` limitado a `100`.
- Seeds `sql/003-seed-faixas-e-regras-base.sql` e `sql/002-seed-demo-completa.sql` carregam metas > 0 (inclusive preta) e a tabela tem CHECK para impedir zeros. Para desativar uma regra use `NULL`.

## 5) Endpoints atuais no Swagger
- **Auth (real)**: `POST /auth/login`, `GET /auth/me`, `GET /auth/convite/:codigo`, `POST /auth/register`.
- **Dashboard (real)**: `GET /dashboard/aluno`, `GET /dashboard/staff`.
- **Auth (stub/mock)**: `POST /auth/refresh`, `POST /auth/forgot-password`, `POST /auth/reset-password`.
- **Checkin (stub)**: `GET /checkin/disponiveis`, `POST /checkin`.
- **Presencas (stub)**: `GET /presencas/pendencias`, `PATCH /presencas/:id/status`, `GET /alunos/:id/historico-presencas`.
- **Alunos (stub)**: `GET /alunos`, `GET /alunos/:id`, `GET /alunos/:id/evolucao`.
- **Aulas/Turmas (stub)**: `GET /turmas`, `GET /aulas/hoje`, `GET /aulas/:id/qrcode`.
- **Config (stub)**: `GET /config/tipos-treino`, `GET /config/regras-graduacao`, `PUT /config/regras-graduacao/:faixaSlug`.
- **Invites (stub)**: `POST /invites`.

## 6) Banco e seeds
- Banco alvo: **PostgreSQL** (Supabase = Postgres gerenciado). Conexao via `DATABASE_URL` (cliente `pg`).
- Ordem recomendada para aplicar SQL:
  1) `sql/001-init-schema.sql`
  2) `sql/003-seed-faixas-e-regras-base.sql`
  3) `sql/002-seed-demo-completa.sql`
- Pode rodar pelo SQL Editor do Supabase ou via `psql -f <arquivo>.sql`.

## 7) Seed Personas (credenciais de teste)
Todas pertencem a **Academia Seed BJJ**.
- ALUNO: `aluno.seed@example.com` / `SenhaAluno123`
- INSTRUTOR: `instrutor.seed@example.com` / `SenhaInstrutor123`
- PROFESSOR: `professor.seed@example.com` / `SenhaProfessor123`
- ADMIN: `admin.seed@example.com` / `SenhaAdmin123`
- TI: `ti.seed@example.com` / `SenhaTi123`
