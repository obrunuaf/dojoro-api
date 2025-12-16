<#
.SYNOPSIS
    BJJ Academy API v1 - Contract Test Script
.DESCRIPTION
    Complete E2E test covering STAFF/ALUNO flows
.NOTES
    Requires: PowerShell 5.1+, API running on localhost:3000
.EXAMPLE
    .\Run-ContractTests.ps1
    .\Run-ContractTests.ps1 -BaseUrl "http://localhost:3000/v1"
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
Write-Host "BJJ Academy API v1 - Contract Tests" -ForegroundColor Cyan
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
$QR_TOKEN = $null
if ($AULA_ID) {
    $qr = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/qrcode" -Headers $staffHeaders
    $QR_TOKEN = $qr.Data.qrToken
    Test-Result "5. GET /aulas/:id/qrcode (STAFF)" ($QR_TOKEN -ne $null) "No qrToken"
}

# ============ CHECK-IN FLOW ============
Write-Host "`n--- CHECK-IN FLOW ---" -ForegroundColor Yellow

$PRESENCA_ID = $null
if ($AULA_ID -and $QR_TOKEN) {
    $checkin = Invoke-Api -Method POST -Endpoint "/checkin" -Headers $alunoHeaders -Body @{
        aulaId = $AULA_ID
        tipo = "QR"
        qrToken = $QR_TOKEN
    } -ExpectedStatus @(200, 201, 422)
    
    if ($checkin.Data) {
        $PRESENCA_ID = $checkin.Data.id
        Test-Result "6. POST /checkin (QR, ALUNO)" $true
    } else {
        Test-Result "6. POST /checkin (QR, ALUNO)" ($checkin.Status -eq 422) "May already exist"
    }
}

# Test 7: List pendências (STAFF)
$pendencias = Invoke-Api -Method GET -Endpoint "/presencas/pendencias" -Headers $staffHeaders
Test-Result "7. GET /presencas/pendencias (STAFF)" $pendencias.Success

if (-not $PRESENCA_ID -and $pendencias.Data.itens -and $pendencias.Data.itens.Count -gt 0) {
    $PRESENCA_ID = $pendencias.Data.itens[0].id
}

# Test 8: Decidir presença (STAFF)
if ($PRESENCA_ID) {
    $decisao = Invoke-Api -Method PATCH -Endpoint "/presencas/$PRESENCA_ID/decisao" -Headers $staffHeaders -Body @{
        decisao = "APROVAR"
        observacao = "Test approval"
    } -ExpectedStatus @(200, 409)
    Test-Result "8. PATCH /presencas/:id/decisao (STAFF)" ($decisao.Status -in @(200, 409))
}

# ============ PRESENÇAS DA AULA ============
Write-Host "`n--- PRESENÇAS DA AULA ---" -ForegroundColor Yellow

if ($AULA_ID) {
    $presencas = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas" -Headers $staffHeaders
    Test-Result "9. GET /aulas/:id/presencas (STAFF)" ($presencas.Data.resumo -ne $null)
    
    $filtered = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas?status=PRESENTE" -Headers $staffHeaders
    Test-Result "10. Filter status=PRESENTE" $filtered.Success
    
    $byName = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas?q=seed" -Headers $staffHeaders
    Test-Result "11. Filter q=seed" $byName.Success
    
    $alunoTry = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas" -Headers $alunoHeaders -ExpectedStatus @(403)
    Test-Result "12. ALUNO on /presencas -> 403" ($alunoTry.Status -eq 403)
}

# ============ PRESENÇA MANUAL ============
Write-Host "`n--- PRESENÇA MANUAL ---" -ForegroundColor Yellow

$alunos = Invoke-Api -Method GET -Endpoint "/alunos" -Headers $staffHeaders
$MANUAL_ALUNO_ID = if ($alunos.Data -and $alunos.Data.Count -gt 1) { $alunos.Data[1].id } else { $alunos.Data[0].id }

