# Requirements: War Game Engine — v1.1

**Defined:** 2026-04-15
**Core Value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking — the tool must enhance the human facilitation team, never slow it down or break immersion.

**Milestone goal:** Close the operational gaps surfaced by the v1.0 live run and the HTTP deploy incident — so the next live exercise starts from a known-good pipeline.

## v1.1 Requirements

### Health Check — Backend

- [x] **HEALTH-01**: Backend exposes `GET /api/health/llm` that performs a minimal authenticated round-trip to the corporate LLM endpoint
- [x] **HEALTH-02**: Response returns `{ ok: true, latencyMs }` on success
- [x] **HEALTH-03**: Response returns `{ ok: false, status, code, hint }` on failure (HTTP status, error code, actionable hint like "Check LLM_API_KEY in .env")
- [x] **HEALTH-04**: Endpoint uses a minimal prompt (~50 tokens) to minimise cost per check
- [x] **HEALTH-05**: Endpoint honours the same `LLM_EXTRA_HEADERS` / auth-mode config as `/api/llm`
- [x] **HEALTH-06**: Endpoint times out after 15s and returns `ok: false` with timeout hint

### Health Check — Frontend

- [x] **HEALTH-07**: Setup screen shows a status indicator (green dot = healthy, red dot = failed, grey/spinner = checking)
- [x] **HEALTH-08**: Status indicator auto-checks on setup-screen mount
- [x] **HEALTH-09**: Status indicator shows a "Re-check" button the facilitator can click
- [x] **HEALTH-10**: On failure, status panel displays the actionable error from the backend (status code + hint)
- [x] **HEALTH-11**: "Launch Scenario" button is disabled while status is failed or checking
- [x] **HEALTH-12**: Successful check displays latency (e.g. "Connected — 820ms")

### Polish — Routing

- [ ] **ROUTE-01**: `/game` route with null `gameState` redirects to `/setup` unconditionally (no DEV auto-seed)
- [ ] **ROUTE-02**: Removing DEV auto-seed eliminates the React setState-during-render warning at `gameStore.ts:304`

### Polish — Debrief

- [ ] **DEBRIEF-01**: Facilitator input text captured in debrief export preserves the first character (no "ound 1..." truncation)

### Polish — Prompt Engineering

- [ ] **PROMPT-01**: Crisis state auto-advances from "No Crisis" → "Supply Crisis" → "Security-Related Supply Crisis" when severity thresholds are crossed
- [ ] **PROMPT-02**: Transition rule documented in system prompt so Finch persona triggers it reliably
- [ ] **PROMPT-03**: Verified empirically via replay of the v1.0 Scenario 2 live run (severity=4 must trigger the transition)

## Future Requirements (deferred to v2+)

### Observability

- Streaming LLM responses token-by-token (if corporate endpoint supports SSE)
- Session analytics dashboard (response times, token usage, persona distribution)

### Config UX

- Visual config editor (form-based, not raw JSON)

## Out of Scope

| Feature | Reason |
|---------|--------|
| HTTPS / TLS | Infrastructure concern; handled via reverse proxy on target server, not app code |
| Game header live health widget | Setup-screen gate is sufficient; keeps in-game UI minimal (per v1.0 core value) |
| Token usage / response-time analytics | Deferred to v2 session analytics candidate |
| Retry budget / circuit breaker on health endpoint | Manual re-check button covers facilitator intent; automated retries add complexity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HEALTH-01 | Phase 9 | Complete |
| HEALTH-02 | Phase 9 | Complete |
| HEALTH-03 | Phase 9 | Complete |
| HEALTH-04 | Phase 9 | Complete |
| HEALTH-05 | Phase 9 | Complete |
| HEALTH-06 | Phase 9 | Complete |
| HEALTH-07 | Phase 10 | Complete |
| HEALTH-08 | Phase 10 | Complete |
| HEALTH-09 | Phase 10 | Complete |
| HEALTH-10 | Phase 10 | Complete |
| HEALTH-11 | Phase 10 | Complete |
| HEALTH-12 | Phase 10 | Complete |
| ROUTE-01 | Phase 11 | Pending |
| ROUTE-02 | Phase 11 | Pending |
| DEBRIEF-01 | Phase 11 | Pending |
| PROMPT-01 | Phase 12 | Pending |
| PROMPT-02 | Phase 12 | Pending |
| PROMPT-03 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 18 total
- Mapped to phases: 18 (Phase 9: 6, Phase 10: 6, Phase 11: 3, Phase 12: 3)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 after v1.1 roadmap creation*
