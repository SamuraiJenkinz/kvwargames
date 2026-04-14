import type { ChatMessage, PersonaId } from '@/types/game'

// ─── PC Badge State ──────────────────────────────────────────────────────────

export type PcBadgeState = 'CRISIS' | 'STRAINED' | null

/**
 * Maps a team's Political Capital (PC) value to a badge display state.
 * PC=0 → CRISIS, PC=1 → STRAINED, PC≥2 → null (no badge).
 */
export function getPcBadge(pc: number): PcBadgeState {
  if (pc === 0) return 'CRISIS'
  if (pc === 1) return 'STRAINED'
  return null
}

// ─── Round Coverage ──────────────────────────────────────────────────────────

/**
 * Returns the set of personas who have spoken at least once since the most
 * recent round_divider (i.e. during the current round). Used by the
 * StatePanel persona indicator dots to show round-coverage at a glance.
 *
 * If there are no round_divider messages, scans the entire message list.
 */
export function getPersonasThisRound(messages: ChatMessage[]): Set<PersonaId> {
  // Find index of the last round_divider
  let startIndex = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'round_divider') {
      startIndex = i + 1
      break
    }
  }

  const spoken = new Set<PersonaId>()
  for (let i = startIndex; i < messages.length; i++) {
    const m = messages[i]
    if (m.type === 'persona' && m.speaker && m.speaker !== 'facilitator') {
      spoken.add(m.speaker as PersonaId)
    }
  }
  return spoken
}
