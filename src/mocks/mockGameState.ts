/**
 * Dev-only mock data for Phase 5 game screen rendering.
 *
 * Provides a mid-game Round 2 snapshot that exercises every visual in
 * Phase 5: STRAINED team (pc=1), CRISIS team (pc=0), all MessageTypes,
 * and a partial persona set after the last round_divider (kent+finch only,
 * no chen — so persona indicator dots render 2 lit / 1 dim).
 *
 * NEVER import this file from production code paths.
 */

import type { GameState, ChatMessage } from '@/types/game'

// ─── Mock Game State ─────────────────────────────────────────────────────────

export const MOCK_GAME_STATE: GameState = {
  round: 2,
  scenarioIndex: 0,
  crisisSeverity: 3,
  crisisState: 'Supply Crisis',
  edipLegitimacy: 1,
  cardsThisRound: [],
  teams: [
    {
      id: 'A',
      name: 'Team A: Frontline & High-Threat',
      pc: 1,
      po: 0,
      readiness: 3,
      stock: 2,
      crm: 2,
      ic: 2,
    }, // STRAINED (pc=1)
    {
      id: 'B',
      name: 'Team B: Industrial Powerhouses',
      pc: 0,
      po: 1,
      readiness: 3,
      stock: 3,
      crm: 2,
      ic: 5,
    }, // CRISIS (pc=0)
    {
      id: 'C',
      name: 'Team C: Rear Support & Logistics',
      pc: 3,
      po: 0,
      readiness: 3,
      stock: 3,
      crm: 3,
      ic: 3,
    },
    {
      id: 'D',
      name: 'Team D: Balancing / Mixed-Interest',
      pc: 4,
      po: 1,
      readiness: 3,
      stock: 3,
      crm: 3,
      ic: 3,
    },
  ],
}

// ─── Mock Messages ────────────────────────────────────────────────────────────

/**
 * One of every MessageType. Round 1 block followed by Round 2 block.
 * Intentionally no chen message after m8 (the Round 2 divider) —
 * persona indicator dots must render 2 lit (kent, finch) / 1 dim (chen).
 */
export const MOCK_MESSAGES: ChatMessage[] = [
  // ── Round 1 ──────────────────────────────────────────────────────────────
  {
    id: 'm1',
    type: 'round_divider',
    label: 'Round 1',
    timestamp: '10:00',
  },
  {
    id: 'm2',
    type: 'persona',
    speaker: 'kent',
    text: '[Round 1 framing — CRM shortage identified; Team A should prioritise front-line stockpile preservation before considering transfers.]',
    timestamp: '10:01',
  },
  {
    id: 'm3',
    type: 'persona',
    speaker: 'finch',
    text: '[Round 1 economic analysis — industrial capacity strained at Team B; legitimacy cost of forced transfers is high this round.]',
    timestamp: '10:02',
  },
  {
    id: 'm4',
    type: 'persona',
    speaker: 'chen',
    text: '[Round 1 procedural note — no EDIP mechanism permits unilateral reallocation; voting rule applies.]',
    timestamp: '10:03',
  },
  {
    id: 'm5',
    type: 'facilitator',
    speaker: 'facilitator',
    text: 'Teams, please declare your national actions for Round 1.',
    timestamp: '10:05',
  },
  {
    id: 'm6',
    type: 'error',
    text: 'LLM timeout — response was not received. Please retry.',
    timestamp: '10:06',
  },
  {
    id: 'm7',
    type: 'debrief_divider',
    label: 'DEBRIEF',
    timestamp: '10:10',
  },
  // ── Round 2 ──────────────────────────────────────────────────────────────
  {
    id: 'm8',
    type: 'round_divider',
    label: 'Round 2',
    timestamp: '10:15',
  },
  {
    id: 'm9',
    type: 'persona',
    speaker: 'kent',
    text: '[Round 2 escalation response — severity tracker has advanced; recommend Prioritisation (Soft) cards this round.]',
    timestamp: '10:16',
  },
  {
    id: 'm10',
    type: 'persona',
    speaker: 'finch',
    text: '[Round 2 industry position — CRM stockpiles sufficient for two rounds without emergency measures.]',
    timestamp: '10:17',
  },
  // NOTE: No chen message after m8 — intentional.
  // Persona indicator dots must render 2 lit (kent, finch) / 1 dim (chen).
]
