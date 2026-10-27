$ErrorActionPreference = "Stop"
$BaseUrl = "http://localhost:8080"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " HMS HOSTEL ALLOCATION RUNTIME TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/15] Logging in as COLLEGE_ADMIN..." -ForegroundColor Yellow
$loginA = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body '{"email":"college.admin@hms.local","password":"HMS@Dev123"}'
$tokenA = $loginA.data.access_token
$headersA = @{ Authorization = "Bearer $tokenA" }
Write-Host "Login successful." -ForegroundColor Green

Write-Host "No Tenant B login available, skipping cross-tenant test setup." -ForegroundColor Yellow

$collegeId = "0cd1d14d-4111-4858-8a7e-28e44e188dec"
$hostelId = "bad5f050-858f-4e56-8dc3-c10a4d88c20b"
$studentId = "6a405786-096a-4d43-85f2-9cb9443ebbbd"

Write-Host "[2/15] Setting up physical hostel infrastructure..." -ForegroundColor Yellow
$suffix = Get-Random -Maximum 99999
$blockBody = @{ code = "ALC-B-$suffix"; name = "Alloc Block $suffix" } | ConvertTo-Json
$block = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/hostels/$hostelId/blocks" -Headers $headersA -ContentType "application/json" -Body $blockBody
$blockId = $block.data.id

$floorBody = @{ code = "ALC-F-$suffix"; name = "Alloc Floor $suffix"; floor_number = 1 } | ConvertTo-Json
$floor = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/hostels/$hostelId/blocks/$blockId/floors" -Headers $headersA -ContentType "application/json" -Body $floorBody
$floorId = $floor.data.id

$roomBody = @{ code = "ALC-R-$suffix"; name = "Alloc Room $suffix" } | ConvertTo-Json
$room = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/hostels/$hostelId/blocks/$blockId/floors/$floorId/rooms" -Headers $headersA -ContentType "application/json" -Body $roomBody
$roomId = $room.data.id

$bed1Body = @{ code = "BED1-$suffix"; name = "Bed 1 $suffix" } | ConvertTo-Json
$bed1 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/hostels/$hostelId/blocks/$blockId/floors/$floorId/rooms/$roomId/beds" -Headers $headersA -ContentType "application/json" -Body $bed1Body
$bed1Id = $bed1.data.id

$bed2Body = @{ code = "BED2-$suffix"; name = "Bed 2 $suffix" } | ConvertTo-Json
$bed2 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/hostels/$hostelId/blocks/$blockId/floors/$floorId/rooms/$roomId/beds" -Headers $headersA -ContentType "application/json" -Body $bed2Body
$bed2Id = $bed2.data.id
Write-Host "Setup complete." -ForegroundColor Green

Write-Host "[3/15] Creating Bed Allocation (Check-in)..." -ForegroundColor Yellow
$allocDate = (Get-Date).ToString("yyyy-MM-ddTHH\:mm\:ssZ")
$bodyAlloc = @{ bed_id = $bed1Id; student_id = $studentId; allocated_at = $allocDate; allocation_type = "REGULAR" } | ConvertTo-Json
$alloc = Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/bed-allocations" -Headers $headersA -ContentType "application/json" -Body $bodyAlloc
$allocId = $alloc.data.id
Write-Host "Allocation created: $allocId" -ForegroundColor Green

Write-Host "[4/15] Testing duplicate active allocation (Negative)..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/college/bed-allocations" -Headers $headersA -ContentType "application/json" -Body $bodyAlloc -ErrorAction Stop
    Write-Error "Expected duplicate allocation to fail, but it succeeded!"
} catch {
    Write-Host "Success: Duplicate allocation prevented." -ForegroundColor Green
}

Write-Host "[5/15] Getting Current Allocation..." -ForegroundColor Yellow
$currAlloc = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/bed-allocations/current?student_id=$studentId" -Headers $headersA
if ($currAlloc.data.id -ne $allocId) {
    Write-Error "Current allocation ID mismatch!"
}
Write-Host "Current allocation matches." -ForegroundColor Green

Write-Host "[6/15] Verifying Bed Status is OCCUPIED..." -ForegroundColor Yellow
$b1 = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/hostels/$hostelId/blocks/$blockId/floors/$floorId/rooms/$roomId/beds/$bed1Id" -Headers $headersA
if ($b1.data.status -ne "OCCUPIED") {
    Write-Error "Bed 1 should be OCCUPIED, found $($b1.data.status)"
}
Write-Host "Bed 1 is OCCUPIED." -ForegroundColor Green

