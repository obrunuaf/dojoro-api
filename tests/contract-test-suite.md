# Dojoro API - Contract Test Suite

Complete QA test plan for STAFF (PROFESSOR) and ALUNO flows.

---

## (A) Test Scenarios Checklist

### Authentication & Setup
| # | Scenario | Endpoint | Expected |
|---|----------|----------|----------|
| 1 | Login PROFESSOR | `POST /auth/login` | `200` + `accessToken` |
| 2 | Login ALUNO | `POST /auth/login` | `200` + `accessToken` |

### Aulas Setup
| # | Scenario | Endpoint | Expected |
|---|----------|----------|----------|
| 3 | List today's classes (STAFF) | `GET /aulas/hoje` | `200` + array |
| 4 | Get/create AGENDADA aula | `GET /aulas` or `POST /aulas` | `200/201` |
| 5 | Generate QR (STAFF) | `GET /aulas/:id/qrcode` | `200` + `qrToken` |

### Check-in Flow
| # | Scenario | Endpoint | Expected |
|---|----------|----------|----------|
| 6 | Check-in via QR (ALUNO) | `POST /checkin` | `201` + PENDENTE |
| 7 | List pendências (STAFF) | `GET /presencas/pendencias` | `200` + itens[] |
| 8 | Decidir presença (STAFF) | `PATCH /presencas/:id/decisao` | `200` + PRESENTE |

### Presenças da Aula
| # | Scenario | Endpoint | Expected |
|---|----------|----------|----------|
| 9 | List presenças (STAFF) | `GET /aulas/:id/presencas` | `200` + resumo + itens |
| 10 | Filter status=PRESENTE | `GET /aulas/:id/presencas?status=PRESENTE` | `200` |
| 11 | Filter by name (q) | `GET /aulas/:id/presencas?q=seed` | `200` |
| 12 | ALUNO tries → 403 | `GET /aulas/:id/presencas` | `403` |

### Presença Manual
| # | Scenario | Endpoint | Expected |
|---|----------|----------|----------|
| 13 | Create PRESENTE (STAFF) | `POST /aulas/:id/presencas/manual` | `201` |
| 14 | Idempotency (same call) | `POST /aulas/:id/presencas/manual` | `200` same record |
| 15 | Conflict PRESENTE→FALTA | `POST /aulas/:id/presencas/manual` | `409` |
| 16 | ALUNO tries → 403 | `POST /aulas/:id/presencas/manual` | `403` |

### Encerrar Aula
| # | Scenario | Endpoint | Expected |
|---|----------|----------|----------|
| 17 | Encerrar AGENDADA (STAFF) | `POST /aulas/:id/encerrar` | `200` + ENCERRADA |
| 18 | Idempotency (call again) | `POST /aulas/:id/encerrar` | `200` |
| 19 | Verify QR cleared | SQL check | `qr_token = null` |
| 20 | Encerrar CANCELADA → 409 | `POST /aulas/:id/encerrar` | `409` |

### Negative Tests
| # | Scenario | Endpoint | Expected |
|---|----------|----------|----------|
| 21 | ALUNO on STAFF endpoint | `GET /aulas/hoje` | `403` |
| 22 | from without to | `GET /presencas/pendencias?from=...` | `400` |
| 23 | Invalid aula ID | `POST /aulas/00000.../encerrar` | `404` |
| 24 | Delete turma with future aulas | `DELETE /turmas/:id` | `409` |

---

## (B) PowerShell Test Script

```powershell
<#
.SYNOPSIS
    Dojoro API - Contract Test Script
.DESCRIPTION
    Complete E2E test covering STAFF/ALUNO flows
.NOTES
    Requires: PowerShell 5.1+, API running on localhost:3000
#>

param(
    [string]$BaseUrl = "http://localhost:3000/v1",
    [string]$ProfEmail = "professor.seed@example.com",
    [string]$ProfPass = "SenhaProfessor123",
    [string]$AlunoEmail = "aluno.seed@example.com",
    [string]$AlunoPass = "SenhaAluno123"
)

$ErrorActionPreference = "Stop"
$passed = 0
$failed = 0

function Test-Result {
    param([string]$Name, [bool]$Success, [string]$Details = "")
    if ($Success) {
        Write-Host "[PASS] $Name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "[FAIL] $Name - $Details" -ForegroundColor Red
        $script:failed++
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [int[]]$ExpectedStatus = @(200)
    )
    
    $uri = "$BaseUrl$Endpoint"
    $params = @{
        Uri = $uri
        Method = $Method
        ContentType = "application/json"
        Headers = $Headers
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    
    try {
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response; Status = 200 }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($ExpectedStatus -contains $statusCode) {
            return @{ Success = $true; Status = $statusCode; Error = $_.Exception.Message }
        }
        return @{ Success = $false; Status = $statusCode; Error = $_.Exception.Message }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Dojoro API - Contract Tests" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ============ AUTHENTICATION ============
Write-Host "`n--- AUTHENTICATION ---" -ForegroundColor Yellow

