$ErrorActionPreference = "Stop"
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/login" -ContentType "application/json" -Body '{"email":"college.admin@hms.local","password":"HMS@Dev123"}'
$token = $login.data.access_token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "Creating Incharge..."
$body = @{
    staff_id = "af04170d-a8b4-4bbd-ad4f-69242750f799"
    assigned_from = "2026-10-07"
    is_primary = $true
} | ConvertTo-Json
$created = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/college/hostels/bad5f050-858f-4e56-8dc3-c10a4d88c20b/incharges" -Headers $headers -ContentType "application/json" -Body $body
$assignmentId = $created.data.id
Write-Host "Created Incharge: $assignmentId"

Write-Host "Getting Incharge..."
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/college/hostels/bad5f050-858f-4e56-8dc3-c10a4d88c20b/incharges/$assignmentId" -Headers $headers | ConvertTo-Json -Depth 10

Write-Host "Updating Incharge..."
$body = @{
    staff_id = "af04170d-a8b4-4bbd-ad4f-69242750f799"
    assigned_from = "2026-10-07"
    assigned_until = "2026-12-31"
    is_primary = $true
} | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "http://localhost:8080/college/hostels/bad5f050-858f-4e56-8dc3-c10a4d88c20b/incharges/$assignmentId" -Headers $headers -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 10

Write-Host "Listing Incharges..."
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/college/hostels/bad5f050-858f-4e56-8dc3-c10a4d88c20b/incharges" -Headers $headers | ConvertTo-Json -Depth 10

Write-Host "Deleting Incharge..."
Invoke-RestMethod -Method Delete -Uri "http://localhost:8080/college/hostels/bad5f050-858f-4e56-8dc3-c10a4d88c20b/incharges/$assignmentId" -Headers $headers | ConvertTo-Json -Depth 10

Write-Host "Getting Incharge (Expecting 404)..."
try {
    Invoke-RestMethod -Method Get -Uri "http://localhost:8080/college/hostels/bad5f050-858f-4e56-8dc3-c10a4d88c20b/incharges/$assignmentId" -Headers $headers
} catch {
    Write-Host "Caught expected error: $_"
}
