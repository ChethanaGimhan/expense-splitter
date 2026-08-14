import { useState, type FormEvent } from 'react';
import type { Person } from '../lib/types';

interface Props {
  people: Person[];
  /** Ids that appear in at least one expense, as payer or participant. */
  referencedIds: Set<string>;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

export default function PeoplePanel({ people, referencedIds, onAdd, onRemove }: Props) {
  const [name, setName] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };

  return (
    <section className="card">
      <h2>People</h2>

      <form className="row" onSubmit={submit}>
        <div style={{ flex: 1 }}>
          <label htmlFor="person-name">Name</label>
          <input
            id="person-name"
            type="text"
            value={name}
            placeholder="e.g. Alice"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="primary" type="submit">
          Add
        </button>
      </form>

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
