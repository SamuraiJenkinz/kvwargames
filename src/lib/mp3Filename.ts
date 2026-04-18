/**
 * Kebab-case a display name for filename use, strict variant.
 * Per CONTEXT.md spec:
 *   lowercase → replace spaces with hyphens → strip any remaining non-[a-z0-9-]
 *   → collapse runs of hyphens → trim edge hyphens → fallback 'session' on empty.
 *
 * Distinct from toKebabFilename in debriefExporter.ts (which returns 'game' on
 * empty and keeps underscores during its substitution pass). The MP3 fallback
 * is 'session' per CONTEXT.md Download Filename Edge Cases.
 */
export function toKebabFilenameStrict(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'session'
  )
}

/**
 * Build the MP3 download filename using the client's LOCAL time at the moment
 * the user clicked Generate.
 *
 * Format: debrief-{kebab-game-name}-{YYYY-MM-DD-HHmm}.mp3
 * Example: debrief-pandemic-rehearsal-2026-04-18-1547.mp3
 *
 * Why local time (not UTC): a facilitator in AEST clicking at 3pm expects
 * "1500", not "0500" from the prior UTC day. See CONTEXT.md + RESEARCH.md
 * Pitfall 6.
 */
export function buildMp3Filename(gameName: string, clickedAt: Date): string {
  const kebab = toKebabFilenameStrict(gameName)
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts =
    `${clickedAt.getFullYear()}-${pad(clickedAt.getMonth() + 1)}-${pad(clickedAt.getDate())}-` +
    `${pad(clickedAt.getHours())}${pad(clickedAt.getMinutes())}`
  return `debrief-${kebab}-${ts}.mp3`
}
