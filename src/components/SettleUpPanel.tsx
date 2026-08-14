import { formatLKR } from '../lib/money';
import type { Person, Transfer } from '../lib/types';

interface Props {
  people: Person[];
  transfers: Transfer[];
}

export default function SettleUpPanel({ people, transfers }: Props) {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? 'Unknown';

  return (
    <section className="card">
      <h2>Settle Up</h2>

      {transfers.length === 0 ? (
        <p className="muted">Everyone is square - no payments needed.</p>
      ) : (
        <>
          <ul>
            {transfers.map((t, i) => (
              <li key={`${t.fromId}-${t.toId}-${i}`} className="transfer">
                <strong>{nameOf(t.fromId)}</strong>
                <span className="arrow">pays</span>
                <strong>{nameOf(t.toId)}</strong>
                <span className="mono" style={{ marginLeft: 'auto' }}>
                  {formatLKR(t.amountCents)}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted" style={{ marginTop: 10 }}>
            {transfers.length} payment{transfers.length === 1 ? '' : 's'} clears the whole group.
          </p>
        </>
      )}
    </section>
  );
}
