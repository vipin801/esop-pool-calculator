import Link from 'next/link';

const ITEMS: readonly { readonly href: string; readonly title: string; readonly description: string }[] = [
  {
    href: '/tools/esop-pool-size/how-it-works',
    title: 'How it works',
    description: 'How the model solves for a pool, tracks every grant, and what it never assumes.',
  },
  {
    href: '/tools/esop-pool-size/faqs',
    title: 'FAQs',
    description: 'Grant basis, strike price, benchmarks and compliance, answered in one place.',
  },
];

/**
 * Sits above `Footer` in both calculator states (design.md's "Two states,
 * not two pages" §3 addendum) — a real navigation, not a modal, to the two
 * standalone info pages `InfoPageShell` renders. Both are `next/link`
 * pages, so each opens on its own URL, is shareable, and keeps no state
 * with the calculator, exactly like the `Footer` link to the same route
 * this band sits beside.
 */
export function HelpLinksBand() {
  return (
    <section aria-label="Learn more" className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group flex items-start justify-between gap-4 rounded-lg border border-border bg-raised px-5 py-5 transition-colors duration-150 hover:border-strong"
        >
          <span>
            <span className="eyebrow block text-accent">{item.title}</span>
            <span className="mt-3 block text-2xs leading-4 text-sub">{item.description}</span>
          </span>
          <span
            aria-hidden="true"
            className="shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      ))}
    </section>
  );
}
