const TokenReference = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-12 bg-bg-base min-h-screen">

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-xl text-text-primary mb-1">
          Design Token Reference
        </h1>
        <p className="font-mono uppercase tracking-wider text-text-secondary text-xs">
          Visual validation of all @theme tokens via Tailwind utility classes
        </p>
      </div>

      {/* ── Persona Colours ─────────────────────────────────────────────── */}
      <section className="border-t border-border-subtle pt-6 sm:pt-8 mt-6 sm:mt-8">
        <h2 className="font-mono uppercase tracking-widest text-text-secondary text-xs mb-4">
          Persona Colours
        </h2>
        <div className="flex flex-wrap gap-6">

          {/* Kent */}
          <div className="flex flex-col gap-2">
            <div className="w-12 h-12 rounded-sm bg-persona-kent" />
            <span className="font-mono text-xs text-persona-kent">Kent</span>
            <div className="px-3 py-2 rounded-sm bg-persona-kent/8 border-l-2 border-persona-kent/50">
              <span className="font-mono text-xs text-persona-kent">Tinted panel</span>
            </div>
          </div>

          {/* Finch */}
          <div className="flex flex-col gap-2">
            <div className="w-12 h-12 rounded-sm bg-persona-finch" />
            <span className="font-mono text-xs text-persona-finch">Finch</span>
            <div className="px-3 py-2 rounded-sm bg-persona-finch/8 border-l-2 border-persona-finch/50">
              <span className="font-mono text-xs text-persona-finch">Tinted panel</span>
            </div>
          </div>

          {/* Chen */}
          <div className="flex flex-col gap-2">
            <div className="w-12 h-12 rounded-sm bg-persona-chen" />
            <span className="font-mono text-xs text-persona-chen">Chen</span>
            <div className="px-3 py-2 rounded-sm bg-persona-chen/8 border-l-2 border-persona-chen/50">
              <span className="font-mono text-xs text-persona-chen">Tinted panel</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── Card Category Colours ────────────────────────────────────────── */}
      <section className="border-t border-border-subtle pt-6 sm:pt-8 mt-6 sm:mt-8">
        <h2 className="font-mono uppercase tracking-widest text-text-secondary text-xs mb-4">
          Card Category Colours
        </h2>
        <div className="flex flex-wrap gap-3">

          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-6 rounded-sm bg-category-crisis" />
            <span className="font-mono text-xs text-text-secondary text-center leading-tight">
              Crisis<br />State
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-6 rounded-sm bg-category-monitoring" />
            <span className="font-mono text-xs text-text-secondary text-center leading-tight">
              Monitoring
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-6 rounded-sm bg-category-prio-soft" />
            <span className="font-mono text-xs text-text-secondary text-center leading-tight">
              Prio<br />Soft
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-6 rounded-sm bg-category-prio-hard" />
            <span className="font-mono text-xs text-text-secondary text-center leading-tight">
              Prio<br />Hard
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-6 rounded-sm bg-category-demand" />
            <span className="font-mono text-xs text-text-secondary text-center leading-tight">
              Demand<br />Coord
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-6 rounded-sm bg-category-production" />
            <span className="font-mono text-xs text-text-secondary text-center leading-tight">
              Production<br />Accel
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-6 rounded-sm bg-category-transfers" />
            <span className="font-mono text-xs text-text-secondary text-center leading-tight">
              Transfers
            </span>
          </div>

        </div>
      </section>

      {/* ── Crisis State Badges ──────────────────────────────────────────── */}
      <section className="border-t border-border-subtle pt-6 sm:pt-8 mt-6 sm:mt-8">
        <h2 className="font-mono uppercase tracking-widest text-text-secondary text-xs mb-4">
          Crisis State Badges
        </h2>
        <div className="flex flex-wrap gap-3">

          <span className="bg-crisis-none/20 text-crisis-none border border-crisis-none/30 rounded-sm px-2 py-0.5 font-mono text-xs uppercase">
            No Crisis
          </span>

          <span className="bg-crisis-supply/20 text-crisis-supply border border-crisis-supply/30 rounded-sm px-2 py-0.5 font-mono text-xs uppercase">
            Supply Crisis
          </span>

          <span className="bg-crisis-security/20 text-crisis-security border border-crisis-security/30 rounded-sm px-2 py-0.5 font-mono text-xs uppercase">
            Security Crisis
          </span>

        </div>
      </section>

      {/* ── Track Bar Shells ─────────────────────────────────────────────── */}
      <section className="border-t border-border-subtle pt-6 sm:pt-8 mt-6 sm:mt-8">
        <h2 className="font-mono uppercase tracking-widest text-text-secondary text-xs mb-4">
          Track Bar Shells
        </h2>
        <div className="flex flex-col gap-4">

          {/* Severity track — ~60% fill */}
          <div>
            <span className="font-mono text-xs text-text-secondary block mb-1">
              Severity: 3 / 5
            </span>
            <div className="w-full h-1.5 bg-bg-surface rounded-sm overflow-hidden">
              <div className="h-full w-3/5 bg-track-severity rounded-sm" />
            </div>
          </div>

          {/* Legitimacy track — ~40% fill */}
          <div>
            <span className="font-mono text-xs text-text-secondary block mb-1">
              Legitimacy: 0 / -2 to +2
            </span>
            <div className="w-full h-1.5 bg-bg-surface rounded-sm overflow-hidden">
              <div className="h-full w-2/5 bg-track-legitimacy rounded-sm" />
            </div>
          </div>

        </div>
      </section>

      {/* ── Typography Samples ───────────────────────────────────────────── */}
      <section className="border-t border-border-subtle pt-6 sm:pt-8 mt-6 sm:mt-8">
        <h2 className="font-mono uppercase tracking-widest text-text-secondary text-xs mb-4">
          Typography Samples
        </h2>
        <div className="flex flex-col gap-3">
          <div className="font-display font-bold text-xl text-text-primary">
            Syne Display
          </div>
          <div className="font-body text-base text-text-primary">
            DM Sans Body Text — readable at small sizes, clear hierarchy
          </div>
          <div className="font-mono text-sm uppercase tracking-wider text-text-secondary">
            IBM Plex Mono Data
          </div>
        </div>
      </section>

      {/* ── Background & Border Samples ─────────────────────────────────── */}
      <section className="border-t border-border-subtle pt-6 sm:pt-8 mt-6 sm:mt-8">
        <h2 className="font-mono uppercase tracking-widest text-text-secondary text-xs mb-4">
          Background &amp; Border Samples
        </h2>
        <div className="flex flex-wrap gap-3">

          <div className="flex flex-col gap-1">
            <div className="w-16 h-10 rounded-sm bg-bg-base border border-border-default" />
            <span className="font-mono text-xs text-text-secondary">bg-base</span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="w-16 h-10 rounded-sm bg-bg-panel border border-border-default" />
            <span className="font-mono text-xs text-text-secondary">bg-panel</span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="w-16 h-10 rounded-sm bg-bg-surface border border-border-default" />
            <span className="font-mono text-xs text-text-secondary">bg-surface</span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="w-16 h-10 rounded-sm bg-bg-elevated border border-border-default" />
            <span className="font-mono text-xs text-text-secondary">bg-elevated</span>
          </div>

        </div>
      </section>

      {/* ── Resource Colours ─────────────────────────────────────────────── */}
      <section className="border-t border-border-subtle pt-6 sm:pt-8 mt-6 sm:mt-8">
        <h2 className="font-mono uppercase tracking-widest text-text-secondary text-xs mb-4">
          Resource Colours
        </h2>
        <div className="flex flex-wrap gap-4">

          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-resource-pc" />
            <span className="font-mono text-xs text-text-secondary">PC</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-resource-po" />
            <span className="font-mono text-xs text-text-secondary">PO</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-resource-readiness" />
            <span className="font-mono text-xs text-text-secondary">Readiness</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-resource-stock" />
            <span className="font-mono text-xs text-text-secondary">Stock</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-resource-crm" />
            <span className="font-mono text-xs text-text-secondary">CRM</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-resource-ic" />
            <span className="font-mono text-xs text-text-secondary">IC</span>
          </div>

        </div>
      </section>

    </div>
  )
}

export default TokenReference
