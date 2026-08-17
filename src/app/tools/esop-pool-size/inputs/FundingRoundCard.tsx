import type { FundingRound, PoolCreationTiming } from '@/lib/esop';
import { Field } from '../ui/Field';
import { NumberField } from '../ui/NumberField';
import { RadioGroup } from '../ui/RadioGroup';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { makeTouchHelpers } from '../lib/touched';
import { InputCard, type CardProps } from './InputCard';

const DEFAULT_ROUND: FundingRound = {
  id: 'next-round',
  label: 'Next round',
  year: 1,
  preMoneyValuation: 3_000_000_000,
  raiseAmount: 500_000_000,
  investorRequiredPostRoundPoolPct: 10,
  poolCreation: 'preMoney',
};

interface FundingRoundCardProps extends CardProps {
  readonly rounds: readonly FundingRound[];
  readonly setRounds: (rounds: readonly FundingRound[]) => void;
}

/**
 * Brief §3, section 06. `pool-solver.ts` never reads `rounds` — modelling one
 * changes the top-up-at-round and founder-cost outputs, never the recommended
 * pool percentage — so every sub-field here is `reportOnly` in
 * lib/visibility.ts, and since D9 the toggle is `minor` rather than required:
 * nothing in this section gates a result.
 *
 * The toggle is the one `minor` field with no `EstimateMarker`, deliberately.
 * D6's marker means "a value out of the defaults table is standing in for
 * yours", and M2/M3 keep that vocabulary honest by refusing a provenance tag
 * to anything that is not an estimate. "No round modelled" is not a value from
 * `DEFAULTS` at all — an empty `rounds` array means the round engine does not
 * run, so there is no figure standing in for anything. The seeded
 * `DEFAULT_ROUND` below it is an invented example, which is exactly why its
 * fields stay `reportOnly` and blank rather than presenting ₹300 crore as an
 * assumption the tool is making.
 */
export function FundingRoundCard({ inputs, rounds, setRounds, touched, markTouched, requiredPaths }: FundingRoundCardProps) {
  const round = rounds[0];
  const { isBlank, isRequired, withTouch } = makeTouchHelpers(touched, markTouched, requiredPaths, inputs);

  return (
    <InputCard index="06" title="Next funding round">
      <Field
        label="Model a funding round"
        required={isRequired('rounds.enabled')}
        helper="Unlocks the top-up needed and the cost to founders at the next round."
      >
        <ToggleSwitch
          id="model-round"
          checked={isBlank('rounds.enabled') ? null : round !== undefined}
          onChange={withTouch('rounds.enabled', (checked) => setRounds(checked ? [DEFAULT_ROUND] : []))}
          label="Model the next funding round"
        />
      </Field>

      {round ? (
        <>
          <Field
            label="Round year" htmlFor="round-year"
            required={isRequired('rounds.0.year')}
            helper="Plan year the round closes in, within your hiring horizon."
            note="None of the fields below change your recommended pool percentage — they price the cost of raising at these terms."
          >
            <NumberField
              id="round-year"
              value={round.year}
              blank={isBlank('rounds.0.year')}
              onChange={withTouch('rounds.0.year', (year) => setRounds([{ ...round, year: Math.max(0, Math.round(year)) }]))}
              min={0}
            />
          </Field>

          <Field label="Pre-money valuation" htmlFor="round-pre-money" required={isRequired('rounds.0.preMoneyValuation')}>
            <NumberField
              id="round-pre-money"
              value={round.preMoneyValuation}
              blank={isBlank('rounds.0.preMoneyValuation')}
              onChange={withTouch('rounds.0.preMoneyValuation', (preMoneyValuation) => setRounds([{ ...round, preMoneyValuation }]))}
              prefix="₹"
              grouped
            />
          </Field>

          <Field label="Raise amount" htmlFor="round-raise" required={isRequired('rounds.0.raiseAmount')}>
            <NumberField
              id="round-raise"
              value={round.raiseAmount}
              blank={isBlank('rounds.0.raiseAmount')}
              onChange={withTouch('rounds.0.raiseAmount', (raiseAmount) => setRounds([{ ...round, raiseAmount }]))}
              prefix="₹"
              grouped
            />
          </Field>

          <Field
            label="Investor-required post-round pool" htmlFor="round-investor-pool-pct"
            required={isRequired('rounds.0.investorRequiredPostRoundPoolPct')}
            helper="As a percentage of the post-round fully diluted count."
          >
            <NumberField
              id="round-investor-pool-pct"
              value={round.investorRequiredPostRoundPoolPct}
              blank={isBlank('rounds.0.investorRequiredPostRoundPoolPct')}
              onChange={withTouch('rounds.0.investorRequiredPostRoundPoolPct', (investorRequiredPostRoundPoolPct) =>
                setRounds([{ ...round, investorRequiredPostRoundPoolPct }]),
              )}
              max={90}
              suffix="%"
            />
          </Field>

          <Field label="Pool created" required={isRequired('rounds.0.poolCreation')}>
            <RadioGroup<PoolCreationTiming>
              name="pool-creation"
              value={isBlank('rounds.0.poolCreation') ? null : round.poolCreation}
              onChange={withTouch('rounds.0.poolCreation', (poolCreation) => setRounds([{ ...round, poolCreation }]))}
              ariaLabel="Pool created"
              options={[
                { value: 'preMoney', label: 'Pre-money', helper: 'Founders and existing holders absorb it.' },
                { value: 'postMoney', label: 'Post-money', helper: 'New investors share the dilution.' },
              ]}
            />
          </Field>
        </>
      ) : null}
    </InputCard>
  );
}
