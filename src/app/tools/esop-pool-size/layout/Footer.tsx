import Link from 'next/link';

interface FooterLink {
  readonly label: string;
  readonly href: string;
}

/**
 * Everything but Resources is brand chrome for a multi-product platform this
 * repo only ships one tool of — Advisory/Tabulate/Folio/Transact and the
 * Solutions/Company/Legal columns have no route here, so they hold `#`. Only
 * Resources points at pages that actually exist, and its "How this works"
 * entry is load-bearing: `info-pages.test.ts` asserts the Footer carries
 * that exact href and label.
 */
const PRODUCTS: readonly FooterLink[] = [
  { label: 'Advisory', href: '#' },
  { label: 'Tabulate', href: '#' },
  { label: 'Folio', href: '#' },
  { label: 'Transact', href: '#' },
];

const SOLUTIONS: readonly FooterLink[] = [
  { label: 'Founders & Companies', href: '#' },
  { label: 'Investors', href: '#' },
  { label: 'Fund Managers', href: '#' },
  { label: 'Family Offices', href: '#' },
  { label: 'Employees', href: '#' },
];

const COMPANY: readonly FooterLink[] = [
  { label: 'About', href: '#' },
  { label: 'Careers', href: '#' },
  { label: 'Contact', href: '#' },
];

const LEGAL: readonly FooterLink[] = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
];

function FooterColumn({ heading, links }: { readonly heading: string; readonly links: readonly FooterLink[] }) {
  return (
    <div>
      <span className="section-label text-accent">{heading}</span>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map((link) =>
          link.href.startsWith('/') ? (
            <li key={link.label}>
              <Link href={link.href} className="text-body text-faint transition-colors duration-150 hover:text-ink">
                {link.label}
              </Link>
            </li>
          ) : (
            <li key={link.label}>
              <a href={link.href} className="text-body text-faint transition-colors duration-150 hover:text-ink">
                {link.label}
              </a>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/**
 * Always-dark: the document's marketing chrome, not this tool's own
 * light/dark toggle — the reference footer stays on the dark ladder
 * regardless of which theme the calculator above it is in. `data-theme`
 * and `.dark` are set together directly on the section root, the same
 * pairing `ThemeProvider` sets on `<html>` (see `lib/theme.tsx`), so every
 * token this subtree reads — `--bg`, `--text`, `--accent`, `--border` —
 * resolves off the already-audited dark ladder without a single `dark:`
 * prefix, and without touching the page's own theme state.
 */
export function Footer() {
  return (
    <footer data-theme="dark" className="dark mt-16 bg-bg text-ink">
      <div className="mx-auto max-w-page px-6 py-16 lg:px-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_repeat(5,max-content)] lg:gap-x-12">
          <div className="col-span-2 max-w-xs sm:col-span-3 lg:col-span-1">
            <span className="text-[22px] font-bold leading-none tracking-tight text-ink">incentiv</span>
            <span aria-hidden="true" className="text-[22px] font-bold leading-none tracking-tight text-accent">
              .
            </span>
            <p className="mt-4 text-body leading-relaxed text-faint">
              Infrastructure for Private Markets. A unified ecosystem bringing efficiency, clarity, and liquidity to
              private markets.
            </p>
          </div>

          <FooterColumn heading="Products" links={PRODUCTS} />
          <FooterColumn heading="Solutions" links={SOLUTIONS} />
          {/* Written as literal `<Link>`s, not through `FooterColumn`'s
              array/map: `info-pages.test.ts` statically greps this file's
              raw text for the literal JSX attribute `href="/tools/esop-pool-
              size/how-it-works"`, which a `href={link.href}` expression
              attribute would never produce no matter what string the array
              holds. */}
          <div>
            <span className="section-label text-accent">Resources</span>
            <ul className="mt-4 flex flex-col gap-3">
              <li>
                <Link
                  href="/tools/esop-pool-size/how-it-works"
                  className="text-body text-faint transition-colors duration-150 hover:text-ink"
                >
                  How this works
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/esop-pool-size/faqs"
                  className="text-body text-faint transition-colors duration-150 hover:text-ink"
                >
                  FAQs
                </Link>
              </li>
            </ul>
          </div>
          <FooterColumn heading="Company" links={COMPANY} />
          <FooterColumn heading="Legal" links={LEGAL} />
        </div>

        <div className="section-divider mt-12" />

        <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-nav text-faint">© {new Date().getFullYear()} Incentiv. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-nav text-faint transition-colors duration-150 hover:text-ink">
              LinkedIn <span aria-hidden="true">↗</span>
            </a>
            <a href="#" className="text-nav text-faint transition-colors duration-150 hover:text-ink">
              Twitter <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
