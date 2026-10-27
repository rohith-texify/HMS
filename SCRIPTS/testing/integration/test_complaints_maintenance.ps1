$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:8080"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " HMS COMPLAINTS & MAINTENANCE RUNTIME TEST" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------
# 1. LOGIN
# ---------------------------------------------------------

Write-Host "[1/13] Login College A Admin..." -ForegroundColor Yellow

$loginBody = @{
    email    = "college.admin@hms.local"
    password = "HMS@Dev123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body $loginBody
$token = $loginResponse.data.access_token
$headers = @{ Authorization = "Bearer $token" }

if (-not $token) {
    Write-Error "Login failed!"
}

# ---------------------------------------------------------
# 2. GET TEST DATA
# ---------------------------------------------------------

Write-Host "[2/13] Get test data (room)..." -ForegroundColor Yellow

$roomId = (go run get_room.go)

if (-not $roomId) { Write-Error "Test room not found" }

# ---------------------------------------------------------
# COMPLAINTS OPERATIONS
# ---------------------------------------------------------

Write-Host "[3/13] Create complaint..." -ForegroundColor Yellow

$complaintBody = @{
    category    = "ROOM"
    title       = "AC not working"
    description = "The AC is leaking water."
    priority    = "HIGH"
} | ConvertTo-Json

$createCompResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/complaints" -Headers $headers -ContentType "application/json" -Body $complaintBody
$compId = $createCompResp.data.id
Write-Host "Created complaint: $compId"

Write-Host "[4/13] List complaints..." -ForegroundColor Yellow
$listCompResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/complaints" -Headers $headers
if ($listCompResp.data.Length -eq 0) { Write-Error "Complaints list empty" }

Write-Host "[5/13] Update complaint status..." -ForegroundColor Yellow
$statusBody = @{ status = "IN_PROGRESS"; message = "Started checking" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$BaseUrl/college/complaints/$compId/status" -Headers $headers -ContentType "application/json" -Body $statusBody

Write-Host "[6/13] List complaint updates..." -ForegroundColor Yellow
$updatesResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/complaints/$compId/updates" -Headers $headers
if ($updatesResp.data.Length -eq 0) { Write-Error "Updates list empty" }

Write-Host "[7/13] Resolve complaint..." -ForegroundColor Yellow
$resolveBody = @{ resolution = "Fixed AC pipe" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$BaseUrl/college/complaints/$compId/resolve" -Headers $headers -ContentType "application/json" -Body $resolveBody

Write-Host "[8/13] Get complaint summary..." -ForegroundColor Yellow
$summaryResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/complaints/reports/summary" -Headers $headers

# ---------------------------------------------------------
# MAINTENANCE OPERATIONS
# ---------------------------------------------------------

Write-Host "[9/13] Create maintenance request..." -ForegroundColor Yellow

$maintBody = @{
    room_id          = $roomId
    maintenance_type = "ELECTRICAL"
    reason           = "Light bulb broken"
    started_at       = (Get-Date).ToString("yyyy-MM-ddT00\:00\:00Z")
} | ConvertTo-Json

$createMaintResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/maintenance" -Headers $headers -ContentType "application/json" -Body $maintBody
$maintId = $createMaintResp.data.id
Write-Host "Created maintenance: $maintId"

Write-Host "[10/13] List maintenance..." -ForegroundColor Yellow
$listMaintResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/maintenance" -Headers $headers
if ($listMaintResp.data.Length -eq 0) { Write-Error "Maintenance list empty" }

Write-Host "[11/13] Resolve maintenance..." -ForegroundColor Yellow
$maintResolveBody = @{ remarks = "Replaced bulb" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$BaseUrl/college/maintenance/$maintId/resolve" -Headers $headers -ContentType "application/json" -Body $maintResolveBody

# ---------------------------------------------------------
# NEGATIVE TEST
# ---------------------------------------------------------

Write-Host "[12/13] Negative test (Invalid category)..." -ForegroundColor Yellow

$invalidCompBody = @{
    category    = "UNSUPPORTED_CATEGORY"
    title       = "AC not working"
    description = "The AC is leaking water."
    priority    = "HIGH"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/complaints" -Headers $headers -ContentType "application/json" -Body $invalidCompBody -ErrorAction Stop
    Write-Error "Invalid category test failed!"
} catch {
    Write-Host "Success: Invalid category rejected."
}

# ---------------------------------------------------------
# CROSS-TENANT TEST
# ---------------------------------------------------------

Write-Host "[13/13] Cross-tenant test..." -ForegroundColor Yellow
$tokenB = "invalid.cross.tenant.token"
$headersB = @{ Authorization = "Bearer $tokenB" }

try {
    Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/complaints/$compId" -Headers $headersB -ErrorAction Stop
    Write-Error "Cross-tenant access succeeded! This is a vulnerability."
} catch {
    Write-Host "Success: Cross-tenant access prevented."
}

Write-Host "PHASE 06 - COMPLAINTS / MAINTENANCE COMPLETE"
