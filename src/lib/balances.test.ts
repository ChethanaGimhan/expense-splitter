import { describe, it, expect } from 'vitest';
import { netBalances, assertBalanced, settleUp, greedySettle, optimalSettle } from './balances';
import { formatCents } from './money';
import type { Expense, Person, Transfer } from './types';

const people: Person[] = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
  { id: 'carol', name: 'Carol' },
  { id: 'dave', name: 'Dave' },
];

/** Applying the settle-up plan to the balances must leave everyone on zero. */
function applyTransfers(net: Record<string, number>, transfers: Transfer[]) {
  const result = { ...net };
  for (const t of transfers) {
    result[t.fromId] += t.amountCents; // the debtor pays, moving up toward zero
    result[t.toId] -= t.amountCents; // the creditor is repaid, moving down toward zero
  }
  return result;
}

/**
 * The exact scenario from the brief:
 *   1. Alice paid Rs. 12,000 split equally among all four
 *   2. Carol paid Rs. 10,000 split by exact amount (3,333.33 / 3,333.33 / 3,333.34)
 *   3. Dave paid Rs. 6,000 split equally between Dave and Bob only
 */
const briefScenario: Expense[] = [
  {
    id: 'e1',
    description: 'Dinner',
    amountCents: 1_200_000,
    payerId: 'alice',
    participantIds: ['alice', 'bob', 'carol', 'dave'],
    mode: 'equal',
    exactShares: {},
  },
  {
    id: 'e2',
    description: 'Hotel',
    amountCents: 1_000_000,
    payerId: 'carol',
    participantIds: ['alice', 'bob', 'dave'],
    mode: 'exact',
    exactShares: { alice: 333_333, bob: 333_333, dave: 333_334 },
  },
  {
    id: 'e3',
    description: 'Gas',
    amountCents: 600_000,
    payerId: 'dave',
    participantIds: ['dave', 'bob'],
    mode: 'equal',
    exactShares: {},
  },
];

describe("the brief's sanity-check scenario", () => {
  const net = netBalances(people, briefScenario);

  it('produces the expected net balance for each person', () => {
    expect(net).toEqual({
      alice: 566_667, // paid 12,000, owes 3,000 + 3,333.33
      bob: -933_333, // owes 3,000 + 3,333.33 + 3,000
      carol: 700_000, // paid 10,000, owes only her 3,000 share of dinner
      dave: -333_334, // paid 6,000, owes 3,000 + 3,333.34 + 3,000
    });
  });

  it('reconciles to exactly zero, not to within a cent', () => {
    expect(Object.values(net).reduce((a, b) => a + b, 0)).toBe(0);
    expect(() => assertBalanced(net)).not.toThrow();
  });

  it('reads back in rupees the way a human would check it', () => {
    expect(formatCents(net.alice)).toBe('5,666.67');
    expect(formatCents(net.bob)).toBe('-9,333.33');
    expect(formatCents(net.carol)).toBe('7,000.00');
    expect(formatCents(net.dave)).toBe('-3,333.34');
  });

  it('settles up in 3 transfers, not the 4 pairwise debts', () => {
    const transfers = settleUp(net);
    expect(transfers).toHaveLength(3);
  });

  it('leaves every single person on zero once the transfers are made', () => {
    const after = applyTransfers(net, settleUp(net));
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });

  it('never asks a creditor to pay or a debtor to receive', () => {
    for (const t of settleUp(net)) {
      expect(net[t.fromId]).toBeLessThan(0);
      expect(net[t.toId]).toBeGreaterThan(0);
      expect(t.amountCents).toBeGreaterThan(0);
    }
  });
});

describe('editing and deleting expenses', () => {
  it('recalculates balances when an expense is removed', () => {
    const withoutGas = briefScenario.filter((e) => e.id !== 'e3');
    const net = netBalances(people, withoutGas);
    expect(net).toEqual({
      alice: 566_667,
      bob: -633_333,
      carol: 700_000,
      dave: -633_334,
    });
    expect(() => assertBalanced(net)).not.toThrow();
  });

  it('recalculates balances when an expense amount is edited', () => {
    const edited = briefScenario.map((e) =>
      e.id === 'e1' ? { ...e, amountCents: 1_000_000 } : e,
    );
    const net = netBalances(people, edited);
    expect(() => assertBalanced(net)).not.toThrow();
    expect(net.alice).toBe(1_000_000 - 250_000 - 333_333);
  });

  it('stays balanced with no people and no expenses', () => {
    expect(settleUp(netBalances([], []))).toEqual([]);
  });
});

