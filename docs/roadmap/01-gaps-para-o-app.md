# Gaps para o App

> O que está pronto e o que falta para lançar o app mobile/PWA.

---

## ✅ Pronto para o App

### Auth & Onboarding

- [x] Login com email/senha
- [x] Signup self-service com código da academia
- [x] Recuperação de senha (forgot → OTP → reset)
- [x] Completar perfil (telefone, data nascimento)
- [x] Convites (staff gera, aluno consome)

### Home & Dashboard

- [x] Home agregada com modo aluno/staff
- [x] Dashboard aluno (próxima aula, progresso, status)
- [x] Dashboard staff (contadores do dia)

### Check-in

- [x] Listar aulas disponíveis hoje
- [x] Check-in via QR Code
- [x] Check-in manual (gera pendência)
- [x] QR Code com TTL configurável

### Presenças (Staff)

- [x] Listar pendências (com filtros)
- [x] Decidir individual (APROVAR/REJEITAR)
- [x] Decidir em lote
- [x] Presença manual
- [x] Listar presenças da aula

### Turmas & Aulas

- [x] CRUD turmas completo
- [x] CRUD aulas completo
- [x] Gerar aulas em lote
- [x] Encerrar aula
- [x] Soft delete com restore

### Alunos

- [x] Listar alunos da academia
- [x] Detalhe do aluno
- [x] Evolução (histórico graduações + progresso)
- [x] Histórico de presenças

### Matrículas (Staff)

- [x] Listar matrículas PENDENTES
- [x] Aprovar/Rejeitar matrícula

### Academia

- [x] Ver dados da academia
- [x] Editar dados da academia

---

## 🔶 Gaps por Prioridade

### P0 - Obrigatório para Launch

#### 1. Refresh Token Real

- **Status:** STUB (retorna mock)
- **Impacto:** Tokens expiram (default 1h), usuário perde sessão
- **Endpoint:** `POST /auth/refresh`
- **Sugestão:** Implementar rotação de refresh tokens com tabela dedicada

```typescript
// Fluxo esperado
POST /auth/refresh
{ "refreshToken": "current-token" }
→ { "accessToken": "new-jwt", "refreshToken": "new-refresh" }
```

---

### P1 - Importante para UX

#### 2. Notificações para Matrícula Aprovada

- **Status:** PLANEJADO
- **Impacto:** Aluno com matrícula PENDENTE não sabe quando foi aprovado
- **Sugestão:**
  - Push notification via Firebase/OneSignal
  - Ou polling: app checa `/auth/me` periodicamente

#### 3. Upload de Foto de Perfil

- **Status:** PLANEJADO
- **Impacto:** Perfil básico, sem identidade visual
- **Sugestão:**
  - Storage: Supabase Storage ou S3
  - Endpoint: `PUT /users/me/avatar`

---

### P2 - Nice to Have

#### 4. Regras de Graduação Configuráveis

- **Status:** STUB
- **Impacto:** Professor não consegue personalizar metas por faixa
- **Endpoints:**
  - `GET /config/regras-graduacao` (stub)
  - `PUT /config/regras-graduacao/:faixaSlug` (stub)

#### 5. Registrar Graduação

- **Status:** STUB
- **Impacto:** Graduação só via SQL
- **Endpoint:** `POST /graduacoes` (stub)

#### 6. Multi-academia para TI

- **Status:** PLANEJADO
- **Impacto:** TI precisa trocar academia no token
- **Sugestão:**
  - `POST /auth/switch-academia` ou
  - Novo login selecionando academia

---

## 📋 Resumo de Endpoints por Status

### ✅ IMPLEMENTADO (Real Postgres)

| Módulo     | Endpoints                                                                         |
| ---------- | --------------------------------------------------------------------------------- |
| Auth       | login, me, signup, forgot-password, verify-otp, reset-password, convite, register |
| Users      | PATCH /me/profile                                                                 |
| Home       | GET /home                                                                         |
| Dashboard  | aluno, staff                                                                      |
| Alunos     | listar, detalhe, evolucao, historico-presencas                                    |
| Turmas     | CRUD + restore                                                                    |
| Aulas      | CRUD + lote + encerrar + presencas + manual + qrcode                              |
| Check-in   | disponiveis, POST                                                                 |
| Presenças  | pendencias, decisao, lote                                                         |
| Config     | tipos-treino                                                                      |
| Invites    | POST                                                                              |
| Academia   | GET/PATCH /me                                                                     |
| Matrículas | pendentes, decisão                                                                |
| Health     | health, ready                                                                     |

### 🔶 STUB/MOCK

| Endpoint                             | Notas              |
| ------------------------------------ | ------------------ |
| `POST /auth/refresh`                 | Retorna token mock |
| `GET /config/regras-graduacao`       | Dados mock         |
| `PUT /config/regras-graduacao/:slug` | Não persiste       |
| `POST /graduacoes`                   | Stub               |

### ⏳ PLANEJADO (não existe)

| Feature             | Prioridade |
| ------------------- | ---------- |
| Notificações push   | P1         |
| Upload de avatar    | P1         |
| Multi-academia (TI) | P2         |
| Relatórios/exports  | P3         |

---

## Próximos Passos Recomendados

1. **Implementar refresh token** antes de ir para produção
2. **Definir estratégia de notificação** (push ou polling)
3. **Validar fluxo completo** com protótipo do app
