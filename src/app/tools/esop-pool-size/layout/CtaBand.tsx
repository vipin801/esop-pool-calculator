import { Button } from '../ui/Button';

export function CtaBand() {
  return (
    <section className="rounded-lg border border-border bg-muted px-6 py-6">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">
        This model runs on assumptions. Tabulate runs on your actual cap table.
      </h2>
      <p className="mt-1.5 text-[13px] leading-5 text-sub">
        Tabulate is Incentiv&apos;s equity management product for grants, vesting and exercises.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary">Book a demo</Button>
        <Button variant="secondary">Explore Tabulate</Button>
      </div>
    </section>
  );
}
