export interface Person {
  id: string;
  name: string;
}

export type SplitMode = 'equal' | 'exact';

export interface Expense {
  id: string;
  description: string;
  /** Integer cents. Always equals the sum of the computed shares. */
  amountCents: number;
  payerId: string;
  /** Everyone this expense is split between (the payer need not be included). */
  participantIds: string[];
  mode: SplitMode;
  /** Only used when mode === 'exact': participantId -> integer cents. */
  exactShares: Record<string, number>;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amountCents: number;
}

export interface AppState {
  people: Person[];
  expenses: Expense[];
}
