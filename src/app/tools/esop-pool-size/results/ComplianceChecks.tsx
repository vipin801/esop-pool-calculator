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

function StatusIcon({ status }: { readonly status: ComplianceStatus }) {
  const className = `mt-0.5 h-3.5 w-3.5 shrink-0 ${TONE[status]}`;
  if (status === 'pass') return <CheckCircle2 className={className} />;
  if (status === 'warn') return <AlertTriangle className={className} />;
  return <XCircle className={className} />;
}

export function ComplianceChecks({ checks }: ComplianceChecksProps) {
  return (
    <section className="rounded-lg border border-border bg-raised">
      <h3 className="border-b border-border px-4 py-2.5 text-[13px] font-semibold text-ink">
        Compliance checks (India)
      </h3>
      <ul className="divide-y divide-border">
        {checks.map((check) => (
          <li key={check.id} className="flex gap-2.5 px-4 py-3">
            <StatusIcon status={check.status} />
            <div className="min-w-0">
              <p className="text-[13px] leading-5 text-ink">{check.finding}</p>
              <p className="mt-0.5 text-2xs leading-4 text-sub">{check.action}</p>
              <p className="mt-0.5 text-2xs text-faint">
                {check.statutoryReference} · {check.disclaimer}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
