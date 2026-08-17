import type { EsopInputs, FundingRound, OpeningGrantCohortInput } from '@/lib/esop';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { AttritionCard } from './AttritionCard';
import { CompanyCard } from './CompanyCard';
import { ComplianceCard } from './ComplianceCard';
import type { EsopGroupKey } from './InputCard';
import { GrantPolicyCard } from './GrantPolicyCard';
import { GrowthCard } from './GrowthCard';
import { HiringCard } from './HiringCard';
import { VestingCard } from './VestingCard';

type Mode = 'simple' | 'advanced';

interface InputRailProps {
  readonly inputs: EsopInputs;
  readonly setGroup: <K extends EsopGroupKey>(key: K, patch: Partial<EsopInputs[K]>) => void;
  readonly openingGrants: readonly OpeningGrantCohortInput[];
  readonly setOpeningGrants: (grants: readonly OpeningGrantCohortInput[]) => void;
  readonly rounds: readonly FundingRound[];
  readonly setRounds: (rounds: readonly FundingRound[]) => void;
  readonly mode: Mode;
  readonly onModeChange: (mode: Mode) => void;
  readonly onReset: () => void;
}

export function InputRail({
  inputs,
  setGroup,
  openingGrants,
  setOpeningGrants,
  rounds,
  setRounds,
  mode,
  onModeChange,
  onReset,
}: InputRailProps) {
  const advanced = mode === 'advanced';
  const cardProps = { inputs, setGroup, advanced };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-raised p-3">
        <div>
          <h2 className="text-[13px] font-medium text-ink">Every field below is a starting estimate.</h2>
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
        className="block rounded-lg border border-strong bg-raised px-3 py-2 text-[13px] font-medium text-ink lg:hidden"
      >
        Jump to your result ↓
      </a>

      <SegmentedControl<Mode>
        value={mode}
        onChange={onModeChange}
        ariaLabel="Input detail level"
        size="md"
        options={[
          { value: 'simple', label: 'Simple' },
          { value: 'advanced', label: 'Advanced' },
        ]}
      />

      <CompanyCard
        {...cardProps}
        openingGrants={openingGrants}
        setOpeningGrants={setOpeningGrants}
        rounds={rounds}
        setRounds={setRounds}
      />
      <HiringCard {...cardProps} />
      <GrantPolicyCard {...cardProps} />
      <GrowthCard {...cardProps} />
      {advanced ? <AttritionCard {...cardProps} /> : null}
      {advanced ? <VestingCard {...cardProps} /> : null}
      <ComplianceCard {...cardProps} />
    </div>
  );
}
