'use client';

import { useState, type ReactNode } from 'react';

interface OptionalFieldToggleProps {
  readonly label: string;
  readonly children: ReactNode;
  /** Fires once, the moment the founder clicks — for the one field here
   *  whose "add" is itself a value the engine reads (`rounds.enabled`),
   *  not just a reveal. Optional because every other caller only needs the
   *  reveal itself. */
  readonly onAdd?: () => void;
}

/**
 * "Simplify Optional ESOP Inputs" / D11. A `minor`-tier field's engine
 * default (D6) keeps running, unmarked, until the founder opts in — D11's
 * narrow exception to D9's "always visible, always `EstimateMarker`'d" rule,
 * for exactly the fields named there.
 *
 * A one-way reveal, not a collapse/expand toggle: there is nothing to
 * re-hide once the founder has asked to see a field, so this is a plain
 * button swapping itself for `children` rather than `CollapsibleSection`'s
 * `<details>` (built for a whole card the founder may want to close again).
 */
export function OptionalFieldToggle({ label, children, onAdd }: OptionalFieldToggleProps) {
  const [added, setAdded] = useState(false);

  if (added) return <>{children}</>;

  return (
    <button
      type="button"
      onClick={() => {
        onAdd?.();
        setAdded(true);
      }}
      className="text-small font-medium text-accent transition-colors duration-150 hover:text-accent-hover"
    >
      + {label}
    </button>
  );
}
