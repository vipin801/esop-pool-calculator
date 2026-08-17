'use client';

import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '../lib/theme';
import { Button } from '../ui/Button';

const NAV = ['Platform', 'Tabulate', 'Resources', 'Pricing'];

export function Header() {
  const { theme, toggle } = useTheme();

  return (
    // Not sticky. It was, at `z-40` over an opaque `bg-surface` — correct
    // as far as it went, which was exactly the problem: a sticky header
    // over a page whose fields scroll is *supposed* to paint over whatever
    // scrolls underneath it, and at 445px wide the first field label
    // (Stage) sits close enough to the top that ordinary scrolling puts it
    // there. Verified empirically (not just by reading the CSS) by
    // measuring the header's and the label's `getBoundingClientRect()`
    // after scrolling 300px: they overlapped. Normal flow is the fix the
    // layout brief itself names for a header that isn't meant to persist,
    // and nothing here depends on it persisting — the pinned banner and
    // Reset live in `InputRail`, not here.
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-small font-semibold tracking-tight text-ink">incentiv</span>
        </Link>
        <nav className="hidden items-center gap-5 md:flex">
          {NAV.map((item) => (
            <a key={item} href="#" className="text-eyebrow text-sub hover:text-ink">
              {item}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex h-8 w-8 items-center justify-center rounded border border-strong text-sub hover:text-ink"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          {/* Secondary, not primary. The header is sticky, so a primary button
              here would sit in every viewport alongside the tool's own one. */}
          <Button size="sm" variant="secondary">
            Book a demo
          </Button>
        </div>
      </div>
    </header>
  );
}
