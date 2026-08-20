import { Button } from '../ui/Button';

/**
 * The page's second display moment, and the only one below the fold. Set in
 * the display face at section scale on the warm `muted` surface, so it reads
 * as a change of material rather than as one more card in the stack.
 */
export function CtaBand() {
  return (
    <section className="rounded-lg border border-border bg-muted px-6 py-14 text-center sm:px-12">
      <p className="eyebrow text-accent">Tabulate</p>
      <h2 className="display mx-auto mt-5 max-w-[22ch] text-h2 text-ink">
        This model runs on assumptions. Tabulate runs on your actual cap table.
      </h2>
      <p className="mx-auto mt-5 max-w-[48ch] text-small leading-relaxed text-sub">
        Tabulate is Incentiv&apos;s equity management product for grants, vesting and exercises.
      </p>
      {/* Book a demo is the primary here — Explore Tabulate a bordered
          ghost beside it, not a second identical secondary (2026-08-18). */}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="md">Book a demo</Button>
        <Button variant="outline" size="md">
          Explore Tabulate
        </Button>
      </div>
    </section>
  );
}
