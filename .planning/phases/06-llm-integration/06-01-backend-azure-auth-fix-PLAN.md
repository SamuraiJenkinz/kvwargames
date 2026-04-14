---
phase: 06-llm-integration
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/config.py
  - backend/app/routers/llm.py
  - backend/.env.example
autonomous: true

must_haves:
  truths:
    - "Backend `POST /api/llm` can authenticate against Azure OpenAI with `api-key` header (no Bearer prefix) when `LLM_AUTH_HEADER_NAME=api-key` and `LLM_AUTH_VALUE_PREFIX=` are set"
    - "Default behaviour (no new env vars set) continues to produce `Authorization: Bearer {key}` — no regression for existing tests / other OpenAI-compatible endpoints"
    - "An integration-style test (with mocked httpx) confirms the header name and value are constructed from settings, not hardcoded"
  artifacts:
    - path: "backend/app/config.py"
      provides: "`llm_auth_header_name` and `llm_auth_value_prefix` settings fields"
      contains: "llm_auth_header_name"
    - path: "backend/app/routers/llm.py"
      provides: "Configurable auth header construction"
    - path: "backend/.env.example"
      provides: "Documentation for the two new env vars, with both standard OpenAI and Azure OpenAI examples"
  key_links:
    - from: "backend/app/routers/llm.py"
      to: "backend/app/config.py"
      via: "settings.llm_auth_header_name / settings.llm_auth_value_prefix"
      pattern: "settings\\.llm_auth_"
---

<objective>
Fix the hardcoded `Authorization: Bearer {key}` auth header in the LLM proxy so the corporate Azure OpenAI endpoint (which requires the `api-key: {key}` header with no prefix) can be used.

Purpose: Without this fix, no LLM call against the corporate deployment will succeed — every subsequent Phase 6 plan that needs live testing is blocked.
Output: Two new settings fields, updated llm.py header construction, updated .env.example, and a regression-proof unit test.
</objective>

