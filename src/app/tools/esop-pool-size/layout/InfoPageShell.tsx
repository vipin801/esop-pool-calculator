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
      <div className="flex min-h-screen w-full flex-col bg-bg">
        <Header />
        <div className="page-edge-lines mx-auto w-full max-w-page flex-1">
          <main className="mx-auto max-w-[720px] px-6 pb-20 pt-10 sm:pt-14 lg:px-0">
            <nav aria-label="Breadcrumb" className="section-label flex items-center gap-2 text-faint">
              <Link href="/tools/esop-pool-size" className="hover:text-ink">
                ESOP Pool Sizing
              </Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="text-accent">
                {crumbLabel}
              </span>
            </nav>

            <h1 className="heading-hero mt-6 text-ink">{title}</h1>
            <p className="mt-5 max-w-[52ch] text-body leading-relaxed text-sub">{subtitle}</p>

            <div className="section-divider mt-12" />
            <div className="mt-10 space-y-10">{children}</div>

            <div className="section-divider mt-12" />
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/tools/esop-pool-size"
                className="inline-flex h-11 items-center justify-center rounded border border-strong bg-surface px-5 text-eyebrow font-medium text-ink transition-colors duration-150 hover:border-ink"
              >
                ← Back to the calculator
              </Link>
              {crumbLabel === 'How it works' ? (
                <Link href="/tools/esop-pool-size/faqs" className="section-label text-faint hover:text-ink">
                  Read the FAQs →
                </Link>
              ) : (
                <Link href="/tools/esop-pool-size/how-it-works" className="section-label text-faint hover:text-ink">
                  Read how it works →
                </Link>
              )}
            </div>
          </main>
        </div>
        <Footer />
      </div>
    </ThemeProvider>
  );
}
