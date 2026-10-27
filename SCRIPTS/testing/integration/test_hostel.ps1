$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:8080"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " HMS HOSTEL API RUNTIME TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------
# 1. LOGIN
# ---------------------------------------------------------

Write-Host "[1/8] Logging in as COLLEGE_ADMIN..." -ForegroundColor Yellow

$loginBody = @{
    email    = "college.admin@hms.local"
    password = "HMS@Dev123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod `
    -Uri "$BaseUrl/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody

if (-not $loginResponse.data.access_token) {
    throw "Login succeeded but JWT token was not returned."
}

$Token = $loginResponse.data.access_token

Write-Host "Login successful." -ForegroundColor Green


# ---------------------------------------------------------
# 2. LIST HOSTELS
# ---------------------------------------------------------

Write-Host ""
Write-Host "[2/8] GET /college/hostels" -ForegroundColor Yellow

$headers = @{
    Authorization = "Bearer $Token"
}

$listResponse = Invoke-RestMethod `
    -Uri "$BaseUrl/college/hostels" `
    -Method GET `
    -Headers $headers

Write-Host "Hostel list endpoint successful." -ForegroundColor Green

$listResponse | ConvertTo-Json -Depth 10


# ---------------------------------------------------------
# 3. CREATE HOSTEL
# ---------------------------------------------------------

Write-Host ""
Write-Host "[3/8] POST /college/hostels" -ForegroundColor Yellow

$uniqueCode = "TEST-" + (Get-Date -Format "yyyyMMddHHmmss")
$uniqueName = "HMS Runtime Test Hostel " + (Get-Date -Format "HHmmss")

$createBody = @{
    code           = $uniqueCode
    name           = $uniqueName
    category       = "BOYS"
    description    = "Runtime API test hostel"
    address        = "HMS Test Campus"
    total_capacity = 100
    status         = "ACTIVE"
} | ConvertTo-Json

$createResponse = Invoke-RestMethod `
    -Uri "$BaseUrl/college/hostels" `
    -Method POST `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $createBody

$createResponse | ConvertTo-Json -Depth 10

$Hostel = $createResponse.data

if (-not $Hostel.id) {
    throw "Hostel creation succeeded but hostel ID was not returned."
}

$HostelId = $Hostel.id

Write-Host ""
Write-Host "Created Hostel ID: $HostelId" -ForegroundColor Green


# ---------------------------------------------------------
# 4. GET HOSTEL
# ---------------------------------------------------------

Write-Host ""
Write-Host "[4/8] GET /college/hostels/$HostelId" -ForegroundColor Yellow

$getResponse = Invoke-RestMethod `
    -Uri "$BaseUrl/college/hostels/$HostelId" `
    -Method GET `
    -Headers $headers

$getResponse | ConvertTo-Json -Depth 10

if ($getResponse.data.id -ne $HostelId) {
    throw "Returned hostel ID does not match created hostel."
}

Write-Host "GET by ID successful." -ForegroundColor Green


# ---------------------------------------------------------
# 5. UPDATE HOSTEL
# ---------------------------------------------------------

Write-Host ""
Write-Host "[5/8] PUT /college/hostels/$HostelId" -ForegroundColor Yellow

$updateBody = @{
    code           = $uniqueCode
    name           = "$uniqueName Updated"
    category       = "BOYS"
    description    = "Updated runtime test hostel"
    address        = "Updated HMS Test Campus"
    total_capacity = 120
} | ConvertTo-Json

$updateResponse = Invoke-RestMethod `
    -Uri "$BaseUrl/college/hostels/$HostelId" `
    -Method PUT `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $updateBody

$updateResponse | ConvertTo-Json -Depth 10

Write-Host "PUT update successful." -ForegroundColor Green


# ---------------------------------------------------------
# 6. UPDATE STATUS
# ---------------------------------------------------------

Write-Host ""
Write-Host "[6/8] PATCH /college/hostels/$HostelId/status" -ForegroundColor Yellow

$statusBody = @{
    status = "MAINTENANCE"
} | ConvertTo-Json

$statusResponse = Invoke-RestMethod `
    -Uri "$BaseUrl/college/hostels/$HostelId/status" `
    -Method PATCH `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $statusBody

$statusResponse | ConvertTo-Json -Depth 10

Write-Host "Status update successful." -ForegroundColor Green


# ---------------------------------------------------------
# 7. VALIDATION TEST
# ---------------------------------------------------------

Write-Host ""
Write-Host "[7/8] Testing invalid hostel category..." -ForegroundColor Yellow

$invalidBody = @{
    code           = "INVALID-TEST-$((Get-Date).Ticks)"
    name           = "Invalid Hostel Test"
    category       = "INVALID_CATEGORY"
    description    = "Should fail validation"
    address        = "Test"
    total_capacity = 50
    status         = "ACTIVE"
} | ConvertTo-Json

try {

    Invoke-RestMethod `
        -Uri "$BaseUrl/college/hostels" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $invalidBody

    throw "Invalid category was incorrectly accepted."

}
catch {

    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "Invalid category correctly rejected with HTTP 400." -ForegroundColor Green
    }
    else {
        throw
    }
}


# ---------------------------------------------------------
# 8. FINAL GET
# ---------------------------------------------------------

Write-Host ""
Write-Host "[8/8] Final GET verification..." -ForegroundColor Yellow

$finalResponse = Invoke-RestMethod `
    -Uri "$BaseUrl/college/hostels/$HostelId" `
    -Method GET `
    -Headers $headers

$finalResponse | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " HOSTEL API RUNTIME TEST PASSED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Hostel ID : $HostelId" -ForegroundColor Cyan
Write-Host "Code      : $uniqueCode" -ForegroundColor Cyan
Write-Host "Status    : MAINTENANCE" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: The test hostel remains in the database because" -ForegroundColor DarkYellow
Write-Host "there is currently no DELETE /college/hostels/:hostel_id API." -ForegroundColor DarkYellow
Write-Host ""
