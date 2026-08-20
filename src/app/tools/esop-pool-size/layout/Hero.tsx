interface HeroProps {
  /** design.md's two page states share this header; only the pre-results
   *  wizard is the 720px column this redesign scopes to (see EsopPoolSizeClient.tsx
   *  and PROJECT.md's 2026-08-18 restraint pass) — the results workspace keeps
   *  its own established `max-w-page` layout, untouched. */
  readonly showResults?: boolean;
}

/**
 * The page's one display moment. Set in DM Serif Display italic, left
 * aligned, with the gradient (accent to terracotta) spent on the single noun
 * phrase the whole tool is about — the design system reserves that treatment
 * for exactly one high-impact headline, and this is it.
 *
 * The breadcrumb is the micro-label above it rather than a line of body copy,
 * and a hairline closes the block: the editorial masthead pattern, not a page
 * title with a subtitle under it.
 *
 * ONE LINE, AT EVERY WIDTH.
 *
 * The headline is set on a single line rather than allowed to wrap, which is
 * the one place this file departs from §3's hero size table. That table's
 * 60px LG step needs 841px of line box; the pre-results column is 720px wide
 * (§5's `container-narrow`), so 60px wrapped to two lines and the display
 * moment read as a paragraph.
 *
 * The size is therefore solved from the measured width of the string rather
 * than picked from the table. Measured in the browser, in the real face:
 * "How big should your ESOP pool be?" in DM Serif Display italic at -0.03em
 * occupies **14.01px of width per 1px of font-size**. `calc()` inverts that —
 * the divisor carries ~3% headroom over the measurement so a fallback face or
 * a hinting difference cannot push it over — and `min()` caps it at 45px,
 * which is the largest step that still fits the 672px content box of the
 * narrow column (45 x 14.01 = 630px).
 *
 * This couples the size to *this* string. If the headline copy changes, the
 * divisor has to be re-measured or the line will break — the trade for a
 * guaranteed single line at every viewport from 320px up.
 */
const HERO_ONE_LINE = 'whitespace-nowrap text-[min(45px,calc((100vw-56px)/14.4))]';

export function Hero({ showResults = false }: HeroProps) {
  return (
    <div
      className={`mx-auto flex flex-col px-6 pb-2 ${
        showResults ? 'max-w-page pt-8 lg:px-16' : 'max-w-[720px] pt-10 sm:pt-14'
      }`}
    >
      <nav aria-label="Breadcrumb" className="section-label flex items-center gap-2 text-faint">
        <span>Resources</span>
        <span aria-hidden="true">/</span>
        <span>Tools</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-accent">
          ESOP Pool Sizing
        </span>
      </nav>
      <h1
        className={`heading-hero text-ink ${
          showResults ? 'mt-4 whitespace-nowrap text-[min(30px,calc((100vw-56px)/14.4))]' : `mt-6 ${HERO_ONE_LINE}`
        }`}
      >
        How big should your <span className="text-gradient">ESOP pool</span> be?
      </h1>
      <p className={`max-w-[46ch] leading-relaxed text-sub ${showResults ? 'mt-3 text-small' : 'mt-5 text-body'}`}>
        Sized against your hiring plan, not a rule of thumb.
      </p>
      <hr className={`section-divider ${showResults ? 'mt-6' : 'mt-10'}`} />
    </div>
  );
}
