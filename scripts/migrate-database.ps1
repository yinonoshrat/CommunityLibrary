#!/usr/bin/env pwsh
# Database Migration Helper Script
# Helps apply migrations to the correct environment

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'dev',
    
    [Parameter(Mandatory=$false)]
    [string]$MigrationFile
)

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  Database Migration Helper" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Determine which environment
$envDisplay = if ($Environment -eq 'dev') { "DEVELOPMENT" } else { "PRODUCTION" }
$color = if ($Environment -eq 'dev') { "Green" } else { "Red" }

Write-Host "Target Environment: $envDisplay" -ForegroundColor $color
Write-Host ""

# Load appropriate environment file
$envFile = if ($Environment -eq 'dev') { ".env.development.local" } else { ".env.production.local" }

if (-not (Test-Path $envFile)) {
    Write-Host "❌ Error: Environment file not found: $envFile" -ForegroundColor Red
    if ($Environment -eq 'prod') {
        Write-Host "   Create .env.production.local with production database credentials" -ForegroundColor Yellow
    }
    exit 1
}

# Load environment variables
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim('"')
        $value = $matches[2].Trim('"')
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

$dbUrl = $env:SUPABASE_URL
if (-not $dbUrl) {
    Write-Host "❌ Error: SUPABASE_URL not found in $envFile" -ForegroundColor Red
    exit 1
}

$dbIdentifier = ($dbUrl -split '//')[1] -split '\.' | Select-Object -First 1
Write-Host "📊 Database: $dbIdentifier" -ForegroundColor Cyan
Write-Host ""

# Confirm before proceeding
if ($Environment -eq 'prod') {
    Write-Host "⚠️  WARNING: You are about to modify the PRODUCTION database!" -ForegroundColor Red
    Write-Host "   This will affect real user data!" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "Type 'CONFIRM' to proceed"
    if ($confirm -ne 'CONFIRM') {
        Write-Host "❌ Migration cancelled" -ForegroundColor Yellow
        exit 0
    }
}

# List available migrations
Write-Host "📁 Available migrations:" -ForegroundColor Cyan
$migrations = Get-ChildItem -Path "database\migrations" -Filter "*.sql" | Sort-Object Name

if ($migrations.Count -eq 0) {
    Write-Host "   No migration files found in database/migrations/" -ForegroundColor Yellow
    exit 0
}

$i = 1
foreach ($migration in $migrations) {
    Write-Host "   $i. $($migration.Name)" -ForegroundColor Gray
    $i++
}
Write-Host ""

# If migration file not specified, prompt
if (-not $MigrationFile) {
    $selection = Read-Host "Select migration number (or 'all' to run all)"
    
    if ($selection -eq 'all') {
        $filesToRun = $migrations
    } else {
        $index = [int]$selection - 1
        if ($index -lt 0 -or $index -ge $migrations.Count) {
            Write-Host "❌ Invalid selection" -ForegroundColor Red
            exit 1
        }
        $filesToRun = @($migrations[$index])
    }
} else {
    $filesToRun = @(Get-Item "database\migrations\$MigrationFile")
}

Write-Host ""
Write-Host "🚀 Running migrations..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $filesToRun) {
    Write-Host "   Applying: $($file.Name)" -ForegroundColor Yellow
    
    # Read SQL content
    $sql = Get-Content $file.FullName -Raw
    
    Write-Host "   SQL Preview (first 200 chars):" -ForegroundColor Gray
    Write-Host "   $($sql.Substring(0, [Math]::Min(200, $sql.Length)))..." -ForegroundColor Gray
    Write-Host ""
    
    if ($Environment -eq 'prod') {
        $confirm = Read-Host "   Apply this migration? (y/n)"
        if ($confirm -ne 'y') {
            Write-Host "   ⏭️  Skipped" -ForegroundColor Yellow
            continue
        }
    }
    
    Write-Host "   ℹ️  Please apply this migration manually in Supabase SQL Editor:" -ForegroundColor Cyan
    Write-Host "   1. Go to: $dbUrl" -ForegroundColor Gray
    Write-Host "   2. Navigate to: SQL Editor" -ForegroundColor Gray
    Write-Host "   3. Paste the SQL from: $($file.FullName)" -ForegroundColor Gray
    Write-Host "   4. Execute the query" -ForegroundColor Gray
    Write-Host ""
    
    $done = Read-Host "   Press Enter when migration is applied (or 's' to skip)"
    if ($done -eq 's') {
        Write-Host "   ⏭️  Skipped" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ Marked as applied" -ForegroundColor Green
    }
    Write-Host ""
}

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "✅ Migration process complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Verify migrations in Supabase dashboard" -ForegroundColor Gray
Write-Host "   2. Test the application: npm start" -ForegroundColor Gray
Write-Host "   3. Check health endpoint for correct environment" -ForegroundColor Gray
Write-Host "==================================================================" -ForegroundColor Cyan
