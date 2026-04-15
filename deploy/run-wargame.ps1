# run-wargame.ps1
# Wrapper script executed by the "KV WarGame" scheduled task.
#
# Responsibilities:
#   1. Set CWD to the app root so pydantic-settings can locate .env
#   2. Launch uvicorn using the venv's python.exe
#   3. Redirect stdout + stderr to a daily-rotated log file under logs\
#   4. Exit with uvicorn's exit code so Task Scheduler can retry on failure
#
# Intentionally minimal: this is called by Task Scheduler with no interactive
# console, so all diagnostic output must go to the log file.
#
# Invocation (from the scheduled task action):
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\WarGame\deploy\run-wargame.ps1"
#
# The task's "Start in" directory MUST be the app root (C:\WarGame by default).

param(
    [string]$AppRoot
)

$ErrorActionPreference = 'Stop'

# Default AppRoot = parent of the directory this script lives in.
# Done here (not as a param default) because PS param defaults cannot contain pipelines.
if (-not $AppRoot) {
    $AppRoot = Split-Path -Parent $PSScriptRoot
}

# Resolve paths relative to app root
$venvPython = Join-Path $AppRoot '.venv\Scripts\python.exe'
$logsDir    = Join-Path $AppRoot 'logs'
$envFile    = Join-Path $AppRoot '.env'

# Ensure logs directory exists
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Daily-rotated log file. Task Scheduler restart-on-failure will append.
$stamp   = Get-Date -Format 'yyyy-MM-dd'
$logFile = Join-Path $logsDir "wargame-$stamp.log"

# Retention: prune logs older than 30 days. Best-effort; don't fail startup on it.
try {
    Get-ChildItem -Path $logsDir -Filter 'wargame-*.log' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
        Remove-Item -Force -ErrorAction SilentlyContinue
} catch {}

function Write-Log([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

Write-Log "---- run-wargame.ps1 starting ----"
Write-Log "AppRoot    = $AppRoot"
Write-Log "venvPython = $venvPython"
Write-Log "logFile    = $logFile"

# Fail-fast preconditions -- surface a readable error in the log, not a Python traceback
if (-not (Test-Path $venvPython)) {
    Write-Log "FATAL: venv python not found at $venvPython. Run deploy\install.ps1 first."
    exit 2
}

if (-not (Test-Path $envFile)) {
    Write-Log "FATAL: .env not found at $envFile. Copy .env.example to .env and fill in LLM credentials."
    exit 3
}

$distIndex = Join-Path $AppRoot 'dist\index.html'
if (-not (Test-Path $distIndex)) {
    Write-Log "FATAL: frontend build not found at $distIndex. Build the frontend (pnpm build) and copy dist\ to the server."
    exit 4
}

# Read bind host/port from .env so the user can override without editing this script.
# Fallback to sensible production defaults if not present.
$appHost = '0.0.0.0'
$appPort = '8000'
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*APP_HOST\s*=\s*(.+?)\s*$') { $appHost = $Matches[1].Trim('"').Trim("'") }
    if ($_ -match '^\s*APP_PORT\s*=\s*(\d+)\s*$') { $appPort = $Matches[1] }
}

Write-Log "Binding    = ${appHost}:${appPort}"

# CWD must be the app root for .env loading (pydantic-settings reads from CWD).
Set-Location $AppRoot

# Launch uvicorn. --app-dir backend makes the "app.main:app" import path work
# from the repo root without packaging. Single worker -- corporate single-facilitator use.
# Redirect both streams to the log; Task Scheduler has no console to write to.
$uvicornArgs = @(
    '-m', 'uvicorn',
    'app.main:app',
    '--host', $appHost,
    '--port', $appPort,
    '--app-dir', 'backend',
    '--no-access-log'
)

Write-Log ("Launching: {0} {1}" -f $venvPython, ($uvicornArgs -join ' '))

# Stream process output directly into the log file. Blocks until the process exits.
& $venvPython @uvicornArgs *>> $logFile
$code = $LASTEXITCODE

Write-Log "uvicorn exited with code $code"
exit $code
