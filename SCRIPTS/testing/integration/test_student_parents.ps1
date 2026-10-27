$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8080"

Write-Host ""
Write-Host "==============================================="
Write-Host " HMS STUDENT-PARENT API TEST"
Write-Host "==============================================="

# ------------------------------------------------
# LOGIN
# ------------------------------------------------

$loginBody = @{
    email = "college.admin@hms.local"
    password = "HMS@Dev123"
} | ConvertTo-Json

$login = Invoke-RestMethod `
    -Method POST `
    -Uri "$baseUrl/auth/login" `
    -ContentType "application/json" `
    -Body $loginBody

$token = $login.data.access_token

$headers = @{
    Authorization = "Bearer $token"
}

Write-Host ""
Write-Host "LOGIN: PASS"

# ------------------------------------------------
# CREATE STUDENT
# ------------------------------------------------

$admission = "SP-TEST-" + (Get-Random -Minimum 10000 -Maximum 99999)

$studentBody = @{
    admission_number = $admission
    first_name = "Student"
    last_name = "ParentTest"
    gender = "MALE"
    student_status = "ACTIVE"
    hostel_status = "NOT_ALLOCATED"
} | ConvertTo-Json

$student = Invoke-RestMethod `
    -Method POST `
    -Uri "$baseUrl/college/students" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $studentBody

$studentID = $student.data.id

Write-Host "STUDENT CREATED: $studentID"

# ------------------------------------------------
# CREATE PARENT
# ------------------------------------------------

$parentBody = @{
    first_name = "Parent"
    last_name = "One"
    relationship = "FATHER"
    phone = "9876500001"
    email = "student.parent.test1@example.com"
} | ConvertTo-Json

$parent = Invoke-RestMethod `
    -Method POST `
    -Uri "$baseUrl/college/parents" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $parentBody

$parentID = $parent.data.id

Write-Host "PARENT CREATED: $parentID"

# ------------------------------------------------
# CREATE SECOND PARENT
# ------------------------------------------------

$parentBody2 = @{
    first_name = "Parent"
    last_name = "Two"
    relationship = "MOTHER"
    phone = "9876500002"
    email = "student.parent.test2@example.com"
} | ConvertTo-Json

$parent2 = Invoke-RestMethod `
    -Method POST `
    -Uri "$baseUrl/college/parents" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $parentBody2

$parentID2 = $parent2.data.id

Write-Host "SECOND PARENT CREATED: $parentID2"

# ------------------------------------------------
# CREATE STUDENT-PARENT RELATIONSHIP
# ------------------------------------------------

Write-Host ""
Write-Host "1. CREATE STUDENT-PARENT RELATIONSHIP"

$relationshipBody = @{
    parent_id = $parentID
    relationship = "FATHER"
    is_primary = $true
    can_receive_notifications = $true
    can_pickup_student = $true
} | ConvertTo-Json

$relationship = Invoke-RestMethod `
    -Method POST `
    -Uri "$baseUrl/college/students/$studentID/parents" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $relationshipBody

$relationshipID = $relationship.data.id

Write-Host "RELATIONSHIP CREATED: $relationshipID"

# ------------------------------------------------
# LIST
# ------------------------------------------------

Write-Host ""
Write-Host "2. LIST STUDENT PARENTS"

$list = Invoke-RestMethod `
    -Method GET `
    -Uri "$baseUrl/college/students/$studentID/parents" `
    -Headers $headers

$list | ConvertTo-Json -Depth 10

# ------------------------------------------------
# GET
# ------------------------------------------------

Write-Host ""
Write-Host "3. GET RELATIONSHIP"

$get = Invoke-RestMethod `
    -Method GET `
    -Uri "$baseUrl/college/students/$studentID/parents/$relationshipID" `
    -Headers $headers

$get | ConvertTo-Json -Depth 10

# ------------------------------------------------
# CREATE SECOND RELATIONSHIP
# ------------------------------------------------

Write-Host ""
Write-Host "4. CREATE SECOND PARENT RELATIONSHIP"

$relationshipBody2 = @{
    parent_id = $parentID2
    relationship = "MOTHER"
    is_primary = $false
    can_receive_notifications = $true
    can_pickup_student = $false
} | ConvertTo-Json

$relationship2 = Invoke-RestMethod `
    -Method POST `
    -Uri "$baseUrl/college/students/$studentID/parents" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $relationshipBody2

$relationshipID2 = $relationship2.data.id

Write-Host "SECOND RELATIONSHIP CREATED: $relationshipID2"

# ------------------------------------------------
# PRIMARY SWITCH
# ------------------------------------------------

Write-Host ""
Write-Host "5. SWITCH PRIMARY PARENT"

$updatePrimary = @{
    relationship = "MOTHER"
    is_primary = $true
    can_receive_notifications = $true
    can_pickup_student = $true
} | ConvertTo-Json

$updated = Invoke-RestMethod `
    -Method PUT `
    -Uri "$baseUrl/college/students/$studentID/parents/$relationshipID2" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $updatePrimary

Write-Host "PRIMARY SWITCHED"

# ------------------------------------------------
# VERIFY PRIMARY
# ------------------------------------------------

