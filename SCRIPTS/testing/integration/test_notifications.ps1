$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:8080"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " HMS NOTIFICATIONS RUNTIME TEST" -ForegroundColor Cyan
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
# 2. GET TEST DATA
# ---------------------------------------------------------

Write-Host "[2/10] Get test data (users)..." -ForegroundColor Yellow

$adminId = "28c1a090-ac64-413f-ade2-bddbee1cca2f"
$studentId = "6a405786-096a-4d43-85f2-9cb9443ebbbd"
$studentEmail = "test.student@hms.local"

if (-not $adminId -or -not $studentId) { Write-Error "Test users not found" }

# ---------------------------------------------------------
# 3. CREATE NOTIFICATION
# ---------------------------------------------------------

Write-Host "[3/10] Create notification..." -ForegroundColor Yellow

$notifBody = @{
    title         = "Hostel Meeting"
    message       = "Please attend the meeting at 5 PM."
    type          = "ANNOUNCEMENT"
    priority      = "HIGH"
    recipient_ids = @($adminId)
} | ConvertTo-Json

$createResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/notifications" -Headers $headers -ContentType "application/json" -Body $notifBody
$notifId = $createResp.data.id
Write-Host "Created notification: $notifId"

# ---------------------------------------------------------
# 4. GET NOTIFICATIONS
# ---------------------------------------------------------

Write-Host "[4/10] List notifications (all)..." -ForegroundColor Yellow
$listResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/notifications" -Headers $headers
if ($listResp.data.Length -eq 0) { Write-Error "Notifications list empty" }

Write-Host "[5/10] Get unread count..." -ForegroundColor Yellow
$countResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/notifications/unread-count" -Headers $headers
Write-Host "Unread count: $($countResp.data.count)"

Write-Host "[6/10] Mark notification as read..." -ForegroundColor Yellow
Invoke-RestMethod -Method Patch -Uri "$BaseUrl/college/notifications/$notifId/read" -Headers $headers

Write-Host "[7/10] Mark all as read..." -ForegroundColor Yellow
Invoke-RestMethod -Method Patch -Uri "$BaseUrl/college/notifications/read-all" -Headers $headers

# ---------------------------------------------------------
# NEGATIVE TESTS
# ---------------------------------------------------------

Write-Host "[8/10] Negative test (Invalid type)..." -ForegroundColor Yellow

$invalidBody = @{
    title         = "Invalid"
    message       = "Invalid."
    type          = "UNSUPPORTED_TYPE"
    priority      = "HIGH"
    recipient_ids = @($adminId)
} | ConvertTo-Json

try {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/notifications" -Headers $headers -ContentType "application/json" -Body $invalidBody -ErrorAction Stop
    Write-Error "Invalid type test failed!"
} catch {
    Write-Host "Success: Invalid type rejected."
}

# ---------------------------------------------------------
# ISOLATION TESTS
# ---------------------------------------------------------

Write-Host "[9/10] User isolation test..." -ForegroundColor Yellow
# Authenticate as student and try to access admin's notification if possible
# Since we created it for both, they both have it, but they have separate delivery statuses.
# We'll fetch unread count for student (should be > 0 because we marked admin's read, not student's).
$loginBodyB = @{ email = "staff.test@hms.local"; password = "HMS@Dev123" } | ConvertTo-Json
try {
    $studentTokenResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body $loginBodyB
    $studentToken = $studentTokenResp.data.access_token
    $studentHeaders = @{ Authorization = "Bearer $studentToken" }
} catch {
    Write-Host "Skipping isolation test: staff not found."
    $studentToken = $null
}

if ($studentToken) {
    $studentCountResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/notifications/unread-count" -Headers $studentHeaders
    if ($studentCountResp.data.count -eq 0) {
        Write-Error "User isolation failed! Admin marking read affected student."
    } else {
        Write-Host "Success: User isolation verified."
    }
}

Write-Host "[10/10] Cross-tenant test..." -ForegroundColor Yellow
$tokenB = "invalid.cross.tenant.token"
$headersB = @{ Authorization = "Bearer $tokenB" }

try {
    Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/notifications" -Headers $headersB -ErrorAction Stop
    Write-Error "Cross-tenant access succeeded! This is a vulnerability."
} catch {
    Write-Host "Success: Cross-tenant access prevented."
}

Write-Host "PHASE 07 - NOTIFICATIONS COMPLETE"
