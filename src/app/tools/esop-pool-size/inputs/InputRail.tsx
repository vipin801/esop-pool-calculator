import type { EsopInputs, FundingRound, OpeningGrantCohortInput } from '@/lib/esop';
import { Button } from '../ui/Button';
import { CompanyTodayCard } from './CompanyTodayCard';
import { FundingRoundCard } from './FundingRoundCard';
import { GrantBasisCard } from './GrantBasisCard';
import type { EsopGroupKey } from './InputCard';
import { GrantPolicyCard } from './GrantPolicyCard';
import { HiringCard } from './HiringCard';
import { LeaversAndRecyclingCard } from './LeaversAndRecyclingCard';
import { ReportOnlyCard } from './ReportOnlyCard';

interface InputRailProps {
  readonly inputs: EsopInputs;
  readonly setGroup: <K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => void;
  readonly openingGrants: readonly OpeningGrantCohortInput[];
  readonly setOpeningGrants: (grants: readonly OpeningGrantCohortInput[]) => void;
  readonly rounds: readonly FundingRound[];
  readonly setRounds: (rounds: readonly FundingRound[]) => void;
  readonly touched: ReadonlySet<string>;
  readonly markTouched: (path: string) => void;
  readonly requiredPaths: ReadonlySet<string>;
  readonly onReset: () => void;
}

/**
 * One form, ordered by impact (brief §3). No Simple/Advanced toggle, and
 * fields never move position when a founder's choice changes a tier — see
 * lib/visibility.ts for what changes instead. Section order is fixed:
 * 01 how you grant, 02 your company today, 03 your hiring plan, 04 grant
 * policy, 05 leavers and recycling, 06 next funding round, 07 the fields
 * that only affect the report.
 */
export function InputRail({
  inputs,
  setGroup,
  openingGrants,
  setOpeningGrants,
  rounds,
  setRounds,
  touched,
  markTouched,
  requiredPaths,
  onReset,
}: InputRailProps) {
  const cardProps = { inputs, setGroup, touched, markTouched, requiredPaths };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-raised p-3">
        <div>
          <h2 className="text-eyebrow font-medium text-ink">Every field below is a starting estimate.</h2>
          <p className="text-2xs leading-4 text-faint">Edit anything — nothing here is measured data on your company.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onReset}>
          Reset
        </Button>
      </div>

      {/* Below lg the rail stacks above the result, so the answer is a scroll
          away. The pinned summary bar carries the number; this carries the
          founder. DOM order is unchanged, so focus order still matches the
          reading order at every width. */}
      <a
        href="#result"
        className="block rounded-lg border border-strong bg-raised px-3 py-2 text-eyebrow font-medium text-ink lg:hidden"
      >
        Jump to your result ↓
      </a>

      <GrantBasisCard {...cardProps} />
      <CompanyTodayCard {...cardProps} openingGrants={openingGrants} setOpeningGrants={setOpeningGrants} />
      <HiringCard {...cardProps} />
      <GrantPolicyCard {...cardProps} />
      <LeaversAndRecyclingCard {...cardProps} />
      <FundingRoundCard {...cardProps} rounds={rounds} setRounds={setRounds} />
      <ReportOnlyCard {...cardProps} />
    </div>
  );
}
