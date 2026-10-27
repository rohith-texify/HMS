$ErrorActionPreference = "Stop"
$BaseUrl = "http://localhost:8080"

# Token A (College 1)
$loginA = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body '{"email":"college.admin@hms.local","password":"HMS@Dev123"}'
$tokenA = $loginA.data.access_token
$headersA = @{ Authorization = "Bearer $tokenA" }

# Token B (College 2)
$loginB = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body '{"email":"admin_c3@test.com","password":"HMS@Dev123"}'
$tokenB = $loginB.data.access_token
$headersB = @{ Authorization = "Bearer $tokenB" }

# Now do the same for a Hostel
$hostelBody = @{
    code = "H_CROSS"
    name = "Hostel Cross"
    category = "BOYS"
    address = "Campus"
    total_capacity = 100
} | ConvertTo-Json

try {
    $createResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/hostels" -Headers $headersA -ContentType "application/json" -Body $hostelBody
    Write-Host "Hostel Create Response: SUCCESS"
} catch {
    Write-Host "Hostel Create Error (Might already exist):"
    $streamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    Write-Host $streamReader.ReadToEnd()
}

$hostelsResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/hostels" -Headers $headersA
Write-Host "Hostels GET Response: $($hostelsResp | ConvertTo-Json -Depth 5)"
$hostelA = $hostelsResp.data[0] # assuming it's in data array directly?

if ($null -eq $hostelA) {
    Write-Host "Failed to find hostel in College A!"
    exit 1
}

$hostelIdA = $hostelA.id
Write-Host "College A Hostel ID: $hostelIdA"

# Try to access Hostel A with Token B
Write-Host "Attempting to access College A's hostel using College B's token..."
try {
    $resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/hostels/$hostelIdA" -Headers $headersB
    Write-Host "FAIL: College B accessed College A's hostel! Response: $($resp | ConvertTo-Json)"
    exit 1
} catch {
    $streamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    $errResp = $streamReader.ReadToEnd()
    Write-Host "SUCCESS: College B denied. Response: $errResp"
}

Write-Host "ALL CROSS-TENANT TESTS PASSED."
