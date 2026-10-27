$ErrorActionPreference = "Stop"
$BaseUrl = "http://localhost:8080"

# Platform Super Admin login
$loginBody = @{
    email = "dev.admin@hms.local"
    password = "HMS@Dev123"
} | ConvertTo-Json

$loginResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body $loginBody
$token = $loginResp.data.access_token
$headers = @{ Authorization = "Bearer $token" }

$collegeBody = @{
    college_code = "C2"
    name = "College Two"
} | ConvertTo-Json

try {
    $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/colleges" -Headers $headers -ContentType "application/json" -Body $collegeBody
    Write-Host "Created college C2"
} catch {
    Write-Host "Error creating college:"
    $streamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    Write-Host $streamReader.ReadToEnd()
}
