import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { ComplianceCheck, ComplianceStatus } from '@/lib/esop';

interface ComplianceChecksProps {
  readonly checks: readonly ComplianceCheck[];
}

const TONE: Record<ComplianceStatus, string> = {
  pass: 'text-accent',
  warn: 'text-warn',
  blocked: 'text-danger',
};

const GROUP_TITLE: Record<ComplianceStatus, string> = {
  blocked: 'Action required',
  warn: 'Check or confirm',
  pass: 'Looks okay',
};

/** design.md §5.5: `blocked` first, then `warn`, then `pass` — the order a
 *  founder should read them in, not the order the engine happens to emit. */
const GROUP_ORDER: readonly ComplianceStatus[] = ['blocked', 'warn', 'pass'];

function StatusIcon({ status }: { readonly status: ComplianceStatus }) {
  const className = `mt-0.5 h-3.5 w-3.5 shrink-0 ${TONE[status]}`;
  if (status === 'pass') return <CheckCircle2 className={className} />;
  if (status === 'warn') return <AlertTriangle className={className} />;
  return <XCircle className={className} />;
}

function CheckRow({ check }: { readonly check: ComplianceCheck }) {
  return (
    <li className="flex gap-3 px-5 py-4">
      <StatusIcon status={check.status} />
      <div className="min-w-0">
        <p className="text-small leading-5 text-ink">{check.finding}</p>
        <p className="mt-1 text-2xs leading-4 text-sub">{check.action}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-2xs text-faint hover:text-sub">Details</summary>
          <p className="mt-1.5 text-2xs leading-4 text-faint">
            {check.statutoryReference} · {check.disclaimer}
          </p>
        </details>
      </div>
    </li>
  );
}

/**
 * design.md §5.5: a one-line summary first ("3 passed, 2 need attention"),
 * then three named groups by status rather than one flat list — the
 * statutory reference moves behind a `Details` disclosure so it never sits
 * at the same weight as the finding itself. The disclaimer stays on every
 * row: that is a structural PROJECT.md prohibition, not a styling choice.
 *
 * The whole panel is a native `<details>`, collapsed by default: the
 * heading and pass/attention counts sit in `<summary>` so they're always
 * visible, and the grouped rows only mount once a founder opens it. This is
 * progressive disclosure, not a gate (D3/D12/D13's sense) — no lead form, no
 * download, one click either way — so it does not need a `touched`/`locked`
 * treatment the way `WhyThisNumber`/`CapTablePanel` do.
 */
export function ComplianceChecks({ checks }: ComplianceChecksProps) {
  const counts = checks.reduce(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }),
    { pass: 0, warn: 0, blocked: 0 } as Record<ComplianceStatus, number>,
  );
  const summary = [
    counts.pass > 0 ? `${counts.pass} passed` : null,
    counts.warn > 0 ? `${counts.warn} need${counts.warn === 1 ? 's' : ''} attention` : null,
    counts.blocked > 0 ? `${counts.blocked} blocked` : null,
  ].filter(Boolean);

  return (
    <details className="group rounded-lg border border-border bg-raised">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span>
          <h3 className="text-small font-medium tracking-tight text-ink">Compliance checks (India)</h3>
          {summary.length > 0 ? <p className="mt-1 text-2xs leading-4 text-sub">{summary.join(', ')}.</p> : null}
        </span>
        <span aria-hidden="true" className="shrink-0 text-faint transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="border-t border-border">
        {GROUP_ORDER.map((status) => {
          const rows = checks.filter((c) => c.status === status);
          if (rows.length === 0) return null;
          return (
            <div key={status} className="border-b border-border last:border-0">
              <p className="section-label px-5 pt-4 text-faint">{GROUP_TITLE[status]}</p>
              <ul className="divide-y divide-border">
                {rows.map((check) => (
                  <CheckRow key={check.id} check={check} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
  );
}
