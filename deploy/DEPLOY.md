# Windows Server Deployment

This directory contains scripts to run KV WarGame as a boot-time service on a
Windows Server via Task Scheduler — no NSSM, no third-party supervisors.

## Scripts

| Script | Purpose |
|---|---|
| `install.ps1` | One-shot installer: venv, pip install, register scheduled task |
| `wargame.ps1` | Day-to-day control: `status`, `start`, `stop`, `restart`, `logs` |
| `update.ps1` | Stop → refresh deps → start (after syncing new code into the app folder) |
| `uninstall.ps1` | Unregister the task; optional `-Purge` to remove venv + logs |
| `run-wargame.ps1` | The wrapper the task executes — not normally invoked by hand |

## Prerequisites

On the server:

- **git** on `PATH` (check: `git --version`)
- **Python 3.11+** installed and on `PATH` (check: `python --version` from an elevated prompt)
- **Administrator** access for the one-time `install.ps1` run (SYSTEM-level scheduled task registration requires it)
- **TCP port 8000** (or your chosen `APP_PORT`) free and — if clients connect over the LAN — allowed through Windows Firewall
- Internet or an internal PyPI mirror reachable for `pip install`

**Node / pnpm are NOT required on the server.** The production frontend bundle (`dist/`) is committed to the repo, so cloning gives you a ready-to-deploy tree. Frontend rebuilds happen on a dev machine and are committed before push.

## First install

```powershell
# --- On the server (elevated PowerShell) ---
cd C:\
git clone https://github.com/SamuraiJenkinz/kvwargames.git WarGame
cd C:\WarGame
powershell.exe -ExecutionPolicy Bypass -File .\deploy\install.ps1
```

The installer:

1. Verifies Python 3.11+
2. Verifies `dist\index.html` exists
3. Creates `.venv\` and installs `backend\requirements.txt`
4. If `.env` is missing, copies `.env.example` → `.env` and **warns you to edit it**
5. Locks ACLs on `.env` to `SYSTEM` + `Administrators`
6. Registers the `KV WarGame` scheduled task to run at system startup (with a 30-second delay) as `NT AUTHORITY\SYSTEM`

### Edit `.env` before first start

`install.ps1` does not start the task automatically — you must set the LLM credentials first:

```powershell
notepad C:\WarGame\.env
# Set LLM_API_KEY, LLM_ENDPOINT_URL, LLM_MODEL
# Keep APP_HOST=0.0.0.0 if you want LAN access, or 127.0.0.1 for local-only
```

**Debrief-podcast TTS (v1.2, optional):** the podcast feature ships with `TTS_PROVIDER=fake` as the safe default — deterministic fixtures, zero outbound traffic. Ship to production that way if you do not yet have an ElevenLabs account or haven't confirmed firewall egress. When you're ready to turn real voices on:

```powershell
# In .env — all four required together:
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=<real-key>
ELEVENLABS_VOICE_KENT=<voice_id>
ELEVENLABS_VOICE_FINCH=<voice_id>
ELEVENLABS_VOICE_CHEN=<voice_id>
```

The backend refuses to start if `TTS_PROVIDER=elevenlabs` is set with any of the four `ELEVENLABS_*` vars missing — fail-fast, no half-configured state. The key is read server-side only; browser requests carry no ElevenLabs header (same posture as `LLM_API_KEY`). The markdown debrief download path is independent of TTS — if ElevenLabs is down, broken, or throttled, Generate Podcast surfaces a clear error banner but Download Debrief (.md) continues to work.

Then either reboot, or start it immediately without rebooting:

```powershell
.\deploy\wargame.ps1 start
.\deploy\wargame.ps1 logs -Follow
```

## Daily operations

```powershell
.\deploy\wargame.ps1 status       # task state + HTTP health probe
.\deploy\wargame.ps1 start
.\deploy\wargame.ps1 stop
.\deploy\wargame.ps1 restart
.\deploy\wargame.ps1 logs         # tail of today's log
.\deploy\wargame.ps1 logs -Follow # stream live
```

`status` reports:

- **Task state** — `Ready` (not running), `Running`, or `Disabled`
- **Last run** / **Last result** — what Task Scheduler saw on its most recent invocation
- **HTTP probe** — whether the server responds on `APP_HOST:APP_PORT`

If `Task state = Running` but the HTTP probe fails, the uvicorn process has crashed or is binding to a different address than configured — check the log.

## Firewall

Inbound TCP 8000 is **not** opened automatically. Run as Administrator when you want LAN access:

```powershell
New-NetFirewallRule -DisplayName 'KV WarGame 8000' `
    -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

Use a different `APP_PORT` in `.env` and the rule, if 8000 is already claimed.

**Outbound (ElevenLabs):** when `TTS_PROVIDER=elevenlabs` is set, the backend calls `https://api.elevenlabs.io` from the deployment host — the same host and credential boundary as the LLM endpoint, plus one new destination. If your corporate egress is allowlist-based, add `api.elevenlabs.io` (TCP 443). Reachability was confirmed on the MMC deployment host (`MC211APT2AS5AHG`) via operational precedent — a separate production application on the same host calls this endpoint daily — plus an `Invoke-WebRequest https://api.elevenlabs.io/v1/voices` HTTP 200 preflight. See `.planning/phases/13-firewall-spike-mockable-backend-foundation/13-01-FIREWALL-SPIKE.md` for the evidence trail. With `TTS_PROVIDER=fake` (default) no outbound ElevenLabs traffic occurs.

