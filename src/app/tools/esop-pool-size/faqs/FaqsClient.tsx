'use client';

import type { ReactNode } from 'react';
import { InfoPageShell } from '../layout/InfoPageShell';

interface FaqItemProps {
  readonly question: string;
  readonly children: ReactNode;
}

function FaqItem({ question, children }: FaqItemProps) {
  return (
    <details className="group rounded-lg border border-border bg-raised">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-small font-medium tracking-tight text-ink [&::-webkit-details-marker]:hidden">
        {question}
        <span aria-hidden="true" className="shrink-0 text-faint transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="space-y-2.5 border-t border-border px-5 py-4 text-small leading-relaxed text-sub">{children}</div>
    </details>
  );
}

export function FaqsClient() {
  return (
    <InfoPageShell
      crumbLabel="FAQs"
      title="Frequently asked questions"
      subtitle="The questions founders ask most, answered in one place."
    >
      <div className="space-y-2">
        <FaqItem question="What does the tool actually calculate?">
          <p>
            How big your ESOP pool needs to be to cover your hiring plan, and how long your current
            pool will last.
          </p>
        </FaqItem>

        <FaqItem question="Percent-of-equity or rupee value — which grant basis should I use?">
          <p>Percent-of-equity is more common before a Series A.</p>
          <p>
            Rupee-value grants are more common from Series A onward, since it&apos;s easier to promise a
            rupee figure to a candidate.
          </p>
        </FaqItem>

        <FaqItem question="Why does the strike price policy matter?">
          <p>
            It decides how many options a rupee grant buys, and how much of the spread an employee
            actually keeps after tax.
          </p>
        </FaqItem>

        <FaqItem question="What if my recommended pool looks much bigger than typical benchmarks?">
          <p>
            The tool always shows two benchmark tracks next to your number — advisory consensus and
            observed India data.
          </p>
          <p>Advisory consensus is opinion. Neither is presented as the truth.</p>
        </FaqItem>

        <FaqItem question="Do I need DPIIT recognition?">
          <p>
            DPIIT recognition exempts promoters and large shareholders from the usual ESOP eligibility
            rules, for ten years from incorporation.
          </p>
          <p>It&apos;s separate from the tax deferral, which needs Inter-Ministerial Board certification as well.</p>
        </FaqItem>

        <FaqItem question="Is the recommended pool percentage exact?">
          <p>It&apos;s a model output, solved to a small tolerance and rounded for the headline.</p>
          <p>Treat it as a defensible starting point for your cap table and counsel, not a guarantee.</p>
        </FaqItem>

        <FaqItem question="What's in the full report, and how do I get it?">
          <p>
            Every assumption, scenario, year-by-year projection and compliance check behind your
            number, as a downloadable PDF.
          </p>
          <p>Enter your name and work email once, from the results screen, to unlock it.</p>
        </FaqItem>

        <FaqItem question="Is any of this legal or tax advice?">
          <p>No. This is general information to help you plan, not a substitute for legal or tax counsel.</p>
          <p>Always confirm with your own advisers before adopting a scheme.</p>
        </FaqItem>

        <FaqItem question="What is Tabulate?">
          <p>
            Incentiv&apos;s equity management product, for running your actual cap table, grants, vesting
            and exercises once a scheme is live.
          </p>
        </FaqItem>
      </div>
    </InfoPageShell>
  );
}