describe('rounding survives all the way through to the balances', () => {
  it('splits Rs. 100 three ways and still reconciles to zero', () => {
    const trio = people.slice(0, 3);
    const net = netBalances(trio, [
      {
        id: 'x',
        description: 'Coffee',
        amountCents: 10_000,
        payerId: 'alice',
        participantIds: ['alice', 'bob', 'carol'],
        mode: 'equal',
        exactShares: {},
      },
    ]);
    expect(net).toEqual({ alice: 6_666, bob: -3_333, carol: -3_333 });
    expect(() => assertBalanced(net)).not.toThrow();
  });
});

describe('settle-up algorithms', () => {
  it('spots a subgroup that cancels exactly', () => {
    // Two debtors of 50 exactly cover one creditor of 100: one transfer each.
    const transfers = settleUp({ a: -5_000, b: -5_000, c: 10_000 });
    expect(transfers).toHaveLength(2);
  });

  it('ignores anyone already settled', () => {
    const transfers = settleUp({ a: -1_000, b: 1_000, c: 0 });
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toEqual({ fromId: 'a', toId: 'b', amountCents: 1_000 });
  });

  it('never asks anyone to front more than they owe', () => {
    // One creditor, three equal debtors. A chain (Bob pays 9,000, gets 6,000
    // back) settles this in three transfers too, but makes Bob move 9,000 to
    // clear a 3,000 debt. Everyone should just pay the creditor directly.
    const net = { alice: 900_000, bob: -300_000, carol: -300_000, dave: -300_000 };
    const transfers = settleUp(net);

    expect(transfers).toHaveLength(3);

    const paidBy: Record<string, number> = {};
    for (const t of transfers) paidBy[t.fromId] = (paidBy[t.fromId] ?? 0) + t.amountCents;
    expect(paidBy).toEqual({ bob: 300_000, carol: 300_000, dave: 300_000 });

    // Nobody receives money they were not owed either.
    expect(transfers.every((t) => t.toId === 'alice')).toBe(true);
  });

  it('moves exactly the money that is owed, never more', () => {
    const net = { a: 566_667, b: -933_333, c: 700_000, d: -333_334 };
    const moved = settleUp(net).reduce((sum, t) => sum + t.amountCents, 0);
    const owed = Object.values(net).filter((v) => v > 0).reduce((a, b) => a + b, 0);
    expect(moved).toBe(owed);
  });

  it('stays fast at the exhaustive-search limit', () => {
    const net: Record<string, number> = {};
    for (let i = 0; i < 6; i++) net[`debtor${i}`] = -(i + 1) * 1_000;
    for (let i = 0; i < 6; i++) net[`creditor${i}`] = (i + 1) * 1_000;

    const started = Date.now();
    const transfers = settleUp(net);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(Object.values(applyTransfers(net, transfers)).every((v) => v === 0)).toBe(true);
  });

  it('never needs more than n-1 transfers, and optimal never beats out greedy', () => {
    const cases: Record<string, number>[] = [
      { a: -100, b: -200, c: 300 },
      { a: -500, b: 300, c: 200 },
      { a: -333, b: -333, c: -334, d: 1_000 },
      { a: 1_000, b: -250, c: -250, d: -250, e: -250 },
      { a: -700, b: 200, c: 200, d: 300 },
      { a: -1, b: -1, c: -1, d: 3 },
    ];

    for (const net of cases) {
      const entries = Object.entries(net).map(([id, balance]) => ({ id, balance }));
      const optimal = optimalSettle(entries);
      const greedy = greedySettle(entries);

      expect(optimal.length).toBeLessThanOrEqual(greedy.length);
      expect(optimal.length).toBeLessThanOrEqual(entries.length - 1);

      // Both plans must actually settle the group.
      for (const plan of [optimal, greedy]) {
        const after = applyTransfers(net, plan);
        expect(Object.values(after).every((v) => v === 0)).toBe(true);
      }
    }
  });
});
