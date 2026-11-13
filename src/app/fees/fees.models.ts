export type Mode = 'cash' | 'upi';

/** One pending student row. Money is always in paise. */
export interface Row {
  id: string;
  name: string;
  cls: string;
  vehicle: string;
  veh: string;
  months: number;
  balance: number;
  steps: number[];
  since: string;
}

/** Read-only fee statement for one student (parent view). */
export interface Statement {
  name: string;
  balance: number;
  rows: { per: string; amt: number; paid: number }[];
}

/** One line of the payments ledger. A reversal is its own row; the original is never edited. */
export interface LedgerRow {
  id: string;
  student: string;
  kind: 'payment' | 'reversal';
  amount: number;
  mode: string;
  paid_on: string;
  note: string;
  reversed: boolean;
}

export interface PlanRow {
  id: string;
  veh: string;
  amount: number;
  effective_from: string;
}

export interface RemindResult {
  sent: number;
  skipped: number;
  failed: number;
}
