# install.ps1
# One-shot installer for the KV WarGame on a Windows Server.
#
# What it does:
#   1. Verifies Python 3.11+ is on PATH
#   2. Verifies the frontend build (dist\index.html) exists
#   3. Creates a venv at .venv\ and pip installs backend\requirements.txt
#   4. Copies .env.example -> .env if .env is missing (prompts edit)
#   5. Registers a "KV WarGame" scheduled task that runs at boot under SYSTEM
#
# Run once, as Administrator, from the app root:
#   powershell.exe -ExecutionPolicy Bypass -File .\deploy\install.ps1
#
# Idempotent: re-running updates deps and re-registers the task.

[CmdletBinding()]
param(
    [string]$TaskName    = 'KV WarGame',
    [string]$RunAsUser   = 'NT AUTHORITY\SYSTEM',
    [int]   $StartupDelaySeconds = 30,
    [switch]$SkipTaskRegistration
)

$ErrorActionPreference = 'Stop'

# Resolve the app root (parent of deploy\)
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Write-Host "App root: $AppRoot"

function Require-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "install.ps1 must be run as Administrator (required to register a SYSTEM scheduled task)."
    }
}

function Require-Python {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        throw "python not found on PATH. Install Python 3.11+ and ensure python.exe is on PATH."
    }
    $ver = & python -c "import sys; print('{0}.{1}'.format(sys.version_info.major, sys.version_info.minor))"
    $parts = $ver.Split('.')
    if ([int]$parts[0] -lt 3 -or ([int]$parts[0] -eq 3 -and [int]$parts[1] -lt 11)) {
        throw "Python 3.11+ required, found $ver"
    }
    Write-Host "Python $ver detected at $($python.Source)"
}

function Require-Dist {
    $idx = Join-Path $AppRoot 'dist\index.html'
    if (-not (Test-Path $idx)) {
        throw "Frontend build not found at $idx. Run 'pnpm build' on a dev machine and copy dist\ to the server before installing."
    }
    Write-Host "Frontend build found: $idx"
}

function Ensure-Venv {
    $venvPath   = Join-Path $AppRoot '.venv'
    $venvPython = Join-Path $venvPath 'Scripts\python.exe'

    if (-not (Test-Path $venvPython)) {
        Write-Host "Creating venv at $venvPath ..."
        & python -m venv $venvPath
        if ($LASTEXITCODE -ne 0) { throw "python -m venv failed" }
    } else {
        Write-Host "venv already exists at $venvPath"
    }

    $reqs = Join-Path $AppRoot 'backend\requirements.txt'
    Write-Host "Installing/updating backend dependencies from $reqs ..."
    & $venvPython -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed" }
    & $venvPython -m pip install -r $reqs
    if ($LASTEXITCODE -ne 0) { throw "pip install -r requirements.txt failed" }

    # Sanity check: can the app import?
    Push-Location $AppRoot
    try {
        $importCmd = "import sys; sys.path.insert(0, 'backend'); from app.main import app; print('import OK')"
        & $venvPython -c $importCmd
        if ($LASTEXITCODE -ne 0) { throw "app.main import failed -- check backend\ for syntax errors" }
    } finally {
        Pop-Location
    }
}

function Ensure-EnvFile {
    $envFile    = Join-Path $AppRoot '.env'
    $envExample = Join-Path $AppRoot '.env.example'
    if (-not (Test-Path $envFile)) {
        if (-not (Test-Path $envExample)) {
            throw ".env.example missing from $AppRoot -- cannot bootstrap .env"
        }
        Copy-Item $envExample $envFile
        Write-Warning ".env was missing; created from .env.example. You MUST edit $envFile and set LLM_API_KEY, LLM_ENDPOINT_URL, LLM_MODEL before the app will start."
    } else {
        Write-Host ".env already exists at $envFile (not overwritten)"
    }

    # Restrict .env to SYSTEM + Administrators only (contains credentials)
    try {
        $acl = Get-Acl $envFile
        $acl.SetAccessRuleProtection($true, $false)
        $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }
        $rules = @(
            New-Object -TypeName System.Security.AccessControl.FileSystemAccessRule -ArgumentList 'NT AUTHORITY\SYSTEM','FullControl','Allow'
            New-Object -TypeName System.Security.AccessControl.FileSystemAccessRule -ArgumentList 'BUILTIN\Administrators','FullControl','Allow'
        )
        foreach ($r in $rules) { $acl.AddAccessRule($r) }
        Set-Acl $envFile $acl
        Write-Host ".env ACL locked to SYSTEM + Administrators"
    } catch {
        Write-Warning "Could not lock .env ACL: $_ -- set permissions manually if required"
    }
}

function Register-Task {
    if ($SkipTaskRegistration) {
        Write-Host "Skipping task registration (-SkipTaskRegistration)"
        return
    }

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Write-Host "Unregistering existing task '$TaskName' ..."
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    $wrapper = Join-Path $PSScriptRoot 'run-wargame.ps1'
    if (-not (Test-Path $wrapper)) {
        throw "Wrapper script missing: $wrapper"
    }

    $action = New-ScheduledTaskAction `
        -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$wrapper`"" `
        -WorkingDirectory $AppRoot

    # At system startup with a delay so network + disk have settled
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $trigger.Delay = "PT${StartupDelaySeconds}S"

    $principal = New-ScheduledTaskPrincipal `
        -UserId $RunAsUser `
        -LogonType ServiceAccount `
        -RunLevel Highest

    # Crash-retry: up to 10 restarts, 1 minute apart. Task Scheduler's
    # closest analogue to NSSM's supervisor. Not as tight but sufficient
    # for a tool that is expected to be up, not to survive every kind of
    # failure silently.
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew `
        -RestartCount 10 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit ([TimeSpan]::Zero)

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description 'KV WarGame FastAPI server (auto-start at boot)' | Out-Null

    Write-Host "Registered scheduled task '$TaskName' (runs as $RunAsUser at boot + ${StartupDelaySeconds}s)"
}

# --- Run ------------------------------------------------------------------
Require-Admin
Require-Python
Require-Dist
Ensure-Venv
Ensure-EnvFile
Register-Task

Write-Host ""
Write-Host "--------------------------------------------------------------------"
Write-Host "Install complete."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Edit $AppRoot\.env with real LLM_API_KEY / LLM_ENDPOINT_URL / LLM_MODEL"
Write-Host "  2. Start it now without rebooting:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  3. Tail the log:                    Get-Content $AppRoot\logs\wargame-*.log -Wait -Tail 40"
Write-Host "  4. Open firewall if needed:         New-NetFirewallRule -DisplayName 'KV WarGame 8000' -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow"
Write-Host "--------------------------------------------------------------------"
