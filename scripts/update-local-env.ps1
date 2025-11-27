#!/usr/bin/env pwsh
# Script to update local development environment to use dev database
# Run this after creating the dev Supabase project

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  Local Development Environment Update Script" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$envFile = ".env.development.local"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ Error: $envFile not found!" -ForegroundColor Red
    Write-Host "   Please ensure you're in the project root directory." -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Current environment file: $envFile" -ForegroundColor Green
Write-Host ""

# Prompt for dev database credentials
Write-Host "Please provide the Development Supabase credentials:" -ForegroundColor Yellow
Write-Host "(You can find these in your Supabase dashboard → Settings → API)" -ForegroundColor Gray
Write-Host ""

$devSupabaseUrl = Read-Host "Dev SUPABASE_URL (e.g., https://xxxxx.supabase.co)"
$devAnonKey = Read-Host "Dev SUPABASE_ANON_KEY"
$devServiceKey = Read-Host "Dev SUPABASE_SERVICE_ROLE_KEY"
$devPostgresUrl = Read-Host "Dev POSTGRES_URL (with pooler)"
$devPostgresUrlNonPooling = Read-Host "Dev POSTGRES_URL_NON_POOLING (direct)"

Write-Host ""
Write-Host "📝 Updating $envFile..." -ForegroundColor Cyan

# Read current content
$content = Get-Content $envFile -Raw

# Replace production URLs with dev URLs
$content = $content -replace 'SUPABASE_URL="[^"]*"', "SUPABASE_URL=`"$devSupabaseUrl`""
$content = $content -replace 'SUPABASE_ANON_KEY="[^"]*"', "SUPABASE_ANON_KEY=`"$devAnonKey`""
$content = $content -replace 'SUPABASE_SERVICE_ROLE_KEY="[^"]*"', "SUPABASE_SERVICE_ROLE_KEY=`"$devServiceKey`""
$content = $content -replace 'POSTGRES_URL="[^"]*"', "POSTGRES_URL=`"$devPostgresUrl`""
$content = $content -replace 'POSTGRES_URL_NON_POOLING="[^"]*"', "POSTGRES_URL_NON_POOLING=`"$devPostgresUrlNonPooling`""

# Add environment identifier if not present
if ($content -notmatch 'ENVIRONMENT=') {
    $content += "`nENVIRONMENT=development`n"
}
if ($content -notmatch 'NODE_ENV=') {
    $content += "NODE_ENV=development`n"
}

# Write updated content
$content | Set-Content $envFile -NoNewline

Write-Host "✅ Environment file updated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Verification:" -ForegroundColor Cyan
Write-Host "   Database URL: $devSupabaseUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Verify the connection: npm start" -ForegroundColor Gray
Write-Host "   2. Check health endpoint: curl http://localhost:3001/api/health" -ForegroundColor Gray
Write-Host "   3. Expected environment: development" -ForegroundColor Gray
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
