import { useEffect, useRef, useState, type FormEvent } from 'react';
import { parseRupees, formatLKR, centsToInput } from '../lib/money';
import { validateExpense } from '../lib/split';
import { newId } from '../lib/storage';
import type { Expense, Person, SplitMode } from '../lib/types';

interface Props {
  people: Person[];
  /** When set, the form edits this expense instead of creating a new one. */
  editing: Expense | null;
  /** Increments on every Edit click, including repeat clicks on the same row. */
  editRequest: number;
  onSave: (expense: Expense) => void;
  onCancelEdit: () => void;
}

export default function ExpenseForm({
  people,
  editing,
  editRequest,
  onSave,
  onCancelEdit,
}: Props) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [mode, setMode] = useState<SplitMode>('equal');
  // Exact amounts are held as raw strings while typing, so a half-typed "33."
  // doesn't get parsed into something surprising.
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(false);
  const formRef = useRef<HTMLElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setDescription('');
    setAmount('');
    setPayerId(people[0]?.id ?? '');
    setParticipantIds(people.map((p) => p.id));
    setMode('equal');
    setExactInputs({});
    setAttempted(false);
  };

  // Load the expense being edited into the form; clear it when editing stops.
  useEffect(() => {
    if (!editing) {
      reset();
      return;
    }
    setDescription(editing.description);
    setAmount(centsToInput(editing.amountCents));
    setPayerId(editing.payerId);
    setParticipantIds(editing.participantIds);
    setMode(editing.mode);
    setExactInputs(
      Object.fromEntries(
        Object.entries(editing.exactShares).map(([id, cents]) => [id, centsToInput(cents)]),
      ),
    );
    setAttempted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, people.length]);

  /**
   * The expense list sits below the form, so without this the page looks like
   * nothing happened when Edit is clicked. This is keyed on the click counter
   * rather than on `editing`, so clicking Edit again on the row already being
   * edited still brings you back up to the form - the id has not changed, so
   * nothing else would have re-fired. Deliberately does not re-populate the
   * fields, which would throw away whatever you had already typed.
   */
  useEffect(() => {
    if (!editing) return;
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    descriptionRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest]);

  const toggleParticipant = (id: string) => {
    setParticipantIds((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  };

  const amountCents = parseRupees(amount);

  // Build the expense the form currently describes, then let the domain layer
  // judge it. The form holds no rules of its own - validateExpense is the only
  // place that decides whether a split is acceptable.
  const draft: Expense = {
    id: editing?.id ?? '',
    description: description.trim() || 'Expense',
    amountCents: amountCents ?? 0,
    payerId,
    participantIds,
    mode,
    exactShares: Object.fromEntries(
      participantIds.map((id) => [id, parseRupees(exactInputs[id] ?? '') ?? 0]),
    ),
  };

  const error =
    amount.trim() === '' || amountCents === null
      ? 'Enter an amount in rupees, e.g. 1200.50'
      : validateExpense(draft);

  // Live feedback while typing exact amounts, so the user can see the gap close.
  const assigned = participantIds.reduce(
    (sum, id) => sum + (parseRupees(exactInputs[id] ?? '') ?? 0),
    0,
  );
  const remaining = (amountCents ?? 0) - assigned;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (error) {
      setAttempted(true);
      return;
    }
    onSave({ ...draft, id: editing?.id ?? newId() });
    reset();
  };

  if (people.length === 0) {
    return (
      <section className="card">
        <h2>Add an expense</h2>
        <p className="muted">Add some people first.</p>
      </section>
    );
  }

  return (
    <section className={`card ${editing ? 'editing' : ''}`} ref={formRef}>
      <h2>
        {editing ? `Editing "${editing.description}"` : 'Add an expense'}
      </h2>

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="desc">Description</label>
          <input
            id="desc"
            ref={descriptionRef}
            type="text"
            value={description}
            placeholder="Dinner"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="amount">Amount (LKR)</label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            value={amount}
            placeholder="12000.00"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="payer">Paid by</label>
          <select id="payer" value={payerId} onChange={(e) => setPayerId(e.target.value)}>
            <option value="">Select...</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Split between</label>
          <div className="checks">
            {people.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={participantIds.includes(p.id)}
                  onChange={() => toggleParticipant(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>How to split</label>
          <div className="modes">
            <label>
              <input
                type="radio"
                checked={mode === 'equal'}
                onChange={() => setMode('equal')}
              />
              Equally
            </label>
            <label>
              <input
                type="radio"
                checked={mode === 'exact'}
                onChange={() => setMode('exact')}
              />
              By exact amount
            </label>
          </div>
        </div>

        {mode === 'exact' && participantIds.length > 0 && (
          <div className="field">
            <label>Exact amounts</label>
            {participantIds.map((id) => (
              <div className="exact-row" key={id}>
                <span>{people.find((p) => p.id === id)?.name}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={exactInputs[id] ?? ''}
                  placeholder="0.00"
                  onChange={(e) =>
                    setExactInputs((current) => ({ ...current, [id]: e.target.value }))
                  }
                />
              </div>
            ))}
            <p className="muted">
              {remaining === 0
                ? 'Adds up exactly.'
                : remaining > 0
                  ? `${formatLKR(remaining)} left to assign.`
                  : `${formatLKR(-remaining)} over the total.`}
            </p>
          </div>
        )}

        {attempted && error && <p className="error">{error}</p>}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" type="submit">
            {editing ? 'Save changes' : 'Add expense'}
          </button>
          {editing && (
            <button type="button" onClick={onCancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
