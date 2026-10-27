$ErrorActionPreference = "Stop"

$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/auth/login" -ContentType "application/json" -Body '{"email":"college.admin@hms.local","password":"HMS@Dev123"}'
$token = $login.data.access_token
$headers = @{ Authorization = "Bearer $token" }
$hostelId = "bad5f050-858f-4e56-8dc3-c10a4d88c20b"

$rand = (Get-Random -Minimum 10000 -Maximum 99999).ToString()
Write-Host "1. Creating Block..."
$bodyBlock = @{ code = "B1-$rand"; name = "Block 1 $rand"; description = "Main Block" } | ConvertTo-Json
$resBlock = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/college/hostels/$hostelId/blocks" -Headers $headers -ContentType "application/json" -Body $bodyBlock
$blockId = $resBlock.data.id
Write-Host "Created Block: $blockId"

Write-Host "2. Creating Floor..."
$bodyFloor = @{ code = "F1-$rand"; name = "First Floor $rand"; floor_number = 1 } | ConvertTo-Json
$resFloor = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/college/hostels/$hostelId/blocks/$blockId/floors" -Headers $headers -ContentType "application/json" -Body $bodyFloor
$floorId = $resFloor.data.id
Write-Host "Created Floor: $floorId"

Write-Host "3. Creating Room..."
$bodyRoom = @{ code = "101-$rand"; name = "Room 101 $rand"; room_type = "DOUBLE"; capacity = 2 } | ConvertTo-Json
$resRoom = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/college/hostels/$hostelId/blocks/$blockId/floors/$floorId/rooms" -Headers $headers -ContentType "application/json" -Body $bodyRoom
$roomId = $resRoom.data.id
Write-Host "Created Room: $roomId"

Write-Host "4. Creating Bed..."
$bodyBed = @{ code = "101-A-$rand"; name = "Bed A $rand" } | ConvertTo-Json
$resBed = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/college/hostels/$hostelId/blocks/$blockId/floors/$floorId/rooms/$roomId/beds" -Headers $headers -ContentType "application/json" -Body $bodyBed
$bedId = $resBed.data.id
Write-Host "Created Bed: $bedId"

Write-Host "5. Getting Bed..."
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/college/hostels/$hostelId/blocks/$blockId/floors/$floorId/rooms/$roomId/beds/$bedId" -Headers $headers | ConvertTo-Json -Depth 10

Write-Host "SUCCESS: Hostel operations runtime tests passed."
