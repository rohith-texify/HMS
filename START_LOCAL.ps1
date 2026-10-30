# ============================================================================
# HMS LOCAL DEVELOPMENT STARTUP SCRIPT
# ============================================================================
# This script starts the complete HMS system locally:
# - Backend API (Go) on http://localhost:8080
# - Super Admin Frontend (React) on http://localhost:3000
# - Uses Neon PostgreSQL (remote database)

param(
    [string]$DatabaseUrl = $null
)

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "HMS - Hostel Management System - LOCAL STARTUP" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Colors for output
$successColor = "Green"
$errorColor = "Red"
$warningColor = "Yellow"
$infoColor = "Cyan"

# ============================================================================
# STEP 1: Validate Prerequisites
# ============================================================================
Write-Host "[1/6] CHECKING PREREQUISITES..." -ForegroundColor $infoColor
Write-Host ""

$checks = @{
    "Node.js" = { node --version }
    "npm" = { npm --version }
    "Go" = { go version }
    "Git" = { git --version }
}

$allOK = $true
foreach ($name in $checks.Keys) {
    try {
        $result = & $checks[$name] 2>$null
        Write-Host "✓ $name installed: $($result.Split([System.Environment]::NewLine)[0])" -ForegroundColor $successColor
    }
    catch {
        Write-Host "✗ $name NOT found" -ForegroundColor $errorColor
        $allOK = $false
    }
}

if (-not $allOK) {
    Write-Host ""
    Write-Host "❌ Some prerequisites are missing. Please install them first." -ForegroundColor $errorColor
    exit 1
}

Write-Host ""
Write-Host "✓ All prerequisites installed" -ForegroundColor $successColor
Write-Host ""

# ============================================================================
# STEP 2: Check .env file
# ============================================================================
Write-Host "[2/6] CHECKING ENVIRONMENT CONFIGURATION..." -ForegroundColor $infoColor
Write-Host ""

$envFile = "d:\HMS\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found at $envFile" -ForegroundColor $errorColor
    Write-Host "Please run: Copy-Item '.env.example' '.env'" -ForegroundColor $warningColor
    exit 1
}

# Read .env and check for DATABASE_URL
$envContent = Get-Content $envFile
$hasDbUrl = $envContent | Where-Object { $_ -match "^DATABASE_URL=" }

if (-not $hasDbUrl) {
    Write-Host "⚠️  DATABASE_URL not set in .env" -ForegroundColor $warningColor
    Write-Host "Please add your Neon database URL to .env:" -ForegroundColor $warningColor
    Write-Host "  DATABASE_URL=postgresql://user:pass@host/database" -ForegroundColor $warningColor
    Write-Host ""
    Write-Host "For now, using fallback local connection..." -ForegroundColor $infoColor
} else {
    Write-Host "✓ DATABASE_URL configured" -ForegroundColor $successColor
}

Write-Host ""

# ============================================================================
# STEP 3: Build Backend
# ============================================================================
Write-Host "[3/6] BUILDING BACKEND API..." -ForegroundColor $infoColor
Write-Host ""

try {
    Set-Location d:\HMS\API\cmd\server
    Write-Host "Building Go binary..." -ForegroundColor $infoColor
    & go build -o server.exe main.go
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Write-Host "✓ Backend built successfully" -ForegroundColor $successColor
    Set-Location d:\HMS
} catch {
    Write-Host "❌ Failed to build backend: $_" -ForegroundColor $errorColor
    exit 1
}

Write-Host ""

# ============================================================================
# STEP 4: Start Backend Server
# ============================================================================
Write-Host "[4/6] STARTING BACKEND API SERVER..." -ForegroundColor $infoColor
Write-Host ""

