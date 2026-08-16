'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface CollapsibleProps {
  readonly title: string;
  readonly defaultOpen?: boolean;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}

export function Collapsible({ title, defaultOpen = false, action, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border bg-raised">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          />
          <span className="text-[13px] font-semibold text-ink">{title}</span>
        </button>
        {action}
      </div>
      {open ? <div className="border-t border-border">{children}</div> : null}
    </div>
  );
}
