'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * design.md §6.3: the one net-new primitive this redesign needs — no
 * drawer/sheet exists in this codebase or in the reference design system.
 * Full-screen on mobile (`Your model`'s "View / edit model" action), built
 * from `--shadow-overlay`, the one Incentiv shadow token, reserved for
 * overlays exactly as its own guidelines say and previously unused anywhere
 * in this tool. Focus-trap and Escape-to-close/return-focus mirror
 * `results/LeadModal.tsx`'s existing bespoke-modal mechanics rather than a
 * new convention.
 */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    const entry = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    entry?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/45 backdrop-blur-[4px]" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mt-auto flex max-h-[92vh] min-h-0 flex-col rounded-t-modal border-t border-border bg-surface shadow-[var(--shadow-overlay)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id={titleId} className="section-label text-accent">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded border border-border p-1.5 text-faint transition-colors duration-150 hover:border-strong hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="shrink-0 border-t border-border px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
