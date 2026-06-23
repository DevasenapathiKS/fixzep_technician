/** Whole rupees for technician pay display (en-IN grouping). */
export function formatInr(n: number): string {
  try {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}
