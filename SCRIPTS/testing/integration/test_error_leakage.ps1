$ErrorActionPreference = "Stop"
$BaseUrl = "http://localhost:8080"

# Login
$loginBody = @{
    email = "college.admin@hms.local"
    password = "HMS@Dev123"
} | ConvertTo-Json

$loginResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body $loginBody
$token = $loginResp.data.access_token
$headers = @{ Authorization = "Bearer $token" }

# Duplicate Create
$studentBody = @{
    user_id = "00000000-0000-0000-0000-000000000000"
    admission_number = "DUPLICATE123"
    first_name = "Test"
    last_name = "Student"
    date_of_birth = "2000-01-01"
    gender = "MALE"
    blood_group = "O+"
    contact_number = "9999999999"
    email = "dup@test.com"
    address = "123 Test St"
} | ConvertTo-Json -Compress

curl.exe -s -X POST "http://localhost:8080/college/students" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d $studentBody
Write-Host ""
Write-Host "Second attempt (should be duplicate):"
curl.exe -s -X POST "http://localhost:8080/college/students" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d $studentBody
