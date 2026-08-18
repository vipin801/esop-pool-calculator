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
    <div className="space-y-4">
      {/*
        2026-08-18 restraint pass: three equal, joined segments — no "/"
        separators — differentiated by weight and fill, not hue (PROJECT.md).
        Display-only progress, matching the wizard's existing behaviour
        (navigation is still Back/Continue alone): `role="tab"` here names the
        state for assistive tech without adding a click-to-jump interaction
        this pass does not otherwise add.
      */}
      <div role="tablist" aria-label="Onboarding progress" className="grid grid-cols-3 gap-2">
        {STEPS.map((s) => {
          const done = requiredPathsForScreen(s.screen, required).every((p) => touched.has(p));
          const current = s.screen === step;
          const state = current ? 'current' : done ? 'completed' : 'upcoming';
          return (
            <div
              key={s.screen}
              role="tab"
              aria-selected={current}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-[12px] text-eyebrow font-medium leading-tight ${
                state === 'current'
                  ? 'bg-ink text-bg'
                  : state === 'completed'
                    ? 'bg-muted text-ink'
                    : 'border border-border text-sub'
              }`}
            >
              {state === 'completed' ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : null}
              {s.label}
            </div>
          );
        })}
      </div>
      <p className="text-eyebrow text-sub">All fields required</p>

      <div aria-live="polite" className="sr-only">
        Step {step + 1} of {STEPS.length}: {STEPS[step]!.label}
      </div>

      <div className="rounded-[12px] border border-border bg-raised p-8">
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
        <div className="mt-8 border-t border-border pt-4">
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
