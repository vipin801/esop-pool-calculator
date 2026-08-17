/**
 * Every field starts blank. The engine still needs a total `EsopInputs`
 * (M33) on every render, so `inputs` itself never goes blank — it stays
 * seeded from `buildSeedInputs()` throughout. What starts blank is the
 * *display*: a field the founder has not yet touched renders empty rather
 * than showing the seed underneath it, and the result stays hidden until
 * every currently visible field has been.
 *
 * A touched field is identified by a dot path (`"company.postMoneyValuation"`,
 * `"hiring.hiresPerYear.0"`), not by a typed shape mirroring `EsopInputs`,
 * because which fields are required changes with a founder's own choices —
 * grant basis, strike policy, recycling, refresh, a modelled round — per
 * lib/visibility.ts's tiers, not with a mode switch. A path string is the
 * same shape whether or not the field behind it is required today.
 */
export type TouchedPaths = ReadonlySet<string>;

export function isBlank(touched: TouchedPaths, path: string): boolean {
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
 */
export function makeTouchHelpers(
  touched: TouchedPaths,
  markTouched: (path: string) => void,
  requiredPaths: ReadonlySet<string>,
) {
  return {
    isBlank: (path: string) => isBlank(touched, path),
    isRequired: (path: string) => requiredPaths.has(path),
    withTouch:
      <T,>(path: string, onChange: (value: T) => void) =>
      (value: T) => {
        onChange(value);
        markTouched(path);
      },
  };
}
