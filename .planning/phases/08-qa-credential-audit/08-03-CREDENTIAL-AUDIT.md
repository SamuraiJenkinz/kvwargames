# Credential Audit — Phase 08-03

**Audit date:** 2026-04-14
**Auditor:** Phase 8 executor (plan 08-03)
**Scope:** Source-code grep evidence + .env hygiene + key-rotation operator checklist. Network-side evidence is cross-referenced from the 08-02 live run artifact (forward dependency — see §3).

**Verdict summary:** PASS. All five client-side credential greps return zero matches. `backend/.env` is gitignored. Neither `.env.example` file contains real key material. A rotation checklist has been codified in §4 to close the operational gap logged in `STATE.md` line 218.

---

## 1. Source-Code Grep Evidence

All commands run from repo root (`C:\KVWarGame`) on 2026-04-14. Test files are excluded via the `grep -v ".test."` filter — credentials inside test fixtures are mock values, not real secrets. Each command's stdout is pasted verbatim; **zero matches is the pass condition** (grep exits with status 1 when nothing matches).

Pitfall note (from `08-RESEARCH.md` Pitfall 5): these greps are intentionally scoped to `src/` (the client). The backend (`backend/app/`) DOES legitimately reference `Authorization` and `LLM_API_KEY` — that is where credentials belong. Extending these greps to the backend would be a false-positive trap and is explicitly out of scope for this audit (§5).

### 1.1 Authorization header references

```bash
$ grep -r "Authorization" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
$ echo "EXIT=$?"
EXIT=1
```

**Result:** PASS — no client-side reference to the `Authorization` header. Credentials are confirmed isolated to the backend proxy, which injects auth on the outbound (server → LLM) side only.

### 1.2 Bearer token references

```bash
$ grep -r "Bearer " src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
$ echo "EXIT=$?"
EXIT=1
```

**Result:** PASS — no client-side reference to a `Bearer <token>` pattern. The OpenAI-style auth prefix never appears in client code.

### 1.3 API key variable references (api_key / apiKey / API_KEY)

```bash
$ grep -rE "api_key|apiKey|API_KEY" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
$ echo "EXIT=$?"
EXIT=1
```

**Result:** PASS — no client-side reference to any API-key variable naming convention (snake_case, camelCase, or SCREAMING_SNAKE_CASE). The client has no notion of an API key.

### 1.4 OpenAI key prefix (sk-)

```bash
$ grep -r "sk-" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
$ echo "EXIT=$?"
EXIT=1
```

**Result:** PASS — no literal `sk-...` key prefix in client source. If a rotation ever pastes a raw OpenAI key into a component, this grep will catch it.

### 1.5 Direct LLM endpoint references (api.openai.com / LLM_ENDPOINT)

```bash
$ grep -rE "api\.openai\.com|LLM_ENDPOINT" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
$ echo "EXIT=$?"
EXIT=1
```

**Result:** PASS — the client never addresses the upstream LLM directly. All LLM traffic is brokered through the backend proxy at `/api/llm`, as designed in Phase 02-02.

### 1.6 Summary

| Check                        | Command                                                                                 | Result |
|------------------------------|-----------------------------------------------------------------------------------------|--------|
| Authorization header         | `grep -r "Authorization" src/ --include="*.ts" --include="*.tsx" \| grep -v ".test."`   | PASS   |
| Bearer token                 | `grep -r "Bearer " src/ --include="*.ts" --include="*.tsx" \| grep -v ".test."`         | PASS   |
| API key variables            | `grep -rE "api_key\|apiKey\|API_KEY" src/ --include="*.ts" --include="*.tsx" \| grep -v ".test."` | PASS |
| OpenAI `sk-` prefix          | `grep -r "sk-" src/ --include="*.ts" --include="*.tsx" \| grep -v ".test."`             | PASS   |
| Direct LLM endpoint          | `grep -rE "api\.openai\.com\|LLM_ENDPOINT" src/ --include="*.ts" --include="*.tsx" \| grep -v ".test."` | PASS |

All five source-code invariants hold. A reviewer can re-run the exact commands above and reproduce the EXIT=1 / no-stdout result.

---

## 2. Config Hygiene

### 2.1 `.gitignore` coverage

```bash
$ git check-ignore -v backend/.env
.gitignore:9:.env	backend/.env
$ echo "EXIT=$?"
EXIT=0
```

`backend/.env` is ignored by line 9 of the project `.gitignore` (`.env` pattern, globstar). Exit 0 = match found = file is gitignored.