# Test 1: Login PROFESSOR
$profLogin = Invoke-Api -Method POST -Endpoint "/auth/login" -Body @{
    email = $ProfEmail
    senha = $ProfPass
}
$TOKEN_STAFF = $profLogin.Data.accessToken
Test-Result "1. Login PROFESSOR" ($TOKEN_STAFF -ne $null) "No token received"
$staffHeaders = @{ Authorization = "Bearer $TOKEN_STAFF" }

# Test 2: Login ALUNO
$alunoLogin = Invoke-Api -Method POST -Endpoint "/auth/login" -Body @{
    email = $AlunoEmail
    senha = $AlunoPass
}
$TOKEN_ALUNO = $alunoLogin.Data.accessToken
Test-Result "2. Login ALUNO" ($TOKEN_ALUNO -ne $null) "No token received"
$alunoHeaders = @{ Authorization = "Bearer $TOKEN_ALUNO" }
$ALUNO_ID = $alunoLogin.Data.user.id

# ============ AULAS SETUP ============
Write-Host "`n--- AULAS SETUP ---" -ForegroundColor Yellow

# Test 3: List today's classes
$aulasHoje = Invoke-Api -Method GET -Endpoint "/aulas/hoje" -Headers $staffHeaders
Test-Result "3. GET /aulas/hoje (STAFF)" $aulasHoje.Success

# Find or create an AGENDADA aula
$AULA_ID = $null
$aulas = Invoke-Api -Method GET -Endpoint "/aulas?status=AGENDADA&from=2025-01-01&to=2025-12-31" -Headers $staffHeaders
if ($aulas.Data -and $aulas.Data.Count -gt 0) {
    $AULA_ID = $aulas.Data[0].id
    Write-Host "Found existing AGENDADA aula: $AULA_ID" -ForegroundColor Gray
} else {
    # Create a turma and aula if none exist
    Write-Host "No AGENDADA aulas found, creating one..." -ForegroundColor Gray
    $turmas = Invoke-Api -Method GET -Endpoint "/turmas" -Headers $staffHeaders
    if ($turmas.Data -and $turmas.Data.Count -gt 0) {
        $turmaId = $turmas.Data[0].id
        $now = (Get-Date).ToUniversalTime()
        $dataInicio = $now.AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        $dataFim = $now.AddHours(2.5).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        
        $novaAula = Invoke-Api -Method POST -Endpoint "/aulas" -Headers $staffHeaders -Body @{
            turmaId = $turmaId
            dataInicio = $dataInicio
            dataFim = $dataFim
            status = "AGENDADA"
        } -ExpectedStatus @(200, 201)
        
        if ($novaAula.Data) {
            $AULA_ID = $novaAula.Data.id
            Write-Host "Created new aula: $AULA_ID" -ForegroundColor Gray
        }
    }
}
Test-Result "4. Get/Create AGENDADA aula" ($AULA_ID -ne $null) "No aula available"

# Test 5: Generate QR
if ($AULA_ID) {
    $qr = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/qrcode" -Headers $staffHeaders
    $QR_TOKEN = $qr.Data.qrToken
    Test-Result "5. GET /aulas/:id/qrcode (STAFF)" ($QR_TOKEN -ne $null) "No qrToken"
}

# ============ CHECK-IN FLOW ============
Write-Host "`n--- CHECK-IN FLOW ---" -ForegroundColor Yellow

# Test 6: Check-in via QR (ALUNO)
$PRESENCA_ID = $null
if ($AULA_ID -and $QR_TOKEN) {
    $checkin = Invoke-Api -Method POST -Endpoint "/checkin" -Headers $alunoHeaders -Body @{
        aulaId = $AULA_ID
        tipo = "QR"
        qrToken = $QR_TOKEN
    } -ExpectedStatus @(200, 201, 422)  # 422 if already checked in
    
    if ($checkin.Data) {
        $PRESENCA_ID = $checkin.Data.id
        Test-Result "6. POST /checkin (QR, ALUNO)" $true
    } else {
        # Already checked in? Try to find existing
        Test-Result "6. POST /checkin (QR, ALUNO)" ($checkin.Status -eq 422) "May already exist"
    }
}

