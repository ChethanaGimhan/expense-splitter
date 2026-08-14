# Expense Splitter

A single-session tool for splitting shared trip costs in Sri Lankan Rupees and settling
up in the fewest payments possible. Add people, log who paid for what, and the app works
out the net position of every person and the shortest set of payments that clears the
group.

No accounts, no login, no server.

## Running it

Requires Node 18 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm test         # 29 unit tests covering the split and settle-up logic
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

No environment variables, API keys or `.env` file are needed to run this.

## How it works

### Money is never a floating-point number

Every amount in the app is stored as an **integer number of cents**. `Rs. 12,000.00` is
held in memory as `1200000`. Rupee strings are parsed into cents at the edge
([`src/lib/money.ts`](src/lib/money.ts)) and formatted back for display; nothing in
between ever does arithmetic on a decimal.

This is the reason the balances reconcile. In JavaScript `0.1 + 0.2 === 0.30000000000000004`,
so a ledger built on floats accumulates drift and eventually shows `Rs. -0.0000000001`
instead of zero.

### Rounding: the largest-remainder method

Rs. 100.00 split three ways is `3333.33...` cents each. Rounding each share down loses a
cent; rounding up invents two.

[`distribute()`](src/lib/split.ts) handles this by flooring every share first — so the
total can only ever be *short*, never over — counting the leftover cents, and handing them
out one each to the shares that were rounded down hardest. Ties break by position, so the
result is deterministic and doesn't reshuffle between renders.

```
Rs. 100.00 split 3 ways  ->  33.34 + 33.33 + 33.33  =  100.00 exactly
```

Because the shares of every expense sum exactly to that expense's total, the credit to the
payer and the debits to the participants cancel, and **the balances always sum to exactly
zero** — not to within a cent. It's an invariant of the data model rather than something
corrected at the end. The Balances panel shows this live: *"Reconciles to exactly Rs. 0.00"*.

### Settle Up: fewest payments, and nobody overpays

Balances are tracked as one net number per person rather than as pairwise debts. The
settle-up screen then finds the shortest set of payments that returns everyone to zero.

Finding the true minimum is NP-hard — it reduces to set-partition, since any subgroup whose
balances cancel can settle internally, and finding those subgroups is the hard part. So
[`settleUp()`](src/lib/balances.ts) runs a branch-and-bound exhaustive search for groups of
up to 12 non-zero balances, and falls back to a greedy largest-debtor/largest-creditor pass
above that so the UI can never hang.

Every transfer is capped at `min(what the debtor owes, what the creditor is owed)`. This
costs nothing in transaction count, and it means **nobody is ever asked to front more than
their own debt** — without the cap, the search can return chains like *"Bob pays 9,000, then
gets 6,000 back"*, which settles a 3,000 debt in the most painful way possible. It also
guarantees the total cash moved equals exactly the sum of the debts; no money circulates.

## Assumptions

Everything here was a judgment call, with the reasoning:

**Persistence is localStorage.** The brief describes a single-session tool with no accounts,
so a database or an API would have been infrastructure spent on nothing. localStorage
survives a refresh, needs no setup from whoever runs this, and left the time for the split
and settle-up logic. The key is versioned (`expense-splitter:v1`) so a future change to the
data shape can move to a new key instead of crashing on old data. Corrupt or hand-edited
data falls back to an empty ledger — a partially valid ledger is worse than none.

**The second split type is exact amounts, not percentages.** Both were allowed; exact
amounts matches the scenario in the brief verbatim, which made it possible to verify against
their exact figures.

**The payer is not automatically part of the split.** Someone can pay for a meal they didn't
eat. The brief's own scenario requires this — Carol pays for a hotel split between the other
three — and a model that assumes otherwise gets it wrong.

**A person who appears in any expense cannot be deleted.** Removing them would drop either
their credit or their share from the ledger, and the balances would stop summing to zero.
The Remove button is disabled with an explanation, and the expenses have to go first. The
alternative — cascading the delete through their expenses — silently destroys data the user
may not have meant to lose.

**The leftover cent goes to the earliest participant.** Deterministic and reproducible,
which matters in a money app. See "what I'd do next" for the trade-off.

**Amounts are entered to at most two decimal places.** `10.001` is rejected rather than
silently rounded, since LKR has no sub-cent denomination and quietly changing a user's
number is worse than refusing it.

**Single currency (LKR), as specified.** No conversion, no multi-currency support.

## Verifying it

The scenario from the brief runs as a test in
[`src/lib/balances.test.ts`](src/lib/balances.test.ts) — Alice pays 12,000 split four ways,
Carol pays 10,000 split by exact amounts, Dave pays 6,000 split between Dave and Bob:

| Person | Net balance |
| ------ | ----------- |
| Alice  | +5,666.67   |
| Bob    | −9,333.33   |
| Carol  | +7,000.00   |
| Dave   | −3,333.34   |

Sums to exactly `0`, and Settle Up clears it in **3 payments** rather than listing every
pairwise debt.

### Tests

29 tests, all against the domain logic:

- Rounding holds for every group size from 1 to 12 across a range of awkward totals — shares
  always sum back to the exact total, and no two shares differ by more than one cent
- The brief's scenario, end to end
- Applying the settle-up plan to the balances leaves every person on exactly zero
- The exhaustive search never returns more transfers than greedy, and never more than n−1
- Nobody pays more than they owe, and total money moved equals total debt
- Editing an expense amount and deleting an expense both recalculate correctly
- Exact splits that don't add up are rejected in both directions

## What I'd do next

**Rotate the leftover cent between expenses.** Right now the earliest participant absorbs
every stray cent. Over one expense that's noise; over thirty expenses with the same group,
one person systematically eats all of them. Seeding the rotation from the expense id would
spread it fairly while staying deterministic.

**Percentage splits**, as a third mode. `distribute()` already takes arbitrary weights, so
the rounding is done — it's a form and a validation message.

**Share the settle-up plan** — export it as text or a link, since the point of the screen is
to tell other people what to pay.

**Undo for delete.** Deleting an expense is currently immediate and irreversible.

## What's incomplete, and why

**No component or end-to-end tests.** The 29 tests cover `src/lib/` exclusively. The brief
was explicit that correctness of the split and settle-up logic matters more than the UI, and
that's where a wrong answer would actually cost someone money — so the test budget went
entirely there. The UI was verified by hand against the brief's scenario.

**Deleting a person is blocked rather than handled.** The correct behaviour is arguably to
offer to reassign or remove their expenses. Blocking protects the invariant, which was the
priority; a smoother flow was not.

**No accessibility pass.** The form uses real labels and semantic elements, but it hasn't
been tested with a screen reader or for keyboard-only navigation.

**Styling is deliberately plain.** The brief said a correct, plain-looking app beats a
beautiful one with wrong balances. The header and layout were done only after the logic was
finished and tested — the commit history reflects that order.

## Project structure

```
src/
├── lib/                  pure TypeScript, no React
│   ├── money.ts          rupee strings <-> integer cents
│   ├── types.ts          Person, Expense, Transfer, AppState
│   ├── split.ts          largest-remainder distribution, split validation
│   ├── balances.ts       net positions, settle-up search
│   └── storage.ts        localStorage load/save
├── components/           one job each
└── App.tsx               owns state, derives balances and transfers
```

The entire domain layer has no idea a UI exists, which is why the tests need no DOM and run
in under half a second. Balances and the settle-up plan are derived on every render rather
than stored, so there is no second copy of the truth to keep in sync — which is what makes
edit and delete recalculate correctly without any extra code.
