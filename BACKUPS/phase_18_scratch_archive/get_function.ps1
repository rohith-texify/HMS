$envPath = "D:\HMS\.env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^(DB_.*)=(.*)") {
            Set-Variable -Name $Matches[1] -Value $Matches[2]
        }
    }
}

$query = "SELECT prosrc FROM pg_proc WHERE proname = 'validate_movement_tenant_consistency';"
docker run --rm -e PGPASSWORD=$DB_PASSWORD postgres:alpine psql -h host.docker.internal -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $query