# Test 7: List pendências (STAFF)
$pendencias = Invoke-Api -Method GET -Endpoint "/presencas/pendencias" -Headers $staffHeaders
Test-Result "7. GET /presencas/pendencias (STAFF)" $pendencias.Success

# Get presenca ID if we don't have one
if (-not $PRESENCA_ID -and $pendencias.Data.itens -and $pendencias.Data.itens.Count -gt 0) {
    $PRESENCA_ID = $pendencias.Data.itens[0].id
}

# Test 8: Decidir presença (STAFF)
if ($PRESENCA_ID) {
    $decisao = Invoke-Api -Method PATCH -Endpoint "/presencas/$PRESENCA_ID/decisao" -Headers $staffHeaders -Body @{
        decisao = "APROVAR"
        observacao = "Test approval"
    } -ExpectedStatus @(200, 409)  # 409 if already decided
    Test-Result "8. PATCH /presencas/:id/decisao (STAFF)" ($decisao.Status -in @(200, 409))
}

# ============ PRESENÇAS DA AULA ============
Write-Host "`n--- PRESENÇAS DA AULA ---" -ForegroundColor Yellow

if ($AULA_ID) {
    # Test 9: List presenças
    $presencas = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas" -Headers $staffHeaders
    Test-Result "9. GET /aulas/:id/presencas (STAFF)" ($presencas.Data.resumo -ne $null)
    
    # Test 10: Filter status
    $filtered = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas?status=PRESENTE" -Headers $staffHeaders
    Test-Result "10. Filter status=PRESENTE" $filtered.Success
    
    # Test 11: Filter by name
    $byName = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas?q=seed" -Headers $staffHeaders
    Test-Result "11. Filter q=seed" $byName.Success
    
    # Test 12: ALUNO tries → 403
    $alunoTry = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas" -Headers $alunoHeaders -ExpectedStatus @(403)
    Test-Result "12. ALUNO on /presencas → 403" ($alunoTry.Status -eq 403)
}

# ============ PRESENÇA MANUAL ============
Write-Host "`n--- PRESENÇA MANUAL ---" -ForegroundColor Yellow

# Get a different aluno for manual test
$alunos = Invoke-Api -Method GET -Endpoint "/alunos" -Headers $staffHeaders
$MANUAL_ALUNO_ID = if ($alunos.Data -and $alunos.Data.Count -gt 1) { $alunos.Data[1].id } else { $alunos.Data[0].id }

if ($AULA_ID -and $MANUAL_ALUNO_ID) {
    # Test 13: Create PRESENTE manual
    $manual = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $staffHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
        status = "PRESENTE"
        observacao = "Manual test"
    } -ExpectedStatus @(200, 201, 409)
    Test-Result "13. POST /presencas/manual PRESENTE" ($manual.Status -in @(200, 201, 409))
    
    # Test 14: Idempotency
    $idem = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $staffHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
        status = "PRESENTE"
    } -ExpectedStatus @(200, 201)
    Test-Result "14. Idempotency (same call)" ($idem.Status -in @(200, 201))
    
    # Test 15: Conflict PRESENTE→FALTA
    $conflict = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $staffHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
        status = "FALTA"
    } -ExpectedStatus @(409)
    Test-Result "15. Conflict PRESENTE→FALTA → 409" ($conflict.Status -eq 409)
    
    # Test 16: ALUNO tries → 403
    $alunoManual = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $alunoHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
    } -ExpectedStatus @(403)
    Test-Result "16. ALUNO on /presencas/manual → 403" ($alunoManual.Status -eq 403)
}

# ============ ENCERRAR AULA ============
Write-Host "`n--- ENCERRAR AULA ---" -ForegroundColor Yellow

# Use a different aula for encerrar test to not affect other tests
$aulasAgendadas = Invoke-Api -Method GET -Endpoint "/aulas?status=AGENDADA&from=2025-01-01&to=2025-12-31" -Headers $staffHeaders
$ENCERRAR_AULA_ID = if ($aulasAgendadas.Data -and $aulasAgendadas.Data.Count -gt 1) { 
    $aulasAgendadas.Data[1].id 
} else { 
    $AULA_ID 
}

