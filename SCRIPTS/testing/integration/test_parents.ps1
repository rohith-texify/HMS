$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8080"

Write-Host ""
Write-Host "============================================="
Write-Host " HMS PARENTS API RUNTIME TEST"
Write-Host "============================================="
Write-Host ""

function Get-Token {
    $body = @{
        email = "college.admin@hms.local"
        password = "HMS@Dev123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod `
        -Method POST `
        -Uri "$baseUrl/auth/login" `
        -ContentType "application/json" `
        -Body $body

    return $response.data.access_token
}

$token = Get-Token

$headers = @{
    Authorization = "Bearer $token"
}

Write-Host "1. GET Parents"

$list = Invoke-RestMethod `
    -Method GET `
    -Uri "$baseUrl/college/parents" `
    -Headers $headers

$list | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "2. CREATE Parent"

$createBody = @{
    first_name = "Rajesh"
    last_name = "Kumar"
    relationship = "FATHER"
    phone = "9876543210"
    alternate_phone = "9123456780"
    email = "rajesh.parent.hms.test@example.com"
    occupation = "Engineer"
    address_line1 = "12 Test Street"
    address_line2 = "HMS Test Area"
    city = "Pollachi"
    state = "Tamil Nadu"
    postal_code = "642001"
    country = "India"
} | ConvertTo-Json

$created = Invoke-RestMethod `
    -Method POST `
    -Uri "$baseUrl/college/parents" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $createBody

$parentID = $created.data.id

Write-Host "Created Parent ID: $parentID"

Write-Host ""
Write-Host "3. GET Created Parent"

$getParent = Invoke-RestMethod `
    -Method GET `
    -Uri "$baseUrl/college/parents/$parentID" `
    -Headers $headers

$getParent | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "4. UPDATE Parent"

$updateBody = @{
    first_name = "Rajesh"
    last_name = "Kumar Updated"
    relationship = "FATHER"
    phone = "9876543210"
    alternate_phone = "9000000000"
    email = "rajesh.updated.hms.test@example.com"
    occupation = "Senior Engineer"
    address_line1 = "Updated Address"
    city = "Pollachi"
    state = "Tamil Nadu"
    postal_code = "642001"
    country = "India"
} | ConvertTo-Json

$updated = Invoke-RestMethod `
    -Method PUT `
    -Uri "$baseUrl/college/parents/$parentID" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $updateBody

$updated | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "8. INVALID UUID TEST"

try {
    Invoke-RestMethod `
        -Method GET `
        -Uri "$baseUrl/college/parents/not-a-uuid" `
        -Headers $headers

    Write-Host "ERROR: Invalid UUID was accepted"
}
catch {
    Write-Host "PASS: Invalid UUID rejected"
}

Write-Host ""
Write-Host "9. MISSING FIRST NAME TEST"

try {
    $badParent = @{
        last_name = "NoFirstName"
        relationship = "MOTHER"
    } | ConvertTo-Json

    Invoke-RestMethod `
        -Method POST `
        -Uri "$baseUrl/college/parents" `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $badParent

    Write-Host "ERROR: Missing first name was accepted"
}
catch {
    Write-Host "PASS: Missing first name rejected"
}

Write-Host ""
Write-Host "10. NON-EXISTENT PARENT TEST"

$fakeID = [guid]::NewGuid()

try {
    Invoke-RestMethod `
        -Method GET `
        -Uri "$baseUrl/college/parents/$fakeID" `
        -Headers $headers

    Write-Host "ERROR: Non-existent parent returned successfully"
}
catch {
    Write-Host "PASS: Non-existent parent rejected"
}

Write-Host ""
Write-Host "============================================="
Write-Host " PARENT CRUD TEST COMPLETE"
Write-Host "============================================="