<execution_context>
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/06-llm-integration/06-CONTEXT.md
@.planning/phases/06-llm-integration/06-RESEARCH.md
@backend/app/config.py
@backend/app/routers/llm.py
@backend/.env.example
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add configurable auth header settings and rewire llm.py header construction</name>
  <files>backend/app/config.py, backend/app/routers/llm.py</files>
  <action>
    In `backend/app/config.py`:
    - Add field `llm_auth_header_name: str = "Authorization"` immediately after `llm_extra_headers`.
    - Add field `llm_auth_value_prefix: str = "Bearer "` immediately after `llm_auth_header_name`.
    - Update the module docstring "Optional env vars" block to document `LLM_AUTH_HEADER_NAME` (default `Authorization`) and `LLM_AUTH_VALUE_PREFIX` (default `Bearer `). Note: trailing space on the default Bearer prefix is intentional — `f"{prefix}{key}"` then `.strip()` handles the empty-prefix case cleanly for Azure.

    In `backend/app/routers/llm.py`:
    - Replace the hardcoded `"Authorization": f"Bearer {settings.llm_api_key}"` line inside the `headers` dict with:
      ```python
      auth_value = f"{settings.llm_auth_value_prefix}{settings.llm_api_key}".strip()
      headers = {
          settings.llm_auth_header_name: auth_value,
          "Content-Type": "application/json",
          **settings.get_extra_headers(),
      }
      ```
    - Keep the order: configured auth header first, Content-Type second, extra headers last (so `llm_extra_headers` can still override if operator really needs it).
    - No other changes to llm.py — response extraction (`choices[0].message.content`), error codes, and timeouts stay as-is.

    Do NOT add `LLM_API_VERSION` / query-param injection in this plan — Research flagged it but CONTEXT-level decision is to add only if ops confirms. Out of scope here.
  </action>
  <verify>
    From `C:\KVWarGame\backend`:
    - `python -c "from app.config import Settings; s = Settings(llm_api_key='x', llm_endpoint_url='http://x', llm_model='m'); print(s.llm_auth_header_name, repr(s.llm_auth_value_prefix))"` prints `Authorization 'Bearer '`.
    - Same one-liner with env vars `LLM_AUTH_HEADER_NAME=api-key LLM_AUTH_VALUE_PREFIX=` set prints `api-key ''`.
    - Existing backend tests (if any in `backend/tests/`) still pass: `pytest backend/tests` or `python -m pytest` from repo root.
  </verify>
  <done>
    config.py exposes both new fields with documented defaults. llm.py constructs the auth header from settings. Default behaviour is byte-identical to the old hardcoded Bearer path. Azure `api-key` style works by setting the two env vars.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add regression test for header construction and update .env.example</name>
  <files>backend/tests/test_llm_auth_header.py, backend/.env.example</files>
  <action>
    Create `backend/tests/test_llm_auth_header.py` with two tests that use FastAPI's `TestClient` + `respx` (or `httpx.MockTransport`) to intercept the outbound upstream call and assert the headers:

    1. `test_default_uses_authorization_bearer` — with only the three required env vars set, POST to `/api/llm` with a trivial body. Intercept the outbound request to `settings.llm_endpoint_url` and assert `request.headers["Authorization"] == "Bearer <key>"` and `"api-key" not in request.headers`.
    2. `test_azure_api_key_style` — monkeypatch settings (clear lru_cache, reinstantiate with `LLM_AUTH_HEADER_NAME=api-key`, `LLM_AUTH_VALUE_PREFIX=""`). Assert outbound `request.headers["api-key"] == "<key>"` and `"Authorization" not in request.headers`.

    Implementation notes:
    - Use `get_settings.cache_clear()` between tests if you reinstantiate.
    - Mock the upstream by replacing `app.state.http_client` in an `autouse` fixture; or use `respx` if already installed; if not installed, use `httpx.MockTransport` and construct the AsyncClient with it in the fixture.
    - Do NOT add any new third-party test dependency — `httpx.MockTransport` is built in.

    Update `backend/.env.example`:
    - Add a new section documenting `LLM_AUTH_HEADER_NAME` (default `Authorization`) and `LLM_AUTH_VALUE_PREFIX` (default `Bearer ` — note trailing space).
    - Include a commented-out Azure example block:
      ```
      # Azure OpenAI (uses `api-key` header, no Bearer prefix):
      # LLM_AUTH_HEADER_NAME=api-key
      # LLM_AUTH_VALUE_PREFIX=
      ```
  </action>
  <verify>
    - `pytest backend/tests/test_llm_auth_header.py -v` — both tests pass.
    - `grep -c "LLM_AUTH_HEADER_NAME" backend/.env.example` returns `>= 1`.
    - Full backend test run `pytest backend/tests` — no regressions.
  </verify>
  <done>
    Regression test proves the two auth modes both work. `.env.example` documents the Azure flip without requiring code reading. A future accidental re-hardcoding of `Authorization: Bearer` would break `test_azure_api_key_style`.
  </done>
</task>

</tasks>

<verification>
- Default auth path unchanged: `Authorization: Bearer <key>` on outbound request.
- Azure auth path works: `api-key: <key>` on outbound request with no Bearer prefix.
- Both paths covered by tests that do not require a live endpoint.
- `.env.example` lets ops/dev configure either without reading code.
</verification>

<success_criteria>
- `backend/app/config.py` exports `llm_auth_header_name` and `llm_auth_value_prefix` fields with correct defaults.
- `backend/app/routers/llm.py` no longer contains the literal string `"Authorization": f"Bearer"`.
- `backend/tests/test_llm_auth_header.py` exists and both tests pass.
- `backend/.env.example` documents both new vars with an Azure example.
</success_criteria>

<output>
After completion, create `.planning/phases/06-llm-integration/06-01-SUMMARY.md` documenting the final behaviour and any operational notes for the Azure flip.
</output>
