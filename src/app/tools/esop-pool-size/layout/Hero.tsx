interface HeroProps {
  /** design.md's two page states share this header; only the pre-results
   *  wizard is the 720px column this redesign scopes to (see EsopPoolSizeClient.tsx
   *  and PROJECT.md's 2026-08-18 restraint pass) — the results workspace keeps
   *  its own established `max-w-page` layout, untouched. */
  readonly showResults?: boolean;
}

/**
 * The page's one display moment. Set in DM Serif Display italic at the
 * document's own hero size, with the gradient (accent to terracotta) spent on
 * the single noun phrase the whole tool is about — the design system reserves
 * that treatment for exactly one high-impact headline, and this is it.
 *
 * The breadcrumb is the micro-label above it rather than a line of body copy,
 * and a hairline closes the block: the editorial masthead pattern, not a page
 * title with a subtitle under it.
 */
export function Hero({ showResults = false }: HeroProps) {
  return (
    <div
      className={`mx-auto flex flex-col px-6 pb-2 ${
        showResults ? 'max-w-page pt-8' : 'max-w-[720px] pt-10 sm:pt-14'
      }`}
    >
      <nav aria-label="Breadcrumb" className="eyebrow flex items-center gap-2 text-faint">
        <span>Resources</span>
        <span aria-hidden="true">/</span>
        <span>Tools</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-accent">
          ESOP Pool Sizing
        </span>
      </nav>
      <h1 className={`display text-ink ${showResults ? 'mt-4 text-h2' : 'mt-6 text-hero'}`}>
        How big should your <span className="gradient-text">ESOP pool</span> be?
      </h1>
      <p className={`max-w-[46ch] leading-relaxed text-sub ${showResults ? 'mt-3 text-small' : 'mt-5 text-body'}`}>
        Sized against your hiring plan, not a rule of thumb.
      </p>
      <hr className={`border-0 border-t border-border ${showResults ? 'mt-6' : 'mt-8'}`} />
    </div>
  );
}
