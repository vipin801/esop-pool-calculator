'use client';

import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '../lib/theme';
import { Button } from '../ui/Button';

const NAV = ['Platform', 'Tabulate', 'Resources', 'Pricing'];

export function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-eyebrow font-bold text-white">
            i
          </span>
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
