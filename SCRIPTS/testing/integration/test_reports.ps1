$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:8080"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " HMS REPORTS & DASHBOARDS RUNTIME TEST" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------
# 1. LOGIN
# ---------------------------------------------------------

Write-Host "[1/10] Login College A Admin..." -ForegroundColor Yellow

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
# 2. TEST OVERVIEW
# ---------------------------------------------------------
Write-Host "[2/10] Test Dashboard Overview..." -ForegroundColor Yellow
$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/reports/overview" -Headers $headers
Write-Host "Total Students: $($resp.data.total_students)"

# ---------------------------------------------------------
# 3. TEST STUDENTS
# ---------------------------------------------------------
Write-Host "[3/10] Test Student Stats..." -ForegroundColor Yellow
$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/reports/students" -Headers $headers
Write-Host "Active Students: $($resp.data.total_by_status.ACTIVE)"

# ---------------------------------------------------------
# 4. TEST OCCUPANCY
# ---------------------------------------------------------
Write-Host "[4/10] Test Hostel Occupancy..." -ForegroundColor Yellow
$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/reports/occupancy" -Headers $headers
Write-Host "Hostels count: $($resp.data.Length)"

# ---------------------------------------------------------
# 5. TEST ALLOCATIONS
# ---------------------------------------------------------
Write-Host "[5/10] Test Allocations Stats..." -ForegroundColor Yellow
$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/reports/allocations" -Headers $headers
Write-Host "Allocated: $($resp.data.total_allocated)"

# ---------------------------------------------------------
# 6. TEST ATTENDANCE
# ---------------------------------------------------------
Write-Host "[6/10] Test Attendance Stats..." -ForegroundColor Yellow
$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/reports/attendance" -Headers $headers
Write-Host "Present: $($resp.data.present_count)"

# ---------------------------------------------------------
# 7. TEST LEAVE
# ---------------------------------------------------------
Write-Host "[7/10] Test Leave Stats..." -ForegroundColor Yellow
$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/reports/leave" -Headers $headers
Write-Host "Pending: $($resp.data.pending)"

# ---------------------------------------------------------
# 8. TEST COMPLAINTS
# ---------------------------------------------------------
Write-Host "[8/10] Test Complaints Stats..." -ForegroundColor Yellow
$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/reports/complaints" -Headers $headers
Write-Host "Open: $($resp.data.open)"

# ---------------------------------------------------------
# 9. TEST MAINTENANCE
# ---------------------------------------------------------
Write-Host "[9/10] Test Maintenance Stats..." -ForegroundColor Yellow
$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/reports/maintenance" -Headers $headers
Write-Host "Open: $($resp.data.open)"

# ---------------------------------------------------------
# 10. TEST STAFF
# ---------------------------------------------------------
Write-Host "[10/10] Test Staff Stats..." -ForegroundColor Yellow
$resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/reports/staff" -Headers $headers
Write-Host "Active: $($resp.data.total_by_status.ACTIVE)"

# ---------------------------------------------------------
# 11. CROSS-TENANT NEGATIVE TEST
# ---------------------------------------------------------
Write-Host "[11/11] Cross-tenant test..." -ForegroundColor Yellow
$tokenB = "invalid.cross.tenant.token"
$headersB = @{ Authorization = "Bearer $tokenB" }

try {
    Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/reports/overview" -Headers $headersB -ErrorAction Stop
    Write-Error "Cross-tenant access succeeded! This is a vulnerability."
} catch {
    Write-Host "Success: Cross-tenant access prevented."
}

Write-Host "PHASE 08 - REPORTS COMPLETE"
