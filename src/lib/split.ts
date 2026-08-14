import { formatLKR } from './money';
import type { Expense } from './types';

/**
 * Distribute `total` cents across `weights` using the largest-remainder method.
 *
 * This is the whole answer to the rounding problem. Each share is floored, which
 * leaves 0..n-1 leftover cents; those cents are handed out one each to the
 * shares with the largest dropped fraction (ties broken by index, so the result
 * is deterministic and stable across re-renders).
 *
 * Post-condition, guaranteed by construction: sum(result) === total, exactly.
 * A 3-way split of Rs. 100.00 therefore yields 33.34 / 33.33 / 33.33, never
 * 33.33 x 3 = 99.99.
 */
export function distribute(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) throw new Error('distribute: weights must sum to a positive number');

  const shares = new Array<number>(n);
  // Remainder of the exact rational share, scaled by totalWeight to stay in integers.
  const remainders: { index: number; rem: number }[] = new Array(n);
  let assigned = 0;

  for (let i = 0; i < n; i++) {
    const numerator = total * weights[i];
    const floored = Math.floor(numerator / totalWeight);
    shares[i] = floored;
    remainders[i] = { index: i, rem: numerator - floored * totalWeight };
    assigned += floored;
  }

  let leftover = total - assigned;
  remainders.sort((a, b) => b.rem - a.rem || a.index - b.index);
  for (let k = 0; leftover > 0; k++, leftover--) {
    shares[remainders[k % n].index] += 1;
  }

  return shares;
}

/** Equal split: every participant carries weight 1. */
export function splitEqual(total: number, participantIds: string[]): Record<string, number> {
  const shares = distribute(total, participantIds.map(() => 1));
  return Object.fromEntries(participantIds.map((id, i) => [id, shares[i]]));
}

/**
 * What each participant owes for a single expense, keyed by person id.
 * For 'exact' splits the stored per-person cents are used verbatim; validation
 * that they sum to the total happens at entry time (see validateExpense).
 */
export function sharesFor(expense: Expense): Record<string, number> {
  if (expense.mode === 'equal') {
    return splitEqual(expense.amountCents, expense.participantIds);
  }
  return Object.fromEntries(
    expense.participantIds.map((id) => [id, expense.exactShares[id] ?? 0]),
  );
}

/**
 * Bonus requirement: splits that don't add up. Returns a human-readable problem
 * or null when the expense is well-formed.
 */
export function validateExpense(expense: Expense): string | null {
  if (expense.amountCents <= 0) return 'Amount must be greater than zero.';
  if (!expense.payerId) return 'Pick who paid.';
  if (expense.participantIds.length === 0) return 'Pick at least one person to split between.';
  // The UI uses checkboxes so this cannot happen through the interface, but the
  // function must be safe on its own terms - a repeated id would double-charge.
  if (new Set(expense.participantIds).size !== expense.participantIds.length) {
    return 'The same person is listed twice in this split.';
  }

  if (expense.mode === 'exact') {
    const sum = expense.participantIds.reduce((a, id) => a + (expense.exactShares[id] ?? 0), 0);
    const diff = expense.amountCents - sum;
    if (diff !== 0) {
      return diff > 0
        ? `Exact amounts are ${formatLKR(diff)} short of the total.`
        : `Exact amounts exceed the total by ${formatLKR(-diff)}.`;
    }
  }
  return null;
}
