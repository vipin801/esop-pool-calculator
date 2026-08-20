'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import type { EsopInputs, FundingRound, OpeningGrantCohortInput } from '@/lib/esop';
import { Button } from '../../ui/Button';
import type { EsopGroupKey } from '../../inputs/InputCard';
import { isScreenComplete, requiredPathsForScreen, type OnboardingScreen } from '../../lib/onboardingScreens';
import { ScreenCompany } from './ScreenCompany';
import { ScreenHiring, type HiringMeta } from './ScreenHiring';
import { ScreenGrants, type GrantMeta } from './ScreenGrants';

const STEPS: readonly { readonly screen: OnboardingScreen; readonly label: string }[] = [
  { screen: 0, label: 'Company' },
  { screen: 1, label: 'Hiring plan' },
  { screen: 2, label: 'Grant economics' },
];

interface OnboardingWizardProps {
  readonly inputs: EsopInputs;
  readonly setGroup: <K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => void;
  readonly openingGrants: readonly OpeningGrantCohortInput[];
  readonly setOpeningGrants: (grants: readonly OpeningGrantCohortInput[]) => void;
  readonly rounds: readonly FundingRound[];
  readonly touched: ReadonlySet<string>;
  readonly markTouched: (path: string) => void;
  readonly markManyTouched: (paths: readonly string[]) => void;
  readonly requiredPaths: ReadonlySet<string>;
  readonly required: readonly string[];
  readonly hiringMeta: HiringMeta;
  readonly setHiringMeta: (meta: HiringMeta) => void;
  readonly grantMeta: GrantMeta;
  readonly setGrantMeta: (meta: GrantMeta) => void;
  readonly readyToCalculate: boolean;
  readonly onCalculate: () => void;
}

/**
 * design.md §3/§4. Three screens, sequential, D10: tiering never depends on
 * which screen a field sits on — `lib/visibility.ts` is untouched, this only
 * sequences the *existing* required paths (lib/onboardingScreens.ts) so
 * "Continue" is disabled until this screen's own required fields are filled,
 * the same D7 gate the old one-page form applied to the whole page at once.
 */
export function OnboardingWizard({
  inputs,
  setGroup,
  openingGrants,
  setOpeningGrants,
  touched,
  markTouched,
  markManyTouched,
  requiredPaths,
  required,
  hiringMeta,
  setHiringMeta,
  grantMeta,
  setGrantMeta,
  readyToCalculate,
  onCalculate,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<OnboardingScreen>(0);
  const stepReady = isScreenComplete(step, required, touched);
  const isLast = step === STEPS.length - 1;

  function goNext() {
    if (!stepReady) return;
    if (isLast) {
      onCalculate();
      return;
    }
    setStep((s) => (s + 1) as OnboardingScreen);
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1) as OnboardingScreen);
  }

  return (
    <div className="space-y-6">
      {/*
        2026-08-19: a progress rule, not three chips. Each step is a 2px rule
        over a micro-label — the rule fills with the accent once the step is
        reached, so progress is read left to right in one glance instead of
        from three competing fills. Display-only, matching the wizard's
        existing behaviour (navigation is still Back/Continue alone):
        `role="tab"` names the state for assistive tech without adding a
        click-to-jump interaction this pass does not otherwise add.
      */}
      <div role="tablist" aria-label="Onboarding progress" className="grid grid-cols-3 gap-3">
        {STEPS.map((s) => {
          const done = requiredPathsForScreen(s.screen, required).every((p) => touched.has(p));
          const current = s.screen === step;
          const reached = current || done;
          return (
            <div key={s.screen} role="tab" aria-selected={current} className="flex flex-col gap-3">
              <span aria-hidden="true" className={`h-0.5 w-full rounded-[1px] ${reached ? 'bg-accent' : 'bg-border'}`} />
              <span className={`section-label flex items-center gap-1.5 ${reached ? 'text-ink' : 'text-faint'}`}>
                {done && !current ? <Check aria-hidden="true" className="h-3 w-3 shrink-0" /> : null}
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="section-label text-faint">All fields required</p>

      <div aria-live="polite" className="sr-only">
        Step {step + 1} of {STEPS.length}: {STEPS[step]!.label}
      </div>

      <div className="rounded-lg border border-border bg-raised p-6 shadow-panel sm:p-10">
        <div className="space-y-8">
          {step === 0 ? (
            <ScreenCompany
              inputs={inputs}
              setGroup={setGroup}
              openingGrants={openingGrants}
              setOpeningGrants={setOpeningGrants}
              touched={touched}
              markTouched={markTouched}
              requiredPaths={requiredPaths}
            />
          ) : step === 1 ? (
            <ScreenHiring
              inputs={inputs}
              setGroup={setGroup}
              meta={hiringMeta}
              setMeta={setHiringMeta}
              touched={touched}
              markTouched={markTouched}
              markManyTouched={markManyTouched}
              requiredPaths={requiredPaths}
            />
          ) : (
            <ScreenGrants
              inputs={inputs}
              setGroup={setGroup}
              meta={grantMeta}
              setMeta={setGrantMeta}
              touched={touched}
              markTouched={markTouched}
              requiredPaths={requiredPaths}
            />
          )}
        </div>

        {/* Footer nav, moved inside the card: a hairline divider, then the
            same 32px group rhythm above it, 16px below it to the buttons. */}
        <div className="mt-10 border-t border-border pt-6">
          <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between">
            <Button variant="ghost" size="md" className="w-full sm:w-auto" onClick={goBack} disabled={step === 0}>
              ← Back
            </Button>
            <Button size="md" className="w-full sm:w-auto" onClick={goNext} disabled={isLast ? !readyToCalculate : !stepReady}>
              {isLast ? 'Calculate pool' : 'Continue →'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
