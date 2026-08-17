'use client';

import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  readonly index: string;
  readonly title: string;
  /** Shown in place of the content while collapsed. Brief §4: a collapsed
   *  section still says, in one line, why its fields don't need entering yet. */
  readonly hint?: string;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

/**
 * `InputCard`'s header, made an accordion. Children unmount while closed —
 * the same pattern `CompanyCard`'s `{round ? (...) : null}` already uses for
 * a toggled-off funding round — so nothing here risks losing a value: every
 * field's state lives in `EsopPoolSizeClient`'s `inputs`/`touched`, not in
 * this component, and re-opening re-renders against the same state.
 *
 * Collapsed or open, a field inside never becomes *required* by that state
 * alone — required is `tierFor(...) === 'drivesPool'` (lib/visibility.ts),
 * independent of whether the founder has opened this disclosure. Collapsing
 * is presentation; the tier is the model.
 */
export function CollapsibleSection({ index, title, hint, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="rounded-lg border border-border bg-raised"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className="tnum text-2xs font-semibold text-faint">{index}</span>
          <span className="text-eyebrow font-semibold text-ink">{title}</span>
        </span>
        <span aria-hidden="true" className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}>
          ⌄
        </span>
      </summary>
      {open ? (
        <div className="space-y-4 border-t border-border px-4 py-4">{children}</div>
      ) : hint ? (
        <p className="border-t border-border px-4 py-3 text-2xs leading-4 text-faint">{hint}</p>
      ) : null}
    </details>
  );
}
