$ErrorActionPreference = "Stop"

$loginBody = @{
    email = "dev.admin@hms.local"
    password = "HMS@Dev123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/auth/login" -ContentType "application/json" -Body $loginBody
$token = $login.data.access_token
$headers = @{
    Authorization = "Bearer $token"
}

$colleges = Invoke-RestMethod -Method GET -Uri "http://localhost:8080/colleges" -Headers $headers
foreach ($college in $colleges.data.colleges) {
    if ($college.status -ne "ACTIVE") {
        Write-Host "Activating college $($college.college_id) - $($college.name)..."
        $statusBody = @{ status = "ACTIVE"; lifecycle_reason = "Reactivating for students API test" } | ConvertTo-Json
        Invoke-RestMethod -Method PATCH -Uri "http://localhost:8080/colleges/$($college.college_id)/status" -Headers $headers -ContentType "application/json" -Body $statusBody
        Write-Host "Activated!"
    }
}
Write-Host "Done!"
