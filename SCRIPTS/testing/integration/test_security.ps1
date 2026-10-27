$ErrorActionPreference = "Stop"
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/login" -ContentType "application/json" -Body '{"email":"college.admin@hms.local","password":"HMS@Dev123"}'
$token = $login.data.access_token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "Creating Security Assignment..."
$body = @{
    staff_id = "af04170d-a8b4-4bbd-ad4f-69242750f799"
    gate_id = "ae9760fc-132c-4e6f-8185-3217dc17cf27"
    shift_name = "Morning"
    shift_start = "06:00"
    shift_end = "14:00"
    assigned_from = "2026-10-07"
    is_active = $true
} | ConvertTo-Json
$createdSecurity = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/college/security-assignments" -Headers $headers -ContentType "application/json" -Body $body
$securityAssignmentId = $createdSecurity.data.id
Write-Host "Created Security Assignment: $securityAssignmentId"

Write-Host "Getting Security Assignment..."
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/college/security-assignments/$securityAssignmentId" -Headers $headers | ConvertTo-Json -Depth 10

Write-Host "Updating Security Assignment..."
$body = @{
    staff_id = "af04170d-a8b4-4bbd-ad4f-69242750f799"
    gate_id = "ae9760fc-132c-4e6f-8185-3217dc17cf27"
    shift_name = "Evening"
    shift_start = "14:00"
    shift_end = "22:00"
    assigned_from = "2026-10-07"
    assigned_until = "2026-12-31"
    is_active = $true
} | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "http://localhost:8080/college/security-assignments/$securityAssignmentId" -Headers $headers -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 10

Write-Host "Listing Security Assignments..."
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/college/security-assignments" -Headers $headers | ConvertTo-Json -Depth 10

Write-Host "Deleting Security Assignment..."
Invoke-RestMethod -Method Delete -Uri "http://localhost:8080/college/security-assignments/$securityAssignmentId" -Headers $headers | ConvertTo-Json -Depth 10

Write-Host "Getting Security Assignment (Expecting 404)..."
try {
    Invoke-RestMethod -Method Get -Uri "http://localhost:8080/college/security-assignments/$securityAssignmentId" -Headers $headers
} catch {
    Write-Host "Caught expected error: $_"
}
