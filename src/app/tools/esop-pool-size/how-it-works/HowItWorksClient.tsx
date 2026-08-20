'use client';

import type { ReactNode } from 'react';
import { InfoPageShell } from '../layout/InfoPageShell';

interface SectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="heading-section text-ink">{title}</h2>
      <div className="space-y-3 text-small leading-relaxed text-sub">{children}</div>
    </section>
  );
}

export function HowItWorksClient() {
  return (
    <InfoPageShell
      crumbLabel="How it works"
      title="How this works"
      subtitle="What the model does, and what it deliberately never assumes for you."
    >
      <Section title="The pool is solved for, not guessed">
        <p>You enter your cap table, your hiring plan and how you like to grant options.</p>
        <p>
          The model then solves for the smallest pool that covers every hire in your plan, rather than
          applying a fixed percentage.
        </p>
        <p>A bigger pool changes the price per option, so it iterates until the two agree.</p>
      </Section>

      <Section title="Every grant tracked, not averaged">
        <p>
          Each grant is tracked by its own year and band, so vesting depends on when it was actually
          made.
        </p>
        <p>A leaver forfeits what hasn&apos;t vested, lets unexercised vested options lapse, and keeps the rest as shares.</p>
        <p>Forfeited and lapsed options return to the pool only if your scheme recycles them.</p>
        <p>A buffer sits on top of the plan, for senior hires you haven&apos;t named yet.</p>
      </Section>

      <Section title="Two numbers, always side by side">
        <p>Every result shows two pools: the one the model recommends, and the pool you already hold.</p>
        <p>The runway is how long your current pool lasts before hiring outpaces what it can cover.</p>
        <p>The tool always shows two benchmark tracks next to your number — advisory consensus and observed India data.</p>
        <p>Advisory consensus is opinion. Neither is presented as the truth.</p>
      </Section>

      <Section title="Compliance, alongside the number">
        <p>
          Every recommendation comes with a compliance checklist for Indian ESOP schemes — scheme
          approval, vesting, DPIIT recognition, tax deferral and authorised capital.
        </p>
        <p>
          DPIIT recognition alone doesn&apos;t unlock the tax deferral. You also need Inter-Ministerial
          Board certification.
        </p>
      </Section>

      <Section title="What's free, what's gated">
        <p>Your recommended pool, top-up, runway and hiring coverage are always free, with no email required.</p>
        <p>
          The full report — every assumption, scenario and calculation behind the number — needs your
          name and work email to download.
        </p>
      </Section>
    </InfoPageShell>
  );
}
