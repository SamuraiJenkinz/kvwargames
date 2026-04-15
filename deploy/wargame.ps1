# wargame.ps1
# Operational control surface for the "KV WarGame" scheduled task.
# Mirrors the mental model of `nssm start|stop|status|restart` for a
# Task Scheduler deployment.
#
# Usage (run from anywhere; admin required for start/stop):
#   .\deploy\wargame.ps1 status
#   .\deploy\wargame.ps1 start
#   .\deploy\wargame.ps1 stop
#   .\deploy\wargame.ps1 restart
#   .\deploy\wargame.ps1 logs           # tail today's log
#   .\deploy\wargame.ps1 logs -Lines 200
#
# Exit codes:
#   0  success
#   1  usage error
#   2  task not registered
#   3  action failed

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('status', 'start', 'stop', 'restart', 'logs', 'help')]
    [string]$Action = 'status',

    [string]$TaskName = 'KV WarGame',

    # For `logs`
    [int]$Lines = 40,
    [switch]$Follow
)

$ErrorActionPreference = 'Stop'
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Get-Task {
    $t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $t) {
        Write-Host "Task '$TaskName' is not registered. Run deploy\install.ps1 first." -ForegroundColor Yellow
        exit 2
    }
    return $t
}

function Get-HttpHealth {
    # Try the bind host:port advertised by the currently running server.
    # Fall back to localhost:8000 if not set in .env.
    $appHost = '127.0.0.1'
    $appPort = '8000'
    $envFile = Join-Path $AppRoot '.env'
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^\s*APP_HOST\s*=\s*(.+?)\s*$') {
                $v = $Matches[1].Trim('"').Trim("'")
                # 0.0.0.0 is not a valid client target -- probe via localhost instead
                if ($v -ne '0.0.0.0') { $appHost = $v }
            }
            if ($_ -match '^\s*APP_PORT\s*=\s*(\d+)\s*$') { $appPort = $Matches[1] }
        }
    }

    $url = "http://${appHost}:${appPort}/"
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        return [pscustomobject]@{ Url = $url; Reachable = $true; StatusCode = $r.StatusCode }
    } catch {
        return [pscustomobject]@{ Url = $url; Reachable = $false; StatusCode = $null }
    }
}

function Action-Status {
    $t    = Get-Task
    $info = Get-ScheduledTaskInfo -TaskName $TaskName

    # Map LastTaskResult to a human-readable hint
    $lastResultHint = switch ($info.LastTaskResult) {
        0        { 'Success' }
        267009   { 'Currently running' }
        267011   { 'Not yet run' }
        default  { "Code $($info.LastTaskResult)" }
    }

    $health = Get-HttpHealth

    Write-Host ""
    Write-Host "KV WarGame -- Task Status" -ForegroundColor Cyan
    Write-Host "-------------------------------------------"
    Write-Host ("  Task state     : {0}" -f $t.State)
    Write-Host ("  Last run       : {0}" -f $info.LastRunTime)
    Write-Host ("  Last result    : {0}" -f $lastResultHint)
    Write-Host ("  Next run       : {0}" -f $info.NextRunTime)
    Write-Host ("  Run as         : {0}" -f $t.Principal.UserId)
    Write-Host ""
    Write-Host "HTTP Health" -ForegroundColor Cyan
    Write-Host "-------------------------------------------"
    Write-Host ("  Probe URL      : {0}" -f $health.Url)
    if ($health.Reachable) {
        Write-Host ("  Reachable      : yes (HTTP {0})" -f $health.StatusCode) -ForegroundColor Green
    } else {
        Write-Host  "  Reachable      : NO" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Action-Start {
    $null = Get-Task
    Write-Host "Starting task '$TaskName' ..."
    try {
        Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    } catch {
        Write-Host "Start failed: $_" -ForegroundColor Red
        exit 3
    }
    Start-Sleep -Seconds 2
    Action-Status
}

function Action-Stop {
    $null = Get-Task
    Write-Host "Stopping task '$TaskName' ..."
    try {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    } catch {
        Write-Host "Stop returned: $_" -ForegroundColor Yellow
    }

    # Stop-ScheduledTask terminates the action process tree, but orphan
    # python.exe processes are occasionally left when uvicorn is mid-request.
    # Clean them up by matching on the venv python path (never kill *all* python).
    $venvPython = Join-Path $AppRoot '.venv\Scripts\python.exe'
    $orphans = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
        Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -ieq $venvPython) }
    foreach ($p in $orphans) {
        Write-Host "Terminating orphan python.exe PID=$($p.ProcessId)"
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {}
    }

    Start-Sleep -Seconds 1
    Action-Status
}

function Action-Restart {
    Action-Stop
    Start-Sleep -Seconds 1
    Action-Start
}

function Action-Logs {
    $logsDir = Join-Path $AppRoot 'logs'
    $stamp   = Get-Date -Format 'yyyy-MM-dd'
    $logFile = Join-Path $logsDir "wargame-$stamp.log"

    if (-not (Test-Path $logFile)) {
        # Fall back to the newest log file if today's doesn't exist yet
        $logFile = Get-ChildItem -Path $logsDir -Filter 'wargame-*.log' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
    }

    if (-not $logFile -or -not (Test-Path $logFile)) {
        Write-Host "No log files found in $logsDir. The task may not have run yet." -ForegroundColor Yellow
        exit 0
    }

    Write-Host "Tailing $logFile (last $Lines lines)" -ForegroundColor Cyan
    if ($Follow) {
        Get-Content -Path $logFile -Tail $Lines -Wait
    } else {
        Get-Content -Path $logFile -Tail $Lines
    }
}

function Action-Help {
    @"
KV WarGame control script

  wargame.ps1 status     Show task state, last run result, and HTTP probe
  wargame.ps1 start      Start the task now (does not wait for next boot)
  wargame.ps1 stop       Stop the task and clean up orphan python.exe
  wargame.ps1 restart    Stop, clean up, start
  wargame.ps1 logs       Print the tail of today's log
  wargame.ps1 logs -Follow -Lines 200
                         Stream the log live (Ctrl+C to exit)
  wargame.ps1 help       This message

Requires: deploy\install.ps1 has been run once to register the task.
Start/stop require Administrator.
"@ | Write-Host
}

switch ($Action) {
    'status'  { Action-Status;  break }
    'start'   { Action-Start;   break }
    'stop'    { Action-Stop;    break }
    'restart' { Action-Restart; break }
    'logs'    { Action-Logs;    break }
    'help'    { Action-Help;    break }
    default   { Action-Help;    exit 1 }
}
