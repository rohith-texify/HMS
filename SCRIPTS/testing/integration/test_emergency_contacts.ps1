$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8080"

$loginBody = @{
    email    = "college.admin@hms.local"
    password = "HMS@Dev123"
} | ConvertTo-Json

Write-Host "========================================"
Write-Host "EMERGENCY CONTACTS API TEST"
Write-Host "========================================"

Write-Host "`n1. LOGIN"

$login = Invoke-RestMethod `
    -Uri "$baseUrl/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody

$token = $login.data.access_token

if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Login failed: access token missing"
}

Write-Host "LOGIN: PASS"

$headers = @{
    Authorization = "Bearer $token"
}

Write-Host "`n2. CREATE TEST STUDENT"

$admission = "EC-TEST-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

$studentBody = @{
    admission_number = $admission
    first_name       = "Emergency"
    last_name        = "TestStudent"
    student_status   = "ACTIVE"
    hostel_status    = "NOT_ALLOCATED"
} | ConvertTo-Json

$student = Invoke-RestMethod `
    -Uri "$baseUrl/college/students" `
    -Method POST `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $studentBody

$studentId = $student.data.id

Write-Host "STUDENT CREATED: $studentId"

Write-Host "`n3. CREATE PRIMARY EMERGENCY CONTACT"

$contactBody = @{
    contact_name = "Test Father"
    relationship = "FATHER"
    phone        = "9876543210"
    email        = "father@example.com"
    city         = "Pollachi"
    state        = "Tamil Nadu"
    country      = "India"
    is_primary   = $true
} | ConvertTo-Json

$contact = Invoke-RestMethod `
    -Uri "$baseUrl/college/students/$studentId/emergency-contacts" `
    -Method POST `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $contactBody

$contactId = $contact.data.id

Write-Host "PRIMARY CONTACT CREATED: $contactId"

if ($contact.data.is_primary -ne $true) {
    throw "Primary contact flag is incorrect"
}

Write-Host "PRIMARY FLAG: PASS"

Write-Host "`n4. CREATE SECONDARY CONTACT"

$contactBody2 = @{
    contact_name = "Test Mother"
    relationship = "MOTHER"
    phone        = "9876543211"
    is_primary   = $false
} | ConvertTo-Json

$contact2 = Invoke-RestMethod `
    -Uri "$baseUrl/college/students/$studentId/emergency-contacts" `
    -Method POST `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $contactBody2

$contactId2 = $contact2.data.id

Write-Host "SECONDARY CONTACT CREATED: $contactId2"

Write-Host "`n5. LIST EMERGENCY CONTACTS"

$list = Invoke-RestMethod `
    -Uri "$baseUrl/college/students/$studentId/emergency-contacts" `
    -Method GET `
    -Headers $headers

if ($list.data.Count -ne 2) {
    throw "Expected 2 emergency contacts"
}

Write-Host "LIST: PASS"

Write-Host "`n6. VERIFY PRIMARY COUNT"

$primaryCount = @(
    $list.data | Where-Object {
        $_.is_primary -eq $true
    }
).Count

if ($primaryCount -ne 1) {
    throw "Expected exactly one primary contact"
}

Write-Host "PRIMARY COUNT: PASS"

Write-Host "`n7. SWITCH PRIMARY CONTACT"

$updateBody = @{
    contact_name = "Test Mother"
    relationship = "MOTHER"
    phone        = "9876543211"
    is_primary   = $true
} | ConvertTo-Json

$updated = Invoke-RestMethod `
    -Uri "$baseUrl/college/students/$studentId/emergency-contacts/$contactId2" `
    -Method PUT `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $updateBody

if ($updated.data.is_primary -ne $true) {
    throw "Primary switch failed"
}

Write-Host "PRIMARY SWITCH: PASS"

Write-Host "`n8. VERIFY OLD PRIMARY WAS CLEARED"

$listAfterSwitch = Invoke-RestMethod `
    -Uri "$baseUrl/college/students/$studentId/emergency-contacts" `
    -Method GET `
    -Headers $headers

$primaryContacts = @(
    $listAfterSwitch.data | Where-Object {
        $_.is_primary -eq $true
    }
)

if ($primaryContacts.Count -ne 1) {
    throw "Primary uniqueness rule failed"
}

$oldPrimary = $listAfterSwitch.data |
    Where-Object { $_.id -eq $contactId }

if ($oldPrimary.is_primary -eq $true) {
    throw "Old primary was not cleared"
}

Write-Host "PRIMARY SWITCH RULE: PASS"

Write-Host "`n9. GET CONTACT"

$single = Invoke-RestMethod `
    -Uri "$baseUrl/college/students/$studentId/emergency-contacts/$contactId2" `
    -Method GET `
    -Headers $headers

if ($single.data.id -ne $contactId2) {
    throw "GET contact returned wrong ID"
}

Write-Host "GET: PASS"

Write-Host "`n10. INVALID STUDENT UUID"

try {
    Invoke-RestMethod `
        -Uri "$baseUrl/college/students/not-a-uuid/emergency-contacts" `
        -Method GET `
        -Headers $headers

    throw "Invalid student UUID was accepted"
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 400) {
        throw
    }

    Write-Host "INVALID STUDENT UUID: PASS"
}

Write-Host "`n11. INVALID CONTACT UUID"

try {
    Invoke-RestMethod `
        -Uri "$baseUrl/college/students/$studentId/emergency-contacts/not-a-uuid" `
        -Method GET `
        -Headers $headers

    throw "Invalid contact UUID was accepted"
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 400) {
        throw
    }

    Write-Host "INVALID CONTACT UUID: PASS"
}

Write-Host "`n12. MISSING CONTACT"

$fakeContactId = [guid]::NewGuid()

try {
    Invoke-RestMethod `
        -Uri "$baseUrl/college/students/$studentId/emergency-contacts/$fakeContactId" `
        -Method GET `
        -Headers $headers

    throw "Non-existent contact was accepted"
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 404) {
        throw
    }

    Write-Host "MISSING CONTACT: PASS"
}

Write-Host "`n13. DELETE CONTACT"

Invoke-RestMethod `
    -Uri "$baseUrl/college/students/$studentId/emergency-contacts/$contactId" `
    -Method DELETE `
    -Headers $headers | Out-Null

Write-Host "DELETE: PASS"

Write-Host "`n14. VERIFY DELETE"

try {
    Invoke-RestMethod `
        -Uri "$baseUrl/college/students/$studentId/emergency-contacts/$contactId" `
        -Method GET `
        -Headers $headers

    throw "Deleted contact still exists"
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 404) {
        throw
    }

    Write-Host "DELETE VERIFICATION: PASS"
}

Write-Host "`n========================================"
Write-Host "EMERGENCY CONTACTS TESTS COMPLETE"
Write-Host "========================================"
