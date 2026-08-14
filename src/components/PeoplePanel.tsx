import { useState, type FormEvent } from 'react';
import type { Person } from '../lib/types';

interface Props {
  people: Person[];
  /** Ids that appear in at least one expense, as payer or participant. */
  referencedIds: Set<string>;
  /** False when there is nothing to clear, so the button stays hidden. */
  canStartOver: boolean;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onStartOver: () => void;
}

export default function PeoplePanel({
  people,
  referencedIds,
  canStartOver,
  onAdd,
  onRemove,
  onStartOver,
}: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    // Two people called "Alice" are distinct ids and the maths stays correct,
    // but Settle Up would then read "Alice pays Alice" and look broken.
    if (people.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`${trimmed} is already in this group.`);
      return;
    }

    setError(null);
    onAdd(trimmed);
    setName('');
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>People</h2>
        {canStartOver && (
          <button type="button" className="link danger" onClick={onStartOver}>
            Start over
          </button>
        )}
      </div>

      <form className="row" onSubmit={submit}>
        <div style={{ flex: 1 }}>
          <label htmlFor="person-name">Name</label>
          <input
            id="person-name"
            type="text"
            value={name}
            placeholder="e.g. Alice"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </div>
        <button className="primary" type="submit">
          Add
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {people.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Add at least two people to start logging expenses.
        </p>
      ) : (
        <ul style={{ marginTop: 12 }}>
          {people.map((p) => {
            // A person referenced by an expense cannot be deleted: removing them
            // would drop their credit or their share from the ledger and the
            // balances would stop summing to zero.
            const locked = referencedIds.has(p.id);
            return (
              <li key={p.id} className="between">
                <span>{p.name}</span>
                <button
                  className="link"
                  disabled={locked}
                  title={locked ? 'Used in an expense - delete those expenses first' : 'Remove'}
                  onClick={() => onRemove(p.id)}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
