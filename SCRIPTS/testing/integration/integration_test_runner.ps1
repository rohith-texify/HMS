$ErrorActionPreference = "Continue"

Write-Host "=========================================="
Write-Host "STARTING PHASE 10 E2E REGRESSION RUNNER"
Write-Host "=========================================="

# Start server
Write-Host "[*] Starting Server..."
$serverProcess = Start-Process -FilePath "go" -ArgumentList "run API/cmd/server/main.go" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5

$BaseUrl = "http://localhost:8080"

# Step 3: Health
Write-Host "[*] Testing Health Endpoints..."
$health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health"
Write-Host "Health: $($health.status)"
$dbHealth = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health/db"
Write-Host "DB Health: $($dbHealth.status)"

# Step 4: Authentication
Write-Host "[*] Testing Authentication..."
try {
    $login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body '{"email":"college.admin@hms.local","password":"HMS@Dev123"}'
    Write-Host "College Login: SUCCESS (Scope: $($login.data.membership.role_scope))"
} catch {
    Write-Host "College Login: FAILED"
}

try {
    $login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body '{"email":"dev.admin@hms.local","password":"HMS@Dev123"}'
    Write-Host "Platform Login: SUCCESS (Scope: $($login.data.membership.role_scope))"
} catch {
    Write-Host "Platform Login: FAILED"
}

try {
    $login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body '{"email":"college.admin@hms.local","password":"wrong"}'
    Write-Host "Invalid Login: SUCCESS (It succeeded?!)"
} catch {
    Write-Host "Invalid Login: DENIED (Expected)"
}

# Run all test scripts
$scripts = @(
    "test_hostel_ops.ps1",
    "test_hostel_allocation.ps1",
    "test_attendance.ps1",
    "test_leave.ps1",
    "test_mess.ps1",
    "test_complaints_maintenance.ps1",
    "test_notifications.ps1",
    "test_reports.ps1",
    "test_cross_tenant.ps1"
)

foreach ($script in $scripts) {
    Write-Host "`n=========================================="
    Write-Host "RUNNING SCRIPT: $script"
    Write-Host "=========================================="
    if (Test-Path $script) {
        try {
            & .\$script
            if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
                Write-Host "`n[RESULT] ${script}: PASS"
            } else {
                Write-Host "`n[RESULT] ${script}: FAIL (Exit Code: $LASTEXITCODE)"
            }
        } catch {
            Write-Host "`n[RESULT] ${script}: FAIL (Exception: $_)"
        }
    } else {
        Write-Host "`n[RESULT] ${script}: SKIPPED (Not Found)"
    }
}

Write-Host "`n=========================================="
Write-Host "STOPPING SERVER"
Write-Host "=========================================="
Stop-Process -Id $serverProcess.Id -Force
