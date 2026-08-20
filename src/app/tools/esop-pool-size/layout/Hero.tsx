interface HeroProps {
  /**
   * Which of the page's two states this masthead is heading.
   *
   * `aside` — the pre-results layout, where the masthead is the top of a left
   * rail that runs beside the form rather than a band above it.
   * `banner` — the results workspace, where it still spans the full 1312px
   * container above the model rail and the report.
   */
  readonly variant?: 'aside' | 'banner';
}

/**
 * The page's one display moment. DM Serif Display italic, left aligned, with
 * the gradient (accent to terracotta) spent on the single noun phrase the
 * whole tool is about — the design system reserves that treatment for exactly
 * one high-impact headline, and this is it.
 *
 * The breadcrumb is the micro-label above it rather than a line of body copy,
 * and a hairline closes the block: the editorial masthead pattern, not a page
 * title with a subtitle under it.
 *
 * ONE LINE, AT EVERY WIDTH.
 *
 * The headline is set on a single line rather than allowed to wrap, which is
 * the one place this file departs from §3's hero size table. The size is
 * solved from the measured width of the string rather than picked from the
 * table: measured in the browser in the real face, "How big should your ESOP
 * pool be?" in DM Serif Display italic at -0.03em occupies **14.01px of width
 * per 1px of font-size**. `calc()` inverts that — the divisor carries ~3%
 * headroom so a fallback face cannot push it over — and `min()` caps it at the
 * largest step that fits the column it is in.
 *
 * There are two caps because there are two column widths. Below `xl` the
 * masthead sits above a 720px form column (672px of content), so 45px fits.
 * At `xl` and up it moves into the 420px left rail, so it steps down to 28px
 * (28 x 14.01 = 392px). Both are single lines; neither wraps.
 *
 * This couples the size to *this* string. If the headline copy changes, the
 * divisor and both caps have to be re-measured or the line will break — the
 * trade for a guaranteed single line at every viewport from 320px up.
 */
const HERO_ONE_LINE = 'whitespace-nowrap text-[min(45px,calc((100vw-56px)/14.4))] xl:text-[28px]';

/** The results workspace keeps the compressed masthead: once there is an
 *  answer on screen, the headline yields to it. */
const HERO_COMPACT = 'whitespace-nowrap text-[min(30px,calc((100vw-56px)/14.4))]';

export function Hero({ variant = 'aside' }: HeroProps) {
  const isBanner = variant === 'banner';

  return (
    <div className={isBanner ? 'mx-auto flex max-w-page flex-col px-6 pb-2 pt-8 lg:px-16' : 'flex flex-col'}>
      <nav aria-label="Breadcrumb" className="section-label flex items-center gap-2 text-faint">
        <span>Resources</span>
        <span aria-hidden="true">/</span>
        <span>Tools</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-accent">
          ESOP Pool Sizing
        </span>
      </nav>
      <h1 className={`heading-hero mt-6 text-ink ${isBanner ? HERO_COMPACT : HERO_ONE_LINE}`}>
        How big should your <span className="text-gradient">ESOP pool</span> be?
      </h1>
      <p className={`max-w-[46ch] leading-relaxed text-sub ${isBanner ? 'mt-3 text-small' : 'mt-5 text-body'}`}>
        Sized against your hiring plan, not a rule of thumb.
      </p>
      <hr className={`section-divider ${isBanner ? 'mt-6' : 'mt-10'}`} />
    </div>
  );
}
