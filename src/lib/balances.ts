import { sharesFor } from './split';
import type { Expense, Person, Transfer } from './types';

/**
 * Net position of every person, in integer cents.
 *   positive => the group owes them money
 *   negative => they owe the group money
 *
 * Pairwise debts are deliberately not tracked. Only the net number per person
 * matters for settling up, and one number per person is far easier to keep
 * correct across edits and deletes than an n x n matrix.
 *
 * Because every expense's shares come from `distribute`, which is guaranteed to
 * sum to the expense total, the credit to the payer and the debits to the
 * participants cancel exactly. So this map always sums to 0 - an invariant,
 * not a coincidence. `assertBalanced` is the runtime proof.
 */
export function netBalances(people: Person[], expenses: Expense[]): Record<string, number> {
  const net: Record<string, number> = Object.fromEntries(people.map((p) => [p.id, 0]));

  for (const expense of expenses) {
    // The payer fronted the whole amount, so the group owes them that much...
    if (expense.payerId in net) net[expense.payerId] += expense.amountCents;

    // ...and each participant owes their share of it.
    for (const [personId, share] of Object.entries(sharesFor(expense))) {
      if (personId in net) net[personId] -= share;
    }
  }

  return net;
}

/** Throws if the books don't balance. Used by the tests and as a UI guard. */
export function assertBalanced(net: Record<string, number>): void {
  const sum = Object.values(net).reduce((a, b) => a + b, 0);
  if (sum !== 0) {
    throw new Error(`Balances do not reconcile to zero: off by ${sum} cent(s)`);
  }
}

/**
 * Greedy settlement: repeatedly make the largest debtor pay the largest
 * creditor. Every step fully zeroes at least one person, so this never needs
 * more than n-1 transfers - against up to n*(n-1)/2 for naive pairwise debts.
 *
 * Fast and good, but not always optimal: given [-50, -50, +100] it may produce
 * two transfers where a smarter pairing also needs two, and on larger inputs it
 * can miss subgroups that cancel exactly.
 */
export function greedySettle(entries: { id: string; balance: number }[]): Transfer[] {
  const debtors = entries.filter((e) => e.balance < 0).map((e) => ({ ...e }));
  const creditors = entries.filter((e) => e.balance > 0).map((e) => ({ ...e }));
  debtors.sort((a, b) => a.balance - b.balance); // most negative first
  creditors.sort((a, b) => b.balance - a.balance); // most positive first

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(-debtors[i].balance, creditors[j].balance);
    if (amount > 0) {
      transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, amountCents: amount });
      debtors[i].balance += amount;
      creditors[j].balance -= amount;
    }
    if (debtors[i].balance === 0) i++;
    if (creditors[j].balance === 0) j++;
  }

  return transfers;
}

/**
 * Exhaustive search for a genuinely minimal transfer set.
 *
 * Finding the true minimum is NP-hard: it reduces to set-partition, because any
 * subgroup whose balances cancel can settle internally and each such subgroup
 * found saves a transaction. So this brute-forces it - pair the first non-zero
 * person against each possible counterparty in turn, recurse, and keep the
 * shortest plan found. Branch-and-bound pruning keeps it practical for the
 * group sizes this app realistically sees.
 *
 * Every transfer is capped at min(what the debtor owes, what the creditor is
 * owed), so nobody is ever asked to front more than their own debt and no money
 * circulates - total cash moved is exactly the sum of the debts. This costs
 * nothing in transaction count: the minimum is n minus the number of disjoint
 * cancelling subgroups, and inside a subgroup of size k you can always reach
 * k-1 transfers with capped payments alone. Without the cap the search can
 * return a chain like "Bob pays 9,000, then gets 6,000 back" - the same number
 * of transfers, but a needlessly painful way to settle a 3,000 debt.
 */
export function optimalSettle(entries: { id: string; balance: number }[]): Transfer[] {
  const ids = entries.map((e) => e.id);
  const balances = entries.map((e) => e.balance);

  let best: Transfer[] | null = null;
  const current: Transfer[] = [];

  const search = (start: number): void => {
    // Skip anyone already settled.
    let i = start;
    while (i < balances.length && balances[i] === 0) i++;

    if (i === balances.length) {
      if (!best || current.length < best.length) best = [...current];
      return;
    }

    // Person i still owes or is owed, so this branch needs at least one more
    // transfer. If that already ties the incumbent, it can never beat it.
    if (best && current.length + 1 >= best.length) return;

    for (let j = i + 1; j < balances.length; j++) {
      // Only settle against someone on the opposite side of the ledger.
      if (balances[i] * balances[j] >= 0) continue;

      // Capped at whichever side runs out first, so neither party overpays.
      const amount = Math.min(Math.abs(balances[i]), Math.abs(balances[j]));
      const iIsDebtor = balances[i] < 0;
      current.push({
        fromId: iIsDebtor ? ids[i] : ids[j],
        toId: iIsDebtor ? ids[j] : ids[i],
        amountCents: amount,
      });

      const savedI = balances[i];
      const savedJ = balances[j];
      // Both parties move toward zero, and at least one of them reaches it.
      balances[i] += iIsDebtor ? amount : -amount;
      balances[j] += iIsDebtor ? -amount : amount;

      // i may still be non-zero if j was the smaller side, so re-examine i
      // rather than moving on. Progress is still guaranteed - every transfer
      // settles at least one person, so the recursion cannot run away.
      search(i);

      // Undo, so the next candidate j starts from a clean slate.
      balances[i] = savedI;
      balances[j] = savedJ;
      current.pop();
    }
  };

  search(0);
  return best ?? [];
}

/** Above this many non-zero balances the exhaustive search gets too slow. */
const EXHAUSTIVE_SEARCH_LIMIT = 12;

/**
 * The "Settle Up" answer: the smallest set of payments that returns everyone to
 * zero. Exhaustive for normal group sizes, greedy as a safety valve for very
 * large groups so the UI can never hang.
 */
export function settleUp(net: Record<string, number>): Transfer[] {
  const entries = Object.entries(net)
    .filter(([, balance]) => balance !== 0)
    .map(([id, balance]) => ({ id, balance }));

  if (entries.length === 0) return [];
  return entries.length <= EXHAUSTIVE_SEARCH_LIMIT
    ? optimalSettle(entries)
    : greedySettle(entries);
}
