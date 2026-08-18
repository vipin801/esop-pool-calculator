'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';
import { ThemeProvider } from '../lib/theme';

interface InfoPageShellProps {
  readonly crumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
}

/**
 * Shared chrome for the calculator's standalone info pages ("How it works,"
 * "FAQs," and any later one): `Header`/`Footer`/`ThemeProvider` and the
 * breadcrumb/H1/subtitle pattern `Hero.tsx` established for the calculator
 * itself, reused rather than restated per page. Each page shares no state
 * with `EsopPoolSizeClient.tsx` or with each other — this is read-once,
 * link-to, keep-open-in-a-tab content, not another calculator state.
 */
export function InfoPageShell({ crumbLabel, title, subtitle, children }: InfoPageShellProps) {
  return (
    <ThemeProvider>
      <div className="min-h-screen w-full bg-surface">
        <Header />
        <main className="mx-auto max-w-[720px] px-6 pb-16 pt-4">
          <nav aria-label="Breadcrumb" className="text-eyebrow text-sub">
            <Link href="/tools/esop-pool-size" className="hover:text-ink">
              ESOP Pool Sizing
            </Link>{' '}
            <span aria-hidden="true">›</span>{' '}
            <span aria-current="page" className="text-sub">
              {crumbLabel}
            </span>
          </nav>

          <h1 className="mt-2 font-[family-name:var(--font-display)] text-[32px] font-normal leading-[1.15] tracking-[var(--tracking-display)] text-ink sm:text-[44px]">
            {title}
          </h1>
          <p className="mt-2 max-w-[52ch] text-[18px] leading-relaxed text-sub">{subtitle}</p>

          <div className="mt-8 space-y-8">{children}</div>

          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <Link
              href="/tools/esop-pool-size"
              className="inline-flex items-center justify-center rounded border border-strong bg-raised px-3.5 py-2 text-eyebrow font-medium text-ink hover:border-ink"
            >
              ← Back to the calculator
            </Link>
            {crumbLabel === 'How it works' ? (
              <Link href="/tools/esop-pool-size/faqs" className="text-eyebrow text-sub hover:text-ink">
                Read the FAQs →
              </Link>
            ) : (
              <Link href="/tools/esop-pool-size/how-it-works" className="text-eyebrow text-sub hover:text-ink">
                Read how it works →
              </Link>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}
