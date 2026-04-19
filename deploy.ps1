# HomelabInfo Deployment Script
# This script automatically detects the version from the backend project file
# and builds/pushes Docker images for both the main app and the agent.

# 1. Detect Version
$csprojPath = "backend/HomeLabInfo.Api.csproj"
if (-Not (Test-Path $csprojPath)) {
    Write-Host "Error: Could not find $csprojPath. Please run this script from the repository root." -ForegroundColor Red
    exit 1
}

[xml]$csproj = Get-Content $csprojPath
$version = $csproj.Project.PropertyGroup.Version

if (-Not $version) {
    Write-Host "Error: Could not find <Version> tag in $csprojPath" -ForegroundColor Red
    exit 1
}

Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host "Detected Version: $version" -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor Cyan

# 2. Build and Push Main App
Write-Host "[1/2] Building and pushing main app image..." -ForegroundColor Yellow
docker buildx build --platform linux/amd64,linux/arm64 `
    -t gfountopoulos/homelabinfo:$version `
    -t gfountopoulos/homelabinfo:latest `
    -f Dockerfile --push .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build for main app failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Build and Push Agent
Write-Host "[2/2] Building and pushing agent image..." -ForegroundColor Yellow
docker buildx build --platform linux/amd64,linux/arm64 `
    -t gfountopoulos/homelabinfo-agent:$version `
    -t gfountopoulos/homelabinfo-agent:latest `
    -f agent/Dockerfile --push agent/

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build for agent failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "----------------------------------------------------" -ForegroundColor Green
Write-Host "Deployment Completed Successfully!" -ForegroundColor Green
Write-Host "Images updated to version $version and latest." -ForegroundColor Green
Write-Host "----------------------------------------------------" -ForegroundColor Green