## Updating to a new version

```powershell
# --- On the server (elevated) ---
cd C:\WarGame
git pull
.\deploy\update.ps1
```

`update.ps1` stops the task, reinstalls deps, imports `app.main` to confirm the new code loads, then restarts the task. If the import fails the task stays stopped so you don't crash-loop on broken code.

**If `git pull` shows a merge conflict on `.env`:** your `.env` is (correctly) gitignored, so this should not happen. If it does, resolve by keeping the local `.env` — it holds the production `LLM_API_KEY`.

**Frontend changes only reach the server after a `pnpm build` + commit on a dev machine.** `dist/` is tracked in the repo precisely so the server needs no Node toolchain — but that also means a frontend edit that isn't rebuilt and committed won't appear in production until it is.

## Logs

- Location: `C:\WarGame\logs\wargame-YYYY-MM-DD.log`
- Rotation: daily by filename; retention 30 days (pruned automatically by `run-wargame.ps1` on each start)
- Content: `run-wargame.ps1` diagnostic lines + uvicorn stdout/stderr combined

Task Scheduler itself logs task starts / stops / exit codes to the **Task Scheduler Operational** Event Log (Applications and Services Logs → Microsoft → Windows → TaskScheduler).

## Task Scheduler vs NSSM — what you're giving up

Task Scheduler is not a process supervisor. These are the real differences to plan around:

| Concern | NSSM | Task Scheduler (this setup) |
|---|---|---|
| Crash restart | Immediate, unlimited | Restart every 1 min, **max 10 restarts per task run** |
| Exit-code 0 means "success" | Always restarts until you tell it not to | Success = don't restart (cannot distinguish from clean shutdown) |
| Child process cleanup | Tracks and kills full process tree | `Stop-ScheduledTask` kills the action process; orphan `python.exe` children are cleaned up by `wargame.ps1 stop` |
| Runs under a local service account | Yes, any account | Yes — this setup uses `SYSTEM`; swap to a dedicated local account if your security policy requires it (see below) |

For a single-facilitator tool that restarts on crash and is manually recoverable by the facilitator during a session, these limits are acceptable. If the tool needs truly unattended always-on supervision under failure, revisit whether a Windows Service (via `sc.exe create` + a service host wrapper, or a packaged `pywin32` service) is warranted.

## Switching off SYSTEM to a dedicated service account

If your corporate policy forbids `SYSTEM` for application workloads:

```powershell
# Pre-create the local account (or AD service account) and grant it
# "Log on as a service" via secpol.msc → Local Policies → User Rights Assignment.

.\deploy\install.ps1 -RunAsUser 'SERVER01\svc_wargame'
# PowerShell will prompt for the account password once at registration.
```

For gMSAs pass the `$`-suffixed name: `-RunAsUser 'DOMAIN\svc_wargame$'`.

## Troubleshooting

**Task state is `Ready` but I just started it**
It ran briefly and exited. Check `logs\wargame-<today>.log` for a fatal error
(`run-wargame.ps1` emits `FATAL:` lines for missing `.env`, missing venv,
missing `dist\`).

**`install.ps1` says "Frontend build not found"**
You forgot to `pnpm build` on the dev machine, or you excluded `dist\` from
the copy. The backend serves `dist\index.html` as the SPA — without it, the
app will start but every URL returns 404.

**Status says `Reachable: NO` but task is `Running`**
Usually means `APP_HOST=127.0.0.1` in `.env` and you're probing from a
different host. For LAN access set `APP_HOST=0.0.0.0` and restart.

**Port 8000 already in use**
Change `APP_PORT` in `.env`, update the firewall rule, restart:
`.\deploy\wargame.ps1 restart`.

**Key rotation**
Edit `.env`, then `.\deploy\wargame.ps1 restart`. The app reads env on start,
so a restart is required — there is no hot-reload path for credentials.

**Credential boundary sanity check**
The `.env` ACL is locked to `SYSTEM` + `Administrators` by the installer.
`LLM_API_KEY` and (when v1.2 real TTS is enabled) `ELEVENLABS_API_KEY` are
read server-side only; browser requests carry neither an `Authorization`
header nor any ElevenLabs credential (validated in Phase 8 credential
audit and re-audited for the podcast path at v1.2). If you suspect drift,
re-run the grep checks in
`.planning\phases\08-qa-credential-audit\08-03-CREDENTIAL-AUDIT.md`.

**Debrief podcast not generating, but LLM works**
Check two things. First, `GET http://<host>:<port>/api/health/tts` — it
always returns HTTP 200, but the body tells you whether the provider is
reachable (`ok: true` with `latencyMs`) or why it isn't (`ok: false` with
one of eight codes: `timeout`, `auth_error`, `not_found`, `rate_limited`,
`upstream_error`, `network_error`, `tls_error`, `invalid_response`).
Second, on the setup screen the **TTS** badge displays the same signal
with locked copy "Podcast generation unavailable — markdown debrief will
still work." — it intentionally does NOT gate Launch. The markdown
debrief download path is fully independent of TTS and continues to work
regardless of the podcast state (empirically verified in Phase 15).
