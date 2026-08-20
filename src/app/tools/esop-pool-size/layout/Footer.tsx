import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-bg">
      <div className="mx-auto max-w-page px-6 py-10 lg:px-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="font-serif text-[22px] italic leading-none tracking-[-0.03em] text-ink">incentiv</span>
            <span aria-hidden="true" className="font-serif text-[22px] italic leading-none tracking-[-0.03em] text-accent">
              .
            </span>
            <p className="mt-3 max-w-md text-2xs leading-4 text-faint">
              Private-markets infrastructure for Indian companies. General information, not legal advice.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/tools/esop-pool-size/how-it-works" className="section-label text-faint hover:text-ink">
              How this works
            </Link>
            <a href="#main" className="section-label text-faint hover:text-ink">
              ESOP Tax Calculator
            </a>
            <a href="#main" className="section-label text-faint hover:text-ink">
              Funding Round Simulator
            </a>
            <a
              href="#"
              className="inline-flex h-8 items-center justify-center rounded border border-strong bg-surface px-3 text-2xs font-medium text-ink transition-colors duration-150 hover:border-ink"
            >
              Book a demo
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
