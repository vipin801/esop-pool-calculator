import { describe, expect, it } from 'vitest';
import { countChangedFields } from '../lib/inputDiff';

describe('countChangedFields', () => {
  it('is zero for identical primitives, objects and arrays', () => {
    expect(countChangedFields(5, 5)).toBe(0);
    expect(countChangedFields('a', 'a')).toBe(0);
    expect(countChangedFields({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(0);
    expect(countChangedFields([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('counts one changed leaf as one', () => {
    expect(countChangedFields({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(1);
  });

  it('counts every changed leaf across nested objects', () => {
    const a = { company: { stage: 'seed', pool: 10 }, hiring: { horizon: 4 } };
    const b = { company: { stage: 'seriesA', pool: 10 }, hiring: { horizon: 5 } };
    expect(countChangedFields(a, b)).toBe(2);
  });

  it('counts per-element differences in an array of primitives', () => {
    expect(countChangedFields([1, 2, 3, 4], [1, 9, 3, 8])).toBe(2);
  });

  it('counts an added or removed array element as one change', () => {
    expect(countChangedFields([1, 2, 3], [1, 2, 3, 4])).toBe(1);
  });

  it('counts a whole object swapped in for a primitive as one change, not a crash', () => {
    expect(countChangedFields(5, { a: 1 })).toBe(1);
    expect(countChangedFields({ a: 1 }, 5)).toBe(1);
  });

  it('counts a null vs an object as one change', () => {
    expect(countChangedFields(null, { a: 1 })).toBe(1);
    expect(countChangedFields({ a: 1 }, null)).toBe(1);
  });

  it('is order-independent for object keys', () => {
    expect(countChangedFields({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(0);
  });
});
