# Modelo logico v1 (Postgres)

Esquema usado pela API v1. Scripts: `sql/001-init-schema.sql` (DDL), `sql/003-seed-faixas-e-regras-base.sql` (dominio), `sql/002-seed-demo-completa.sql` (dados de exemplo).

## Tabelas principais
- **faixas**: `slug` PK, `nome`, `categoria`, `ordem`, `graus_maximos`.
- **academias**: `id` PK, `nome`, `codigo_convite`, `ativo`, `criado_em`.
- **usuarios**: `id` PK, `email` unique, `senha_hash`, `nome_completo`, `status` (`INVITED/ACTIVE/INACTIVE`), `faixa_atual_slug` FK, `grau_atual`, `aceitou_termos`, `criado_em`.
- **usuarios_papeis**: `usuario_id` FK, `academia_id` FK, `papel` (`ALUNO/INSTRUTOR/PROFESSOR/ADMIN/TI`), `criado_em`, unique `(usuario_id, academia_id, papel)`.
- **convites**: `academia_id` FK, `email`, `token_hash` unique, `papel_sugerido`, `expires_at`, `used_at`.
- **regras_graduacao**: `academia_id` FK, `faixa_slug` FK, `aulas_minimas`, `tempo_minimo_meses`, `meta_aulas_no_grau`, unique `(academia_id, faixa_slug)`.
- **tipos_treino**: `academia_id` FK, `nome`, `cor_identificacao`, unique `(academia_id, nome)`.
- **turmas**: `academia_id` FK, `tipo_treino_id` FK, `nome`, `dias_semana` integer[], `hora_inicio`, `hora_fim`, `instrutor_padrao_id`.
- **aulas**: `academia_id` FK, `turma_id` FK, `data_inicio`, `data_fim`, `status`, `qr_token`, `qr_expires_at`, `criado_em`.
- **matriculas**: `usuario_id` FK, `academia_id` FK, `numero_matricula`, `status`, `data_inicio`, `data_fim`, unique `(academia_id, numero_matricula)`.
- **presencas**: `academia_id` FK, `aula_id` FK, `aluno_id` FK, `status`, `origem`, `registrado_por`, `criado_em`, unique `(aula_id, aluno_id)`.
- **graduacoes**: `usuario_id` FK, `academia_id` FK, `faixa_slug` FK, `grau`, `data_graduacao`, `professor_id` FK, `observacoes`, `criado_em`.

## Relacoes chave
- `usuarios_papeis` → `usuarios` e `academias` (origem do papel ativo usado no JWT).
- `matriculas` → `usuarios` e `academias` (gate de acesso e dashboards).
- `turmas` → `tipos_treino` → `academias`; `aulas` → `turmas` → `academias` (agenda/check-in).
- `presencas` → `aulas` → `turmas` → `academias` e `presencas` → `usuarios` (aluno).
- `regras_graduacao` → `faixas`/`academias`; `graduacoes` → `usuarios`/`faixas`/`academias`.
- `convites` → `academias` (validados em `GET /auth/convite/:codigo` e consumidos em `POST /auth/register`).

## Tabelas por modulo
- **Auth/Login/Me/Register/Convites**: `usuarios`, `usuarios_papeis`, `matriculas`, `academias`, `convites`.
- **Dashboard**: `presencas`, `matriculas`, `regras_graduacao`, `aulas`, `turmas` (dados ainda mockados na API, mas ja cobertos pelo schema).
- **Checkin & Presencas**: `aulas`, `presencas`, `matriculas`, `turmas`, `tipos_treino`, `usuarios`.
- **Alunos (listar/detalhar/evolucao)**: `usuarios`, `matriculas`, `presencas`, `graduacoes`, `faixas`.
- **Graduacoes**: `graduacoes`, `faixas`, `usuarios` (aluno e professor).
- **Config**: `faixas`, `regras_graduacao`, `tipos_treino`, `turmas`.
