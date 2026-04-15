# update.ps1
# Deploys a new version of the WarGame to an already-installed server.
#
# Workflow:
#   1. Stop the scheduled task
#   2. Refresh Python deps against current backend\requirements.txt
#   3. Restart the task
#
# This script does NOT copy code -- copy/sync your new backend\, dist\, and
# deploy\ contents into the app root first (robocopy, xcopy, git pull, etc.),
# then run this to reinstall dependencies and bounce the service.
#
# Run as Administrator:
#   powershell.exe -ExecutionPolicy Bypass -File .\deploy\update.ps1

[CmdletBinding()]
param(
    [string]$TaskName = 'KV WarGame'
)

$ErrorActionPreference = 'Stop'
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ctrl    = Join-Path $PSScriptRoot 'wargame.ps1'

function Require-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "update.ps1 must be run as Administrator."
    }
}

Require-Admin

Write-Host "Stopping task '$TaskName' ..."
& $ctrl stop -TaskName $TaskName

$venvPython = Join-Path $AppRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    throw "venv not found at $venvPython -- run deploy\install.ps1 first"
}

$reqs = Join-Path $AppRoot 'backend\requirements.txt'
Write-Host "Refreshing dependencies from $reqs ..."
& $venvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed" }
& $venvPython -m pip install -r $reqs --upgrade
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }

# Quick smoke import so we fail before starting, not after
Push-Location $AppRoot
try {
    $importCmd = "import sys; sys.path.insert(0, 'backend'); from app.main import app; print('import OK')"
    & $venvPython -c $importCmd
    if ($LASTEXITCODE -ne 0) { throw "app.main import failed -- new code has an error" }
} finally {
    Pop-Location
}

Write-Host "Starting task '$TaskName' ..."
& $ctrl start -TaskName $TaskName

Write-Host ""
Write-Host "Update complete. Tail logs with:  .\deploy\wargame.ps1 logs -Follow"
