$ContainerName = "hms-postgres-integration-test-run"
$Port = 5433
$DbName = "hms_integration_test"
$DbUser = "hms_super"
$DbPass = "supersecret"
$TestUser = "hms_api_test"
$TestPass = "testpass"

if (docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$ContainerName$") {
    docker rm -f $ContainerName | Out-Null
}

$pidInUse = (netstat -ano | findstr :$Port | Select-String -Pattern '\s+(\d+)$' | ForEach-Object { $_.Matches.Groups[1].Value } | Select-Object -First 1)
if ($pidInUse) {
    throw "Port $Port is already in use by PID $pidInUse. Aborting."
}

try {
    Write-Host "Starting disposable PostgreSQL container..."
    $TestDir = (Resolve-Path "scratch").Path + "\test_migrations_integration"
    if (Test-Path $TestDir) { Remove-Item -Recurse -Force $TestDir }
    New-Item -ItemType Directory -Force -Path $TestDir | Out-Null
    Copy-Item "DATABASE\migrations\*.sql" -Destination $TestDir
    Copy-Item "scratch\proposed_patch\004_people.sql" -Destination $TestDir -Force
    Copy-Item "scratch\proposed_patch\005_movement.sql" -Destination $TestDir -Force
    Copy-Item "scratch\proposed_patch\008_communication.sql" -Destination $TestDir -Force
    Copy-Item "scratch\proposed_patch\009_meals_resources.sql" -Destination $TestDir -Force
    Copy-Item "scratch\proposed_patch\900_security.sql" -Destination $TestDir -Force
    Copy-Item "scratch\proposed_patch\901_indexes.sql" -Destination $TestDir -Force
    Copy-Item "scratch\proposed_patch\903_seed.sql" -Destination $TestDir -Force

    docker run -d --name $ContainerName `
        -p "127.0.0.1:$($Port):5432" `
        -e POSTGRES_USER=$DbUser `
        -e POSTGRES_PASSWORD=$DbPass `
        -e POSTGRES_DB=$DbName `
        -v "$TestDir`:/docker-entrypoint-initdb.d:ro" `
        postgres:15-alpine | Out-Null

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
        docker logs $ContainerName
        throw "PostgreSQL failed to initialize within 30 seconds."
    }

    Start-Sleep -Seconds 3 # Extra buffer 

    Write-Host "Creating test role..."
    $createRoleSql = @"
CREATE ROLE $TestUser WITH LOGIN PASSWORD '$TestPass' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA platform TO $TestUser;
GRANT USAGE ON SCHEMA app TO $TestUser;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO $TestUser;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO $TestUser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO $TestUser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO $TestUser;
"@
    $createRoleSql | docker exec -i $ContainerName psql -U $DbUser -d $DbName

    Write-Host "Verifying database integrity and test role..."
    $TestDbUrl = "postgres://$TestUser`:$TestPass@127.0.0.1:$Port/$DbName"
    
    $checkSql = @"
SELECT 
    current_database() as db,
    current_user as usr,
    rolsuper,
    rolbypassrls 
FROM pg_roles 
WHERE rolname = current_user;
"@
    $checkResult = docker exec -i $ContainerName psql -U $TestUser -d $DbName -t -c $checkSql | Out-String
    Write-Host "Role Check Result: $checkResult"
    
    if ($checkResult -notmatch "$DbName") { throw "Wrong database connected." }
    if ($checkResult -notmatch "$TestUser") { throw "Wrong user connected." }
    if ($checkResult -match "t.*t" -or $checkResult -match "true.*true") { throw "Test role has superuser or bypassrls!" }

    Write-Host "Running integration tests..."
    $env:TEST_DATABASE_URL = $TestDbUrl
    
    Write-Host "--- Testing Repository ---"
    go test -count=1 -v ./API/internal/repository
    
    Write-Host "--- Testing Service ---"
    go test -count=1 -v ./API/internal/service

    Write-Host "--- Full Validation Suite ---"
    go fmt ./...
    go test -count=1 ./...
    go vet ./...
    go build ./...
    
} catch {
    Write-Host "ERROR:" $_
    docker logs $ContainerName
} finally {
    Write-Host "Cleaning up disposable container..."
    $env:TEST_DATABASE_URL = $null
    docker rm -f $ContainerName | Out-Null
}

