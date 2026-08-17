/**
 * Required fields start blank. The engine still needs a total `EsopInputs`
 * (M33) on every render, so `inputs` itself never goes blank — it stays
 * seeded from `buildSeedInputs()` throughout. What starts blank is the
 * *display*: a required field the founder has not yet touched renders empty
 * rather than showing the seed underneath it, and the result stays hidden
 * until every one of them has been.
 *
 * **Only required fields.** D7 wrote this rule for every field on screen,
 * because every field on screen was required. D9 §5 narrows it: a `minor`
 * field is optional, so it renders the seeded default it would silently use
 * anyway, marked as an estimate — a blank box quietly contributing 15% to the
 * answer is the unmarked default D6 forbids. `reportOnly` fields keep the
 * blank start (they are company facts with example seeds, not assumptions);
 * `hidden` ones are not rendered at all. `lib/visibility.ts`'s
 * `showsSeededDefault` is where that line is drawn, once.
 *
 * A touched field is identified by a dot path (`"company.postMoneyValuation"`,
 * `"hiring.hiresPerYear.0"`), not by a typed shape mirroring `EsopInputs`,
 * because which fields are required changes with a founder's own choices —
 * grant basis, strike policy, recycling, refresh, a modelled round — per
 * lib/visibility.ts's tiers, not with a mode switch. A path string is the
 * same shape whether or not the field behind it is required today.
 */
import type { EsopInputs } from '@/lib/esop';
import { showsSeededDefault } from './visibility';

export type TouchedPaths = ReadonlySet<string>;

/** Has the founder entered this field. Distinct from "does its control render
 *  empty", which is the helper below: a `minor` field is untouched and still
 *  shows a value. */
export function isUntouched(touched: TouchedPaths, path: string): boolean {
  return !touched.has(path);
}

/**
 * Wraps a field's real `onChange` so every commit both updates `inputs`
 * (unchanged behaviour) and marks the path touched (new behaviour), rather
 * than requiring every call site to remember the second half.
 *
 * `requiredPaths` is the same set `requiredFieldPaths` (lib/completeness.ts)
 * produces for the current render, threaded down so a Card can ask "is this
 * path one of the ones withholding the result" without restating that
 * function's branches a second time next to the label.
 *
 * `inputs` is here for the tier lookup `isBlank` needs, and only for that. It
 * is already in scope in every card.
 */
export function makeTouchHelpers(
  touched: TouchedPaths,
  markTouched: (path: string) => void,
  requiredPaths: ReadonlySet<string>,
  inputs: EsopInputs,
) {
  return {
    /** Should this field's control render empty. D9 §5: untouched *and* not a
     *  field that shows its seeded default instead. */
    isBlank: (path: string) => isUntouched(touched, path) && !showsSeededDefault(path, inputs),
    isRequired: (path: string) => requiredPaths.has(path),
    withTouch:
      <T,>(path: string, onChange: (value: T) => void) =>
      (value: T) => {
        onChange(value);
        markTouched(path);
      },
  };
}