try {
    # Start backend in background
    $backendProcess = Start-Process -FilePath "d:\HMS\API\cmd\server\server.exe" `
        -WorkingDirectory "d:\HMS" `
        -NoNewWindow `
        -PassThru `
        -RedirectStandardOutput "d:\HMS\backend.log" `
        -RedirectStandardError "d:\HMS\backend-error.log"
    
    Write-Host "✓ Backend server started (PID: $($backendProcess.Id))" -ForegroundColor $successColor
    Write-Host "  API will be available at http://localhost:8080" -ForegroundColor $infoColor
    Write-Host "  Logs: d:\HMS\backend.log" -ForegroundColor $infoColor
    
    # Wait for backend to be ready
    Write-Host ""
    Write-Host "Waiting for backend to initialize..." -ForegroundColor $infoColor
    Start-Sleep -Seconds 3
    
    # Test if backend is responding
    try {
        $healthCheck = Invoke-WebRequest -Uri "http://localhost:8080/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($healthCheck.StatusCode -eq 200) {
            Write-Host "✓ Backend is healthy and responding" -ForegroundColor $successColor
        }
    } catch {
        Write-Host "⚠️  Backend started but health check failed - it may still be initializing" -ForegroundColor $warningColor
    }
    
} catch {
    Write-Host "❌ Failed to start backend: $_" -ForegroundColor $errorColor
    exit 1
}

Write-Host ""

# ============================================================================
# STEP 5: Install Frontend Dependencies & Start
# ============================================================================
Write-Host "[5/6] STARTING SUPER-ADMIN FRONTEND..." -ForegroundColor $infoColor
Write-Host ""

try {
    $frontendPath = "d:\HMS\MODULES\SUPER-ADMIN\FRONTEND\WEB"
    
    if (-not (Test-Path "$frontendPath\node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor $infoColor
        Set-Location $frontendPath
        & npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed"
        }
        Write-Host "✓ Dependencies installed" -ForegroundColor $successColor
    } else {
        Write-Host "✓ Dependencies already installed" -ForegroundColor $successColor
    }
    
    Write-Host ""
    Write-Host "Starting development server..." -ForegroundColor $infoColor
    
    # Start frontend in new window so user can see it
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c cd `"$frontendPath`" && npm run dev" `
        -WindowStyle Normal
    
    Write-Host "✓ Frontend development server started" -ForegroundColor $successColor
    Write-Host "  Frontend will open at http://localhost:3000" -ForegroundColor $infoColor
    
    Set-Location d:\HMS
    
} catch {
    Write-Host "❌ Failed to start frontend: $_" -ForegroundColor $errorColor
    exit 1
}

Write-Host ""

# ============================================================================
# STEP 6: Display Summary
# ============================================================================
Write-Host "[6/6] STARTUP COMPLETE" -ForegroundColor $infoColor
Write-Host ""
Write-Host "============================================================================" -ForegroundColor $successColor
Write-Host "HMS IS NOW RUNNING LOCALLY" -ForegroundColor $successColor
Write-Host "============================================================================" -ForegroundColor $successColor
Write-Host ""
Write-Host "BACKEND API:" -ForegroundColor $infoColor
Write-Host "  URL: http://localhost:8080" -ForegroundColor $successColor
Write-Host "  Health: http://localhost:8080/health" -ForegroundColor $successColor
Write-Host "  Logs: d:\HMS\backend.log" -ForegroundColor $infoColor
Write-Host ""
Write-Host "SUPER-ADMIN FRONTEND:" -ForegroundColor $infoColor
Write-Host "  URL: http://localhost:3000" -ForegroundColor $successColor
Write-Host "  Login with: superadmin@hms.local / Password@123" -ForegroundColor $successColor
Write-Host ""
Write-Host "DATABASE:" -ForegroundColor $infoColor
if ($hasDbUrl) {
    Write-Host "  Using: Neon DB (from DATABASE_URL)" -ForegroundColor $successColor
} else {
    Write-Host "  Using: Local/Remote as configured in .env" -ForegroundColor $warningColor
}
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor $infoColor
Write-Host "1. Open http://localhost:3000 in your browser" -ForegroundColor $infoColor
Write-Host "2. Login with test credentials above" -ForegroundColor $infoColor
Write-Host "3. Navigate the Super Admin dashboard" -ForegroundColor $infoColor
Write-Host ""
Write-Host "STOPPING THE SYSTEM:" -ForegroundColor $infoColor
Write-Host "1. Close the frontend window (npm dev)" -ForegroundColor $infoColor
Write-Host "2. Stop-Process -Id $($backendProcess.Id) (to stop backend)" -ForegroundColor $infoColor
Write-Host ""
Write-Host "============================================================================" -ForegroundColor $successColor
Write-Host ""

# Keep script running to show information
Write-Host "Press Ctrl+C to stop the backend and close this window" -ForegroundColor $warningColor
Write-Host ""

# Wait indefinitely to keep backend running
while ($true) {
    Start-Sleep -Seconds 10
    
    # Check if backend is still running
    if (-not (Get-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "⚠️  Backend process has stopped" -ForegroundColor $warningColor
        break
    }
}
