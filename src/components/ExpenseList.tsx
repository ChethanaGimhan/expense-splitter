import { formatLKR } from '../lib/money';
import { sharesFor } from '../lib/split';
import type { Expense, Person } from '../lib/types';

interface Props {
  expenses: Expense[];
  people: Person[];
  editingId: string | null;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export default function ExpenseList({ expenses, people, editingId, onEdit, onDelete }: Props) {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? 'Unknown';

  return (
    <section className="card">
      <h2>Expenses</h2>

      {expenses.length === 0 ? (
        <p className="muted">Nothing logged yet.</p>
      ) : (
        <ul>
          {expenses.map((expense) => {
            // Showing the resolved per-person shares makes the rounding visible:
            // a three-way split of Rs. 100 reads 33.34 / 33.33 / 33.33 on screen.
            const shares = sharesFor(expense);
            return (
              <li key={expense.id}>
                <div className="between">
                  <div>
                    <strong>{expense.description}</strong>{' '}
                    <span className="mono">{formatLKR(expense.amountCents)}</span>
                    <div className="muted">
                      paid by {nameOf(expense.payerId)} &middot;{' '}
                      {expense.mode === 'equal' ? 'split equally' : 'exact amounts'}
                    </div>
                    <div className="muted">
                      {expense.participantIds
                        .map((id) => `${nameOf(id)} ${formatLKR(shares[id] ?? 0)}`)
                        .join('  |  ')}
                    </div>
                  </div>
                  <div>
                    <button className="link" onClick={() => onEdit(expense)}>
                      {editingId === expense.id ? 'Editing' : 'Edit'}
                    </button>
                    <button className="link" onClick={() => onDelete(expense.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
