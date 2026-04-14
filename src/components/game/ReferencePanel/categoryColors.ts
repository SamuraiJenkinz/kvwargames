// Category `cat` string -> Tailwind background class (4px left chip)
// Pre-baked lookup required by Tailwind v4 — do NOT template-literal class names or they will be purged.
export const CAT_CHIP_CLASS: Record<string, string> = {
  'Crisis State':              'bg-category-crisis',
  'Monitoring':                'bg-category-monitoring',
  'Prioritisation (Soft)':     'bg-category-prio-soft',
  'Prioritisation (Hard)':     'bg-category-prio-hard',
  'Demand Coordination':       'bg-category-demand',
  'Production Acceleration':   'bg-category-production',
  'Transfers':                 'bg-category-transfers',
}

export function catChipClass(cat: string): string {
  return CAT_CHIP_CLASS[cat] ?? 'bg-border-default'
}