if ($AULA_ID -and $MANUAL_ALUNO_ID) {
    $manual = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $staffHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
        status = "PRESENTE"
        observacao = "Manual test"
    } -ExpectedStatus @(200, 201, 409)
    Test-Result "13. POST /presencas/manual PRESENTE" ($manual.Status -in @(200, 201, 409))
    
    $idem = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $staffHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
        status = "PRESENTE"
    } -ExpectedStatus @(200, 201)
    Test-Result "14. Idempotency (same call)" ($idem.Status -in @(200, 201))
    
    $conflict = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $staffHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
        status = "FALTA"
    } -ExpectedStatus @(409)
    Test-Result "15. Conflict PRESENTE->FALTA -> 409" ($conflict.Status -eq 409)
    
    $alunoManual = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $alunoHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
    } -ExpectedStatus @(403)
    Test-Result "16. ALUNO on /presencas/manual -> 403" ($alunoManual.Status -eq 403)
}

# ============ ENCERRAR AULA ============
Write-Host "`n--- ENCERRAR AULA ---" -ForegroundColor Yellow

$aulasAgendadas = Invoke-Api -Method GET -Endpoint "/aulas?status=AGENDADA&from=2025-01-01&to=2025-12-31" -Headers $staffHeaders
$ENCERRAR_AULA_ID = if ($aulasAgendadas.Data -and $aulasAgendadas.Data.Count -gt 1) { 
    $aulasAgendadas.Data[1].id 
} else { 
    $AULA_ID 
}

if ($ENCERRAR_AULA_ID) {
    $enc1 = Invoke-Api -Method POST -Endpoint "/aulas/$ENCERRAR_AULA_ID/encerrar" -Headers $staffHeaders
    Test-Result "17. POST /encerrar (AGENDADA->ENCERRADA)" ($enc1.Data.status -eq "ENCERRADA")
    
    $enc2 = Invoke-Api -Method POST -Endpoint "/aulas/$ENCERRAR_AULA_ID/encerrar" -Headers $staffHeaders
    Test-Result "18. Encerrar idempotency" ($enc2.Data.status -eq "ENCERRADA")
    
    Test-Result "19. QR cleared (qrToken=null)" ($enc1.Data.qrToken -eq $null)
}

# Test 20: Encerrar CANCELADA -> 409
$aulasParaCancelar = Invoke-Api -Method GET -Endpoint "/aulas?status=AGENDADA&from=2025-01-01&to=2025-12-31" -Headers $staffHeaders
if ($aulasParaCancelar.Data -and $aulasParaCancelar.Data.Count -gt 0) {
    $cancelAulaId = $aulasParaCancelar.Data[0].id
    $cancel = Invoke-Api -Method POST -Endpoint "/aulas/$cancelAulaId/cancel" -Headers $staffHeaders
    if ($cancel.Success) {
        $encCancelada = Invoke-Api -Method POST -Endpoint "/aulas/$cancelAulaId/encerrar" -Headers $staffHeaders -ExpectedStatus @(409)
        Test-Result "20. Encerrar CANCELADA -> 409" ($encCancelada.Status -eq 409)
    } else {
        Test-Result "20. Encerrar CANCELADA -> 409" $false "Could not cancel aula first"
    }
} else {
    Test-Result "20. Encerrar CANCELADA -> 409" $false "No aula to cancel"
}

# ============ NEGATIVE TESTS ============
Write-Host "`n--- NEGATIVE TESTS ---" -ForegroundColor Yellow

$alunoStaff = Invoke-Api -Method GET -Endpoint "/aulas/hoje" -Headers $alunoHeaders -ExpectedStatus @(403)
Test-Result "21. ALUNO on /aulas/hoje -> 403" ($alunoStaff.Status -eq 403)

$fromOnly = Invoke-Api -Method GET -Endpoint "/presencas/pendencias?from=2025-01-01T00:00:00Z" -Headers $staffHeaders -ExpectedStatus @(400)
Test-Result "22. from without to -> 400" ($fromOnly.Status -eq 400)

$invalidId = Invoke-Api -Method POST -Endpoint "/aulas/00000000-0000-0000-0000-000000000000/encerrar" -Headers $staffHeaders -ExpectedStatus @(404)
Test-Result "23. Invalid aula ID -> 404" ($invalidId.Status -eq 404)

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
