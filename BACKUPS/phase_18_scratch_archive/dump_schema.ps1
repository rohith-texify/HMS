$envPath = "D:\HMS\.env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^(DB_.*)=(.*)") {
            Set-Variable -Name $Matches[1] -Value $Matches[2]
        }
    }
}

$outFile = "D:\HMS\scratch\recovered_movement_schema.sql"

Write-Host "Running pg_dump via Docker..."
docker run --rm -e PGPASSWORD=$DB_PASSWORD postgres:alpine pg_dump -h host.docker.internal -p $DB_PORT -U $DB_USER -d $DB_NAME -s -t "app.attendance_cards" -t "app.attendance_records" -t "app.entry_exit_records" -t "app.record_corrections" > $outFile

Write-Host "pg_dump completed. Output saved to $outFile"
