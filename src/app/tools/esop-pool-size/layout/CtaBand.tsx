import { Button } from '../ui/Button';

interface CtaBandProps {
  /**
   * `band` — the full-width block below the report in the results workspace.
   * Centered, on the warm `muted` surface, as its own display moment.
   *
   * `aside` — the same pitch in the pre-results left rail, under the
   * masthead. Left aligned and unfilled, because in that column it is the
   * *second* thing a reader meets rather than a band they arrive at, and a
   * centered filled panel 420px wide reads as a card rather than as a
   * continuation of the masthead above it.
   */
  readonly variant?: 'band' | 'aside';
}

/**
 * The page's second display moment. Set in the display face at section scale;
 * in `band` it sits on the warm `muted` surface so it reads as a change of
 * material rather than as one more card in the stack.
 */
export function CtaBand({ variant = 'band' }: CtaBandProps) {
  const isAside = variant === 'aside';

  return (
    <section
      className={
        isAside
          ? 'text-left'
          : 'rounded-lg border border-border bg-muted px-6 py-14 text-center sm:px-12'
      }
    >
      <p className="section-label text-accent">Tabulate</p>
      <h2
        className={`heading-section mt-5 text-ink ${
          isAside ? 'text-[22px]' : 'mx-auto max-w-[24ch]'
        }`}
      >
        This model runs on assumptions. Tabulate runs on your actual cap table.
      </h2>
      <p className={`mt-5 text-small leading-relaxed text-sub ${isAside ? 'max-w-[40ch]' : 'mx-auto max-w-[48ch]'}`}>
        Tabulate is Incentiv&apos;s equity management product for grants, vesting and exercises.
      </p>
      {/* Book a demo is the primary here — Explore Tabulate a bordered
          ghost beside it, not a second identical secondary (2026-08-18). */}
      <div className={`mt-8 flex flex-wrap gap-3 ${isAside ? '' : 'justify-center'}`}>
        <Button size="md">Book a demo</Button>
        <Button variant="outline" size="md">
          Explore Tabulate
        </Button>
      </div>
    </section>
  );
}