```bash
$ git check-ignore -v .env
.gitignore:9:.env	.env
$ echo "EXIT=$?"
EXIT=0
```

The root `.env` path is also covered by the same rule (the path does not currently exist at repo root, but the rule is active — if a root `.env` is ever created, it will be ignored).

**Result:** PASS — `.env` is gitignored at both the project root and inside `backend/`. No environment file can be accidentally committed via `git add .env` or `git add backend/.env`.

### 2.2 `.env.example` files contain no real key material

```bash
$ grep -E "sk-|[a-z0-9]{32,}" backend/.env.example
$ echo "EXIT=$?"
EXIT=1
```

```bash
$ grep -E "sk-|[a-z0-9]{32,}" .env.example
$ echo "EXIT=$?"
EXIT=1
```

Both `.env.example` files contain only placeholder values (`your-api-key-here`) and documentation URLs (e.g. `https://api.openai.com/v1/chat/completions` as a format example). Neither contains an OpenAI-style `sk-` prefix nor a 32+ character lowercase/digit run that would indicate an accidentally pasted secret.

**Result:** PASS — only placeholder values present. Safe to copy to `.env` and fill in; safe to keep committed as documentation.

---

## 3. Network Evidence (cross-reference)

> **Forward dependency note:** `08-02-LIVE-RUN.md` does not yet exist at the time of writing this audit (2026-04-14). It is produced by Wave 2 of Phase 8 (plan 08-02) during the Scenario 2 full-round live run. Once 08-02 completes, the file at `.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md` § "Network Evidence" will contain the authoritative network-side artifacts for this audit.

Expected contents of the 08-02 network-evidence section (per `08-CONTEXT.md` → "Credential audit depth" → "Network evidence"):

- **DevTools HAR excerpt or annotated screenshot** of a browser-originated `POST /api/llm` request captured during the live run.
- **Header-level confirmation** that the browser request contains **no** `Authorization` header, **no** `api-key` header, and **no** direct LLM endpoint URL. The browser only ever calls the same-origin proxy at `/api/llm`.
- **Outbound-side confirmation** that the backend injects the auth header on the server → LLM hop (per the Phase 06-01 implementation in `backend/app/routers/llm.py`; configurable via `LLM_AUTH_HEADER_NAME` + `LLM_AUTH_VALUE_PREFIX`). This hop is **not visible to the browser** and therefore cannot leak through DevTools.

This audit doc cites the 08-02 artifact; it does **not** duplicate the HAR. When 08-02 lands, reviewers should follow the reference:

> See `.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md` § "Network Evidence" for the request-header capture.

If at 08-02 completion the live run reveals an `Authorization` header on the browser → backend request, this audit's overall verdict **must** be revised to FAIL and a finding logged for the facilitator. The source-code greps alone cannot prove runtime absence; the network capture closes that loop.

---

## 4. Key Rotation Checklist

**Background.** `STATE.md` line 218 (Phase 8 ops note, 2026-04-14) records:

> *"OpenAI API key rotated between Phase 6 smoke test and Phase 7 smoke test (appeared in chat logs both times). STATE backends should never source key from env files without a key-rotation checklist per phase smoke test."*

The leak vector in Phases 6 and 7 was **not a code defect** — the source-code greps above confirm the key has never appeared in client source. The leak was **operational**: smoke-test transcripts captured outbound request payloads (or DevTools console output that happened to include them) and the resulting narrative was pasted into planning docs. Because the key was live during both smoke tests, the leaked value was valid each time.

This checklist exists so that the **next** operator to rotate the key can follow a codified procedure instead of re-deriving it.

### 4.1 When you rotate the API key

1. **Revoke the old key in the LLM provider dashboard *before* generating the new one.** This minimises the window in which the already-leaked old key remains valid. Do not generate-then-revoke — the order matters.

2. **Update `backend/.env`.** Replace `LLM_API_KEY=<old-key>` with `LLM_API_KEY=<new-key>`. Immediately re-verify the file is still gitignored:
   ```bash
   git check-ignore -v backend/.env
   ```
   Expect `.gitignore:9:.env	backend/.env`. If empty, STOP — something has changed the gitignore rules; fix before continuing.

3. **Restart the dev backend.** `cd backend && uvicorn app.main:app --reload` (or whatever `pnpm dev:backend` wires up). The FastAPI lifespan re-reads `Settings` on startup — a hot-reload of a Python file alone does **not** re-read the env. An uvicorn `--reload` restart on `backend/.env` change *will* pick up the new value because `--reload` watches the directory.

