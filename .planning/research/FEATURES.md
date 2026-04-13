# Feature Landscape: AI-Powered Wargame Facilitation Engine

**Domain:** AI-assisted policy tabletop exercise facilitation tool
**Project:** KV War Game Engine (EDIP Security of Supply)
**Researched:** 2026-04-13
**Confidence:** HIGH — derived from authoritative spec (WARGAME_ENGINE_DEV_SPEC.md) and domain knowledge of tabletop facilitation tooling

---

## Methodology Note

WebSearch was unavailable. Findings are grounded in:
1. The authoritative project spec (`WARGAME_ENGINE_DEV_SPEC.md`) — HIGH confidence
2. Domain knowledge of tabletop exercise tooling (RAND wargaming literature, FEMA TTX tools, Catalyst/Tabletop Simulator conventions) — MEDIUM confidence
3. AI assistant product patterns (multi-persona chatbots, co-pilot interfaces) — HIGH confidence

No verified competitor product exists that combines all three: multi-persona AI, live state tracking, and policy exercise facilitation. This is a differentiated product, not a commodity one.

---

## Table Stakes

Features that facilitators and exercise designers will expect as baseline. Missing any = product feels broken or incomplete for the use case.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time chat interface with AI responses | Core value delivery — without it there is no product | Med | Streaming preferred but polling acceptable for this use case |
| Visually distinct persona identities | If three voices look identical, immersion collapses immediately | Low | Avatar, colour, name, title per persona |
| Loading/thinking indicator | Without it, facilitators assume the tool is frozen | Low | Animated dots during LLM call |
| Live game state dashboard | Facilitator must see crisis severity, resources without mental math | Med | Left panel: track bars, team resource grids |
| Round counter and round advancement | Facilitators orient by round; it is the primary temporal anchor | Low | Header display + "Advance Round" button |
| Crisis state display | The most important macro game variable; must be immediately visible | Low | Status badge with colour coding (green/amber/red) |
| In-session card reference | Facilitators cannot memorise 11 cards; they need clickable lookup | Low | Right panel, list + detail view |
| Facilitator input bar | The primary interaction point; must be obvious and always accessible | Low | Bottom bar, full width, always visible |
| Error state handling | LLM calls fail; silence is worse than a visible error message | Low | Red-tinted error message in chat feed |
| Session debrief export | Exercises produce debrief content that clients need after the room | Med | Markdown download |
| Config loading (JSON) | Game content must be separable from the engine | Med | JSON textarea with parse validation |

---

## Differentiators

Features that are not expected by default in this space but create significant value and competitive distance.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Three distinct AI personas with routing logic | No generic AI assistant does contextual persona selection. Kent/Finch/Chen each own a domain; the routing logic makes the tool feel like a trained facilitation team, not a chatbot | High | Routing decision table per trigger type; persona system prompt engineering |
| Structured JSON state updates from LLM | Most tools display AI commentary; this tool actually changes the game state from AI responses. It closes the loop between narrative and mechanics | High | Parsing, validation, clamping pipeline; stateUpdater.ts is critical |
| Config generation from text brief | Lowers barrier to reuse dramatically — a facilitator writes a paragraph, gets a playable game config. No other facilitation tool does this | High | generate-config API route + schema-constrained LLM prompt |
| Reusable game engine (JSON config schema) | The EDIP game is not the product; the engine is. Config-driven architecture means each new exercise is config, not code | Med | GameConfig interface; schema must be stable across games |
| Persona flag system | The `flag` field in LLM responses surfaces facilitator-facing procedural warnings ("PC threshold reached," "EDIP Legitimacy at risk") without breaking persona voice | Med | Separate amber banner in chat; LLM must be trained to use it correctly |
| EO Response mechanic integration | Economic Operator response scenarios are a core EDIP realism feature; they surface compliance/resistance dynamics that policy exercises need | Med | Routing: Finch models paths, Chen presents choice |
| PC threshold warning badges | Prevents facilitators from missing a strained team state; STRAINED/CRISIS visual badge on team cards | Low | Threshold detection in StatePanel; amber/red badges |
| Round inject delivery via AI | Injects are delivered by Finch as scenario engine, framed by Kent — this is meaningfully better than a facilitator reading from notes | Med | Round start auto-trigger calling LLM with inject text |
| Facilitator flag for disputes | Deliberation friction routes to Kent, who facilitates rather than resolving. This respects that AI must not adjudicate player disputes | Med | Routing rule; Kent-only zone |
| Dark themed high-information-density UI | Policy exercise facilitation tools are universally bland; a polished dark interface with information hierarchy signals professionalism at the table | Med | Tailwind tokens; IBM Plex Mono for data; Syne for headers |

