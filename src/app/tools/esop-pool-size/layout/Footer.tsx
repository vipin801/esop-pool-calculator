export function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-muted">
      <div className="mx-auto max-w-page px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="text-[15px] font-semibold tracking-tight text-ink">incentiv</span>
            <p className="mt-2 max-w-md text-2xs leading-4 text-faint">
              Private-markets infrastructure for Indian companies. General information, not legal advice.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#main" className="text-2xs text-sub hover:text-ink">
              ESOP Tax Calculator
            </a>
            <a href="#main" className="text-2xs text-sub hover:text-ink">
              Funding Round Simulator
            </a>
            <a
              href="#"
              className="inline-flex items-center justify-center rounded border border-strong bg-raised px-3.5 py-2 text-[13px] font-medium text-ink hover:border-ink"
            >
              Book a demo
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
