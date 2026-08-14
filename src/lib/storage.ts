import type { AppState } from './types';

/**
 * Persistence is localStorage, on purpose. The brief asks for a single-session
 * tool with no accounts, so a server and a database would be infrastructure
 * spent on nothing. localStorage survives a refresh, needs no setup from
 * whoever runs this, and keeps the interesting code in the split logic.
 *
 * The key is versioned so that a future change to the shape of AppState can
 * simply start on a new key instead of crashing on old data.
 */
const STORAGE_KEY = 'expense-splitter:v1';

export const emptyState: AppState = { people: [], expenses: [] };

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;

    const parsed = JSON.parse(raw) as AppState;
    // Anything hand-edited or left over from an older build is discarded rather
    // than half-loaded - a partially valid ledger is worse than an empty one.
    if (!Array.isArray(parsed?.people) || !Array.isArray(parsed?.expenses)) return emptyState;
    return parsed;
  } catch {
    return emptyState;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private-browsing mode and full quotas both throw here. The app stays
    // usable in memory; only persistence is lost, so this is not worth
    // interrupting the user over.
  }
}

/** Stable unique ids so expenses can reference people across reloads. */
export function newId(): string {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
