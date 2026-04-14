import type { PersonaId } from '@/types/game'

// ─── Persona Metadata ────────────────────────────────────────────────────────

// Initials per REQUIREMENTS.md CHAT-02 (overrides CONTEXT.md's K/F/C)
export interface PersonaMeta {
  displayName: string
  initials: string    // two-letter avatar initials per CHAT-02 (KV/AF/MC)
  colorClass: string  // Tailwind bg class for avatar fill
  textClass: string   // Tailwind text class for name colour
  bubbleClass: string // Tailwind classes for tinted bubble bg + border
  dotClass: string    // Tailwind bg class for persona dot
}

export const PERSONA_META: Record<PersonaId, PersonaMeta> = {
  // Initials per REQUIREMENTS.md CHAT-02 (overrides CONTEXT.md's K/F/C)
  kent: {
    displayName: 'Kent',
    initials: 'KV',
    colorClass: 'bg-persona-kent',
    textClass: 'text-persona-kent',
    bubbleClass: 'bg-persona-kent/8 border-l-2 border-persona-kent/50',
    dotClass: 'bg-persona-kent',
  },
  finch: {
    displayName: 'Finch',
    initials: 'AF',
    colorClass: 'bg-persona-finch',
    textClass: 'text-persona-finch',
    bubbleClass: 'bg-persona-finch/8 border-l-2 border-persona-finch/50',
    dotClass: 'bg-persona-finch',
  },
  chen: {
    displayName: 'Chen',
    initials: 'MC',
    colorClass: 'bg-persona-chen',
    textClass: 'text-persona-chen',
    bubbleClass: 'bg-persona-chen/8 border-l-2 border-persona-chen/50',
    dotClass: 'bg-persona-chen',
  },
}

export const PERSONA_ORDER: PersonaId[] = ['kent', 'finch', 'chen']