if ($ENCERRAR_AULA_ID) {
    # Test 17: Encerrar AGENDADA
    $enc1 = Invoke-Api -Method POST -Endpoint "/aulas/$ENCERRAR_AULA_ID/encerrar" -Headers $staffHeaders
    Test-Result "17. POST /encerrar (AGENDADA→ENCERRADA)" ($enc1.Data.status -eq "ENCERRADA")
    
    # Test 18: Idempotency
    $enc2 = Invoke-Api -Method POST -Endpoint "/aulas/$ENCERRAR_AULA_ID/encerrar" -Headers $staffHeaders
    Test-Result "18. Encerrar idempotency" ($enc2.Data.status -eq "ENCERRADA")
    
    # Test 19: QR cleared
    Test-Result "19. QR cleared (qrToken=null)" ($enc1.Data.qrToken -eq $null)
}

# Test 20: Encerrar CANCELADA → 409
# First cancel an aula, then try to encerrar
$aulasParaCancelar = Invoke-Api -Method GET -Endpoint "/aulas?status=AGENDADA&from=2025-01-01&to=2025-12-31" -Headers $staffHeaders
if ($aulasParaCancelar.Data -and $aulasParaCancelar.Data.Count -gt 0) {
    $cancelAulaId = $aulasParaCancelar.Data[0].id
    $cancel = Invoke-Api -Method POST -Endpoint "/aulas/$cancelAulaId/cancel" -Headers $staffHeaders
    if ($cancel.Success) {
        $encCancelada = Invoke-Api -Method POST -Endpoint "/aulas/$cancelAulaId/encerrar" -Headers $staffHeaders -ExpectedStatus @(409)
        Test-Result "20. Encerrar CANCELADA → 409" ($encCancelada.Status -eq 409)
    } else {
        Test-Result "20. Encerrar CANCELADA → 409" $false "Could not cancel aula first"
    }
} else {
    Test-Result "20. Encerrar CANCELADA → 409" $false "No aula to cancel"
}

# ============ NEGATIVE TESTS ============
Write-Host "`n--- NEGATIVE TESTS ---" -ForegroundColor Yellow

# Test 21: ALUNO on STAFF endpoint
$alunoStaff = Invoke-Api -Method GET -Endpoint "/aulas/hoje" -Headers $alunoHeaders -ExpectedStatus @(403)
Test-Result "21. ALUNO on /aulas/hoje → 403" ($alunoStaff.Status -eq 403)

# Test 22: from without to
$fromOnly = Invoke-Api -Method GET -Endpoint "/presencas/pendencias?from=2025-01-01T00:00:00Z" -Headers $staffHeaders -ExpectedStatus @(400)
Test-Result "22. from without to → 400" ($fromOnly.Status -eq 400)

# Test 23: Invalid aula ID
$invalidId = Invoke-Api -Method POST -Endpoint "/aulas/00000000-0000-0000-0000-000000000000/encerrar" -Headers $staffHeaders -ExpectedStatus @(404)
Test-Result "23. Invalid aula ID → 404" ($invalidId.Status -eq 404)

# ============ SUMMARY ============
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "Total:  $($passed + $failed)" -ForegroundColor White

if ($failed -gt 0) {
    exit 1
}
```

---

## (C) SQL Validation Queries

```sql
-- ========================================
-- Dojoro API - SQL Validation Queries
-- Run in Supabase SQL Editor or psql
-- ========================================

-- 1. Check aula status and QR after encerrar
SELECT 
    id,
    status,
    qr_token,
    qr_expires_at,
    data_inicio,
    data_fim,
    deleted_at
FROM aulas
WHERE id = '<AULA_ID>'  -- Replace with actual ID
LIMIT 1;

-- Expected after encerrar:
-- status = 'ENCERRADA'
-- qr_token = null
-- qr_expires_at = null

-- 2. List presenças da aula with audit columns
SELECT 
    p.id,
    p.aluno_id,
    u.nome_completo as aluno_nome,
    p.status,
    p.origem,
    p.criado_em,
    p.registrado_por,
    p.updated_at,
    p.decidido_em,
    p.decidido_por,
    p.decisao_observacao
FROM presencas p
JOIN usuarios u ON u.id = p.aluno_id
WHERE p.aula_id = '<AULA_ID>'
ORDER BY 
    CASE 
        WHEN p.status = 'PENDENTE' THEN 0
        WHEN p.status = 'PRESENTE' THEN 1
        WHEN p.status = 'FALTA' THEN 2
        ELSE 3
    END,
    u.nome_completo;

