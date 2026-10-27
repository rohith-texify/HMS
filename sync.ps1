# HMS Automatic Git Sync Script
# Usage:
#   .\sync.ps1               - Runs a single sync (add, commit, pull rebase, push)
#   .\sync.ps1 -Watch        - Watches repository for changes and auto-syncs every N seconds
param (
    [switch]$Watch,
    [int]$IntervalSeconds = 60
)

function Sync-GitRepository {
    Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Checking git status..." -ForegroundColor Cyan

    $status = git status --porcelain
    if ($status) {
        Write-Host "Changes detected. Staging and committing..." -ForegroundColor Yellow
        git add .
        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        git commit -m "auto-sync: $timestamp"
    } else {
        Write-Host "Working tree clean, no local changes to commit." -ForegroundColor DarkGray
    }

    Write-Host "Syncing with remote repository (origin main)..." -ForegroundColor Cyan
    git pull origin main --rebase
    git push origin main

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Git sync complete successfully!" -ForegroundColor Green
    } else {
        Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Git sync encountered an error (exit code $LASTEXITCODE)." -ForegroundColor Red
    }
}

if ($Watch) {
    Write-Host "Starting HMS Auto-Sync in watch mode (interval: $IntervalSeconds seconds). Press Ctrl+C to stop." -ForegroundColor Green
    while ($true) {
        Sync-GitRepository
        Start-Sleep -Seconds $IntervalSeconds
    }
} else {
    Sync-GitRepository
}
