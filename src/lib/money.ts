/**
 * Money is represented ONLY as an integer number of cents (1/100 LKR).
 * Nothing in this app ever stores or arithmetics a rupee value as a float,
 * because 0.1 + 0.2 !== 0.3 and balances would stop reconciling to zero.
 */

/** Parse a user-typed rupee string ("1,234.5", "3333.34") into integer cents. */
export function parseRupees(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return null;

  const [whole, frac = ''] = cleaned.split('.');
  if (frac.length > 2) return null; // reject sub-cent precision rather than silently rounding it away
  const cents = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Format integer cents as a grouped rupee string: 1234567 -> "12,345.67". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

/** Same as formatCents but prefixed, for display. */
export function formatLKR(cents: number): string {
  return `Rs. ${formatCents(cents)}`;
}

/** Plain (ungrouped) rupee string, for populating editable form inputs. */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
