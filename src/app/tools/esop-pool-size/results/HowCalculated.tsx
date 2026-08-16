const POINTS = [
  'The pool size is solved for, not guessed: a bigger pool changes the price per share, which changes how many options a rupee grant buys, so the model iterates until the two agree.',
  'Every grant is tracked by the year and band it was made in, not averaged — a cohort’s vesting depends on exactly when it was granted, not on a portfolio-wide average age.',
  'A leaver’s unvested options are forfeited, their vested-but-unexercised options lapse, and their vested-and-exercised options leave the pool for good and become issued shares.',
  'Forfeited and lapsed options only return to the pool if your scheme recycles them.',
  'A buffer is added on top of planned consumption, for senior hires that aren’t in the plan yet.',
  'Two pools are shown everywhere, always labelled: the recommendation is this plan run against the pool this tool suggests; the current-pool figures are the same plan run against the pool you actually hold today.',
];

export function HowCalculated() {
  return (
    <div className="rounded border border-border bg-muted p-4">
      <h3 className="text-[13px] font-semibold text-ink">How this is calculated</h3>
      <ul className="mt-2 space-y-1.5">
        {POINTS.map((point) => (
          <li key={point} className="flex gap-2 text-2xs leading-4 text-sub">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-strong" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
