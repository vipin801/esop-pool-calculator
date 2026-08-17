import type { EsopResult } from '@/lib/esop';
import { EstimateMarker } from '../ui/EstimateMarker';

/** Every point is one sentence pair, inside the 25-word copy budget. */
const POINTS = [
  'The pool is solved for, not guessed. A bigger pool moves the price per share, so the model iterates until the two agree.',
  'Every grant is tracked by its own year and band. Vesting depends on when a grant was made, never on an average age.',
  'A leaver forfeits what has not vested, lapses what they never exercise, and takes the rest as issued shares.',
  'Forfeited and lapsed options return to the pool only if your scheme recycles them.',
  'A buffer sits on top of planned consumption, for senior hires not in the plan yet.',
  'Two pools are shown everywhere, always labelled: the pool this tool recommends, and the pool you hold today.',
];

interface HowCalculatedProps {
  readonly solver: EsopResult['solver'];
}

export function HowCalculated({ solver }: HowCalculatedProps) {
  return (
    <details className="rounded border border-border bg-muted">
      <summary className="cursor-pointer px-4 py-2.5 text-eyebrow font-semibold text-ink">
        How this is calculated
      </summary>
      <div className="border-t border-border px-4 py-3">
        <ul className="space-y-1.5">
          {POINTS.map((point) => (
            <li key={point} className="flex gap-2 text-2xs leading-4 text-sub">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-strong" />
              {point}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-2xs leading-4 text-faint">
          Solved in {solver.iterations} iteration{solver.iterations === 1 ? '' : 's'}, rounded up to the nearest 0.5%.
          <EstimateMarker label="Model output" />
        </p>
      </div>
    </details>
  );
}
