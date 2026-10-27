$ContainerName = "hms_migration_test_container"
$Port = 5434
$DbName = "hms_test_db"
$DbUser = "hms_test_user"
$DbPass = "hms_test_pass"
$TestDir = (Resolve-Path "scratch").Path + "\test_migrations"

# A. PREFLIGHT
Write-Host "--- Preflight ---"
if (Test-Path $TestDir) { Remove-Item -Recurse -Force $TestDir }
New-Item -ItemType Directory -Force -Path $TestDir | Out-Null

Copy-Item "DATABASE\migrations\*.sql" -Destination $TestDir
Copy-Item "scratch\proposed_patch\004_people.sql" -Destination $TestDir -Force
Copy-Item "scratch\proposed_patch\005_movement.sql" -Destination $TestDir -Force
Copy-Item "scratch\proposed_patch\008_communication.sql" -Destination $TestDir -Force
Copy-Item "scratch\proposed_patch\009_meals_resources.sql" -Destination $TestDir -Force
Copy-Item "scratch\proposed_patch\901_indexes.sql" -Destination $TestDir -Force
Copy-Item "scratch\proposed_patch\900_security.sql" -Destination $TestDir -Force
Copy-Item "scratch\proposed_patch\903_seed.sql" -Destination $TestDir -Force
Copy-Item "scratch\test_rls.sql" -Destination $TestDir -Force

$files = Get-ChildItem $TestDir -Filter "*.sql" | Sort-Object Name
Write-Host "Migration files prepared:"
$files | ForEach-Object { Write-Host $_.Name }

# B. START ISOLATED DB
Write-Host "--- Starting Container ---"
if (docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$ContainerName$") {
    docker rm -f $ContainerName | Out-Null
}

$pidInUse = (netstat -ano | findstr :$Port | Select-String -Pattern '\s+(\d+)$' | ForEach-Object { $_.Matches.Groups[1].Value } | Select-Object -First 1)
if ($pidInUse) { throw "Port $Port is already in use by PID $pidInUse. Aborting." }

docker run -d --name $ContainerName `
    -p "127.0.0.1:$($Port):5432" `
    -e POSTGRES_USER=$DbUser `
    -e POSTGRES_PASSWORD=$DbPass `
    -e POSTGRES_DB=$DbName `
    -v "$TestDir`:/docker-entrypoint-initdb.d:ro" `
    postgres:alpine | Out-Null

Write-Host "Waiting for PostgreSQL initialization (max 30s)..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $logs = docker logs $ContainerName 2>&1 | Out-String
    if ($logs -match "database system is ready to accept connections" -and $logs -match "PostgreSQL init process complete") {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}

if (!$ready) {
    Write-Host "FAILED TO INITIALIZE"
    docker logs $ContainerName
    docker rm -f $ContainerName | Out-Null
    exit 1
}

Start-Sleep -Seconds 3

# C. VALIDATION
Write-Host "--- Running Validate.sql ---"
Get-Content DATABASE\validate.sql | docker exec -i $ContainerName psql -U $DbUser -d $DbName

Write-Host "--- Inspecting Catalog ---"
$catalogSql = @"
SELECT tablename, rowsecurity, forcerowsecurity 
FROM pg_tables 
WHERE schemaname = 'app' 
  AND tablename IN ('attendance_cards', 'attendance_records', 'entry_exit_records', 'record_corrections');

SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'app' 
  AND tablename IN ('attendance_cards', 'attendance_records', 'entry_exit_records', 'record_corrections');
"@
$catalogSql | docker exec -i $ContainerName psql -U $DbUser -d $DbName

# D. CLEANUP
Write-Host "--- Cleanup ---"
docker rm -f $ContainerName | Out-Null
Remove-Item -Recurse -Force $TestDir
Write-Host "Cleanup completed successfully."

