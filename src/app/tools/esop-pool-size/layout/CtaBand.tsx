import { Button } from '../ui/Button';

export function CtaBand() {
  return (
    <section className="rounded-[12px] border border-border bg-muted p-8 text-center">
      <h2 className="text-body font-semibold tracking-tight text-ink">
        This model runs on assumptions. Tabulate runs on your actual cap table.
      </h2>
      <p className="mx-auto mt-1.5 max-w-[48ch] text-eyebrow leading-5 text-sub">
        Tabulate is Incentiv&apos;s equity management product for grants, vesting and exercises.
      </p>
      {/* Book a demo is the primary here — Explore Tabulate a bordered
          ghost beside it, not a second identical secondary (2026-08-18). */}
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button size="md">Book a demo</Button>
        <Button variant="outline" size="md">
          Explore Tabulate
        </Button>
      </div>
    </section>
  );
}