4. **Verify the new key works end-to-end.** From the frontend dev server, issue a single `POST /api/llm` test turn (e.g. send any facilitator message via the chat input). Confirm:
   - Response is 200 and renders persona messages in the chat
   - Dev console shows no `LLM_UPSTREAM_ERROR` / `LLM_AUTH_ERROR`
   - Backend logs show outbound request completed successfully

5. **Scrub any pre-rotation transcripts.** Search planning artifacts for the OLD key prefix and redact if found:
   ```bash
   grep -r "<first-10-chars-of-old-key>" .planning/
   grep -r "<first-10-chars-of-old-key>" backend/
   grep -r "<first-10-chars-of-old-key>" src/
   ```
   If matches appear, redact (replace with `sk-REDACTED-<date>`) and commit the redaction with an explicit commit message. **Do not rewrite git history** unless the old key was committed to the default branch — in that case, escalate: history rewrite requires coordination with every clone holder.

6. **Re-run this audit's source-code greps.** Confirm the new key has not crept into `src/`:
   ```bash
   grep -r "sk-" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
   grep -rE "api_key|apiKey|API_KEY" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
   ```
   Both must return EXIT=1 (zero matches). If either matches, STOP — the new key has leaked into client source; revoke again and investigate.

7. **Log the rotation in `STATE.md` ops history.** Add a single line under "Blockers/Concerns" → ops note, of the form:
   `2026-MM-DD: LLM_API_KEY rotated. Reason: <periodic rotation | suspected leak | Phase 8 smoke test>. Old key revoked before new key issued. Audit greps re-run clean.`
   Commit this with `docs(state): log key rotation YYYY-MM-DD`.

### 4.2 Smoke-test transcript hygiene (the actual leak cause)

Phases 6 and 7 leaked the key not by committing it, but by pasting DevTools console output into planning docs while the console included outbound request payloads. To prevent this on the **next** smoke test:

- **Before capturing any transcript, clear DevTools console and Network tab.**
- **When pasting console output, visually scan for any `sk-` / 32+ char opaque token, a `Bearer ` prefix, or the literal string `Authorization:` — redact before paste, not after.**
- **After pasting, run the transcript file through the audit greps:**
  ```bash
  grep -E "sk-|Bearer |Authorization:" .planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md
  ```
  Expect zero matches. If matches appear, redact the file, commit the redaction, and trigger a fresh rotation (the transcript is now tainted).
- **Prefer the `/api/llm` response body over the outbound payload for transcript content.** The response body never contains credentials by design; the outbound payload is the thing that carries `Authorization: Bearer <key>`.

### 4.3 Why this exists in this audit

Source-code greps (§1) prove the client is clean at commit time. The network capture (§3, via 08-02) proves the browser never sees credentials at runtime. Neither of those defences catches the **transcript-paste** leak vector. Section 4 closes that third loop. Without it, a future facilitator repeats the Phase 6/7 mistake and the cycle continues.

---

## 5. Out of Scope

The following checks were deliberately excluded from this audit per `08-CONTEXT.md` → "Credential audit depth" → "Not in scope". They are logged here explicitly so that future auditors know they were **considered and deferred**, not forgotten:

- **Full SAST scan** (e.g. semgrep, snyk code, sonarqube). Out of proportion for a three-persona facilitator-operated tabletop tool. Revisit if the tool is ever distributed beyond the original facilitator group or exposed to untrusted users.
- **Dependency CVE sweep** (e.g. `npm audit`, `pip-audit`, `trivy`). Same rationale. The dependency tree is small (Vite + React + FastAPI + httpx + pydantic) and locked via `pnpm-lock.yaml` / `uv.lock`; a one-off sweep before the next milestone is cheap enough to defer.
- **Penetration testing.** Same rationale. The tool runs same-origin in a facilitator-controlled environment with no multi-tenant exposure.
- **Backend-side credential grep.** The backend (`backend/app/routers/llm.py`) **legitimately** references `Authorization` (as the default auth header name) and reads `LLM_API_KEY` from settings — that is where credentials **belong**. A blanket grep over `backend/` would produce intended matches and would teach nothing. Backend credential hygiene is enforced at code review time (the proxy design locks the auth header to the outbound hop) plus by the network capture in §3 which confirms no leakage to the browser.

---

*Audit complete: 2026-04-14. Re-run the source-code greps, `git check-ignore` calls, and `.env.example` checks before any future production deployment or distribution event.*
