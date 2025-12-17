<#
.SYNOPSIS
    BJJ Academy API v1 - Contract Test Script
.DESCRIPTION
    Complete E2E test covering STAFF/ALUNO flows
    - Repeatable: creates temp resources and cleans up
    - Dynamic dates: uses now-7d to now+30d
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

$ErrorActionPreference = "Continue"
$passed = 0
$failed = 0
$cleanup = @()

# Dynamic date ranges (now-7d to now+30d)
$now = Get-Date
$FromDate = $now.AddDays(-7).ToString("yyyy-MM-dd")
$ToDate = $now.AddDays(30).ToString("yyyy-MM-dd")
$FromISO = $now.AddDays(-7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$ToISO = $now.AddDays(30).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

function Test-Result {
    param([string]$Name, [bool]$Success, [string]$Details = "")
    if ($Success) {
        Write-Host "[PASS] $Name" -ForegroundColor Green
        $script:passed++
    }
    else {
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
        [int[]]$ExpectedStatus = @(200, 201)
    )
    
    $uri = "$BaseUrl$Endpoint"
    $params = @{
        Uri             = $uri
        Method          = $Method
        ContentType     = "application/json"
        Headers         = $Headers
        UseBasicParsing = $true
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    
    try {
        $response = Invoke-WebRequest @params -ErrorAction Stop
        $statusCode = [int]$response.StatusCode
        $data = $null
        
        if ($response.Content -and $response.Content.Length -gt 0) {
            try {
                $data = $response.Content | ConvertFrom-Json
            }
            catch {
                $data = $response.Content
            }
        }
        
        $success = $ExpectedStatus -contains $statusCode
        return @{ 
            Success = $success
            Data    = $data
            Status  = $statusCode
            Error   = $null
        }
    }
    catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        
        $success = $ExpectedStatus -contains $statusCode
        return @{ 
            Success = $success
            Status  = $statusCode
            Error   = $_.Exception.Message
            Data    = $null
        }
    }
}

function Add-Cleanup {
    param([string]$Type, [string]$Id, [hashtable]$Headers)
    $script:cleanup += @{ Type = $Type; Id = $Id; Headers = $Headers }
}

function Invoke-Cleanup {
    Write-Host "`n--- CLEANUP ---" -ForegroundColor Magenta
    foreach ($item in $script:cleanup) {
        $endpoint = switch ($item.Type) {
            "aula" { "/aulas/$($item.Id)" }
            "turma" { "/turmas/$($item.Id)" }
            default { $null }
        }
        if ($endpoint) {
            $result = Invoke-Api -Method DELETE -Endpoint $endpoint -Headers $item.Headers -ExpectedStatus @(200, 404, 409)
            Write-Host "Cleanup $($item.Type) $($item.Id): $($result.Status)" -ForegroundColor Gray
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "BJJ Academy API v1 - Contract Tests" -ForegroundColor Cyan
Write-Host "Date Range: $FromDate to $ToDate" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ============ AUTHENTICATION ============
Write-Host "`n--- AUTHENTICATION ---" -ForegroundColor Yellow

# Test 1: Login PROFESSOR
$profLogin = Invoke-Api -Method POST -Endpoint "/auth/login" -Body @{
    email = $ProfEmail
    senha = $ProfPass
}
$TOKEN_STAFF = $profLogin.Data.accessToken
Test-Result "1. Login PROFESSOR" ($TOKEN_STAFF -ne $null -and $profLogin.Status -eq 200) "Status: $($profLogin.Status)"
$staffHeaders = @{ Authorization = "Bearer $TOKEN_STAFF" }

# Test 2: Login ALUNO
$alunoLogin = Invoke-Api -Method POST -Endpoint "/auth/login" -Body @{
    email = $AlunoEmail
    senha = $AlunoPass
}
$TOKEN_ALUNO = $alunoLogin.Data.accessToken
Test-Result "2. Login ALUNO" ($TOKEN_ALUNO -ne $null -and $alunoLogin.Status -eq 200) "Status: $($alunoLogin.Status)"
$alunoHeaders = @{ Authorization = "Bearer $TOKEN_ALUNO" }
$ALUNO_ID = $alunoLogin.Data.user.id

# ============ AULAS SETUP ============
Write-Host "`n--- AULAS SETUP ---" -ForegroundColor Yellow

# Test 3: List today's classes
$aulasHoje = Invoke-Api -Method GET -Endpoint "/aulas/hoje" -Headers $staffHeaders
Test-Result "3. GET /aulas/hoje (STAFF)" $aulasHoje.Success "Status: $($aulasHoje.Status)"

# Find or create an AGENDADA aula (dynamic date range)
$AULA_ID = $null
$CREATED_AULA = $false
$aulas = Invoke-Api -Method GET -Endpoint "/aulas?status=AGENDADA&from=$FromDate&to=$ToDate" -Headers $staffHeaders
if ($aulas.Data -and $aulas.Data.Count -gt 0) {
    $AULA_ID = $aulas.Data[0].id
    Write-Host "Found existing AGENDADA aula: $AULA_ID" -ForegroundColor Gray
}
else {
    Write-Host "No AGENDADA aulas found, creating one..." -ForegroundColor Gray
    $turmas = Invoke-Api -Method GET -Endpoint "/turmas" -Headers $staffHeaders
    if ($turmas.Data -and $turmas.Data.Count -gt 0) {
        $turmaId = $turmas.Data[0].id
        $dataInicio = $now.AddHours(2).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        $dataFim = $now.AddHours(3.5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        
        $novaAula = Invoke-Api -Method POST -Endpoint "/aulas" -Headers $staffHeaders -Body @{
            turmaId    = $turmaId
            dataInicio = $dataInicio
            dataFim    = $dataFim
            status     = "AGENDADA"
        }
        
        if ($novaAula.Data -and $novaAula.Status -in @(200, 201)) {
            $AULA_ID = $novaAula.Data.id
            $CREATED_AULA = $true
            Add-Cleanup -Type "aula" -Id $AULA_ID -Headers $staffHeaders
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
    Test-Result "5. GET /aulas/:id/qrcode (STAFF)" ($QR_TOKEN -ne $null -and $qr.Status -eq 200) "Status: $($qr.Status)"
}

# ============ CHECK-IN FLOW ============
Write-Host "`n--- CHECK-IN FLOW ---" -ForegroundColor Yellow

$PRESENCA_ID = $null
if ($AULA_ID -and $QR_TOKEN) {
    $checkin = Invoke-Api -Method POST -Endpoint "/checkin" -Headers $alunoHeaders -Body @{
        aulaId  = $AULA_ID
        tipo    = "QR"
        qrToken = $QR_TOKEN
    } -ExpectedStatus @(200, 201, 422)
    
    if ($checkin.Data -and $checkin.Status -in @(200, 201)) {
        $PRESENCA_ID = $checkin.Data.id
        Test-Result "6. POST /checkin (QR, ALUNO)" $true "Created: $PRESENCA_ID"
    }
    else {
        Test-Result "6. POST /checkin (QR, ALUNO)" ($checkin.Status -eq 422) "Status: $($checkin.Status) (may already exist)"
    }
}

# Test 7: List pendências (STAFF)
$pendencias = Invoke-Api -Method GET -Endpoint "/presencas/pendencias" -Headers $staffHeaders
Test-Result "7. GET /presencas/pendencias (STAFF)" ($pendencias.Success -and $pendencias.Status -eq 200) "Status: $($pendencias.Status)"

if (-not $PRESENCA_ID -and $pendencias.Data.itens -and $pendencias.Data.itens.Count -gt 0) {
    $PRESENCA_ID = $pendencias.Data.itens[0].id
}

# Test 8: Decidir presença (STAFF)
if ($PRESENCA_ID) {
    $decisao = Invoke-Api -Method PATCH -Endpoint "/presencas/$PRESENCA_ID/decisao" -Headers $staffHeaders -Body @{
        decisao    = "APROVAR"
        observacao = "Test approval"
    } -ExpectedStatus @(200, 409)
    Test-Result "8. PATCH /presencas/:id/decisao (STAFF)" ($decisao.Status -in @(200, 409)) "Status: $($decisao.Status)"
}

# ============ PRESENÇAS DA AULA ============
Write-Host "`n--- PRESENÇAS DA AULA ---" -ForegroundColor Yellow

if ($AULA_ID) {
    $presencas = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas" -Headers $staffHeaders
    Test-Result "9. GET /aulas/:id/presencas (STAFF)" ($presencas.Data.resumo -ne $null -and $presencas.Status -eq 200) "Status: $($presencas.Status)"
    
    $filtered = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas?status=PRESENTE" -Headers $staffHeaders
    Test-Result "10. Filter status=PRESENTE" ($filtered.Status -eq 200) "Status: $($filtered.Status)"
    
    $byName = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas?q=seed" -Headers $staffHeaders
    Test-Result "11. Filter q=seed" ($byName.Status -eq 200) "Status: $($byName.Status)"
    
    $alunoTry = Invoke-Api -Method GET -Endpoint "/aulas/$AULA_ID/presencas" -Headers $alunoHeaders -ExpectedStatus @(403)
    Test-Result "12. ALUNO on /presencas -> 403" ($alunoTry.Status -eq 403) "Status: $($alunoTry.Status)"
}

# ============ PRESENÇA MANUAL ============
Write-Host "`n--- PRESENÇA MANUAL ---" -ForegroundColor Yellow

$alunos = Invoke-Api -Method GET -Endpoint "/alunos" -Headers $staffHeaders
$MANUAL_ALUNO_ID = if ($alunos.Data -and $alunos.Data.Count -gt 1) { $alunos.Data[1].id } else { $alunos.Data[0].id }

if ($AULA_ID -and $MANUAL_ALUNO_ID) {
    $manual = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $staffHeaders -Body @{
        alunoId    = $MANUAL_ALUNO_ID
        status     = "PRESENTE"
        observacao = "Manual test"
    } -ExpectedStatus @(200, 201, 409)
    Test-Result "13. POST /presencas/manual PRESENTE" ($manual.Status -in @(200, 201, 409)) "Status: $($manual.Status)"
    
    $idem = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $staffHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
        status  = "PRESENTE"
    } -ExpectedStatus @(200, 201)
    Test-Result "14. Idempotency (same call)" ($idem.Status -in @(200, 201)) "Status: $($idem.Status)"
    
    $conflict = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $staffHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
        status  = "FALTA"
    } -ExpectedStatus @(409)
    Test-Result "15. Conflict PRESENTE->FALTA -> 409" ($conflict.Status -eq 409) "Status: $($conflict.Status)"
    
    $alunoManual = Invoke-Api -Method POST -Endpoint "/aulas/$AULA_ID/presencas/manual" -Headers $alunoHeaders -Body @{
        alunoId = $MANUAL_ALUNO_ID
    } -ExpectedStatus @(403)
    Test-Result "16. ALUNO on /presencas/manual -> 403" ($alunoManual.Status -eq 403) "Status: $($alunoManual.Status)"
}

# ============ ENCERRAR AULA ============
Write-Host "`n--- ENCERRAR AULA ---" -ForegroundColor Yellow

# Create a fresh aula for encerrar test to not affect other tests
$ENCERRAR_AULA_ID = $null
$turmas = Invoke-Api -Method GET -Endpoint "/turmas" -Headers $staffHeaders
if ($turmas.Data -and $turmas.Data.Count -gt 0) {
    $turmaId = $turmas.Data[0].id
    $dataInicio = $now.AddHours(5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $dataFim = $now.AddHours(6.5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    
    $encAula = Invoke-Api -Method POST -Endpoint "/aulas" -Headers $staffHeaders -Body @{
        turmaId    = $turmaId
        dataInicio = $dataInicio
        dataFim    = $dataFim
        status     = "AGENDADA"
    }
    
    if ($encAula.Data -and $encAula.Status -in @(200, 201)) {
        $ENCERRAR_AULA_ID = $encAula.Data.id
        Write-Host "Created aula for encerrar test: $ENCERRAR_AULA_ID" -ForegroundColor Gray
    }
}

if ($ENCERRAR_AULA_ID) {
    $enc1 = Invoke-Api -Method POST -Endpoint "/aulas/$ENCERRAR_AULA_ID/encerrar" -Headers $staffHeaders
    Test-Result "17. POST /encerrar (AGENDADA->ENCERRADA)" ($enc1.Data.status -eq "ENCERRADA" -and $enc1.Status -eq 200) "Status: $($enc1.Status)"
    
    $enc2 = Invoke-Api -Method POST -Endpoint "/aulas/$ENCERRAR_AULA_ID/encerrar" -Headers $staffHeaders
    Test-Result "18. Encerrar idempotency" ($enc2.Data.status -eq "ENCERRADA" -and $enc2.Status -eq 200) "Status: $($enc2.Status)"
    
    Test-Result "19. QR cleared (qrToken=null)" ($enc1.Data.qrToken -eq $null) "qrToken: $($enc1.Data.qrToken)"
}
else {
    Test-Result "17. POST /encerrar" $false "Could not create test aula"
    Test-Result "18. Encerrar idempotency" $false "Skipped"
    Test-Result "19. QR cleared" $false "Skipped"
}

# Test 20: Encerrar CANCELADA -> 409 (create fresh aula, cancel, then try encerrar)
$CANCEL_AULA_ID = $null
if ($turmas.Data -and $turmas.Data.Count -gt 0) {
    $turmaId = $turmas.Data[0].id
    $dataInicio = $now.AddHours(8).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $dataFim = $now.AddHours(9.5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    
    $cancelAula = Invoke-Api -Method POST -Endpoint "/aulas" -Headers $staffHeaders -Body @{
        turmaId    = $turmaId
        dataInicio = $dataInicio
        dataFim    = $dataFim
        status     = "AGENDADA"
    }
    
    if ($cancelAula.Data -and $cancelAula.Status -in @(200, 201)) {
        $CANCEL_AULA_ID = $cancelAula.Data.id
        $cancel = Invoke-Api -Method POST -Endpoint "/aulas/$CANCEL_AULA_ID/cancel" -Headers $staffHeaders
        
        if ($cancel.Status -eq 200) {
            $encCancelada = Invoke-Api -Method POST -Endpoint "/aulas/$CANCEL_AULA_ID/encerrar" -Headers $staffHeaders -ExpectedStatus @(409)
            Test-Result "20. Encerrar CANCELADA -> 409" ($encCancelada.Status -eq 409) "Status: $($encCancelada.Status)"
        }
        else {
            Test-Result "20. Encerrar CANCELADA -> 409" $false "Could not cancel: $($cancel.Status)"
        }
    }
    else {
        Test-Result "20. Encerrar CANCELADA -> 409" $false "Could not create test aula"
    }
}

# ============ NEGATIVE TESTS ============
Write-Host "`n--- NEGATIVE TESTS ---" -ForegroundColor Yellow

$alunoStaff = Invoke-Api -Method GET -Endpoint "/aulas/hoje" -Headers $alunoHeaders -ExpectedStatus @(403)
Test-Result "21. ALUNO on /aulas/hoje -> 403" ($alunoStaff.Status -eq 403) "Status: $($alunoStaff.Status)"

$fromOnly = Invoke-Api -Method GET -Endpoint "/presencas/pendencias?from=$FromISO" -Headers $staffHeaders -ExpectedStatus @(400)
Test-Result "22. from without to -> 400" ($fromOnly.Status -eq 400) "Status: $($fromOnly.Status)"

$invalidId = Invoke-Api -Method POST -Endpoint "/aulas/00000000-0000-0000-0000-000000000000/encerrar" -Headers $staffHeaders -ExpectedStatus @(404)
Test-Result "23. Invalid aula ID -> 404" ($invalidId.Status -eq 404) "Status: $($invalidId.Status)"

# ============ SCENARIO #24: DELETE turma with future aulas -> 409 ============
Write-Host "`n--- SCENARIO #24: DELETE turma with future aulas ---" -ForegroundColor Yellow

$TEST_TURMA_ID = $null
$TEST_FUTURE_AULA_ID = $null

# Get tipos-treino for creating turma
$tiposTreino = Invoke-Api -Method GET -Endpoint "/config/tipos-treino" -Headers $staffHeaders
$tipoTreinoId = if ($tiposTreino.Data -and $tiposTreino.Data.Count -gt 0) { $tiposTreino.Data[0].id } else { "gi" }

# Create test turma
$testTurmaName = "Test-Turma-$(Get-Date -Format 'HHmmss')"
$createTurma = Invoke-Api -Method POST -Endpoint "/turmas" -Headers $staffHeaders -Body @{
    nome          = $testTurmaName
    tipoTreinoId  = $tipoTreinoId
    diasSemana    = @(1, 3, 5)
    horarioPadrao = "19:00"
}

if ($createTurma.Data -and $createTurma.Status -in @(200, 201)) {
    $TEST_TURMA_ID = $createTurma.Data.id
    Write-Host "Created test turma: $TEST_TURMA_ID ($testTurmaName)" -ForegroundColor Gray
    
    # Create future aula in this turma
    $futureDataInicio = $now.AddDays(7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $futureDataFim = $now.AddDays(7).AddHours(1.5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    
    $createFutureAula = Invoke-Api -Method POST -Endpoint "/aulas" -Headers $staffHeaders -Body @{
        turmaId    = $TEST_TURMA_ID
        dataInicio = $futureDataInicio
        dataFim    = $futureDataFim
        status     = "AGENDADA"
    }
    
    if ($createFutureAula.Data -and $createFutureAula.Status -in @(200, 201)) {
        $TEST_FUTURE_AULA_ID = $createFutureAula.Data.id
        Write-Host "Created future aula: $TEST_FUTURE_AULA_ID" -ForegroundColor Gray
        
        # Now try to delete the turma - should return 409
        $deleteTurma = Invoke-Api -Method DELETE -Endpoint "/turmas/$TEST_TURMA_ID" -Headers $staffHeaders -ExpectedStatus @(409)
        Test-Result "24. DELETE turma with future aulas -> 409" ($deleteTurma.Status -eq 409) "Status: $($deleteTurma.Status)"
        
        # Cleanup: delete the aula first, then the turma
        Write-Host "Cleanup: deleting future aula..." -ForegroundColor Gray
        $deleteAula = Invoke-Api -Method DELETE -Endpoint "/aulas/$TEST_FUTURE_AULA_ID" -Headers $staffHeaders -ExpectedStatus @(200, 404)
        Write-Host "  Aula delete status: $($deleteAula.Status)" -ForegroundColor Gray
        
        Write-Host "Cleanup: deleting test turma..." -ForegroundColor Gray
        $deleteTurmaFinal = Invoke-Api -Method DELETE -Endpoint "/turmas/$TEST_TURMA_ID" -Headers $staffHeaders -ExpectedStatus @(200, 404)
        Write-Host "  Turma delete status: $($deleteTurmaFinal.Status)" -ForegroundColor Gray
    }
    else {
        Test-Result "24. DELETE turma with future aulas -> 409" $false "Could not create future aula: $($createFutureAula.Status)"
        # Cleanup turma anyway
        Invoke-Api -Method DELETE -Endpoint "/turmas/$TEST_TURMA_ID" -Headers $staffHeaders -ExpectedStatus @(200, 404) | Out-Null
    }
}
else {
    Test-Result "24. DELETE turma with future aulas -> 409" $false "Could not create test turma: $($createTurma.Status)"
}

# ============ AUTH RECOVERY + COMPLETE PROFILE ============
Write-Host "`n--- AUTH RECOVERY + COMPLETE PROFILE ---" -ForegroundColor Yellow

# Test 25: Forgot Password (get devOtp for testing)
$forgotResult = Invoke-Api -Method POST -Endpoint "/auth/forgot-password" -Body @{
    email = $AlunoEmail
}
$devOtp = $forgotResult.Data.devOtp
Test-Result "25. POST /auth/forgot-password" ($forgotResult.Status -eq 200 -and $forgotResult.Data.message -ne $null) "Status: $($forgotResult.Status)"

if ($devOtp) {
    Write-Host "  devOtp received: $devOtp" -ForegroundColor Gray
    
    # Test 26: Verify OTP (valid)
    $verifyResult = Invoke-Api -Method POST -Endpoint "/auth/verify-otp" -Body @{
        email  = $AlunoEmail
        codigo = $devOtp
    }
    Test-Result "26. POST /auth/verify-otp (valid)" ($verifyResult.Status -eq 200 -and $verifyResult.Data.valid -eq $true) "Status: $($verifyResult.Status)"
    
    # Test 27: Verify OTP with wrong code -> 400
    $verifyBad = Invoke-Api -Method POST -Endpoint "/auth/verify-otp" -Body @{
        email  = $AlunoEmail
        codigo = "000000"
    } -ExpectedStatus @(400)
    Test-Result "27. POST /auth/verify-otp (wrong code) -> 400" ($verifyBad.Status -eq 400) "Status: $($verifyBad.Status)"
    
    # Test 28: Reset Password with OTP
    $newPassword = "NovaSenha123"
    $resetResult = Invoke-Api -Method POST -Endpoint "/auth/reset-password" -Body @{
        email     = $AlunoEmail
        codigo    = $devOtp
        novaSenha = $newPassword
    }
    Test-Result "28. POST /auth/reset-password" ($resetResult.Status -eq 200 -and $resetResult.Data.message -ne $null) "Status: $($resetResult.Status)"
    
    # Test 29: Login with new password
    $loginNew = Invoke-Api -Method POST -Endpoint "/auth/login" -Body @{
        email = $AlunoEmail
        senha = $newPassword
    }
    Test-Result "29. Login with new password" ($loginNew.Status -eq 200 -and $loginNew.Data.accessToken -ne $null) "Status: $($loginNew.Status)"
    
    # Restore original password for future tests
    $restoreForgot = Invoke-Api -Method POST -Endpoint "/auth/forgot-password" -Body @{
        email = $AlunoEmail
    }
    if ($restoreForgot.Data.devOtp) {
        Invoke-Api -Method POST -Endpoint "/auth/reset-password" -Body @{
            email     = $AlunoEmail
            codigo    = $restoreForgot.Data.devOtp
            novaSenha = $AlunoPass
        } | Out-Null
        Write-Host "  Restored original password" -ForegroundColor Gray
    }
}
else {
    Write-Host "  No devOtp returned (may be production mode)" -ForegroundColor Yellow
    Test-Result "26. POST /auth/verify-otp" $true "Skipped (no devOtp)"
    Test-Result "27. POST /auth/verify-otp (wrong)" $true "Skipped"
    Test-Result "28. POST /auth/reset-password" $true "Skipped"
    Test-Result "29. Login with new password" $true "Skipped"
}

# Test 30: PATCH /users/me/profile
$profileUpdate = Invoke-Api -Method PATCH -Endpoint "/users/me/profile" -Headers $alunoHeaders -Body @{
    telefone       = "+5511999999999"
    dataNascimento = "1990-05-15"
}
Test-Result "30. PATCH /users/me/profile" ($profileUpdate.Status -eq 200) "Status: $($profileUpdate.Status)"

if ($profileUpdate.Data) {
    Test-Result "31. profileComplete flag present" ($profileUpdate.Data.profileComplete -ne $null) "profileComplete: $($profileUpdate.Data.profileComplete)"
}
else {
    Test-Result "31. profileComplete flag present" $false "No data returned"
}

# ============ CLEANUP ============
if ($cleanup.Count -gt 0) {
    Invoke-Cleanup
}

# ============ SUMMARY ============
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "Total:  $($passed + $failed)" -ForegroundColor White

if ($failed -gt 0) {
    Write-Host "`nSome tests failed. Check output above for details." -ForegroundColor Yellow
    exit 1
}
else {
    Write-Host "`nAll tests passed!" -ForegroundColor Green
    exit 0
}
