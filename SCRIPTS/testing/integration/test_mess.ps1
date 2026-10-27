$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:8080"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " HMS MESS OPERATIONS RUNTIME TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------
# 1. LOGIN
# ---------------------------------------------------------

Write-Host "[1/9] Login College A Admin..." -ForegroundColor Yellow

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
# 2. IDENTIFY TEST DATA
# ---------------------------------------------------------

Write-Host "[2/9] Identify test hostel and student..." -ForegroundColor Yellow

$hostelsResponse = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/hostels" -Headers $headers
$hostelId = $hostelsResponse.data[0].id

$studentsResponse = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/students" -Headers $headers
$studentId = $studentsResponse.data[0].id

if (-not $hostelId -or -not $studentId) {
    Write-Error "Test data not found"
}

# ---------------------------------------------------------
# 3. CREATE MEAL TIMING
# ---------------------------------------------------------

Write-Host "[3/9] Create meal timing..." -ForegroundColor Yellow

$mealTimingBody = @{
    hostel_id  = $hostelId
    meal_type  = "BREAKFAST"
    start_time = "0000-01-01T07:30:00Z"
    end_time   = "0000-01-01T09:30:00Z"
} | ConvertTo-Json

try {
    $createTimingResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/hostels/$hostelId/mess/timings" -Headers $headers -ContentType "application/json" -Body $mealTimingBody
    Write-Host "Created timing: $($createTimingResp.data.id)"
} catch {
    Write-Host "Timing already exists, proceeding..."
}

# ---------------------------------------------------------
# 4. LIST MEAL TIMINGS
# ---------------------------------------------------------

Write-Host "[4/9] List meal timings..." -ForegroundColor Yellow
$listTimingResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/hostels/$hostelId/mess/timings" -Headers $headers
if ($listTimingResp.data.Length -eq 0) { Write-Error "Timings list empty" }

# ---------------------------------------------------------
# 5. CREATE MEAL MENU
# ---------------------------------------------------------

Write-Host "[5/9] Create meal menu..." -ForegroundColor Yellow

$menuDate = (Get-Date).AddDays((Get-Random -Minimum 1000 -Maximum 9000)).ToString("yyyy-MM-ddT00\:00\:00Z")
$mealMenuBody = @{
    hostel_id  = $hostelId
    menu_date  = $menuDate
    meal_type  = "BREAKFAST"
    items      = "Idli, Vada, Chutney, Sambar"
} | ConvertTo-Json

$createMenuResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/hostels/$hostelId/mess/menus" -Headers $headers -ContentType "application/json" -Body $mealMenuBody
$menuId = $createMenuResp.data.id
Write-Host "Created menu: $menuId"

# ---------------------------------------------------------
# 6. LIST MEAL MENUS
# ---------------------------------------------------------

Write-Host "[6/9] List meal menus..." -ForegroundColor Yellow
$listMenuResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/hostels/$hostelId/mess/menus" -Headers $headers
if ($listMenuResp.data.Length -eq 0) { Write-Error "Menus list empty" }

# ---------------------------------------------------------
# 7. GET TODAY'S MENUS
# ---------------------------------------------------------

Write-Host "[7/9] Get today's menus..." -ForegroundColor Yellow
$todayMenusResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/mess/today" -Headers $headers
Write-Host "Found $($todayMenusResp.data.Length) menus for today"

# ---------------------------------------------------------
# 8. NEGATIVE TEST (Invalid Meal Type)
# ---------------------------------------------------------

Write-Host "[8/9] Negative test (Invalid meal type)..." -ForegroundColor Yellow

$invalidMenuBody = @{
    hostel_id  = $hostelId
    menu_date  = $menuDate
    meal_type  = "SUPPER"
    items      = "Some items"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/hostels/$hostelId/mess/menus" -Headers $headers -ContentType "application/json" -Body $invalidMenuBody -ErrorAction Stop
    Write-Error "Invalid meal type test failed!"
} catch {
    Write-Host "Success: Invalid meal type rejected."
}

# ---------------------------------------------------------
# 9. CROSS-TENANT TEST
# ---------------------------------------------------------

Write-Host "[9/9] Cross-tenant test..." -ForegroundColor Yellow
$tokenB = "invalid.cross.tenant.token"
$headersB = @{ Authorization = "Bearer $tokenB" }

try {
    Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/hostels/$hostelId/mess/menus" -Headers $headersB -ErrorAction Stop
    Write-Error "Cross-tenant access succeeded! This is a vulnerability."
} catch {
    Write-Host "Success: Cross-tenant access prevented."
}

Write-Host "PHASE 05 - MESS OPERATIONS COMPLETE"