Write-Host ""
Write-Host "6. VERIFY PRIMARY PARENT RULE"

$verifyList = Invoke-RestMethod `
    -Method GET `
    -Uri "$baseUrl/college/students/$studentID/parents" `
    -Headers $headers

$verifyList | ConvertTo-Json -Depth 10

$primaryCount = @(
    $verifyList.data |
    Where-Object { $_.is_primary -eq $true }
).Count

if ($primaryCount -eq 1) {
    Write-Host "PASS: Exactly one primary parent exists"
}
else {
    Write-Host "FAIL: Primary parent count = $primaryCount"
}

# ------------------------------------------------
# DUPLICATE RELATIONSHIP
# ------------------------------------------------

Write-Host ""
Write-Host "7. DUPLICATE RELATIONSHIP TEST"

try {

    $duplicateBody = @{
        parent_id = $parentID
        relationship = "FATHER"
        is_primary = $false
        can_receive_notifications = $true
        can_pickup_student = $false
    } | ConvertTo-Json

    Invoke-RestMethod `
        -Method POST `
        -Uri "$baseUrl/college/students/$studentID/parents" `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $duplicateBody

    Write-Host "FAIL: Duplicate relationship accepted"
}
catch {
    Write-Host "PASS: Duplicate relationship rejected"
}

# ------------------------------------------------
# INVALID STUDENT UUID
# ------------------------------------------------

Write-Host ""
Write-Host "8. INVALID STUDENT UUID"

try {

    Invoke-RestMethod `
        -Method GET `
        -Uri "$baseUrl/college/students/not-a-uuid/parents" `
        -Headers $headers

    Write-Host "FAIL: Invalid student UUID accepted"
}
catch {
    Write-Host "PASS: Invalid student UUID rejected"
}

# ------------------------------------------------
# INVALID RELATIONSHIP UUID
# ------------------------------------------------

Write-Host ""
Write-Host "9. INVALID RELATIONSHIP UUID"

try {

    Invoke-RestMethod `
        -Method GET `
        -Uri "$baseUrl/college/students/$studentID/parents/not-a-uuid" `
        -Headers $headers

    Write-Host "FAIL: Invalid relationship UUID accepted"
}
catch {
    Write-Host "PASS: Invalid relationship UUID rejected"
}

# ------------------------------------------------
# MISSING RELATIONSHIP
# ------------------------------------------------

Write-Host ""
Write-Host "10. MISSING RELATIONSHIP"

try {

    $badBody = @{
        parent_id = $parentID
        is_primary = $false
    } | ConvertTo-Json

    Invoke-RestMethod `
        -Method POST `
        -Uri "$baseUrl/college/students/$studentID/parents" `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $badBody

    Write-Host "FAIL: Missing relationship accepted"
}
catch {
    Write-Host "PASS: Missing relationship rejected"
}

# ------------------------------------------------
# NON EXISTENT RELATIONSHIP
# ------------------------------------------------

Write-Host ""
Write-Host "11. NON-EXISTENT RELATIONSHIP"

$fakeRelationshipID = [guid]::NewGuid()

try {

    Invoke-RestMethod `
        -Method GET `
        -Uri "$baseUrl/college/students/$studentID/parents/$fakeRelationshipID" `
        -Headers $headers

    Write-Host "FAIL: Fake relationship returned"
}
catch {
    Write-Host "PASS: Fake relationship rejected"
}

# ------------------------------------------------
# UPDATE FLAGS
# ------------------------------------------------

Write-Host ""
Write-Host "12. UPDATE AUTHORIZATION FLAGS"

$flagBody = @{
    relationship = "MOTHER"
    is_primary = $true
    can_receive_notifications = $false
    can_pickup_student = $true
} | ConvertTo-Json

$flagUpdate = Invoke-RestMethod `
    -Method PUT `
    -Uri "$baseUrl/college/students/$studentID/parents/$relationshipID2" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $flagBody

if (
    $flagUpdate.data.can_receive_notifications -eq $false -and
    $flagUpdate.data.can_pickup_student -eq $true
) {
    Write-Host "PASS: Relationship flags updated"
}
else {
    Write-Host "FAIL: Relationship flags incorrect"
}

# ------------------------------------------------
# DELETE
# ------------------------------------------------

Write-Host ""
Write-Host "13. DELETE RELATIONSHIP"

Invoke-RestMethod `
    -Method DELETE `
    -Uri "$baseUrl/college/students/$studentID/parents/$relationshipID" `
    -Headers $headers

Write-Host "PASS: Relationship deleted"

# ------------------------------------------------
# VERIFY DELETE
# ------------------------------------------------

Write-Host ""
Write-Host "14. VERIFY DELETE"

try {

    Invoke-RestMethod `
        -Method GET `
        -Uri "$baseUrl/college/students/$studentID/parents/$relationshipID" `
        -Headers $headers

    Write-Host "FAIL: Deleted relationship still exists"
}
catch {
    Write-Host "PASS: Deleted relationship not found"
}

Write-Host ""
Write-Host "==============================================="
Write-Host " STUDENT-PARENT TEST COMPLETE"
Write-Host "==============================================="
