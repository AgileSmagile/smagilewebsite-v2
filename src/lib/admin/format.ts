/** Shared formatting and display utilities for admin lead pages. */

/** Format a day rate range for display. */
export function formatRate(min: number | null, max: number | null): string {
  if (!min && !max) return 'Not stated';
  if (min && max && min !== max) return `\u00a3${min}-\u00a3${max}/day`;
  return `\u00a3${min || max}/day`;
}

/** Format a date string for compact display (e.g. "14 Mar"). */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Format a date string with year (e.g. "14 Mar 2026"). */
export function formatDateWithYear(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format a currency value in GBP (e.g. "£1,234"). */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Return a text colour class for an invoice status. */
export function invoiceStatusColour(status: string): string {
  switch (status) {
    case 'Paid':
      return 'text-green-400';
    case 'Overdue':
      return 'text-red-400';
    case 'Open':
    case 'Sent':
      return 'text-yellow-400';
    case 'Draft':
      return 'text-grey-500';
    default:
      return 'text-warm-300';
  }
}

/** Return a text colour class based on match score. */
export function scoreColour(score: number | null): string {
  if (!score) return 'text-grey-500';
  if (score >= 60) return 'text-green-400';
  if (score >= 30) return 'text-amber-400';
  return 'text-grey-500';
}

/** Return a background colour class based on match score. */
export function scoreBg(score: number | null): string {
  if (!score) return 'bg-grey-700/30';
  if (score >= 60) return 'bg-green-500/20';
  if (score >= 30) return 'bg-amber-500/20';
  return 'bg-grey-700/30';
}