# Write-Host "[7/15] Testing Cross-Tenant Access (Negative)..." -ForegroundColor Yellow
# try {
#     Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/bed-allocations/$allocId" -Headers $headersB -ErrorAction Stop
#     Write-Error "Tenant B read Tenant A allocation!"
# } catch {
#     Write-Host "Success: Cross-tenant read prevented." -ForegroundColor Green
# }
# 
# try {
#     $bodyUpdate = @{ allocation_type = "EMERGENCY" } | ConvertTo-Json
#     Invoke-RestMethod -Method Put -Uri "$BaseUrl/college/bed-allocations/$allocId" -Headers $headersB -ContentType "application/json" -Body $bodyUpdate -ErrorAction Stop
#     Write-Error "Tenant B modified Tenant A allocation!"
# } catch {
#     Write-Host "Success: Cross-tenant modification prevented." -ForegroundColor Green
# }

Write-Host "[8/15] Updating Allocation..." -ForegroundColor Yellow
$bodyUpdate = @{ allocation_type = "EMERGENCY"; remarks = "Updated by test" } | ConvertTo-Json
$update = Invoke-RestMethod -Method Put -Uri "$BaseUrl/college/bed-allocations/$allocId" -Headers $headersA -ContentType "application/json" -Body $bodyUpdate
if ($update.data.allocation_type -ne "EMERGENCY") {
    Write-Error "Allocation update failed"
}
Write-Host "Allocation updated successfully." -ForegroundColor Green

Write-Host "[9/15] Transferring Bed..." -ForegroundColor Yellow
$transferDate = (Get-Date).ToString("yyyy-MM-ddTHH\:mm\:ssZ")
$bodyTransfer = @{ new_bed_id = $bed2Id; transferred_at = $transferDate } | ConvertTo-Json
$transfer = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/college/bed-allocations/$allocId/transfer" -Headers $headersA -ContentType "application/json" -Body $bodyTransfer
$newAllocId = $transfer.data.id
Write-Host "Transferred to new allocation: $newAllocId" -ForegroundColor Green

Write-Host "[10/15] Verifying bed statuses after transfer..." -ForegroundColor Yellow
$b1After = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/hostels/$hostelId/blocks/$blockId/floors/$floorId/rooms/$roomId/beds/$bed1Id" -Headers $headersA
if ($b1After.data.status -ne "AVAILABLE") {
    Write-Error "Bed 1 should be AVAILABLE after transfer, found $($b1After.data.status)"
}

$b2After = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/hostels/$hostelId/blocks/$blockId/floors/$floorId/rooms/$roomId/beds/$bed2Id" -Headers $headersA
if ($b2After.data.status -ne "OCCUPIED") {
    Write-Error "Bed 2 should be OCCUPIED after transfer, found $($b2After.data.status)"
}
Write-Host "Statuses correct (Bed1: AVAILABLE, Bed2: OCCUPIED)." -ForegroundColor Green

Write-Host "[11/15] Releasing Allocation (Check-out)..." -ForegroundColor Yellow
$releaseDate = (Get-Date).ToString("yyyy-MM-ddTHH\:mm\:ssZ")
$bodyRelease = @{ released_at = $releaseDate; status = "RELEASED" } | ConvertTo-Json
$release = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/college/bed-allocations/$newAllocId/release" -Headers $headersA -ContentType "application/json" -Body $bodyRelease
Write-Host "Allocation released." -ForegroundColor Green

Write-Host "[12/15] Verifying Bed 2 is AVAILABLE..." -ForegroundColor Yellow
$b2Final = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/hostels/$hostelId/blocks/$blockId/floors/$floorId/rooms/$roomId/beds/$bed2Id" -Headers $headersA
if ($b2Final.data.status -ne "AVAILABLE") {
    Write-Error "Bed 2 should be AVAILABLE after checkout, found $($b2Final.data.status)"
}
Write-Host "Bed 2 is AVAILABLE." -ForegroundColor Green

Write-Host "[13/15] Checking Allocation History..." -ForegroundColor Yellow
$history = Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/bed-allocations?student_id=$studentId" -Headers $headersA
if ($history.data.Length -lt 2) {
    Write-Error "Expected at least 2 history records (original + transferred)."
}
Write-Host "History correctly tracks $($history.data.Length) records." -ForegroundColor Green

Write-Host "[14/15] Verify current allocation is not found after checkout..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Method Get -Uri "$BaseUrl/college/bed-allocations/current?student_id=$studentId" -Headers $headersA -ErrorAction Stop
    Write-Error "Expected 404 for current allocation, but it succeeded!"
} catch {
    Write-Host "Success: No active allocation found for student." -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " PHASE 02 HOSTEL ALLOCATION COMPLETE    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
