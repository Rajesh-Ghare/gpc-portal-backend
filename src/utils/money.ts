/**
 * Prices are stored as DECIMAL major units ("25.00" rupees). Providers and
 * comparisons use integer minor units (2500 paise) — never compare floats.
 */
export function toMinorUnits(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

export function fromMinorUnits(minor: string | number): number {
  return Number(minor) / 100;
}