---

## Anti-Features

Features to deliberately NOT build. These are common mistakes in this category or features that would harm the product's core purpose.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-user real-time collaboration | Adds WebSocket complexity, auth complexity, and state sync complexity. The exercise is run by one facilitator; team participants are not using the tool | Single-facilitator model; spec explicitly excludes this |
| Persistent session history / saved games | Creates GDPR/data retention questions and requires a database. Policy exercises often involve sensitive geopolitical scenarios; ephemeral is a feature, not a limitation | Zustand in-memory only; export debrief at end |
| User accounts and authentication | Corporate SSO handles this at the network layer; building auth inside the app duplicates effort and creates credential management risk | Document SSO middleware hook in deployment notes |
| Full game automation / AI-driven teams | The AI does not play the teams; it supports the human facilitation team. AI playing teams would replace the exercise, not enhance it | AI responds to facilitator input; never originates team decisions |
| Mobile-first or mobile-optimised layout | This is a laptop tool at a facilitation table. Mobile-first layout compromises the information density the 1280px layout supports | 1280px primary; tablet-usable is sufficient |
| Chat history persistence across sessions | Tempting for analytics, but creates data sensitivity problems. Debrief export is the right channel for post-session content | Debrief export covers the legitimate use case |
| Streaming LLM responses token-by-token | Increases implementation complexity significantly and provides marginal value. The 2-4 sentence response is short enough that whole-response delivery feels fast | POST request returning complete response; loading indicator covers latency |
| Per-team interfaces or player-facing views | Players are at a physical table; they do not use screens. A player-facing UI would require multi-user collaboration and misunderstands the use case | Facilitator-only tool |
| AI-generated images or visual scenario art | Adds token cost, latency, and complexity. The UI design system already provides visual identity through colour tokens | Persona identity via avatar initials, colour, typography |
| Complex undo/redo state history | Adds state machine complexity. Facilitators discuss decisions verbally; if a state update is wrong, they type a correction in the next input | Simple clamped state; facilitator corrects via subsequent input |
| Drag-and-drop physical token simulation | Gamification feature that delays delivery without adding exercise value. Resources are numbers, not virtual tokens | Numeric display with resource grids |
| LLM model selection in UI | Exposes implementation detail to the facilitator. Model is an infrastructure decision, not a facilitation decision | Environment variable only; no UI for model selection |

---

## Feature Dependencies

What requires what, in build order.

```
TypeScript interfaces (game.ts, llm.ts)
  └─ EDIP config constant (edipConfig.ts)
      └─ Zustand store (gameStore.ts)
          ├─ Setup screen (JSON load, brief generation, scenario launch)
          │   └─ Config generation API route (/api/generate-config)
          └─ Game screen layout (GameHeader, StatePanel, ChatFeed, ReferencePanel, FacilitatorInput)
              └─ LLM proxy route (/api/llm)
                  └─ LLM client (llmClient.ts)
                      └─ Prompt builder (promptBuilder.ts)
                          └─ State updater (stateUpdater.ts)
                              └─ Persona routing (routing rules in system prompt)
                                  ├─ Round start auto-trigger
                                  ├─ Facilitator input handler
                                  ├─ Advance round action
                                  └─ Debrief trigger
                                      └─ Debrief export (debriefExporter.ts)
```

Critical path dependencies:

| Feature | Requires | Blocked Until |
|---------|----------|---------------|
| Game screen renders | Zustand store | Store complete |
| LLM calls work | /api/llm route + promptBuilder | Both complete |
| Personas respond in-character | Routing rules in system prompt | promptBuilder complete |
| State updates apply | stateUpdater.ts + applyStateUpdate | Both complete |
| Config generation | /api/generate-config route | LLM proxy complete |
| Debrief export | isDebrief message flags from LLM | LLM integration complete |
| PC warning badges | State dashboard + team resource data | StatePanel complete |
| Inject delivery | Round start auto-trigger + LLM integration | LLM integration complete |
| Flag banners in chat | LLM returns `flag` field | Persona routing complete |

---

## MVP Definition

### MVP: What Must Ship for the Tool to Be Usable at a Facilitation Table

The MVP is the minimum set of features that allows a facilitator to run a live EDIP exercise with AI support from start to finish, without embarrassing gaps.

**Must have in MVP:**

