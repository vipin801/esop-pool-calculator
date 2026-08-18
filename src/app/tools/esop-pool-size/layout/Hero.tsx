interface HeroProps {
  /** design.md's two page states share this header; only the pre-results
   *  wizard is the 720px column this redesign scopes to (see EsopPoolSizeClient.tsx
   *  and PROJECT.md's 2026-08-18 restraint pass) — the results workspace keeps
   *  its own established `max-w-page` layout, untouched. */
  readonly showResults?: boolean;
}

export function Hero({ showResults = false }: HeroProps) {
  return (
    <div className={`mx-auto flex flex-col gap-2 px-6 pt-4 ${showResults ? 'max-w-page' : 'max-w-[720px]'}`}>
      <nav aria-label="Breadcrumb" className="text-eyebrow text-sub">
        <span>Resources</span> <span aria-hidden="true">›</span> <span>Tools</span>{' '}
        <span aria-hidden="true">›</span>{' '}
        <span aria-current="page" className="text-sub">
          ESOP Pool Sizing
        </span>
      </nav>
      <h1 className="font-[family-name:var(--font-display)] text-[32px] font-normal leading-[1.15] tracking-[var(--tracking-display)] text-ink sm:text-[44px]">
        How big should your ESOP pool be?
      </h1>
      <p className="max-w-[52ch] text-[18px] leading-relaxed text-sub">
        Sized against your hiring plan, not a rule of thumb.
      </p>
    </div>
  );
}
