# Roles e Controle de Acesso

> Guia prático de permissões na API Dojoro.

---

## Hierarquia de Roles

```
TI > ADMIN > PROFESSOR > INSTRUTOR > ALUNO
```

Prioridade usada para definir o `role` principal no JWT quando o usuário tem múltiplos papéis.

---

## Definição de Roles

| Role          | Descrição                                                   |
| ------------- | ----------------------------------------------------------- |
| **ALUNO**     | Usuário padrão. Faz check-in, vê próprio perfil e histórico |
| **INSTRUTOR** | Gerencia aulas e presenças do dia-a-dia                     |
| **PROFESSOR** | Tudo do INSTRUTOR + gradua alunos, configura regras         |
| **ADMIN**     | Tudo do PROFESSOR + configurações da academia               |
| **TI**        | Acesso total, suporte técnico multi-academia (futuro)       |

---

## Matriz de Permissões

### Auth & Onboarding

| Endpoint                     | ALUNO | INSTRUTOR+ | Público |
| ---------------------------- | ----- | ---------- | ------- |
| `POST /auth/login`           | -     | -          | ✅      |
| `POST /auth/signup`          | -     | -          | ✅      |
| `POST /auth/forgot-password` | -     | -          | ✅      |
| `GET /auth/me`               | ✅    | ✅         | -       |
| `PATCH /users/me/profile`    | ✅    | ✅         | -       |

### Home & Dashboard

| Endpoint               | ALUNO           | INSTRUTOR+      |
| ---------------------- | --------------- | --------------- |
| `GET /home`            | ✅ (mode=aluno) | ✅ (mode=staff) |
| `GET /dashboard/aluno` | ✅              | ✅              |
| `GET /dashboard/staff` | ❌              | ✅              |

### Check-in (ALUNO apenas)

| Endpoint                   | ALUNO | STAFF |
| -------------------------- | ----- | ----- |
| `GET /checkin/disponiveis` | ✅    | ❌    |
| `POST /checkin`            | ✅    | ❌    |

### Presenças & Aulas (STAFF apenas)

| Endpoint                           | ALUNO | INSTRUTOR+ |
| ---------------------------------- | ----- | ---------- |
| `GET /aulas/hoje`                  | ❌    | ✅         |
| `GET /aulas/:id/qrcode`            | ❌    | ✅         |
| `POST /aulas/:id/encerrar`         | ❌    | ✅         |
| `GET /presencas/pendencias`        | ❌    | ✅         |
| `PATCH /presencas/:id/decisao`     | ❌    | ✅         |
| `POST /aulas/:id/presencas/manual` | ❌    | ✅         |

### Turmas

| Endpoint             | ALUNO | INSTRUTOR+ |
| -------------------- | ----- | ---------- |
| `GET /turmas`        | ✅    | ✅         |
| `POST /turmas`       | ❌    | ✅         |
| `PATCH /turmas/:id`  | ❌    | ✅         |
| `DELETE /turmas/:id` | ❌    | ✅         |

### Alunos

| Endpoint                   | ALUNO           | INSTRUTOR+ |
| -------------------------- | --------------- | ---------- |
| `GET /alunos`              | ❌              | ✅         |
| `GET /alunos/:id`          | ✅ (só próprio) | ✅         |
| `GET /alunos/:id/evolucao` | ✅ (só próprio) | ✅         |

### Config & Graduações

| Endpoint                       | ALUNO | INSTRUTOR | PROFESSOR+ |
| ------------------------------ | ----- | --------- | ---------- |
| `GET /config/tipos-treino`     | ❌    | ✅        | ✅         |
| `GET /config/regras-graduacao` | ❌    | ❌        | ✅         |
| `POST /graduacoes`             | ❌    | ❌        | ✅         |

### Matrículas (Staff)

| Endpoint                          | ALUNO | INSTRUTOR+ |
| --------------------------------- | ----- | ---------- |
| `GET /staff/matriculas/pendentes` | ❌    | ✅         |
| `PATCH /staff/matriculas/:id`     | ❌    | ✅         |

---

## Multi-tenant

**Regra fundamental:** Todas as consultas são filtradas pelo `academiaId` presente no JWT.

O token carrega:

```json
{
  "sub": "uuid-usuario",
  "email": "user@example.com",
  "role": "PROFESSOR",
  "roles": ["PROFESSOR", "ALUNO"],
  "academiaId": "uuid-academia"
}
```

- `role`: papel principal (usado para decisões de permissão)
- `roles`: todos os papéis do usuário naquela academia
- `academiaId`: filtro obrigatório em todas as queries

---

## Home: mode=staff vs mode=aluno

O endpoint `GET /home` aceita query `mode`:

| Token                           | mode omitido | mode=staff | mode=aluno                 |
| ------------------------------- | ------------ | ---------- | -------------------------- |
| Staff (tem PROFESSOR/INSTRUTOR) | STAFF        | ✅         | ✅ (se tem ALUNO em roles) |
| Aluno puro                      | ALUNO        | ❌ 403     | ✅                         |

**Exemplo:**

```bash
# Staff vendo modo aluno
curl "http://localhost:3000/v1/home?mode=aluno" \
  -H "Authorization: Bearer $TOKEN_PROFESSOR"

# Aluno tentando staff (403)
curl "http://localhost:3000/v1/home?mode=staff" \
  -H "Authorization: Bearer $TOKEN_ALUNO"
```

---

## Seed: Multi-role

Nos seeds, INSTRUTOR/PROFESSOR/ADMIN/TI também têm papel ALUNO associado. Isso permite que staff teste funcionalidades de aluno sem trocar de conta.

```sql
-- Exemplo: professor tem dois papéis
usuarios_papeis (usuario_id, academia_id, papel)
  -> (prof_id, acad_id, 'PROFESSOR')
  -> (prof_id, acad_id, 'ALUNO')
```
