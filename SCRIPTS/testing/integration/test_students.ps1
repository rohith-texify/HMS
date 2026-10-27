$ErrorActionPreference = "Stop"

Write-Host "5. Runtime test - first verify health"
$health = Invoke-RestMethod -Method GET -Uri "http://localhost:8080/health"
Write-Host "Health: $($health.status)"
$dbHealth = Invoke-RestMethod -Method GET -Uri "http://localhost:8080/health/db"
Write-Host "DB Health: $($dbHealth.status)"

Write-Host "`n6. Login as COLLEGE_ADMIN"
$loginBody = @{
    email = "college.admin@hms.local"
    password = "HMS@Dev123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/auth/login" -ContentType "application/json" -Body $loginBody
$token = $login.data.access_token
$headers = @{
    Authorization = "Bearer $token"
}

Write-Host "`n8. GET Students"
$students = Invoke-RestMethod -Method GET -Uri "http://localhost:8080/college/students" -Headers $headers
Write-Host "Students count: $($students.data.Count)"

Write-Host "`n9. CREATE Student - positive test"
$admission = "HMS-TEST-" + (Get-Date -Format "yyyyMMddHHmmss")
$studentBody = @{
    admission_number = $admission
    registration_number = "REG-$admission"
    roll_number = "ROLL-$admission"
    first_name = "API"
    middle_name = "Test"
    last_name = "Student"
    date_of_birth = "2005-06-15T00:00:00Z"
    gender = "MALE"
    blood_group = "O+"
    phone = "9876543210"
    email = "api.student@test.local"
    address_line1 = "HMS Test Address"
    city = "Pollachi"
    state = "Tamil Nadu"
    postal_code = "642001"
    country = "India"
    admission_date = "2026-06-01T00:00:00Z"
    student_status = "ACTIVE"
    hostel_status = "NOT_ALLOCATED"
    metadata = @{
        test = $true
        source = "student-api-runtime-test"
    }
} | ConvertTo-Json -Depth 10

$createResponse = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/college/students" -Headers $headers -ContentType "application/json" -Body $studentBody
$studentId = $createResponse.data.id
Write-Host "Created Student ID: $studentId"

Write-Host "`n10. GET the created Student"
$getStudent = Invoke-RestMethod -Method GET -Uri "http://localhost:8080/college/students/$studentId" -Headers $headers
Write-Host "Student Admission: $($getStudent.data.admission_number)"

Write-Host "`n11. UPDATE Student"
$updateBody = @{
    admission_number = $admission
    registration_number = "REG-$admission"
    roll_number = "ROLL-$admission"
    first_name = "API"
    middle_name = "Updated"
    last_name = "Student"
    date_of_birth = "2005-06-15T00:00:00Z"
    gender = "MALE"
    blood_group = "O+"
    phone = "9876543211"
    email = "api.student.updated@test.local"
    address_line1 = "Updated HMS Address"
    city = "Pollachi"
    state = "Tamil Nadu"
    postal_code = "642001"
    country = "India"
    admission_date = "2026-06-01T00:00:00Z"
} | ConvertTo-Json -Depth 10
$updateResponse = Invoke-RestMethod -Method PUT -Uri "http://localhost:8080/college/students/$studentId" -Headers $headers -ContentType "application/json" -Body $updateBody
Write-Host "Updated Student Middle Name: $($updateResponse.data.middle_name)"

Write-Host "`n12. Student status testing"
$statusBody = @{ status = "SUSPENDED" } | ConvertTo-Json
$statusResponse = Invoke-RestMethod -Method PATCH -Uri "http://localhost:8080/college/students/$studentId/status" -Headers $headers -ContentType "application/json" -Body $statusBody
Write-Host "Status after suspend: $($statusResponse.data.student_status)"

$statusBody = @{ status = "ACTIVE" } | ConvertTo-Json
$statusResponse = Invoke-RestMethod -Method PATCH -Uri "http://localhost:8080/college/students/$studentId/status" -Headers $headers -ContentType "application/json" -Body $statusBody
Write-Host "Status after activate: $($statusResponse.data.student_status)"

try {
    $statusBody = @{ status = "INVALID_STATUS" } | ConvertTo-Json
    Invoke-RestMethod -Method PATCH -Uri "http://localhost:8080/college/students/$studentId/status" -Headers $headers -ContentType "application/json" -Body $statusBody
    Write-Host "FAILED: Expected 400 for invalid status"
} catch {
    Write-Host "Expected error for invalid status: $($_.Exception.Message)"
}

Write-Host "`n13. Invalid input testing"
try {
    Invoke-RestMethod -Method GET -Uri "http://localhost:8080/college/students/not-a-uuid" -Headers $headers
    Write-Host "FAILED: Expected 400 for invalid UUID"
} catch {
    Write-Host "Expected error for invalid UUID: $($_.Exception.Message)"
}

try {
    $invalidBody = @{ first_name = "Invalid" } | ConvertTo-Json
    Invoke-RestMethod -Method POST -Uri "http://localhost:8080/college/students" -Headers $headers -ContentType "application/json" -Body $invalidBody
    Write-Host "FAILED: Expected 400 for missing admission number"
} catch {
    Write-Host "Expected error for missing admission: $($_.Exception.Message)"
}

try {
    $invalidBody = @{ admission_number = "INVALID-HOSTEL-001"; first_name = "Invalid"; hostel_status = "WRONG_STATUS" } | ConvertTo-Json
    Invoke-RestMethod -Method POST -Uri "http://localhost:8080/college/students" -Headers $headers -ContentType "application/json" -Body $invalidBody
    Write-Host "FAILED: Expected 400 for invalid hostel status"
} catch {
    Write-Host "Expected error for invalid hostel status: $($_.Exception.Message)"
}

Write-Host "`n14. Duplicate admission number test"
try {
    $duplicateBody = @{ admission_number = $admission; first_name = "Duplicate"; last_name = "Student" } | ConvertTo-Json
    Invoke-RestMethod -Method POST -Uri "http://localhost:8080/college/students" -Headers $headers -ContentType "application/json" -Body $duplicateBody
    Write-Host "FAILED: Expected 409 for duplicate admission"
} catch {
    Write-Host "Expected error for duplicate admission: $($_.Exception.Message)"
}

Write-Host "`nTests completed!"
