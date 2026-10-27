$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:8080"

$Email = "college.admin@hms.local"
$Password = "HMS@Dev123"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " HMS GATE API RUNTIME TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "[1/8] Logging in as COLLEGE_ADMIN..."

$loginBody = @{
    email    = $Email
    password = $Password
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "$BaseUrl/auth/login" `
    -ContentType "application/json" `
    -Body $loginBody

$token = $loginResponse.data.access_token

if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Login token was not returned."
}

Write-Host "Login successful." -ForegroundColor Green

$headers = @{
    Authorization = "Bearer $token"
}

Write-Host ""
Write-Host "[2/8] GET /college/gates"

$listResponse = Invoke-RestMethod `
    -Method Get `
    -Uri "$BaseUrl/college/gates" `
    -Headers $headers

Write-Host "Gate list endpoint successful." -ForegroundColor Green

Write-Host ""
Write-Host "[3/8] POST /college/gates"

$timestamp = Get-Date -Format "yyyyMMddHHmmss"

$createBody = @{
    hostel_id = "bad5f050-858f-4e56-8dc3-c10a4d88c20b"
    code = "GATE-$timestamp"
    name = "HMS Runtime Test Gate $timestamp"
    gate_type = "MAIN"
    location_description = "Main campus entrance"
    status = "ACTIVE"
} | ConvertTo-Json

$createResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "$BaseUrl/college/gates" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $createBody

$gateId = $createResponse.data.id

if ([string]::IsNullOrWhiteSpace($gateId)) {
    throw "Gate ID was not returned."
}

Write-Host "Created Gate ID: $gateId" -ForegroundColor Green

Write-Host ""
Write-Host "[4/8] GET /college/gates/:id"

$getResponse = Invoke-RestMethod `
    -Method Get `
    -Uri "$BaseUrl/college/gates/$gateId" `
    -Headers $headers

if ($getResponse.data.id -ne $gateId) {
    throw "GET returned incorrect gate."
}

Write-Host "PASS" -ForegroundColor Green

Write-Host ""
Write-Host "[5/8] PUT /college/gates/:id"

$updateBody = @{
    hostel_id = "bad5f050-858f-4e56-8dc3-c10a4d88c20b"
    code = "GATE-UPD-$timestamp"
    name = "Updated HMS Runtime Test Gate"
    gate_type = "MAIN"
    location_description = "Updated main entrance"
    status = "ACTIVE"
} | ConvertTo-Json

$updateResponse = Invoke-RestMethod `
    -Method Put `
    -Uri "$BaseUrl/college/gates/$gateId" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $updateBody

Write-Host "PASS" -ForegroundColor Green

Write-Host ""
Write-Host "[6/8] PATCH /college/gates/:id/status"

$statusBody = @{
    status = "INACTIVE"
} | ConvertTo-Json

$statusResponse = Invoke-RestMethod `
    -Method Patch `
    -Uri "$BaseUrl/college/gates/$gateId/status" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $statusBody

if ($statusResponse.data.status -ne "INACTIVE") {
    throw "Gate status was not updated."
}

Write-Host "status became INACTIVE" -ForegroundColor Green
Write-Host "PASS" -ForegroundColor Green

Write-Host ""
Write-Host "[7/8] Invalid empty code must be rejected"

$invalidBody = @{
    hostel_id = "bad5f050-858f-4e56-8dc3-c10a4d88c20b"
    code = ""
    name = "Invalid Gate"
    gate_type = "MAIN"
    status = "ACTIVE"
} | ConvertTo-Json

try {
    Invoke-RestMethod `
        -Method Post `
        -Uri "$BaseUrl/college/gates" `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $invalidBody | Out-Null

    throw "Invalid gate was accepted."
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 400) {
        throw
    }

    Write-Host "invalid code correctly rejected HTTP 400" -ForegroundColor Green
}

Write-Host ""
Write-Host "[8/8] Final GET verification"

$finalResponse = Invoke-RestMethod `
    -Method Get `
    -Uri "$BaseUrl/college/gates/$gateId" `
    -Headers $headers

Write-Host "Final Gate:" -ForegroundColor Yellow
$finalResponse.data | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " GATE API RUNTIME TEST PASSED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
