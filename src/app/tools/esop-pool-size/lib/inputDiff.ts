/**
 * A precise count of how many leaf values differ between two `EsopInputs`
 * snapshots, for `Your model`'s "N changes not applied" line (design.md §6.2)
 * — not an estimate, a real recursive walk over every field, array included.
 * Pure, no engine call, the same discipline every other lib/ helper here
 * holds to.
 */
export function countChangedFields(a: unknown, b: unknown): number {
  if (Object.is(a, b)) return 0;

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray || bIsArray) {
    if (!aIsArray || !bIsArray) return 1;
    const length = Math.max(a.length, b.length);
    let count = 0;
    for (let i = 0; i < length; i++) count += countChangedFields(a[i], b[i]);
    return count;
  }

  const aIsObject = typeof a === 'object' && a !== null;
  const bIsObject = typeof b === 'object' && b !== null;
  if (aIsObject || bIsObject) {
    if (!aIsObject || !bIsObject) return 1;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let count = 0;
    for (const key of keys) {
      count += countChangedFields((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]);
    }
    return count;
  }

  return a === b ? 0 : 1;
}
