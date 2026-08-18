import type { EsopInputs, FundingRound, OpeningGrantCohortInput } from '@/lib/esop';
import { Button } from '../ui/Button';
import { GrantBasisCard } from '../inputs/GrantBasisCard';
import { CompanyTodayCard } from '../inputs/CompanyTodayCard';
import { GrantPolicyCard } from '../inputs/GrantPolicyCard';
import { LeaversAndRecyclingCard } from '../inputs/LeaversAndRecyclingCard';
import { FundingRoundCard } from '../inputs/FundingRoundCard';
import { ReportOnlyCard } from '../inputs/ReportOnlyCard';
import { InputCard, type EsopGroupKey } from '../inputs/InputCard';
import { ScreenHiring, type HiringMeta } from './onboarding/ScreenHiring';
import { ScreenGrants, type GrantMeta } from './onboarding/ScreenGrants';

interface ModelPanelProps {
  readonly modelInputs: EsopInputs;
  readonly setDraftGroup: <K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => void;
  readonly openingGrants: readonly OpeningGrantCohortInput[];
  readonly setDraftOpeningGrants: (grants: readonly OpeningGrantCohortInput[]) => void;
  readonly rounds: readonly FundingRound[];
  readonly setDraftRounds: (rounds: readonly FundingRound[]) => void;
  readonly touched: ReadonlySet<string>;
  readonly markTouched: (path: string) => void;
  readonly markManyTouched: (paths: readonly string[]) => void;
  readonly requiredPaths: ReadonlySet<string>;
  readonly hiringMeta: HiringMeta;
  readonly setHiringMeta: (meta: HiringMeta) => void;
  readonly grantMeta: GrantMeta;
  readonly setGrantMeta: (meta: GrantMeta) => void;
  readonly isDirty: boolean;
  readonly changeCount: number;
  readonly onDiscard: () => void;
  readonly onRecalculate: () => void;
  readonly onReset: () => void;
}

/**
 * design.md §6. Every field a founder can edit from the results workspace,
 * in one place — reusing the same card components the onboarding wizard and
 * the pre-redesign rail both already used, grouped rather than rewritten:
 * `GrantPolicyCard` and `CompanyTodayCard` hide the slices ScreenHiring and
 * ScreenGrants already cover here, so no field appears through two different
 * controls (see their `hide*` props). Nothing here changes a tier — every
 * `RequiredMarker`/`EstimateMarker` is the same `lib/visibility.ts` read the
 * cards always did.
 */
export function ModelPanel({
  modelInputs,
  setDraftGroup,
  openingGrants,
  setDraftOpeningGrants,
  rounds,
  setDraftRounds,
  touched,
  markTouched,
  markManyTouched,
  requiredPaths,
  hiringMeta,
  setHiringMeta,
  grantMeta,
  setGrantMeta,
  isDirty,
  changeCount,
  onDiscard,
  onRecalculate,
  onReset,
}: ModelPanelProps) {
  const cardProps = { inputs: modelInputs, setGroup: setDraftGroup, touched, markTouched, requiredPaths };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-eyebrow font-semibold text-ink">Your model</h2>
        <p className="text-2xs leading-4 text-faint">Inputs and assumptions used for this recommendation.</p>
      </div>

      <div className="space-y-3">
        <GrantBasisCard {...cardProps} />
        <CompanyTodayCard
          {...cardProps}
          openingGrants={openingGrants}
          setOpeningGrants={setDraftOpeningGrants}
          hideValuationAndGrowth
        />

        <InputCard index="03" title="Hiring plan">
          <ScreenHiring
            inputs={modelInputs}
            setGroup={setDraftGroup}
            meta={hiringMeta}
            setMeta={setHiringMeta}
            touched={touched}
            markTouched={markTouched}
            markManyTouched={markManyTouched}
            requiredPaths={requiredPaths}
          />
        </InputCard>

        <InputCard index="04" title="Grant economics">
          <ScreenGrants
            inputs={modelInputs}
            setGroup={setDraftGroup}
            meta={grantMeta}
            setMeta={setGrantMeta}
            touched={touched}
            markTouched={markTouched}
            requiredPaths={requiredPaths}
            alwaysShowStrikeAndTheta
          />
        </InputCard>

        <GrantPolicyCard {...cardProps} hideGrantPerHire hideStrikeAndTheta index="05" />
        <LeaversAndRecyclingCard {...cardProps} index="06" />
        <FundingRoundCard {...cardProps} rounds={rounds} setRounds={setDraftRounds} index="07" />
        <ReportOnlyCard {...cardProps} index="08" />
      </div>

      {isDirty ? (
        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-lg border border-strong bg-raised p-3 shadow-panel">
          <p className="text-2xs font-medium text-ink">
            {changeCount} {changeCount === 1 ? 'change' : 'changes'} not applied
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onDiscard}>
              Discard
            </Button>
            <Button size="sm" onClick={onRecalculate}>
              Recalculate
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={onReset}>
          Reset everything
        </Button>
      )}
    </div>
  );
}
