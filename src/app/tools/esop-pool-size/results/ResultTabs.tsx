'use client';

import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface ResultTab {
  readonly id: string;
  readonly label: string;
  /** Lazy, so an unselected panel costs neither a Recharts tree nor a table. */
  readonly render: () => ReactNode;
}

interface ResultTabsProps {
  readonly tabs: readonly ResultTab[];
  readonly ariaLabel: string;
}

/**
 * The WAI-ARIA tabs pattern, manual activation.
 *
 * Roving tabindex: exactly one tab is in the tab order, arrow keys move
 * between them, Home and End jump to the ends. That is what keeps the tab
 * order short — eight sections used to mean eight headings and every control
 * inside them between the founder and the footer.
 *
 * The panel itself is focusable. It scrolls when a cap table is taller than
 * the box, and a scrollable region that cannot be focused cannot be scrolled
 * from the keyboard.
 */
export function ResultTabs({ tabs, ariaLabel }: ResultTabsProps) {
  const base = useId();
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const listRef = useRef<HTMLDivElement>(null);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeId),
  );
  const active = tabs[activeIndex];

  function focusTab(index: number) {
    const next = tabs[index];
    if (!next) return;
    setActiveId(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${base}-tab-${next.id}`)}`)?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const last = tabs.length - 1;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab(activeIndex === last ? 0 : activeIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab(activeIndex === 0 ? last : activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTab(last);
    }
  }

  if (!active) return null;

  return (
    <div className="min-w-0">
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        // Wraps rather than scrolls: six tabs do not fit 375px on one row, and
        // a horizontally scrolling strip hides the last two behind a gesture
        // nothing on screen advertises.
        className="flex flex-wrap gap-x-1 border-b border-border px-1"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              id={`${base}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-eyebrow font-medium transition-colors duration-150 ${
                selected ? 'border-accent text-ink' : 'border-transparent text-sub hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${base}-panel-${active.id}`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${active.id}`}
        tabIndex={0}
        // 400px at lg is what keeps the whole result object inside a 900px
        // viewport once the header wraps at 1024, where the download button
        // drops below the headline and costs the card another row.
        className="max-h-[62vh] min-h-[280px] overflow-y-auto p-3 lg:max-h-[400px]"
      >
        {active.render()}
      </div>
    </div>
  );
}
