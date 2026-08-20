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
    //
    // Sits on the cream page rather than on a white card: the chrome is the
    // canvas and the panels are what float on it, which is the whole point
    // of a three-surface warm ramp.
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-baseline gap-0.5">
          {/* The wordmark is the design system's display face doing what it is
              for — italic serif, tight tracking — with the accent spent on a
              single full stop. */}
          <span className="display text-h4 text-ink">incentiv</span>
          <span aria-hidden="true" className="display text-h4 text-accent">
            .
          </span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <a key={item} href="#" className="eyebrow text-faint transition-colors duration-150 hover:text-ink">
              {item}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex h-8 w-8 items-center justify-center rounded border border-border text-faint transition-colors duration-150 hover:border-strong hover:text-ink"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          {/* Secondary, not primary — the accent fill belongs to the tool's
              own action, and this shares a viewport with it. */}
          <Button size="sm" variant="secondary">
            Book a demo
          </Button>
        </div>
      </div>
    </header>
  );
}
