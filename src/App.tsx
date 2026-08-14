import { useEffect, useMemo, useState } from 'react';
import PeoplePanel from './components/PeoplePanel';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import BalancesPanel from './components/BalancesPanel';
import SettleUpPanel from './components/SettleUpPanel';
import { netBalances, settleUp } from './lib/balances';
import { loadState, saveState, newId, emptyState } from './lib/storage';
import type { AppState, Expense } from './lib/types';

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bumped on every Edit click so the form can scroll itself back into view
  // even when the same expense is clicked twice.
  const [editRequest, setEditRequest] = useState(0);

  // Single write point for persistence: any change to people or expenses is
  // saved, so no individual handler has to remember to do it.
  useEffect(() => saveState(state), [state]);

  // Balances and the settle-up plan are derived from the ledger on every
  // render rather than stored. There is no second copy of the truth to keep in
  // sync, which is what makes edit and delete recalculate correctly for free.
  const net = useMemo(
    () => netBalances(state.people, state.expenses),
    [state.people, state.expenses],
  );
  const transfers = useMemo(() => settleUp(net), [net]);

  // Anyone named by an expense, so they can't be deleted out from under it.
  const referencedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of state.expenses) {
      ids.add(e.payerId);
      e.participantIds.forEach((id) => ids.add(id));
    }
    return ids;
  }, [state.expenses]);

  const addPerson = (name: string) =>
    setState((s) => ({ ...s, people: [...s.people, { id: newId(), name }] }));

  const removePerson = (id: string) =>
    setState((s) => ({ ...s, people: s.people.filter((p) => p.id !== id) }));

  const saveExpense = (expense: Expense) => {
    setState((s) => ({
      ...s,
      expenses: s.expenses.some((e) => e.id === expense.id)
        ? s.expenses.map((e) => (e.id === expense.id ? expense : e))
        : [...s.expenses, expense],
    }));
    setEditingId(null);
  };

  const deleteExpense = (id: string) => {
    setState((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
    if (editingId === id) setEditingId(null);
  };

  // Everything is persisted, so without this the only way to clear old data is
  // through devtools. Confirmed first, since there is no undo.
  const startOver = () => {
    if (!window.confirm('Remove everyone and every expense? This cannot be undone.')) return;
    setState(emptyState);
    setEditingId(null);
  };

  const editing = state.expenses.find((e) => e.id === editingId) ?? null;
  const hasData = state.people.length > 0 || state.expenses.length > 0;

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <svg className="mark" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
            <path d="M20 3a17 17 0 0 1 0 34Z" fill="currentColor" opacity="0.9" />
            <path d="M20 3a17 17 0 0 0 0 34Z" fill="currentColor" opacity="0.3" />
          </svg>
          <div>
            <h1>Expense Splitter</h1>
            <p className="tagline">
              Add your group, log your costs, and find out exactly who owes whom
            </p>
          </div>
        </div>
        <span className="currency-pill">LKR</span>
      </header>

      <div className="grid-2">
        <div>
          <PeoplePanel
            people={state.people}
            referencedIds={referencedIds}
            canStartOver={hasData}
            onAdd={addPerson}
            onRemove={removePerson}
            onStartOver={startOver}
          />
          <ExpenseForm
            people={state.people}
            editing={editing}
            editRequest={editRequest}
            onSave={saveExpense}
            onCancelEdit={() => setEditingId(null)}
          />
        </div>

        <div>
          <BalancesPanel people={state.people} net={net} />
          <SettleUpPanel people={state.people} transfers={transfers} />
        </div>
      </div>

      <ExpenseList
        expenses={state.expenses}
        people={state.people}
        editingId={editingId}
        onEdit={(e) => {
          setEditingId(e.id);
          setEditRequest((n) => n + 1);
        }}
        onDelete={deleteExpense}
      />
    </div>
  );
}
