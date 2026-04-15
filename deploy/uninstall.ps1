# uninstall.ps1
# Removes the "KV WarGame" scheduled task.
#
# Default behaviour: leaves the app directory, .venv, .env, and logs intact.
# Pass -Purge to delete those as well.
#
# Run as Administrator:
#   powershell.exe -ExecutionPolicy Bypass -File .\deploy\uninstall.ps1
#   powershell.exe -ExecutionPolicy Bypass -File .\deploy\uninstall.ps1 -Purge

[CmdletBinding()]
param(
    [string]$TaskName = 'KV WarGame',
    [switch]$Purge
)

$ErrorActionPreference = 'Stop'
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Require-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "uninstall.ps1 must be run as Administrator."
    }
}

Require-Admin

# Stop and clean up orphan processes by reusing wargame.ps1
$ctrl = Join-Path $PSScriptRoot 'wargame.ps1'
if (Test-Path $ctrl) {
    try { & $ctrl stop -TaskName $TaskName } catch { Write-Warning "stop returned: $_" }
}

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Unregistered scheduled task '$TaskName'"
} else {
    Write-Host "Task '$TaskName' not registered -- nothing to unregister"
}

if ($Purge) {
    # NOTE: .env is NOT purged (contains credentials; may be needed for reinstall).
    # Delete manually if truly wanted.
    $toDelete = @(
        (Join-Path $AppRoot '.venv'),
        (Join-Path $AppRoot 'logs')
    )
    foreach ($p in $toDelete) {
        if (Test-Path $p) {
            Write-Host "Purging $p"
            Remove-Item -Recurse -Force $p
        }
    }
    Write-Host ""
    Write-Host "NOTE: .env was NOT deleted (may contain credentials needed for reinstall)."
    Write-Host "      Delete manually with: Remove-Item '$AppRoot\.env'"
}

Write-Host "Uninstall complete."
