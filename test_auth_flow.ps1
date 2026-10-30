# HMS Authentication Flow Test Script
# Tests the complete login and authentication flow
# Run this after deploying 904_seed_users.sql migration

param(
    [string]$ApiUrl = "http://localhost:8080",
    [string]$Email = "superadmin@hms.local",
    [string]$Password = "Password@123"
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "HMS Authentication Flow Test" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Colors for output
$successColor = "Green"
$errorColor = "Red"
$infoColor = "Yellow"

# Test 1: Health Check
Write-Host "[TEST 1] Health Check - /health" -ForegroundColor $infoColor
try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/health" -Method GET -TimeoutSec 5
    if ($response.success -eq $true -and $response.data.status -eq "ok") {
        Write-Host "✅ PASS: API is healthy" -ForegroundColor $successColor
    } else {
        Write-Host "❌ FAIL: Unexpected health response" -ForegroundColor $errorColor
        Write-Host $response | ConvertTo-Json
    }
} catch {
    Write-Host "❌ FAIL: Cannot reach API at $ApiUrl" -ForegroundColor $errorColor
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor $errorColor
    exit 1
}
Write-Host ""

# Test 2: Database Health Check
Write-Host "[TEST 2] Database Health Check - /health/db" -ForegroundColor $infoColor
try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/health/db" -Method GET -TimeoutSec 5
    if ($response.success -eq $true) {
        Write-Host "✅ PASS: Database is connected" -ForegroundColor $successColor
        Write-Host "  - College Pool: $($response.data.college_pool)" -ForegroundColor $infoColor
        Write-Host "  - Platform Pool: $($response.data.platform_pool)" -ForegroundColor $infoColor
    } else {
        Write-Host "❌ FAIL: Database health check failed" -ForegroundColor $errorColor
        Write-Host $response | ConvertTo-Json
        exit 1
    }
} catch {
    Write-Host "❌ FAIL: Database health check failed" -ForegroundColor $errorColor
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor $errorColor
    exit 1
}
Write-Host ""

# Test 3: Login with Test User
Write-Host "[TEST 3] Login Endpoint - POST /auth/login" -ForegroundColor $infoColor
Write-Host "  Email: $Email"
Write-Host "  Password: $Password"

$loginBody = @{
    email    = $Email
    password = $Password
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$ApiUrl/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json" `
        -TimeoutSec 5

    if ($response.success -eq $true -and $response.data.access_token) {
        Write-Host "✅ PASS: Login successful" -ForegroundColor $successColor
        Write-Host "  - User ID: $($response.data.user_id)" -ForegroundColor $infoColor
        Write-Host "  - Email: $($response.data.email)" -ForegroundColor $infoColor
        Write-Host "  - Token received: $($response.data.access_token.Substring(0, 20))..." -ForegroundColor $infoColor
        Write-Host "  - Expires at: $($response.data.expires_at)" -ForegroundColor $infoColor
        Write-Host "  - Role: $($response.data.membership.role_code)" -ForegroundColor $infoColor
        
        $accessToken = $response.data.access_token
    } else {
        Write-Host "❌ FAIL: Login failed" -ForegroundColor $errorColor
        Write-Host $response | ConvertTo-Json
        exit 1
    }
} catch {
    Write-Host "❌ FAIL: Login request failed" -ForegroundColor $errorColor
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor $errorColor
    
    # Try to parse error response
    $errorContent = $_.Exception.Response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorContent) {
        Write-Host "Server Response: $($errorContent | ConvertTo-Json)" -ForegroundColor $errorColor
    }
    exit 1
}
Write-Host ""

# Test 4: Invalid Login
Write-Host "[TEST 4] Invalid Login Test - POST /auth/login (wrong password)" -ForegroundColor $infoColor
$invalidLoginBody = @{
    email    = $Email
    password = "WrongPassword123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$ApiUrl/auth/login" `
        -Method POST `
        -Body $invalidLoginBody `
        -ContentType "application/json" `
        -TimeoutSec 5
    
    Write-Host "❌ FAIL: Should have rejected invalid password" -ForegroundColor $errorColor
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ PASS: Correctly rejected invalid password (401 Unauthorized)" -ForegroundColor $successColor
    } else {
        Write-Host "⚠️  WARNING: Expected 401, got $($_.Exception.Response.StatusCode)" -ForegroundColor $errorColor
    }
}
Write-Host ""

# Test 5: Test All Seed Users
Write-Host "[TEST 5] Testing All Seed Users" -ForegroundColor $infoColor

$testUsers = @(
    @{ Email = "superadmin@hms.local"; Role = "SUPER_ADMIN"; Password = "Password@123" }
    @{ Email = "admin@test-college.local"; Role = "COLLEGE_ADMIN"; Password = "Password@123" }
    @{ Email = "student@test-college.local"; Role = "STUDENT"; Password = "Password@123" }
    @{ Email = "parent@test-college.local"; Role = "PARENT"; Password = "Password@123" }
    @{ Email = "incharge@test-college.local"; Role = "INCHARGE"; Password = "Password@123" }
    @{ Email = "security@test-college.local"; Role = "SECURITY"; Password = "Password@123" }
)

$passCount = 0
$failCount = 0

foreach ($user in $testUsers) {
    Write-Host "  Testing: $($user.Email) ($($user.Role))" -ForegroundColor $infoColor
    
    $loginBody = @{
        email    = $user.Email
        password = $user.Password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod `
            -Uri "$ApiUrl/auth/login" `
            -Method POST `
            -Body $loginBody `
            -ContentType "application/json" `
            -TimeoutSec 5
        
        if ($response.success -eq $true -and $response.data.access_token -and $response.data.membership.role_code -eq $user.Role) {
            Write-Host "    ✅ Success" -ForegroundColor $successColor
            $passCount++
        } else {
            Write-Host "    ❌ Failed - Role mismatch or no token" -ForegroundColor $errorColor
            $failCount++
        }
    } catch {
        Write-Host "    ❌ Failed - $($_.Exception.Message)" -ForegroundColor $errorColor
        $failCount++
    }
}

Write-Host ""
Write-Host "  Result: $passCount passed, $failCount failed" -ForegroundColor $(if ($failCount -eq 0) { $successColor } else { $errorColor })
Write-Host ""

# Final Summary
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

if ($failCount -eq 0 -and $passCount -eq 6) {
    Write-Host "✅ ALL TESTS PASSED - Authentication flow is working correctly!" -ForegroundColor $successColor
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor $infoColor
    Write-Host "1. Test with frontend application" -ForegroundColor $infoColor
    Write-Host "2. Verify CORS headers are correct" -ForegroundColor $infoColor
    Write-Host "3. Test API endpoints with valid JWT token" -ForegroundColor $infoColor
    Write-Host ""
} else {
    Write-Host "❌ SOME TESTS FAILED - Please check the errors above" -ForegroundColor $errorColor
    exit 1
}