1. **Setup flow** — load EDIP default config, select scenario, launch game
2. **Three-column game layout** — state panel, chat feed, reference panel
3. **Three visually distinct personas** — Kent (blue), Finch (amber), Chen (green) responding in-character
4. **Live game state dashboard** — crisis severity track, EDIP legitimacy track, all four team resource grids
5. **Round advancement with inject delivery** — Finch delivers inject, Kent frames round
6. **Facilitator input handler** — type event, receive persona responses
7. **Persona routing logic** — correct persona speaks for correct trigger
8. **State updates from LLM** — crisisSeverity, crisisState, edipLegitimacy, teamUpdates applied with clamping
9. **Reference panel** — CARDS tab (list + detail), ACTIONS tab (national actions + unique team powers), GUIDE tab
10. **Debrief trigger and export** — "End Game + Debrief" button, three-persona debrief, markdown download
11. **LLM proxy** — credentials server-side only, never in browser
12. **Error handling** — LLM errors shown in chat, not silent failures

**Defer to post-MVP:**

| Feature | Reason to Defer |
|---------|----------------|
| Config generation from text brief | Nice-to-have; EDIP config covers the launch use case; generation is complex to prompt-engineer reliably |
| PC warning STRAINED/CRISIS badges | Low-risk addition post-MVP; resource numbers are visible already |
| Keyboard shortcuts (Enter, Escape) | Polish; not functional blocker |
| Responsive tablet layout | Primary target is 1280px laptop; tablet is stretch goal |
| Config JSON editing in review mode | Load-only is sufficient for MVP; editing is a power-user feature |

---

## Feature Prioritization Matrix

Ranked by: (impact on facilitation quality) × (delivery risk). High impact + low risk = ship first.

| Priority | Feature | Impact | Risk | Phase |
|----------|---------|--------|------|-------|
| P0 | TypeScript interfaces + EDIP config + Zustand store | Foundation — nothing works without it | Low | Phase 1 |
| P0 | LLM proxy + llmClient | Core integration — nothing AI works without it | Med | Phase 4 |
| P0 | promptBuilder with persona routing | Persona voice + state updates depend on this | High | Phase 4 |
| P0 | Three-column game layout + persona message rendering | Visual identity and immersion | Low | Phase 3 |
| P0 | Live state dashboard (tracks + team resources) | Facilitator situational awareness | Low | Phase 3 |
| P1 | Round advancement + inject delivery | Temporal structure of exercise | Med | Phase 4 |
| P1 | Facilitator input → persona response | Primary interaction loop | Med | Phase 4 |
| P1 | stateUpdater with clamping | State integrity; prevents negative resource absurdities | Low | Phase 4 |
| P1 | Reference panel (all three tabs) | Reduces facilitator cognitive load during play | Low | Phase 3 |
| P1 | Debrief trigger + export | Closes the session; captures client deliverable | Med | Phase 5 |
| P2 | Setup screen (load + launch) | Required to start a game, but simple to build | Low | Phase 2 |
| P2 | PC warning badges | Prevents missed threshold moments | Low | Phase 5 |
| P2 | Error states in chat | Graceful degradation | Low | Phase 5 |
| P3 | Config generation from brief | High facilitation value but high prompt-engineering risk | High | Phase 5 |
| P3 | Keyboard shortcuts | Polish | Low | Phase 5 |
| P3 | Tablet-responsive layout | Stretch goal | Low | Phase 5 |

---

## Confidence Assessment

| Area | Level | Notes |
|------|-------|-------|
| Table stakes features | HIGH | Grounded in spec + domain knowledge of facilitation tooling |
| Differentiators | HIGH | Grounded in spec; AI persona routing is genuinely uncommon in this space |
| Anti-features | HIGH | Spec explicitly lists non-goals; these confirm the reasoning |
| Feature dependencies | HIGH | Derived from spec's data flow and component architecture |
| MVP scope | HIGH | Derived from spec's Phase 1-5 ordering and stated goals |
| Competitor landscape | LOW | WebSearch unavailable; no verified competitor product research |

---

## Sources

- `C:/KVWarGame/WARGAME_ENGINE_DEV_SPEC.md` — authoritative implementation spec (HIGH confidence)
- `C:/KVWarGame/.planning/PROJECT.md` — requirements and constraints (HIGH confidence)
- Domain knowledge: RAND wargaming methodology, FEMA TTX facilitation conventions, Tabletop Simulator UI patterns (MEDIUM confidence — training knowledge, August 2025 cutoff)
- AI assistant product patterns: multi-persona chatbot interfaces, co-pilot tools (HIGH confidence)