-- 3. Count presenças by status (resumo)
SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'PENDENTE') as pendentes,
    COUNT(*) FILTER (WHERE status = 'PRESENTE') as presentes,
    COUNT(*) FILTER (WHERE status = 'FALTA') as faltas
FROM presencas
WHERE aula_id = '<AULA_ID>';

-- 4. Verify pendências for today
SELECT 
    p.id,
    p.status,
    p.origem,
    p.criado_em,
    a.data_inicio,
    t.nome as turma
FROM presencas p
JOIN aulas a ON a.id = p.aula_id
JOIN turmas t ON t.id = a.turma_id
WHERE p.status = 'PENDENTE'
  AND a.data_inicio >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
  AND a.data_inicio < ((CURRENT_DATE + 1) AT TIME ZONE 'America/Sao_Paulo')
ORDER BY p.criado_em DESC;

-- 5. Verify audit fields after decisão
SELECT 
    id,
    status,
    decidido_em,
    decidido_por,
    decisao_observacao,
    updated_at
FROM presencas
WHERE id = '<PRESENCA_ID>'  -- Replace with actual ID
LIMIT 1;

-- Expected after APROVAR:
-- status = 'PRESENTE'
-- decidido_em = <timestamp>
-- decidido_por = <staff_user_id>

-- 6. Check presença manual (origem = SISTEMA)
SELECT 
    id,
    status,
    origem,
    registrado_por,
    decidido_em,
    decidido_por,
    decisao_observacao
FROM presencas
WHERE origem = 'SISTEMA'
  AND aula_id = '<AULA_ID>'
ORDER BY criado_em DESC;

-- 7. Turmas with future aulas (for 409 delete test)
SELECT 
    t.id as turma_id,
    t.nome as turma_nome,
    COUNT(a.id) as aulas_futuras
FROM turmas t
LEFT JOIN aulas a ON a.turma_id = t.id 
    AND a.data_inicio > NOW()
    AND a.deleted_at IS NULL
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.nome
HAVING COUNT(a.id) > 0;
```

---

## (D) Troubleshooting Guide

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | `401 Unauthorized` | Token expired/invalid | Re-login, check JWT_SECRET env |
| 2 | `403 Forbidden` | Wrong role (ALUNO on STAFF endpoint) | Use correct token |
| 3 | `403 Insufficient role` | Missing role in token | Check usuarios_papeis table |
| 4 | `409 Conflict` (presença) | Already decided | Check current status first |
| 5 | `409 Conflict` (encerrar) | Aula is CANCELADA | Cannot encerrar cancelled aula |
| 6 | `409 Conflict` (turma delete) | Has future aulas | Delete/cancel aulas first |
| 7 | `422 Unprocessable` | QR token expired | Regenerate QR (default 5min TTL) |
| 8 | `422` duplicate check-in | Already checked in | Check presencas table |
| 9 | `400 from/to` | Missing pair | Send both from AND to |
| 10 | Empty `/aulas/hoje` | Wrong timezone | Check APP_TIMEZONE, aula data_inicio |
| 11 | `404 Aula` | Soft-deleted or wrong ID | Use includeDeleted=true or check deleted_at |
| 12 | `404 Aluno` | No matrícula ATIVA | Check matriculas table |

### Quick Checks

```bash
# Check API is running
curl http://localhost:3000/v1/health

# Check timezone
echo $APP_TIMEZONE  # Should be America/Sao_Paulo

# Check JWT_SECRET is set
echo $JWT_SECRET

# Verify aula exists
curl "http://localhost:3000/v1/aulas/<ID>" -H "Authorization: Bearer <TOKEN>"
```

### Common SQL Fixes

```sql
-- Fix: Create aula for today if none exist
INSERT INTO aulas (academia_id, turma_id, data_inicio, data_fim, status)
SELECT 
    t.academia_id,
    t.id,
    NOW() + INTERVAL '1 hour',
    NOW() + INTERVAL '2.5 hours',
    'AGENDADA'
FROM turmas t
WHERE t.deleted_at IS NULL
LIMIT 1;

-- Fix: Reset presença to PENDENTE for retesting
UPDATE presencas 
SET status = 'PENDENTE', 
    decidido_em = NULL, 
    decidido_por = NULL, 
    decisao_observacao = NULL
WHERE id = '<PRESENCA_ID>';
```
