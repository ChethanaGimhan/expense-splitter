import { formatLKR, formatCents } from '../lib/money';
import type { Person } from '../lib/types';

interface Props {
  people: Person[];
  net: Record<string, number>;
}

export default function BalancesPanel({ people, net }: Props) {
  // Summed from the same integers that are rendered on screen, so the badge is
  // proof about what the user is actually looking at - not a separate
  // calculation that could quietly disagree with the list.
  const total = people.reduce((sum, p) => sum + (net[p.id] ?? 0), 0);

  return (
    <section className="card">
      <h2>Balances</h2>

      {people.length === 0 ? (
        <p className="muted">No one added yet.</p>
      ) : (
        <ul>
          {people.map((p) => {
            const balance = net[p.id] ?? 0;
            return (
              <li key={p.id} className="between">
                <span>{p.name}</span>
                <span className={`mono ${balance > 0 ? 'owed' : balance < 0 ? 'owes' : 'muted'}`}>
                  {balance === 0
                    ? 'settled'
                    : balance > 0
                      ? `is owed ${formatLKR(balance)}`
                      : `owes ${formatLKR(-balance)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className={`badge ${total === 0 ? '' : 'bad'}`}>
        {total === 0
          ? 'Reconciles to exactly Rs. 0.00'
          : `Does not reconcile - off by Rs. ${formatCents(total)}`}
      </div>
    </section>
  );
}
