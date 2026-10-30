#!/usr/bin/env pwsh
# Test HMS Login Flow

Write-Host "🧪 Testing HMS Login Flow" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Backend Health
Write-Host "1️⃣  Testing Backend Health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" `
        -UseBasicParsing `
        -TimeoutSec 5 `
        -ErrorAction Stop
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend is running on port 8080" -ForegroundColor Green
        Write-Host "   Response: $($response.Content)" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend returned status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Backend health check failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Frontend Running
Write-Host "2️⃣  Testing Frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" `
        -UseBasicParsing `
        -TimeoutSec 5 `
        -ErrorAction Stop
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Frontend is running on port 3000" -ForegroundColor Green
    } else {
        Write-Host "❌ Frontend returned status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Frontend check failed: $_" -ForegroundColor Red
}

Write-Host ""

# Test 3: Login API
Write-Host "3️⃣  Testing Login API..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "superadmin@hms.local"
        password = "Password@123"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://localhost:8080/auth/login" `
        -UseBasicParsing `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Login API is working" -ForegroundColor Green
        $data = $response.Content | ConvertFrom-Json
        Write-Host "   Response: $($data | ConvertTo-Json -Depth 3)" -ForegroundColor Green
    } else {
        Write-Host "❌ Login returned status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Login API failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ Test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open http://localhost:3000 in browser" -ForegroundColor White
Write-Host "2. Enter credentials:" -ForegroundColor White
Write-Host "   Email: superadmin@hms.local" -ForegroundColor White
Write-Host "   Password: Password@123" -ForegroundColor White
Write-Host "3. Click Sign In button" -ForegroundColor White
