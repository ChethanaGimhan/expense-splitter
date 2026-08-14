import { describe, it, expect } from 'vitest';
import { distribute, splitEqual, sharesFor, validateExpense } from './split';
import { parseRupees, formatCents } from './money';
import type { Expense } from './types';

describe('parseRupees', () => {
  it('parses rupee strings into cents', () => {
    expect(parseRupees('12000')).toBe(1_200_000);
    expect(parseRupees('3333.34')).toBe(333_334);
    expect(parseRupees('12,000.50')).toBe(1_200_050);
    expect(parseRupees('0.05')).toBe(5);
  });

  it('rejects junk and sub-cent precision', () => {
    expect(parseRupees('abc')).toBeNull();
    expect(parseRupees('')).toBeNull();
    expect(parseRupees('10.001')).toBeNull();
  });
});

describe('distribute (rounding)', () => {
  it('splits Rs. 100 three ways with no cent lost', () => {
    const shares = distribute(10_000, [1, 1, 1]);
    expect(shares).toEqual([3334, 3333, 3333]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it('always sums back to the total, for every group size and amount', () => {
    for (let n = 1; n <= 12; n++) {
      for (const total of [1, 7, 100, 999, 10_000, 1_200_001]) {
        const shares = distribute(total, Array(n).fill(1));
        expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
        // no two shares may differ by more than a single cent
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic - the same input always gives the same output', () => {
    expect(distribute(10_000, [1, 1, 1])).toEqual(distribute(10_000, [1, 1, 1]));
  });
});

describe('splitEqual', () => {
  it('keys shares by person and reconciles exactly', () => {
    const shares = splitEqual(1_200_000, ['a', 'b', 'c', 'd']);
    expect(shares).toEqual({ a: 300_000, b: 300_000, c: 300_000, d: 300_000 });
  });

  it('gives the leftover cent to the first participant', () => {
    const shares = splitEqual(1_000, ['a', 'b', 'c']);
    expect(shares).toEqual({ a: 334, b: 333, c: 333 });
    expect(formatCents(shares.a)).toBe('3.34');
  });
});

const exactExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  description: 'Hotel',
  amountCents: 1_000_000,
  payerId: 'carol',
  participantIds: ['alice', 'bob', 'dave'],
  mode: 'exact',
  exactShares: { alice: 333_333, bob: 333_333, dave: 333_334 },
  ...overrides,
});

describe('sharesFor', () => {
  it('uses the stored amounts verbatim for exact splits', () => {
    expect(sharesFor(exactExpense())).toEqual({
      alice: 333_333,
      bob: 333_333,
      dave: 333_334,
    });
  });

  it('never charges someone who is not a participant', () => {
    expect(sharesFor(exactExpense()).carol).toBeUndefined();
  });
});

describe('validateExpense', () => {
  it('accepts an exact split that adds up', () => {
    expect(validateExpense(exactExpense())).toBeNull();
  });

  it('flags exact splits that fall short of the total', () => {
    const e = exactExpense({ exactShares: { alice: 333_333, bob: 333_333, dave: 333_333 } });
    expect(validateExpense(e)).toBe('Exact amounts are Rs. 0.01 short of the total.');
  });

  it('flags exact splits that overshoot the total', () => {
    const e = exactExpense({ exactShares: { alice: 400_000, bob: 400_000, dave: 400_000 } });
    expect(validateExpense(e)).toBe('Exact amounts exceed the total by Rs. 2,000.00.');
  });

  it('rejects empty or nonsensical expenses', () => {
    expect(validateExpense(exactExpense({ amountCents: 0 }))).toMatch(/greater than zero/);
    expect(validateExpense(exactExpense({ participantIds: [] }))).toMatch(/at least one person/);
  });
});
